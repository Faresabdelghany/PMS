"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import type { AgentWithSupervisor } from "@/lib/supabase/types"

const STATUS_STYLES: Record<string, string> = {
  online: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  busy: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  idle: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  offline: "bg-red-500/10 text-red-600 dark:text-red-400",
}

const TYPE_STYLES: Record<string, string> = {
  supreme: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  lead: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  specialist: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  integration: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
}

type SortField = "name" | "role" | "status" | "squad" | "agent_type"
type SortDir = "asc" | "desc"

export function AgentsTable({
  agents,
  organizationId,
}: {
  agents: AgentWithSupervisor[]
  organizationId: string
}) {
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

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={squadFilter} onValueChange={setSquadFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Squads</SelectItem>
            <SelectItem value="engineering">Engineering</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                Name <SortIndicator field="name" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("role")}>
                Role <SortIndicator field="role" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("agent_type")}>
                Type <SortIndicator field="agent_type" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("squad")}>
                Squad <SortIndicator field="squad" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                Status <SortIndicator field="status" />
              </TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Reports To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No agents found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="text-muted-foreground">{agent.role}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={TYPE_STYLES[agent.agent_type] || ""}>
                      {agent.agent_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {agent.squad}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_STYLES[agent.status] || ""}>
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {agent.ai_model || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agent.supervisor?.name || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
