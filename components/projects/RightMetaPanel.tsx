import { TimeCard } from "@/components/projects/TimeCard"
import { BacklogCard } from "@/components/projects/BacklogCard"
import { QuickLinksCard } from "@/components/projects/QuickLinksCard"
import { Separator } from "@/components/ui/separator"
import { ClientCard } from "@/components/projects/ClientCard"
import type { BacklogSummary, QuickLink } from "@/lib/data/project-details"
import type { Client } from "@/lib/data/clients"

// Props use the strict types from data layer
// The component transforms any compatible data to the expected format
type RightMetaPanelProps = {
  time: {
    estimateLabel: string
    dueDate: Date | null
    daysRemainingLabel: string
    progressPercent: number
  }
  backlog: BacklogSummary
  quickLinks?: QuickLink[]
  // Client can be a full Client or a partial client from the project relation
  client?: Client | { id: string; name: string } | null
}

// Helper to ensure client has all required fields
function toFullClient(client: Client | { id: string; name: string }): Client {
  if ('status' in client) {
    return client
  }
  // Default status for partial client data
  return {
    ...client,
    status: "active",
  }
}

export function RightMetaPanel({ time, backlog, quickLinks = [], client }: RightMetaPanelProps) {
  return (
    <aside className="flex flex-col gap-10 p-4 pt-8 lg:sticky lg:self-start">
      <TimeCard time={time} />
      <Separator />
      <BacklogCard backlog={backlog} />
      {client && (
        <>
          <Separator />
          <ClientCard client={toFullClient(client)} />
        </>
      )}
      <Separator />
      <QuickLinksCard links={quickLinks} />
    </aside>
  )
}
