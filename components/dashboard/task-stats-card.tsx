import { getCachedTaskStats } from "@/lib/server-cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertCircle, ListTodo } from "lucide-react"

export async function ActiveTasksCard({ orgId }: { orgId: string }) {
  const stats = await getCachedTaskStats(orgId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
        <ListTodo className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stats.total}</div>
        <p className="text-xs text-muted-foreground">
          {stats.dueToday} due today
        </p>
      </CardContent>
    </Card>
  )
}

export async function OverdueTasksCard({ orgId }: { orgId: string }) {
  const stats = await getCachedTaskStats(orgId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
        <AlertCircle className="h-4 w-4 text-destructive" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
        <p className="text-xs text-muted-foreground">Tasks past due date</p>
      </CardContent>
    </Card>
  )
}

export async function CompletedThisWeekCard({ orgId }: { orgId: string }) {
  const stats = await getCachedTaskStats(orgId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Completed</CardTitle>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-500">
          {stats.completedThisWeek}
        </div>
        <p className="text-xs text-muted-foreground">This week</p>
      </CardContent>
    </Card>
  )
}

export async function DueTodayCard({ orgId }: { orgId: string }) {
  const stats = await getCachedTaskStats(orgId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Due Today</CardTitle>
        <Clock className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-yellow-500">{stats.dueToday}</div>
        <p className="text-xs text-muted-foreground">Tasks due today</p>
      </CardContent>
    </Card>
  )
}
