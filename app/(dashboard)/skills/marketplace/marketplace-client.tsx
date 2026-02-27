"use client"

import { useState, useTransition, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { Code } from "@phosphor-icons/react/dist/ssr/Code"
import { Megaphone } from "@phosphor-icons/react/dist/ssr/Megaphone"
import { PaintBrush } from "@phosphor-icons/react/dist/ssr/PaintBrush"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import Link from "next/link"
import { updateSkill, upsertSkill } from "@/lib/actions/skills"
import type { Skill } from "@/lib/actions/skills"

const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  development: Code,
  communication: Megaphone,
  filesystem: PaintBrush,
  automation: Lightning,
}

const CATEGORY_COLORS: Record<string, string> = {
  development: "text-blue-500",
  research: "text-purple-500",
  filesystem: "text-pink-500",
  automation: "text-amber-500",
  communication: "text-green-500",
  data: "text-cyan-500",
  nodes: "text-orange-500",
  media: "text-violet-500",
}

interface SkillsMarketplaceClientProps {
  initialSkills: Skill[]
  initialCategory?: string
  degraded?: boolean
}

export function SkillsMarketplaceClient({
  initialSkills,
  initialCategory,
  degraded,
}: SkillsMarketplaceClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [skills, setSkills] = useState<Skill[]>(initialSkills)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>(initialCategory ?? "All")
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Derive unique categories from the skills list
  const availableCategories = Array.from(
    new Set(["All", ...skills.map((s) => s.category).filter(Boolean)])
  ) as string[]

  const filtered = skills.filter((s) => {
    const matchesCategory = category === "All" || s.category === category
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleInstall = (skill: Skill) => {
    setTogglingId(skill.id)
    startTransition(async () => {
      const installing = !skill.installed

      const result = skill.id.startsWith("catalog-")
        ? await upsertSkill(skill.org_id, {
            name: skill.name,
            description: skill.description,
            category: skill.category,
            version: skill.version,
            author: skill.author,
            installed: installing,
            enabled: skill.enabled,
            config: skill.config,
          })
        : await updateSkill(skill.id, { installed: installing })

      if (result.error) {
        toast.error(result.error)
        setTogglingId(null)
        return
      }

      toast.success(skill.installed ? `Uninstalled ${skill.name}` : `Installed ${skill.name}`)

      setSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id
            ? {
                ...s,
                id: result.data?.id ?? s.id,
                installed: installing,
              }
            : s
        )
      )

      setTogglingId(null)
      router.refresh()
    })
  }

  const installedCount = skills.filter((s) => s.installed).length

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Skills Marketplace"
        actions={
          <Link href="/skills">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Skills
            </Button>
          </Link>
        }
      >
        {/* Filter bar in the secondary row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills..."
              className="pl-9 h-8"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {availableCategories.map((cat) => (
              <Button
                key={cat}
                variant={category === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(cat)}
                className="h-7 capitalize"
              >
                {cat}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {installedCount} of {skills.length} installed
          </span>
        </div>
        {degraded && (
          <p className="text-xs text-amber-600 mt-2">
            Showing fallback catalog because gateway skill sync is currently unavailable.
          </p>
        )}
      </PageHeader>

      <div className="p-6">
        {/* Skills Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MagnifyingGlass className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No skills match your search.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((skill) => {
              const Icon = skill.category ? CATEGORY_ICONS[skill.category] : undefined
              const colorClass = skill.category ? CATEGORY_COLORS[skill.category] ?? "text-muted-foreground" : "text-muted-foreground"
              const isToggling = togglingId === skill.id

              return (
                <Card
                  key={skill.id}
                  className={`flex flex-col ${skill.installed ? "border-primary/30 bg-primary/[0.02]" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      {Icon && <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${colorClass}`} />}
                      {skill.installed && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Installed
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-sm font-semibold font-mono">{skill.name}</CardTitle>
                    {skill.category && (
                      <Badge variant="secondary" className="w-fit text-xs capitalize">
                        {skill.category}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {skill.description ?? ""}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant={skill.installed ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                      onClick={() => toggleInstall(skill)}
                      disabled={isPending || isToggling}
                    >
                      {isToggling
                        ? "Saving..."
                        : skill.installed
                        ? "Uninstall"
                        : "Install"}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
