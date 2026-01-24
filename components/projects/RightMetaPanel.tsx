import { TimeCard } from "@/components/projects/TimeCard"
import { BacklogCard } from "@/components/projects/BacklogCard"
import { QuickLinksCard } from "@/components/projects/QuickLinksCard"
import { Separator } from "@/components/ui/separator"
import { ClientCard } from "@/components/projects/ClientCard"

type RightMetaPanelClient = {
  id: string
  name: string
  industry?: string | null
  location?: string | null
  website?: string | null
}

type RightMetaPanelProps = {
  time: {
    estimateLabel: string
    dueDate: Date | null
    daysRemainingLabel: string
    progressPercent: number
  }
  backlog: {
    statusLabel: string
    groupLabel: string
    priorityLabel: string
    labelBadge: string
    picUsers: { id: string; name: string; avatarUrl?: string }[]
    supportUsers?: { id: string; name: string; avatarUrl?: string }[]
  }
  quickLinks?: { id: string; label: string; url: string; iconType: string }[]
  client?: RightMetaPanelClient | null
}

export function RightMetaPanel({ time, backlog, quickLinks, client }: RightMetaPanelProps) {
  return (
    <aside className="flex flex-col gap-10 p-4 pt-8 lg:sticky lg:self-start">
      <TimeCard time={time} />
      <Separator />
      <BacklogCard backlog={backlog} />
      {client && (
        <>
          <Separator />
          <ClientCard client={client} />
        </>
      )}
      <Separator />
      <QuickLinksCard links={quickLinks} />
    </aside>
  )
}
