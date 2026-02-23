"use client"

import { useState } from "react"
import { toast } from "sonner"
import { pingAgent } from "@/lib/actions/agent-commands"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle"
import type { AgentWithSupervisor } from "@/lib/supabase/types"

// ─── Design-system token maps ──────────────────────────────────────────────

// CLAUDE.md defines: blue=engineering, purple=marketing, green=design/product, gold=supreme
const SQUAD_BG: Record<string, string> = {
  engineering: "bg-blue-500",
  marketing:   "bg-purple-500",
  all:         "bg-emerald-500",
}

const AGENT_TYPE_BG: Record<string, string> = {
  supreme:     "bg-yellow-500",
  lead:        "bg-blue-500",
  specialist:  "bg-muted-foreground",
  integration: "bg-emerald-500",
}

function getAvatarBg(agent: AgentWithSupervisor): string {
  if (agent.agent_type === "supreme") return AGENT_TYPE_BG.supreme
  return SQUAD_BG[agent.squad] ?? "bg-muted-foreground"
}

// Status dot colors — from design-system.json contextual.status tokens
const STATUS_DOT: Record<string, string> = {
  online:  "bg-emerald-500",
  busy:    "bg-amber-500",
  idle:    "bg-amber-500",
  offline: "bg-muted-foreground/60",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
}

// ─── Agent node card (fixed w-28 so connector math is exact) ─────────────

interface AgentNodeProps {
  agent: AgentWithSupervisor
  onClick: (agent: AgentWithSupervisor) => void
}

function AgentNode({ agent, onClick }: AgentNodeProps) {
  const avatarBg = getAvatarBg(agent)
  const statusDot = STATUS_DOT[agent.status] ?? STATUS_DOT.offline

  return (
    <button
      onClick={() => onClick(agent)}
      className={cn(
        // Design system: rounded-lg border bg-card text-card-foreground
        // hover: bg-accent; transition-colors at 200ms; cursor-pointer
        "w-28 flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card",
        "p-3 text-center transition-colors hover:bg-accent hover:border-border cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      )}
    >
      {/* Avatar circle — rounded-full, h-10 w-10 per design system avatar lg */}
      <div className={cn("relative h-10 w-10 rounded-full flex items-center justify-center", avatarBg)}>
        <span className="text-xs font-semibold text-white select-none">
          {getInitials(agent.name)}
        </span>
        {/* Status dot — h-3 w-3, border-2 border-background for cutout effect */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            statusDot
          )}
        />
      </div>

      {/* Name — text-xs font-medium text-foreground, clipped at 2 lines */}
      <p className="text-xs font-medium text-foreground leading-tight line-clamp-2 w-full text-center">
        {agent.name}
      </p>

      {/* Role — text-[10px] text-muted-foreground */}
      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1 w-full text-center">
        {agent.role}
      </p>
    </button>
  )
}

// ─── Synthetic human root node (Fares) ─────────────────────────────────────

function HumanRootNode({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-28 flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card",
        "p-3 text-center transition-colors hover:bg-accent cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      )}
    >
      {/* Gold avatar for the human operator */}
      <div className="relative h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center">
        <span className="text-xs font-semibold text-white select-none">FA</span>
        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
      </div>
      <p className="text-xs font-medium text-foreground leading-tight">Fares</p>
      <p className="text-[10px] text-muted-foreground leading-tight">Human Operator</p>
    </button>
  )
}

// ─── Vertical connector line ────────────────────────────────────────────────

function Connector() {
  return <div className="w-px h-4 bg-border flex-shrink-0" />
}

// ─── Recursive subtree ──────────────────────────────────────────────────────
// Each node is w-28 (112px). Horizontal bar uses inset-x-14 (56px = w-28/2)
// so the bar precisely spans from center of leftmost to center of rightmost child.

interface SubtreeProps {
  parentId: string
  childrenMap: Map<string, AgentWithSupervisor[]>
  onClick: (agent: AgentWithSupervisor) => void
}

function AgentSubtree({ parentId, childrenMap, onClick }: SubtreeProps) {
  const children = childrenMap.get(parentId) ?? []
  if (children.length === 0) return null

  return (
    <div className="flex flex-col items-center">
      {/* Vertical line from parent down to horizontal bar (or single child) */}
      <Connector />

      {children.length === 1 ? (
        // Single child — straight vertical connection, no horizontal bar
        <div className="flex flex-col items-center">
          <AgentNode agent={children[0]} onClick={onClick} />
          <AgentSubtree
            parentId={children[0].id}
            childrenMap={childrenMap}
            onClick={onClick}
          />
        </div>
      ) : (
        // Multiple children — horizontal bar connecting them all
        <div className="relative flex items-start gap-6">
          {/*
            Horizontal bar: inset-x-14 (56px each side).
            With w-28 (112px) nodes, 56px = half-node-width.
            The bar therefore starts at center of leftmost child
            and ends at center of rightmost child, regardless of gap size.
          */}
          <div className="absolute top-0 inset-x-14 h-px bg-border pointer-events-none" />

          {children.map((child) => (
            <div key={child.id} className="flex flex-col items-center">
              {/* Vertical drop from bar down to child node */}
              <Connector />
              <AgentNode agent={child} onClick={onClick} />
              <AgentSubtree
                parentId={child.id}
                childrenMap={childrenMap}
                onClick={onClick}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Agent detail sheet ─────────────────────────────────────────────────────

interface AgentDetailSheetProps {
  agent: AgentWithSupervisor | null
  open: boolean
  onClose: () => void
  orgId: string
}

function AgentDetailSheet({ agent, open, onClose, orgId }: AgentDetailSheetProps) {
  const [pinging, setPinging] = useState(false)

  if (!agent) return null

  const avatarBg = getAvatarBg(agent)
  const statusDot = STATUS_DOT[agent.status] ?? STATUS_DOT.offline
  const statusLabel = agent.status.charAt(0).toUpperCase() + agent.status.slice(1)

  const handlePing = async () => {
    setPinging(true)
    try {
      const result = await pingAgent(orgId, agent.id, `Ping from Mission Control UI`)
      if (result.error) {
        toast.error(`Ping failed: ${result.error}`)
      } else {
        toast.success(`Ping sent to ${agent.name}`)
      }
    } catch {
      toast.error("Failed to send ping")
    } finally {
      setPinging(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-80 sm:w-96 flex flex-col gap-0 p-0 overflow-y-auto">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            {/* Avatar — design system avatar lg (h-10 w-10) */}
            <div className={cn("relative h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0", avatarBg)}>
              <span className="text-sm font-semibold text-white select-none">
                {getInitials(agent.name)}
              </span>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                  statusDot
                )}
              />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground leading-none">
                {agent.name}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground mt-1 leading-none">
                {agent.role}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 p-6 space-y-5">
          {/* Status + Squad badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 rounded-full">
              <Circle className={cn("h-2 w-2", statusDot.replace("bg-", "text-"))} weight="fill" />
              {statusLabel}
            </Badge>
            <Badge variant="outline" className="rounded-full capitalize">
              {agent.squad}
            </Badge>
            <Badge variant="outline" className="rounded-full capitalize">
              {agent.agent_type}
            </Badge>
          </div>

          {/* Description */}
          {agent.description && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                About
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {agent.description}
              </p>
            </div>
          )}

          {/* AI Model */}
          {(agent.ai_provider || agent.ai_model) && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Model
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <Lightning className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">
                  {agent.ai_model ?? agent.ai_provider ?? "—"}
                </span>
              </div>
            </div>
          )}

          {/* Capabilities */}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Capabilities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary" className="text-xs rounded-md">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Supervisor */}
          {agent.supervisor && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Reports To
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <Robot className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {agent.supervisor.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {agent.supervisor.role}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Ping button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handlePing}
            disabled={pinging}
          >
            <Broadcast className="h-4 w-4" />
            {pinging ? "Pinging..." : "Ping Agent"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Fares detail sheet ─────────────────────────────────────────────────────

function FaresDetailSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-80 sm:w-96 p-0 overflow-y-auto">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-white">FA</span>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground leading-none">
                Fares
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground mt-1 leading-none">
                Human Operator
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 rounded-full">
              <Circle className="h-2 w-2 text-emerald-500" weight="fill" />
              Online
            </Badge>
            <Badge variant="outline" className="rounded-full">Supreme</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Mission commander. Owns all AI agents and defines objectives. Manages PMS from this interface.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyNetwork() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="p-3 bg-muted rounded-lg">
        <Robot className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No agents found</p>
        <p className="text-sm text-muted-foreground">
          Add agents to your organization to see the network.
        </p>
      </div>
    </div>
  )
}

// ─── Main client component ───────────────────────────────────────────────────

interface AgentNetworkClientProps {
  agents: AgentWithSupervisor[]
  orgId: string
}

export function AgentNetworkClient({ agents, orgId }: AgentNetworkClientProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentWithSupervisor | null>(null)
  const [faresSheetOpen, setFaresSheetOpen] = useState(false)

  if (agents.length === 0) return <EmptyNetwork />

  // Build parent → children map
  const childrenMap = new Map<string, AgentWithSupervisor[]>()
  const agentIds = new Set(agents.map((a) => a.id))

  for (const agent of agents) {
    const parentId = agent.reports_to
    // Only record parent-child relationships where both exist in this org
    if (parentId && agentIds.has(parentId)) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
      childrenMap.get(parentId)!.push(agent)
    }
  }

  // Root agents: no reports_to, or reports_to points outside this org's agents
  const rootAgents = agents.filter(
    (a) => !a.reports_to || !agentIds.has(a.reports_to)
  )

  return (
    <>
      {/* Scrollable canvas — flex-1 so it fills remaining height */}
      <div className="flex-1 overflow-auto p-8 min-h-0">
        {/* Legend bar */}
        <div className="flex items-center gap-6 mb-8 flex-wrap">
          <p className="text-xs font-medium text-muted-foreground">Squad</p>
          {[
            { label: "Engineering", dot: "bg-blue-500" },
            { label: "Marketing",   dot: "bg-purple-500" },
            { label: "Design / Product", dot: "bg-emerald-500" },
            { label: "Supreme",     dot: "bg-yellow-500" },
          ].map(({ label, dot }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full", dot)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="h-4 w-px bg-border" />
          {[
            { label: "Online",  dot: "bg-emerald-500" },
            { label: "Busy",    dot: "bg-amber-500" },
            { label: "Offline", dot: "bg-muted-foreground/60" },
          ].map(({ label, dot }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", dot)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Tree — top-down, centered */}
        <div className="flex flex-col items-center">
          {/* Fares — human root */}
          <HumanRootNode onClick={() => setFaresSheetOpen(true)} />

          {rootAgents.length > 0 && (
            <>
              <Connector />
              {rootAgents.length === 1 ? (
                <div className="flex flex-col items-center">
                  <AgentNode agent={rootAgents[0]} onClick={setSelectedAgent} />
                  <AgentSubtree
                    parentId={rootAgents[0].id}
                    childrenMap={childrenMap}
                    onClick={setSelectedAgent}
                  />
                </div>
              ) : (
                <div className="relative flex items-start gap-6">
                  <div className="absolute top-0 inset-x-14 h-px bg-border pointer-events-none" />
                  {rootAgents.map((root) => (
                    <div key={root.id} className="flex flex-col items-center">
                      <Connector />
                      <AgentNode agent={root} onClick={setSelectedAgent} />
                      <AgentSubtree
                        parentId={root.id}
                        childrenMap={childrenMap}
                        onClick={setSelectedAgent}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail sheets */}
      <AgentDetailSheet
        agent={selectedAgent}
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        orgId={orgId}
      />
      <FaresDetailSheet
        open={faresSheetOpen}
        onClose={() => setFaresSheetOpen(false)}
      />
    </>
  )
}
