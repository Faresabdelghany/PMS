import { getCachedProjectCount } from "@/lib/server-cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderKanban } from "lucide-react"

export async function ProjectCountCard({ orgId }: { orgId: string }) {
  const counts = await getCachedProjectCount(orgId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Projects</CardTitle>
        <FolderKanban className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{counts.total}</div>
        <p className="text-xs text-muted-foreground">
          {counts.active} active, {counts.completed} completed
        </p>
      </CardContent>
    </Card>
  )
}
