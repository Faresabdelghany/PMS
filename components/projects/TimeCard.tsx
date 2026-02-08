import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"

import { Progress } from "@/components/ui/progress"
import { StatRow } from "@/components/projects/StatRow"

type TimeCardProps = {
  time: {
    estimateLabel: string
    dueDate: Date | null
    daysRemainingLabel: string
    progressPercent: number
  }
}

export function TimeCard({ time }: TimeCardProps) {
  const dueDateLabel = time.dueDate
    ? time.dueDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : "Not set"

  return (
    <div>
      <div className="pb-6">
        <div className="text-base font-medium">Time</div>
      </div>
      <div className="space-y-6">
        <StatRow label="Estimate" value={<span className="px-2">{time.estimateLabel}</span>} icon={<Clock className="h-4 w-4" />} />
        <StatRow
          label="Due Date"
          value={<span className="px-2">{dueDateLabel}</span>}
          icon={<CalendarBlank className="h-4 w-4" />}
        />

        <div className="pt-1">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Days remaining</span>
            <span>{time.daysRemainingLabel}</span>
          </div>
          <Progress className="mt-3 h-1.5 bg-accent [&>div]:bg-gradient-to-r [&>div]:from-blue-200 [&>div]:to-blue-800" value={time.progressPercent} />
        </div>
      </div>
    </div>
  )
}
