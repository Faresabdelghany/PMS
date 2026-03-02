"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getTokenUsageSummary,
  getTokenUsageByAgent,
  getTokenUsageByModel,
  getTokenUsageTrend,
  getRecentTokenUsage,
} from "@/lib/actions/token-usage"
import type {
  TokenUsageSummary,
  TokenUsageByAgent,
  TokenUsageByModel,
  TokenUsageTrendEntry,
  TokenUsageLogWithAgent,
} from "@/lib/actions/token-usage"

// ── Constants ──────────────────────────────────────────────────────────

type TimeRange = "1d" | "7d" | "30d"

const RANGE_LABELS: Record<TimeRange, string> = {
  "1d": "24h",
  "7d": "7 days",
  "30d": "30 days",
}

const RANGE_DAYS: Record<TimeRange, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

// ── Formatters ─────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Chart Tooltip ──────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; name?: string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">
            {entry.name === "Cost"
              ? currencyFormatter.format(entry.value ?? 0)
              : formatTokenCount(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────

function CostDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Range tabs skeleton */}
      <Skeleton className="h-10 w-64 rounded-lg" />

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

interface CostDashboardClientProps {
  orgId: string
}

export function CostDashboardClient({ orgId }: CostDashboardClientProps) {
  const [range, setRange] = useState<TimeRange>("7d")
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null)
  const [byAgent, setByAgent] = useState<TokenUsageByAgent[]>([])
  const [byModel, setByModel] = useState<TokenUsageByModel[]>([])
  const [trend, setTrend] = useState<TokenUsageTrendEntry[]>([])
  const [recentUsage, setRecentUsage] = useState<TokenUsageLogWithAgent[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(
    async (selectedRange: TimeRange) => {
      setLoading(true)
      setError(null)

      try {
        const [summaryRes, agentRes, modelRes, trendRes, recentRes] = await Promise.all([
          getTokenUsageSummary(orgId, selectedRange),
          getTokenUsageByAgent(orgId, selectedRange),
          getTokenUsageByModel(orgId, selectedRange),
          getTokenUsageTrend(orgId, selectedRange, "daily"),
          getRecentTokenUsage(orgId, 20),
        ])

        if (summaryRes.error) throw new Error(summaryRes.error)
        if (agentRes.error) throw new Error(agentRes.error)
        if (modelRes.error) throw new Error(modelRes.error)
        if (trendRes.error) throw new Error(trendRes.error)
        if (recentRes.error) throw new Error(recentRes.error)

        setSummary(summaryRes.data ?? null)
        setByAgent(agentRes.data ?? [])
        setByModel(modelRes.data ?? [])
        setTrend(trendRes.data ?? [])
        setRecentUsage(recentRes.data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load token usage data")
      } finally {
        setLoading(false)
      }
    },
    [orgId]
  )

  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  if (loading) {
    return <CostDashboardSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => fetchData(range)}
              className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isEmpty =
    !summary || (summary.totalCostUsd === 0 && summary.entryCount === 0)

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <RangeSelector range={range} onRangeChange={setRange} />
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                No token usage data recorded yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Token usage will appear here once agents start processing tasks.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const burnRate = summary
    ? summary.totalCostUsd / RANGE_DAYS[range]
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Range selector */}
      <RangeSelector range={range} onRangeChange={setRange} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Cost"
          value={currencyFormatter.format(summary?.totalCostUsd ?? 0)}
        />
        <SummaryCard
          title="Input Tokens"
          value={formatTokenCount(summary?.totalInputTokens ?? 0)}
        />
        <SummaryCard
          title="Output Tokens"
          value={formatTokenCount(summary?.totalOutputTokens ?? 0)}
        />
        <SummaryCard
          title="Burn Rate"
          value={`~${currencyFormatter.format(burnRate)} / day`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostByAgentChart data={byAgent.slice(0, 10)} />
        <CostByModelChart data={byModel} />
      </div>

      {/* Trend chart — full width */}
      <CostTrendChart data={trend} />

      {/* Recent usage table */}
      <RecentUsageTable data={recentUsage} />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

function RangeSelector({
  range,
  onRangeChange,
}: {
  range: TimeRange
  onRangeChange: (r: TimeRange) => void
}) {
  return (
    <Tabs
      value={range}
      onValueChange={(v) => onRangeChange(v as TimeRange)}
    >
      <TabsList>
        {(Object.keys(RANGE_LABELS) as TimeRange[]).map((key) => (
          <TabsTrigger key={key} value={key}>
            {RANGE_LABELS[key]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

function CostByAgentChart({ data }: { data: TokenUsageByAgent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cost by Agent</CardTitle>
        <CardDescription>Top agents by total cost</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No agent cost data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 8, bottom: 0 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => currencyFormatter.format(v)}
                />
                <YAxis
                  type="category"
                  dataKey="agent_name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  width={90}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="total_cost_usd"
                  name="Cost"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CostByModelChart({ data }: { data: TokenUsageByModel[] }) {
  const total = data.reduce((sum, d) => sum + d.total_cost_usd, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cost by Model</CardTitle>
        <CardDescription>Cost distribution across models</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {total === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No model cost data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="total_cost_usd"
                  nameKey="model"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        {total > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            {data.map((d, i) => (
              <div
                key={`${d.provider}-${d.model}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                <span className="text-muted-foreground">{d.model}</span>
                <span className="font-medium">
                  {currencyFormatter.format(d.total_cost_usd)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CostTrendChart({ data }: { data: TokenUsageTrendEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cost Trend</CardTitle>
        <CardDescription>Daily cost over the selected range</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No trend data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  width={48}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Cost"
                  fill="var(--chart-2)"
                  stroke="var(--chart-2)"
                  fillOpacity={0.4}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentUsageTable({ data }: { data: TokenUsageLogWithAgent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Usage</CardTitle>
        <CardDescription>Last 20 token usage entries</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No recent usage entries
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">
                    Time
                  </th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">
                    Agent
                  </th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">
                    Model
                  </th>
                  <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">
                    Input
                  </th>
                  <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">
                    Output
                  </th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(entry.created_at)}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {entry.agent?.name ?? "Unknown"}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">
                      {entry.model}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {formatTokenCount(entry.input_tokens)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {formatTokenCount(entry.output_tokens)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium">
                      {currencyFormatter.format(entry.cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
