import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { Code } from "@phosphor-icons/react/dist/ssr/Code"
import { Megaphone } from "@phosphor-icons/react/dist/ssr/Megaphone"
import { PaintBrush } from "@phosphor-icons/react/dist/ssr/PaintBrush"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"

export const metadata: Metadata = {
  title: "Skills - PMS",
}

const SKILL_CATEGORIES = [
  {
    name: "Engineering",
    icon: Code,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    count: 6,
    description: "Code review, GitHub integration, performance auditing and more.",
  },
  {
    name: "Marketing",
    icon: Megaphone,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    count: 12,
    description: "SEO, content strategy, ad creative, social content and campaigns.",
  },
  {
    name: "Design",
    icon: PaintBrush,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    count: 4,
    description: "Frontend design, UI/UX guidelines and design systems.",
  },
  {
    name: "Productivity",
    icon: Lightning,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    count: 3,
    description: "Weather, summarization, brainstorming and general tasks.",
  },
]

export default function SkillsPage() {
  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Skills"
        actions={
          <Link href="/skills/marketplace">
            <Button variant="ghost" size="sm">
              Browse Marketplace
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        {/* Category Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SKILL_CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <Link key={cat.name} href={`/skills/marketplace?category=${cat.name.toLowerCase()}`}>
                <Card className="h-full hover:border-primary/30 transition-colors cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className={`w-10 h-10 rounded-lg ${cat.bg} flex items-center justify-center mb-2`}>
                      <Icon className={`h-5 w-5 ${cat.color}`} />
                    </div>
                    <CardTitle className="text-base">{cat.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit text-xs">
                      {cat.count} skills
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Getting Started with Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Skills are modular AI capabilities you can install on your agents. Browse the marketplace
              to find skills that match your team&apos;s workflow, then assign them to specific agents.
            </p>
            <div className="flex gap-2">
              <Link href="/skills/marketplace">
                <Button variant="outline" size="sm">
                  Browse All Skills
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
              <Link href="/agents">
                <Button variant="ghost" size="sm">View Agents</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
