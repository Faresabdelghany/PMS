import { getCachedClientCount } from "@/lib/server-cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"

export async function ClientCountCard({ orgId }: { orgId: string }) {
  const counts = await getCachedClientCount(orgId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Clients</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{counts.total}</div>
        <p className="text-xs text-muted-foreground">Total clients</p>
      </CardContent>
    </Card>
  )
}
