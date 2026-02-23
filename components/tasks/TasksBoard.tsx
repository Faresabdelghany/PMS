"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { User } from "@phosphor-icons/react/dist/ssr/User"
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle"
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TaskCard } from "./TaskCard"
import { TaskDetail } from "./TaskDetail"
import { LiveActivityFeed } from "./LiveActivityFeed"
import type { OrgTaskWithRelations, OrgTaskStats } from "@/lib/actions/tasks-sprint3"
import type { AgentEventWithAgent } from "@/lib/actions/agent-events"

const COLUMNS = [
  { id: "recurring", label: "Recurring", statuses: ["recurring"] as string[] },
  { id: "todo", label: "To Do", statuses: ["todo"] as string[] },
  { id: "in-progress", label: "In Progress", statuses: ["in-progress"] as string[] },
  { id: "done", label: "Done", statuses: ["done"] as string[] },
] as const

type ColumnId = "recurring" | "todo" | "in-progress" | "done"

function columnIcon(id: ColumnId) {
  switch (id) {
    case "recurring":
      return <ArrowsClockwise className="h-4 w-4 text-muted-foreground" />
    case "todo":
      return <Circle className="h-4 w-4 text-muted-foreground" />
    case "in-progress":
      return <CircleNotch className="h-4 w-4 text-muted-foreground" />
    case "done":
      return <CheckCircle className="h-4 w-4 text-muted-foreground" />
  }
}

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
      const mapped = COLUMNS.some((col) => col.statuses.includes(task.status))
      if (!mapped) {
        result.todo.push(task)
      }
    }

    return result
  }, [filteredTasks])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Stats Bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-6">
          <StatItem value={stats.thisWeek} label="This Week" />
          <div className="h-6 w-px bg-border" />
          <StatItem value={stats.inProgress} label="In Progress" />
          <div className="h-6 w-px bg-border" />
          <StatItem value={stats.total} label="Total" />
          <div className="h-6 w-px bg-border" />
          <StatItem value={`${stats.completionRate}%`} label="Completion" />
        </div>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap">
        {/* Type filter */}
        <div className="flex items-center gap-1">
          <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label="All" />
          <FilterChip
            active={typeFilter === "user"}
            onClick={() => setTypeFilter("user")}
            label="User"
            icon={<User className="h-3 w-3" />}
          />
          <FilterChip
            active={typeFilter === "agent"}
            onClick={() => setTypeFilter("agent")}
            label="Agents"
            icon={<Robot className="h-3 w-3" />}
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
        {/* Kanban board — grid layout matching project-board-view.tsx */}
        <div className="flex-1 p-4 overflow-auto min-h-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((col) => {
              const colTasks = tasksByColumn[col.id]
              return (
                <KanbanColumn
                  key={col.id}
                  id={col.id}
                  label={col.label}
                  tasks={colTasks}
                  onTaskClick={setSelectedTask}
                  onAddClick={() => router.push(`/tasks/new?status=${col.id}`)}
                />
              )
            })}
          </div>
        </div>

        {/* Live Activity Panel */}
        <div className="w-[300px] flex-shrink-0 border-l border-border flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-medium text-foreground">Live Activity</h3>
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
}: {
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
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
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
        active
          ? "bg-accent text-foreground"
          : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function KanbanColumn({
  id,
  label,
  tasks,
  onTaskClick,
  onAddClick,
}: {
  id: ColumnId
  label: string
  tasks: OrgTaskWithRelations[]
  onTaskClick: (task: OrgTaskWithRelations) => void
  onAddClick: () => void
}) {
  return (
    // Same style as project-board-view.tsx: rounded-xl bg-muted
    <div className="rounded-xl bg-muted">
      {/* Column header — same layout as project-board-view.tsx */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          {columnIcon(id)}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            type="button"
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            type="button"
          >
            <DotsThreeVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Column content — same padding as project-board-view.tsx */}
      <div className="px-3 pb-3 space-y-3 min-h-[120px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        )}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onAddClick}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add task
        </Button>
      </div>
    </div>
  )
}
