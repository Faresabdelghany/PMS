import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getDashboardKPIs, getDailyCompletions, getTaskStatusDistribution } from "@/lib/actions/dashboard"
import { getPendingApprovalsCount } from "@/lib/actions/approvals"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CompletionsBarChart, StatusAreaChart } from "@/components/dashboard"
import { StatCardSkeleton } from "@/components/skeletons"
import { Folders } from "@phosphor-icons/react/dist/ssr/Folders"
import { ListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { ClipboardText } from "@phosphor-icons/react/dist/ssr/ClipboardText"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"
import { GatewayStatusCard } from "@/components/dashboard/gateway-status-card"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Dashboard - PMS",
}

export default async function Page() {
  const { orgId } = await getPageOrganization()

  const kpisPromise = getDashboardKPIs(orgId)
  const completionsPromise = getDailyCompletions(orgId)
  const distributionPromise = getTaskStatusDistribution(orgId)
  const pendingApprovalsPromise = getPendingApprovalsCount(orgId).catch(() => ({ data: 0 }))

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your projects, tasks, and team activity
        </p>
      </div>

      {/* KPI Cards */}
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <KPICards kpisPromise={kpisPromise} />
      </Suspense>

      {/* Mission Control Cards */}
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        }
      >
        <MissionControlCards pendingApprovalsPromise={pendingApprovalsPromise} />
      </Suspense>

      {/* Charts */}
      <Suspense
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="h-[340px]" /></Card>
            <Card><CardContent className="h-[340px]" /></Card>
          </div>
        }
      >
        <Charts
          completionsPromise={completionsPromise}
          distributionPromise={distributionPromise}
        />
      </Suspense>
    </div>
  )
}

async function KPICards({
  kpisPromise,
}: {
  kpisPromise: ReturnType<typeof getDashboardKPIs>
}) {
  const kpis = await kpisPromise

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          <Folders className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalProjects}</div>
          <p className="text-xs text-muted-foreground">Across your organization</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
          <ListChecks className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.activeTasks}</div>
          <p className="text-xs text-muted-foreground">Tasks not yet completed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          <Robot className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.activeAgents}</div>
          <p className="text-xs text-muted-foreground">Agents currently online</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed This Week</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.completedThisWeek}</div>
          <p className="text-xs text-muted-foreground">Tasks done in the last 7 days</p>
        </CardContent>
      </Card>
    </div>
  )
}

async function Charts({
  completionsPromise,
  distributionPromise,
}: {
  completionsPromise: ReturnType<typeof getDailyCompletions>
  distributionPromise: ReturnType<typeof getTaskStatusDistribution>
}) {
  const [completions, distribution] = await Promise.all([
    completionsPromise,
    distributionPromise,
  ])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompletionsBarChart data={completions} />
      <StatusAreaChart data={distribution} />
    </div>
  )
}

async function MissionControlCards({
  pendingApprovalsPromise,
}: {
  pendingApprovalsPromise: Promise<{ data?: number }>
}) {
  const pendingResult = await pendingApprovalsPromise
  const pendingCount = pendingResult.data ?? 0

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Pending Approvals Card */}
      <Link href="/approvals?status=pending">
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <ClipboardText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              {pendingCount === 0
                ? "All caught up!"
                : `${pendingCount} request${pendingCount === 1 ? "" : "s"} awaiting review`}
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Gateway Status Card */}
      <GatewayStatusCard />
    </div>
  )
}
