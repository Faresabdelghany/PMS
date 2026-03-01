"use client"

import { useState } from "react"
import { AgentsTable } from "@/components/agents/agents-table"
import { AgentNetworkClient } from "@/components/agents/AgentNetworkClient"
import type { AgentWithSupervisor } from "@/lib/supabase/types"
import type { Skill } from "@/lib/actions/skills"

type TabValue = "list" | "network"

interface AgentsPageClientProps {
  agents: AgentWithSupervisor[]
  orgId: string
  skills: Skill[]
}

export function AgentsPageClient({ agents, orgId, skills }: AgentsPageClientProps) {
  const [tab, setTab] = useState<TabValue>("list")

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Pill tab toggle */}
      <div className="px-4 pt-3 pb-1">
        <div className="inline-flex bg-muted rounded-full px-1 py-0.5 text-xs border border-border/50 h-8 items-center">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
              tab === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Agents
          </button>
          <button
            type="button"
            onClick={() => setTab("network")}
            className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
              tab === "network"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Network
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === "list" ? (
        <AgentsTable agents={agents} organizationId={orgId} />
      ) : (
        <AgentNetworkClient agents={agents} orgId={orgId} />
      )}
    </div>
  )
}
