import { Star } from "@phosphor-icons/react/dist/ssr/Star"
import { User } from "@phosphor-icons/react/dist/ssr/User"
import { PencilSimpleLine } from "@phosphor-icons/react/dist/ssr/PencilSimpleLine"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"
import { Archive } from "@phosphor-icons/react/dist/ssr/Archive"

import type { ProjectDetails } from "@/lib/data/project-details"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getProjectStatusLabel, type ProjectStatus } from "@/lib/constants/status"
import { cn } from "@/lib/utils"

const STATUS_BADGE_STYLES: Record<ProjectStatus, { bg: string; text: string; icon: typeof Star }> = {
  backlog: { bg: "bg-orange-100", text: "text-orange-700", icon: Archive },
  planned: { bg: "bg-neutral-100", text: "text-neutral-700", icon: Clock },
  active: { bg: "bg-blue-100", text: "text-blue-700", icon: Star },
  completed: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  cancelled: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
}

type ProjectHeaderProps = {
  project: ProjectDetails
  status?: ProjectStatus
  onEditProject?: () => void
}

export function ProjectHeader({ project, status = "planned", onEditProject }: ProjectHeaderProps) {
  const statusStyle = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.planned
  const StatusIcon = statusStyle.icon

  return (
    <section className="mt-4 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-foreground leading-tight">{project.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn("border-none flex items-center gap-1", statusStyle.bg, statusStyle.text)}>
              <StatusIcon className="h-3 w-3" />
              {getProjectStatusLabel(status)}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 text-orange-800 bg-orange-100 border-none">
              <User className="h-3 w-3" />
              Assigned to me
            </Badge>
          </div>
        </div>

        {onEditProject && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit project"
            className="rounded-lg text-muted-foreground hover:text-foreground"
            onClick={onEditProject}
          >
            <PencilSimpleLine className="h-4 w-4" />
          </Button>
        )}
      </div>
    </section>
  )
}
