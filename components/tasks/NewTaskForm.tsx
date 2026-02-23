"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Robot, User, Rocket, ArrowLeft, CheckCircle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { createTask } from "@/lib/actions/tasks/mutations"
import { dispatchTaskToAgent } from "@/lib/actions/tasks-sprint3"

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
]

const PRIORITIES = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "no-priority", label: "No Priority" },
]

const squadColors: Record<string, string> = {
  engineering: "bg-blue-500",
  marketing: "bg-purple-500",
  all: "bg-emerald-500",
}

type MemberProp = {
  id: string
  user_id: string
  role: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface NewTaskFormProps {
  projects: Array<{ id: string; name: string }>
  agents: Array<{
    id: string
    name: string
    role: string
    squad: string
    status: string
    avatar_url: string | null
  }>
  members?: MemberProp[]
  orgId: string
}

export function NewTaskForm({ projects, agents, members = [], orgId }: NewTaskFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [assignType, setAssignType] = useState<"member" | "agent">("member")
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [selectedMemberId, setSelectedMemberId] = useState<string>("")
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? "")
  const [status, setStatus] = useState<string>("todo")
  const [priority, setPriority] = useState<string>("medium")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)

    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string)?.trim()
    const description = (formData.get("description") as string)?.trim() || null

    if (!name) {
      setErrorMsg("Task name is required")
      return
    }
    if (!selectedProjectId) {
      setErrorMsg("Please select a project")
      return
    }
    if (assignType === "agent" && !selectedAgentId) {
      setErrorMsg("Please select an agent")
      return
    }

    startTransition(async () => {
      // Build task data with optional assignee
      const taskData: Record<string, unknown> = {
        name,
        description,
        status: status as "todo" | "in-progress" | "done",
        priority: priority as "urgent" | "high" | "medium" | "low" | "no-priority",
      }

      // Add member assignee if selected
      if (assignType === "member" && selectedMemberId) {
        taskData.assignee_id = selectedMemberId
      }

      const result = await createTask(selectedProjectId, taskData as any)

      if (result.error) {
        setErrorMsg(result.error)
        return
      }

      const task = result.data!

      // If agent selected, dispatch
      if (assignType === "agent" && selectedAgentId && task.id) {
        const dispatchResult = await dispatchTaskToAgent(orgId, task.id, selectedAgentId)
        if (dispatchResult.error) {
          setErrorMsg(`Task created but dispatch failed: ${dispatchResult.error}`)
          return
        }
      }

      setSuccess(true)
      setTimeout(() => router.push("/tasks"), 1000)
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle size={40} className="text-emerald-400" weight="fill" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Task Created!</h3>
          {assignType === "agent" ? (
            <p className="text-sm text-muted-foreground mt-1">Agent has been dispatched. Redirecting...</p>
          ) : selectedMemberId ? (
            <p className="text-sm text-muted-foreground mt-1">
              Assigned to {members.find(m => m.user_id === selectedMemberId)?.profile.full_name || "member"}. Redirecting...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Redirecting to tasks...</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back to tasks
      </button>

      {/* Task Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm font-medium">
          Task Name <span className="text-red-400">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="What needs to be done?"
          className="h-10"
          autoFocus
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-sm font-medium">
          Description
        </Label>
        <textarea
          id="description"
          name="description"
          placeholder="Add details, context, or instructions..."
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Project */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Project <span className="text-red-400">*</span>
        </Label>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects found.{" "}
            <Link href="/projects/new" className="text-primary underline">
              Create one first
            </Link>
          </p>
        ) : (
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assign To toggle */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Assign To</Label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setAssignType("member")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all",
              assignType === "member"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <User size={16} />
            Team Member
          </button>
          <button
            type="button"
            onClick={() => setAssignType("agent")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all border-l border-border",
              assignType === "agent"
                ? "bg-purple-600 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <Robot size={16} />
            AI Agent
          </button>
        </div>

        {assignType === "member" && members.length > 0 && (
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select a team member..." />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  <div className="flex items-center gap-2">
                    {member.profile.avatar_url ? (
                      <Image
                        src={member.profile.avatar_url}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                        {(member.profile.full_name || member.profile.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{member.profile.full_name || member.profile.email}</span>
                    <span className="text-muted-foreground text-xs">({member.role})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {assignType === "member" && members.length === 0 && (
          <p className="text-sm text-muted-foreground">No team members found. Invite members from Settings.</p>
        )}

        {assignType === "agent" && (
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select an agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white",
                        squadColors[agent.squad] ?? "bg-slate-500"
                      )}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <span>{agent.name}</span>
                    <span className="text-muted-foreground text-xs">— {agent.role}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">{errorMsg}</p>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending || projects.length === 0}
          className={cn(
            "flex-1 gap-2 font-medium",
            assignType === "agent"
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          {isPending ? (
            assignType === "agent" ? "Creating & Dispatching..." : "Creating..."
          ) : assignType === "agent" ? (
            <>
              <Rocket size={16} />
              Create & Dispatch
            </>
          ) : (
            "Create Task"
          )}
        </Button>
      </div>
    </form>
  )
}
