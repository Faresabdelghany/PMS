"use client"

import { useState, useMemo, memo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CaretUpDown } from "@phosphor-icons/react/dist/ssr/CaretUpDown"
import { ArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown"
import { ArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp"
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentWithSupervisor, AgentStatus } from "@/lib/supabase/types"

// ── Status badge styling (matches client pattern) ────────────────────

const statusBadgeConfig: Record<AgentStatus, { label: string; badge: string; dot: string }> = {
  online: {
    label: "Online",
    badge: "bg-teal-50 text-teal-700 border-transparent dark:bg-teal-500/15 dark:text-teal-100",
    dot: "bg-teal-600 dark:bg-teal-300",
  },
  busy: {
    label: "Busy",
    badge: "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-100",
    dot: "bg-amber-600 dark:bg-amber-300",
  },
  idle: {
    label: "Idle",
    badge: "bg-blue-50 text-blue-700 border-transparent dark:bg-blue-500/15 dark:text-blue-100",
    dot: "bg-blue-500 dark:bg-blue-300",
  },
  offline: {
    label: "Offline",
    badge: "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-600/30 dark:text-slate-200",
    dot: "bg-slate-500 dark:bg-slate-300",
  },
}

const statusDotLive: Record<AgentStatus, string> = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  idle: "bg-blue-400",
  offline: "bg-zinc-400",
}

const TYPE_BADGE: Record<string, string> = {
  supreme: "bg-purple-50 text-purple-700 border-transparent dark:bg-purple-500/15 dark:text-purple-100",
  lead: "bg-indigo-50 text-indigo-700 border-transparent dark:bg-indigo-500/15 dark:text-indigo-100",
  specialist: "bg-sky-50 text-sky-700 border-transparent dark:bg-sky-500/15 dark:text-sky-100",
  integration: "bg-teal-50 text-teal-700 border-transparent dark:bg-teal-500/15 dark:text-teal-100",
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = statusBadgeConfig[status]
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        config.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  )
}

type SortField = "name" | "role" | "status" | "squad" | "agent_type"
type SortDir = "asc" | "desc"

// ── Memoized table row ───────────────────────────────────────────────

const AgentTableRow = memo(function AgentTableRow({
  agent,
  onQuickView,
  onEdit,
}: {
  agent: AgentWithSupervisor
  onQuickView: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <TableRow className="hover:bg-muted/80 [content-visibility:auto] [contain-intrinsic-size:auto_56px]">
      <TableCell
        className="align-middle text-sm font-medium text-foreground cursor-pointer"
        onClick={() => onQuickView(agent.id)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-medium bg-muted">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                statusDotLive[agent.status]
              )}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate">{agent.name}</span>
            {(agent as any).current_task_id ? (
              <span className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Working on task
              </span>
            ) : (
              <span className="mt-0.5 text-[11px] text-muted-foreground truncate">
                {agent.supervisor?.name ? `→ ${agent.supervisor.name}` : "—"}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="align-middle text-sm text-muted-foreground truncate">
        {agent.role}
      </TableCell>
      <TableCell className="align-middle">
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
            TYPE_BADGE[agent.agent_type] || ""
          )}
        >
          {agent.agent_type}
        </Badge>
      </TableCell>
      <TableCell className="align-middle">
        <Badge
          variant="outline"
          className="rounded-full border-transparent bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize"
        >
          {agent.squad}
        </Badge>
      </TableCell>
      <TableCell className="align-middle">
        <AgentStatusBadge status={agent.status} />
      </TableCell>
      <TableCell className="align-middle text-xs text-muted-foreground font-mono truncate">
        {agent.ai_model || "—"}
      </TableCell>
      <TableCell className="align-middle text-xs text-muted-foreground font-mono truncate">
        {(agent as any).session_key || "—"}
      </TableCell>
      <TableCell className="align-middle text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`Actions for ${agent.name}`}
            >
              <DotsThreeVertical className="h-4 w-4" weight="regular" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onQuickView(agent.id)}>
              Quick view
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(agent.id)}>
              Edit agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

// ── Main table component ─────────────────────────────────────────────

export function AgentsTable({
  agents,
  organizationId,
}: {
  agents: AgentWithSupervisor[]
  organizationId: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [squadFilter, setSquadFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const filtered = useMemo(() => {
    let result = agents

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q)
      )
    }

    if (squadFilter !== "all") {
      result = result.filter((a) => a.squad === squadFilter)
    }

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter)
    }

    result = [...result].sort((a, b) => {
      const aVal = (a[sortField] || "").toString().toLowerCase()
      const bVal = (b[sortField] || "").toString().toLowerCase()
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })

    return result
  }, [agents, search, squadFilter, statusFilter, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const handleQuickView = useCallback(
    (id: string) => router.push(`?view=${id}`, { scroll: false }),
    [router]
  )

  const handleEdit = useCallback(
    (id: string) => router.push(`?agent=${id}`, { scroll: false }),
    [router]
  )

  function SortButton({ field, label }: { field: SortField; label: string }) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => toggleSort(field)}
      >
        <span>{label}</span>
        {sortField === field ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <CaretUpDown className="h-3 w-3" />
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Filters */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-3 border-b border-border/40 md:flex-row md:items-center md:justify-between md:flex-wrap">
        <div className="overflow-x-auto min-w-0">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="inline-flex bg-muted rounded-full px-1 py-0.5 text-xs border border-border/50 h-8">
              {[
                { id: "all", label: "All" },
                { id: "online", label: "Online" },
                { id: "busy", label: "Busy" },
                { id: "idle", label: "Idle" },
                { id: "offline", label: "Offline" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={statusFilter} forceMount className="hidden" />
          </Tabs>
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <Select value={squadFilter} onValueChange={setSquadFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg border-border min-h-[44px] sm:min-h-0">
              <SelectValue placeholder="Squad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Squads</SelectItem>
              <SelectItem value="engineering">Engineering</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-[160px] max-w-xs relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="h-9 min-h-[44px] sm:min-h-0 rounded-lg bg-muted/50 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20 border-border border shadow-none pl-9"
            />
          </div>

          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pb-2 pt-5" style={{ contain: "content" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/60 rounded-lg bg-muted/30">
            <p className="text-sm font-medium text-foreground">No agents found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-muted">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[28%] text-xs font-medium text-muted-foreground">
                    <SortButton field="name" label="Name" />
                  </TableHead>
                  <TableHead className="w-[20%] text-xs font-medium text-muted-foreground">
                    <SortButton field="role" label="Role" />
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-medium text-muted-foreground">
                    <SortButton field="agent_type" label="Type" />
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-medium text-muted-foreground">
                    <SortButton field="squad" label="Squad" />
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-medium text-muted-foreground">
                    <SortButton field="status" label="Status" />
                  </TableHead>
                  <TableHead className="w-[10%] text-xs font-medium text-muted-foreground">
                    Model
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-medium text-muted-foreground">
                    Session
                  </TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((agent) => (
                  <AgentTableRow
                    key={agent.id}
                    agent={agent}
                    onQuickView={handleQuickView}
                    onEdit={handleEdit}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
