"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { Code } from "@phosphor-icons/react/dist/ssr/Code"
import { Megaphone } from "@phosphor-icons/react/dist/ssr/Megaphone"
import { PaintBrush } from "@phosphor-icons/react/dist/ssr/PaintBrush"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"

type Skill = {
  id: string
  name: string
  category: "Engineering" | "Marketing" | "Design" | "Productivity"
  description: string
  installed: boolean
}

const SKILLS: Skill[] = [
  // Engineering
  { id: "coding-agent", name: "coding-agent", category: "Engineering", description: "Full-stack code generation, refactoring, and debugging assistant.", installed: false },
  { id: "gh-issues", name: "gh-issues", category: "Engineering", description: "Automated GitHub issue creation, labeling, and triage from agent tasks.", installed: false },
  { id: "github", name: "github", category: "Engineering", description: "GitHub integration for PRs, repos, and workflows.", installed: false },
  { id: "healthcheck", name: "healthcheck", category: "Engineering", description: "Monitor service health endpoints and report anomalies.", installed: true },
  { id: "skill-creator", name: "skill-creator", category: "Engineering", description: "Generate new skills from natural language descriptions.", installed: false },
  { id: "perf-audit", name: "perf-audit", category: "Engineering", description: "Lighthouse-based performance auditing and optimization suggestions.", installed: false },
  // Marketing
  { id: "ad-creative", name: "ad-creative", category: "Marketing", description: "Generate ad copy and creative briefs for campaigns.", installed: false },
  { id: "ai-seo", name: "ai-seo", category: "Marketing", description: "AI-driven SEO keyword research and content optimization.", installed: false },
  { id: "analytics-tracking", name: "analytics-tracking", category: "Marketing", description: "Set up analytics tracking plans and event schemas.", installed: false },
  { id: "cold-email", name: "cold-email", category: "Marketing", description: "Personalized cold email sequences with A/B variants.", installed: false },
  { id: "content-strategy", name: "content-strategy", category: "Marketing", description: "Build content calendars and editorial strategy frameworks.", installed: true },
  { id: "copywriting", name: "copywriting", category: "Marketing", description: "Persuasive copywriting for landing pages, emails, and ads.", installed: false },
  { id: "email-sequence", name: "email-sequence", category: "Marketing", description: "Multi-step email drip campaigns with conditional logic.", installed: false },
  { id: "launch-strategy", name: "launch-strategy", category: "Marketing", description: "Product launch planning, timelines, and go-to-market strategy.", installed: false },
  { id: "marketing-ideas", name: "marketing-ideas", category: "Marketing", description: "Rapid ideation for campaigns, channels, and positioning.", installed: false },
  { id: "paid-ads", name: "paid-ads", category: "Marketing", description: "Google and Meta ad creation, targeting, and budget recommendations.", installed: false },
  { id: "seo-audit", name: "seo-audit", category: "Marketing", description: "Technical and on-page SEO audit with actionable fixes.", installed: false },
  { id: "social-content", name: "social-content", category: "Marketing", description: "Social media content creation for Twitter, LinkedIn, Instagram.", installed: false },
  // Design
  { id: "frontend-design", name: "frontend-design", category: "Design", description: "Component design, responsive layouts, and CSS architecture.", installed: false },
  { id: "ui-ux-pro-max", name: "ui-ux-pro-max", category: "Design", description: "Advanced UX research, wireframing, and usability recommendations.", installed: true },
  { id: "web-design-guidelines", name: "web-design-guidelines", category: "Design", description: "Create and enforce web design guidelines and style systems.", installed: false },
  { id: "nano-banana-pro", name: "nano-banana-pro", category: "Design", description: "Micro-interaction design and motion/animation guidelines.", installed: false },
  // Productivity
  { id: "weather", name: "weather", category: "Productivity", description: "Real-time weather data and forecasts for location-aware tasks.", installed: true },
  { id: "summarize", name: "summarize", category: "Productivity", description: "Summarize documents, threads, and meetings into key points.", installed: false },
  { id: "brainstorming", name: "brainstorming", category: "Productivity", description: "Structured brainstorming with ideation frameworks and mind maps.", installed: false },
]

const CATEGORIES = ["All", "Engineering", "Marketing", "Design", "Productivity"] as const
type CategoryFilter = (typeof CATEGORIES)[number]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Engineering: Code,
  Marketing: Megaphone,
  Design: PaintBrush,
  Productivity: Lightning,
}

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "text-blue-500",
  Marketing: "text-purple-500",
  Design: "text-pink-500",
  Productivity: "text-amber-500",
}

export default function SkillsMarketplacePage() {
  const [skills, setSkills] = useState<Skill[]>(SKILLS)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<CategoryFilter>("All")

  const filtered = skills.filter((s) => {
    const matchesCategory = category === "All" || s.category === category
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleInstall = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, installed: !s.installed } : s))
    )
  }

  const installedCount = skills.filter((s) => s.installed).length

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Sparkle className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skills Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            {installedCount} of {skills.length} skills installed
          </p>
        </div>
      </div>

      {/* Search + Category Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat)}
              className="h-8"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No skills match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((skill) => {
            const Icon = CATEGORY_ICONS[skill.category]
            const colorClass = CATEGORY_COLORS[skill.category]

            return (
              <Card key={skill.id} className={`flex flex-col ${skill.installed ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    {Icon && <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${colorClass}`} />}
                    {skill.installed && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0">
                        <Check className="h-3 w-3 mr-1" />
                        Installed
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm font-semibold font-mono">{skill.name}</CardTitle>
                  <Badge variant="secondary" className="w-fit text-xs">{skill.category}</Badge>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={skill.installed ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={() => toggleInstall(skill.id)}
                  >
                    {skill.installed ? "Uninstall" : "Install"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
