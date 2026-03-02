import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import {
  getDashboardKPIs,
  getDailyCompletions,
  getTaskStatusDistribution,
  getTaskPriorityBreakdown,
  getAgentWorkload,
  getAgentActivityTimeline,
} from "@/lib/actions/dashboard"
import { getPendingApprovalsCount } from "@/lib/actions/approvals"
import { getStatusBarCounts } from "@/lib/actions/agents"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CompletionsBarChart,
  StatusAreaChart,
  PriorityPieChart,
  AgentWorkloadChart,
  AgentActivityChart,
} from "@/components/dashboard"
import { StatCardSkeleton } from "@/components/skeletons"
import { Folders } from "@phosphor-icons/react/dist/ssr/Folders"
import { ListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { ClipboardText } from "@phosphor-icons/react/dist/ssr/ClipboardText"
import { Timer } from "@phosphor-icons/react/dist/ssr/Timer"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning"
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
  const priorityPromise = getTaskPriorityBreakdown(orgId)
  const agentWorkloadPromise = getAgentWorkload(orgId)
  const agentActivityPromise = getAgentActivityTimeline(orgId)
  const pendingApprovalsPromise = getPendingApprovalsCount(orgId).catch(() => ({ data: 0 }))
  const opsCountsPromise = getStatusBarCounts(orgId).catch(() => ({ data: null }))

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

      {/* Operations Status */}
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <OperationsStatusCards opsCountsPromise={opsCountsPromise} pendingApprovalsPromise={pendingApprovalsPromise} orgId={orgId} />
      </Suspense>

      {/* Charts Row 1: Completions + Status Distribution */}
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

      {/* Charts Row 2: Priority + Agent Workload */}
      <Suspense
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="h-[340px]" /></Card>
            <Card><CardContent className="h-[340px]" /></Card>
          </div>
        }
      >
        <AnalyticsCharts
          priorityPromise={priorityPromise}
          agentWorkloadPromise={agentWorkloadPromise}
          agentActivityPromise={agentActivityPromise}
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

async function AnalyticsCharts({
  priorityPromise,
  agentWorkloadPromise,
  agentActivityPromise,
}: {
  priorityPromise: ReturnType<typeof getTaskPriorityBreakdown>
  agentWorkloadPromise: ReturnType<typeof getAgentWorkload>
  agentActivityPromise: ReturnType<typeof getAgentActivityTimeline>
}) {
  const [priority, agentWorkload, agentActivity] = await Promise.all([
    priorityPromise,
    agentWorkloadPromise,
    agentActivityPromise,
  ])

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <PriorityPieChart data={priority} />
        <AgentWorkloadChart data={agentWorkload} />
      </div>
      <div className="grid gap-4 lg:grid-cols-1">
        <AgentActivityChart data={agentActivity} />
      </div>
    </>
  )
}

async function OperationsStatusCards({
  opsCountsPromise,
  pendingApprovalsPromise,
  orgId,
}: {
  opsCountsPromise: Promise<{ data?: { onlineAgents: number; totalAgents: number; activeSessions: number } | null }>
  pendingApprovalsPromise: Promise<{ data?: number }>
  orgId: string
}) {
  const [opsResult, pendingResult] = await Promise.all([opsCountsPromise, pendingApprovalsPromise])
  const ops = opsResult.data
  const pendingCount = pendingResult.data ?? 0

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Mission Control</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Agents Online */}
        <Link href="/agents">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agents Online</CardTitle>
              <Robot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ops ? `${ops.onlineAgents}/${ops.totalAgents}` : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {ops && ops.onlineAgents === 0 ? "No agents connected" : "Active agents"}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Active Sessions */}
        <Link href="/sessions">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ops?.activeSessions ?? 0}</div>
              <p className="text-xs text-muted-foreground">Running agent sessions</p>
            </CardContent>
          </Card>
        </Link>

        {/* Pending Approvals */}
        <Link href="/approvals?status=pending">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <ClipboardText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">
                {pendingCount === 0 ? "All caught up!" : `${pendingCount} awaiting review`}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Gateway Status */}
        <GatewayStatusCard orgId={orgId} />
      </div>
    </div>
  )
}
