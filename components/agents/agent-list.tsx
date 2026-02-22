"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AgentCard } from "./agent-card"
import { AgentDetailPanel } from "./agent-detail-panel"
import { CreateAgentDialog } from "./create-agent-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Bot } from "lucide-react"
import type { AgentWithSupervisor, AgentSquad, AgentStatus, Agent } from "@/lib/supabase/types"

interface AgentListProps {
  initialAgents: AgentWithSupervisor[]
  organizationId: string
}

export function AgentList({ initialAgents, organizationId }: AgentListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [agents, setAgents] = useState<AgentWithSupervisor[]>(initialAgents)
  const [search, setSearch] = useState("")
  const [squadFilter, setSquadFilter] = useState<AgentSquad | "all_squads">("all_squads")
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all_statuses">("all_statuses")
  const [createOpen, setCreateOpen] = useState(false)

  // Filter agents client-side for instant feedback
  const filteredAgents = useMemo(() => {
    let result = agents
    if (squadFilter !== "all_squads") {
      result = result.filter((a) => a.squad === squadFilter)
    }
    if (statusFilter !== "all_statuses") {
      result = result.filter((a) => a.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q))
      )
    }
    return result
  }, [agents, squadFilter, statusFilter, search])

  const handleAgentClick = useCallback(
    (agentId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("agent", agentId)
      router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const handleAgentCreated = useCallback(
    (newAgent: Agent) => {
      // Add the new agent with empty supervisor (will reload on next visit)
      setAgents((prev) => [{ ...newAgent, supervisor: null } as AgentWithSupervisor, ...prev])
    },
    []
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI agents and monitor their activity.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select
          value={squadFilter}
          onValueChange={(v) => setSquadFilter(v as AgentSquad | "all_squads")}
        >
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_squads">All Squads</SelectItem>
            <SelectItem value="engineering">Engineering</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="all">All (General)</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AgentStatus | "all_statuses")}
        >
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_statuses">All Statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={() => handleAgentClick(agent.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No agents found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || squadFilter !== "all_squads" || statusFilter !== "all_statuses"
              ? "Try adjusting your filters."
              : "Create your first agent to get started."}
          </p>
        </div>
      )}

      {/* Detail panel (URL-driven) */}
      <AgentDetailPanel />

      {/* Create dialog */}
      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId}
        agents={agents}
        onCreated={handleAgentCreated}
      />
    </div>
  )
}
