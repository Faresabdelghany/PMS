"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Robot, User } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TaskCard } from "./TaskCard"
import { TaskDetail } from "./TaskDetail"
import { LiveActivityFeed } from "./LiveActivityFeed"
import type { OrgTaskWithRelations, OrgTaskStats } from "@/lib/actions/tasks-sprint3"
import type { AgentEventWithAgent } from "@/lib/actions/agent-events"

const COLUMNS = [
  { id: "recurring", label: "Recurring", dot: "bg-indigo-400", statuses: ["recurring"] as string[] },
  { id: "todo", label: "To Do", dot: "bg-muted-foreground", statuses: ["todo"] as string[] },
  { id: "in-progress", label: "In Progress", dot: "bg-blue-400", statuses: ["in-progress"] as string[] },
  { id: "done", label: "Done", dot: "bg-emerald-400", statuses: ["done"] as string[] },
] as const

type ColumnId = "recurring" | "todo" | "in-progress" | "done"

const squadColors: Record<string, string> = {
  engineering: "bg-blue-500",
  marketing: "bg-purple-500",
  all: "bg-emerald-500",
}

interface Agent {
  id: string
  name: string
  role: string
  squad: string
  avatar_url: string | null
  status: string
}

interface TasksBoardProps {
  tasks: OrgTaskWithRelations[]
  stats: OrgTaskStats
  agents: Agent[]
  events: AgentEventWithAgent[]
  orgId: string
}

export function TasksBoard({ tasks, stats, agents, events, orgId }: TasksBoardProps) {
  const router = useRouter()
  const [selectedTask, setSelectedTask] = useState<OrgTaskWithRelations | null>(null)
  const [agentFilter, setAgentFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "user" | "agent">("all")

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (agentFilter && t.assigned_agent_id !== agentFilter) return false
      if (typeFilter === "user" && t.task_type !== "user") return false
      if (typeFilter === "agent" && t.task_type !== "agent") return false
      return true
    })
  }, [tasks, agentFilter, typeFilter])

  // Group tasks by column
  const tasksByColumn = useMemo<Record<ColumnId, OrgTaskWithRelations[]>>(() => {
    const result: Record<ColumnId, OrgTaskWithRelations[]> = {
      recurring: [],
      todo: [],
      "in-progress": [],
      done: [],
    }

    for (const task of filteredTasks) {
      // Recurring tasks go in their own column
      if (task.task_type === "recurring") {
        result.recurring.push(task)
        continue
      }

      for (const col of COLUMNS) {
        if (col.statuses.includes(task.status)) {
          result[col.id as ColumnId].push(task)
          break
        }
      }

      // Default unmapped statuses to todo (task_type !== "recurring" already guaranteed by continue above)
      const mapped = COLUMNS.some((col) => col.statuses.includes(task.status))
      if (!mapped) {
        result.todo.push(task)
      }
    }

    return result
  }, [filteredTasks])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Stats Bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-6">
          <StatItem value={stats.thisWeek} label="This Week" />
          <div className="h-6 w-px bg-border" />
          <StatItem value={stats.inProgress} label="In Progress" />
          <div className="h-6 w-px bg-border" />
          <StatItem value={stats.total} label="Total" />
          <div className="h-6 w-px bg-border" />
          <StatItem
            value={`${stats.completionRate}%`}
            label="Completion"
            accent="text-purple-400"
          />
        </div>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/40 flex items-center gap-3 flex-wrap">
        {/* New Task */}
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => router.push("/tasks/new")}
        >
          <Plus size={14} weight="bold" />
          New Task
        </Button>

        <div className="h-5 w-px bg-border" />

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <FilterChip
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
            label="All"
          />
          <FilterChip
            active={typeFilter === "user"}
            onClick={() => setTypeFilter("user")}
            label="User"
            icon={<User size={12} />}
          />
          <FilterChip
            active={typeFilter === "agent"}
            onClick={() => setTypeFilter("agent")}
            label="Agents"
            icon={<Robot size={12} />}
          />
        </div>

        {/* Agent chips */}
        {agents.length > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1 flex-wrap">
              <FilterChip
                active={agentFilter === null}
                onClick={() => setAgentFilter(null)}
                label="All Agents"
              />
              {agents.slice(0, 6).map((agent) => (
                <FilterChip
                  key={agent.id}
                  active={agentFilter === agent.id}
                  onClick={() => setAgentFilter(agentFilter === agent.id ? null : agent.id)}
                  label={agent.name}
                  icon={
                    <div
                      className={cn(
                        "h-3.5 w-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white",
                        squadColors[agent.squad] ?? "bg-slate-500"
                      )}
                    >
                      {agent.name.charAt(0)}
                    </div>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Main Area: Kanban + Live Feed ─────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Kanban board */}
        <div className="flex-1 flex gap-3 p-4 overflow-x-auto min-h-0">
          {COLUMNS.map((col) => {
            const colTasks = tasksByColumn[col.id]
            return (
              <KanbanColumn
                key={col.id}
                label={col.label}
                dotClass={col.dot}
                tasks={colTasks}
                onTaskClick={setSelectedTask}
                onAddClick={() => router.push(`/tasks/new?status=${col.id}`)}
              />
            )
          })}
        </div>

        {/* Live Activity Panel */}
        <div className="w-[300px] flex-shrink-0 border-l border-border/40 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground">Live Activity</h3>
          </div>
          <div className="flex-1 overflow-hidden px-3 py-3">
            <LiveActivityFeed orgId={orgId} initialEvents={events} />
          </div>
        </div>
      </div>

      {/* Task Detail Sheet */}
      <TaskDetail
        task={selectedTask}
        agents={agents}
        orgId={orgId}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => {
          setSelectedTask(null)
          router.refresh()
        }}
      />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function StatItem({
  value,
  label,
  accent,
}: {
  value: string | number
  label: string
  accent?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn("text-2xl font-bold tabular-nums", accent ?? "text-foreground")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
        active
          ? "bg-foreground text-background"
          : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function KanbanColumn({
  label,
  dotClass,
  tasks,
  onTaskClick,
  onAddClick,
}: {
  label: string
  dotClass: string
  tasks: OrgTaskWithRelations[]
  onTaskClick: (task: OrgTaskWithRelations) => void
  onAddClick: () => void
}) {
  return (
    <div className="flex flex-col w-72 min-w-72 rounded-xl bg-accent/20 border border-border/40">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", dotClass)} />
        <h3 className="text-sm font-medium text-foreground flex-1">{label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums bg-background/60 px-1.5 py-0.5 rounded-md">
          {tasks.length}
        </span>
        <button
          onClick={onAddClick}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        )}
      </div>
    </div>
  )
}
