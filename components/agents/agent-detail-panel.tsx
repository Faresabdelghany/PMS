"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { AgentActivityFeed } from "./agent-activity-feed"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bot,
  Clock,
  Cpu,
  Shield,
  GitBranch,
  Users,
  Star,
  Circle,
  Pencil,
  Save,
  X,
  Zap,
  Power,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getAgent, updateAgent } from "@/lib/actions/agents"
import { getAgentActivities } from "@/lib/actions/agents"
import { toast } from "sonner"
import type {
  AgentWithSupervisor,
  AgentActivityRow,
  AgentType,
  AgentStatus,
  AgentSquad,
} from "@/lib/supabase/types"
import type { Skill } from "@/lib/actions/skills"

// ── Status styling ──────────────────────────────────────────────────

const statusConfig: Record<AgentStatus, { label: string; dot: string; badge: string }> = {
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    badge: "bg-teal-50 text-teal-700 border-transparent dark:bg-teal-500/15 dark:text-teal-100",
  },
  busy: {
    label: "Busy",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-100",
  },
  idle: {
    label: "Idle",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border-transparent dark:bg-blue-500/15 dark:text-blue-100",
  },
  offline: {
    label: "Offline",
    dot: "bg-zinc-400",
    badge: "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-600/30 dark:text-slate-200",
  },
}

const typeLabels: Record<AgentType, string> = {
  supreme: "Supreme",
  lead: "Lead",
  specialist: "Specialist",
  integration: "Integration",
}

const typeBadgeColors: Record<AgentType, string> = {
  supreme: "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-100",
  lead: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-100",
  specialist: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100",
  integration: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-100",
}

const squadLabels: Record<AgentSquad, string> = {
  engineering: "Engineering",
  marketing: "Marketing",
  all: "All",
}

function formatLastActive(date: string | null): string {
  if (!date) return "Never"
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

// ── Edit form schema ────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  agent_type: z.enum(["supreme", "lead", "specialist", "integration"]),
  squad: z.enum(["engineering", "marketing", "all"]),
  status: z.enum(["online", "busy", "idle", "offline"]),
  ai_provider: z.string().max(100).optional().nullable(),
  ai_model: z.string().max(200).optional().nullable(),
  reports_to: z.string().uuid().optional().nullable(),
  is_active: z.boolean(),
  skills: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
})

type EditFormValues = z.infer<typeof editSchema>

const MODEL_MAP: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-3-5", label: "Claude Haiku 3.5" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "o1", label: "o1" },
    { id: "o3-mini", label: "o3-mini" },
  ],
  "openai-codex": [
    { id: "gpt-5.1", label: "GPT-5.1 (Codex)" },
    { id: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
    { id: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini" },
    { id: "gpt-5.2", label: "GPT-5.2 (Codex)" },
    { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { id: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" },
  ],
  other: [{ id: "custom", label: "Custom / Other" }],
}

// ── Component ───────────────────────────────────────────────────────

interface AgentQuickViewProps {
  agents?: AgentWithSupervisor[]
  skills?: Skill[]
}

export function AgentQuickView({ agents = [], skills = [] }: AgentQuickViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = searchParams.get("view")

  const [agent, setAgent] = useState<AgentWithSupervisor | null>(null)
  const [activities, setActivities] = useState<AgentActivityRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isOpen = !!agentId

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      role: "",
      description: "",
      agent_type: "specialist",
      squad: "engineering",
      status: "offline",
      ai_provider: "anthropic",
      ai_model: "claude-sonnet-4-6",
      reports_to: null,
      is_active: true,
      skills: [],
    },
  })

  const watchedProvider = form.watch("ai_provider") ?? "anthropic"
  const watchedSkills = form.watch("skills")

  // Reset form when agent data loads
  const populateForm = useCallback(
    (a: AgentWithSupervisor) => {
      const existingSkills = Array.isArray(a.skills)
        ? (a.skills as { id: string; name: string }[])
        : []
      form.reset({
        name: a.name,
        role: a.role,
        description: a.description ?? "",
        agent_type: a.agent_type as EditFormValues["agent_type"],
        squad: a.squad as EditFormValues["squad"],
        status: a.status as EditFormValues["status"],
        ai_provider: a.ai_provider ?? "anthropic",
        ai_model: a.ai_model ?? "claude-sonnet-4-6",
        reports_to: a.reports_to ?? null,
        is_active: a.is_active ?? true,
        skills: existingSkills,
      })
    },
    [form]
  )

  useEffect(() => {
    if (!agentId) {
      setAgent(null)
      setActivities([])
      setIsEditing(false)
      return
    }

    const currentId = agentId

    async function fetchData() {
      setIsLoading(true)
      setIsEditing(false)
      try {
        const [agentResult, activitiesResult] = await Promise.all([
          getAgent(currentId),
          getAgentActivities(currentId),
        ])

        if (agentResult.error) {
          toast.error(agentResult.error)
          return
        }
        if (agentResult.data) {
          setAgent(agentResult.data)
          populateForm(agentResult.data)
        }
        if (activitiesResult.data) setActivities(activitiesResult.data)
      } catch {
        toast.error("Failed to load agent details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [agentId, populateForm])

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    const newPath = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    router.push(newPath, { scroll: false })
  }, [router, searchParams])

  const handleCancelEdit = useCallback(() => {
    if (agent) populateForm(agent)
    setIsEditing(false)
  }, [agent, populateForm])

  const handleSave = useCallback(
    async (values: EditFormValues) => {
      if (!agent) return
      setIsSaving(true)
      try {
        const result = await updateAgent(agent.id, values)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Agent updated")
        // Re-fetch to get fresh data including supervisor join
        const refreshed = await getAgent(agent.id)
        if (refreshed.data) {
          setAgent(refreshed.data)
          populateForm(refreshed.data)
        }
        setIsEditing(false)
        router.refresh()
      } finally {
        setIsSaving(false)
      }
    },
    [agent, populateForm, router]
  )

  const toggleSkill = useCallback(
    (skill: Skill) => {
      const current = form.getValues("skills")
      const exists = current.some((s) => s.id === skill.id)
      if (exists) {
        form.setValue(
          "skills",
          current.filter((s) => s.id !== skill.id),
          { shouldDirty: true }
        )
      } else {
        form.setValue("skills", [...current, { id: skill.id, name: skill.name }], {
          shouldDirty: true,
        })
      }
    },
    [form]
  )

  const installedSkills = skills.filter((s) => s.installed && s.enabled)

  const modelOptions = (MODEL_MAP[watchedProvider] ?? MODEL_MAP.anthropic)

  const reportsToOptions = agents.filter((a) => a.id !== agentId)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[600px] lg:w-[700px] sm:max-w-none p-0 flex flex-col sm:rounded-l-[32px] overflow-hidden"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">
          {agent?.name || "Agent Details"}
        </SheetTitle>

        {isLoading && <AgentDetailPanelSkeleton />}

        {!isLoading && !agent && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Agent not found
          </div>
        )}

        {!isLoading && agent && (
          <>
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex-shrink-0 border-b border-border/60 space-y-2">
              <div className="flex items-start gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                      statusConfig[agent.status].dot
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        {...form.register("name")}
                        className="w-full text-lg font-semibold text-foreground bg-transparent border-b border-primary/40 outline-none pb-0.5 placeholder:text-muted-foreground"
                        placeholder="Agent name"
                      />
                      <input
                        {...form.register("role")}
                        className="w-full text-sm text-muted-foreground bg-transparent border-b border-border outline-none pb-0.5 placeholder:text-muted-foreground/60"
                        placeholder="Role"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold truncate">{agent.name}</h2>
                      <p className="text-sm text-muted-foreground truncate">{agent.role}</p>
                    </>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 rounded-lg text-muted-foreground"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-lg"
                      onClick={form.handleSubmit(handleSave)}
                      disabled={isSaving}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 rounded-lg"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>

              {/* Badges */}
              {!isEditing && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium",
                      typeBadgeColors[agent.agent_type]
                    )}
                  >
                    {typeLabels[agent.agent_type]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-transparent bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {squadLabels[agent.squad]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium",
                      statusConfig[agent.status].badge
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig[agent.status].dot)} />
                    {statusConfig[agent.status].label}
                  </Badge>
                  {!agent.is_active && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-transparent bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200 px-2 py-0.5 text-[10px] font-medium"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4 space-y-5">
              {/* Description */}
              {isEditing ? (
                <div className="space-y-1.5">
                  <h3 className="text-sm font-medium text-foreground">Description</h3>
                  <textarea
                    {...form.register("description")}
                    rows={3}
                    className="w-full text-sm leading-relaxed text-muted-foreground bg-muted/50 rounded-lg border border-border p-3 outline-none focus:border-primary/40 resize-none placeholder:text-muted-foreground/60"
                    placeholder="What does this agent do?"
                  />
                </div>
              ) : (
                agent.description && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-foreground">Description</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
                  </div>
                )
              )}

              {/* Details — editable or static */}
              {isEditing ? (
                <div className="rounded-2xl border border-border bg-card/80 px-5 py-4 space-y-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Type */}
                    <EditSelectField
                      label="Type"
                      icon={<Star className="h-3.5 w-3.5" />}
                      control={form.control}
                      name="agent_type"
                      options={[
                        { value: "supreme", label: "Supreme" },
                        { value: "lead", label: "Lead" },
                        { value: "specialist", label: "Specialist" },
                        { value: "integration", label: "Integration" },
                      ]}
                    />

                    {/* Squad */}
                    <EditSelectField
                      label="Squad"
                      icon={<Users className="h-3.5 w-3.5" />}
                      control={form.control}
                      name="squad"
                      options={[
                        { value: "engineering", label: "Engineering" },
                        { value: "marketing", label: "Marketing" },
                        { value: "all", label: "All" },
                      ]}
                    />

                    {/* Status */}
                    <EditSelectField
                      label="Status"
                      icon={<Circle className="h-3.5 w-3.5" />}
                      control={form.control}
                      name="status"
                      options={[
                        { value: "online", label: "Online" },
                        { value: "busy", label: "Busy" },
                        { value: "idle", label: "Idle" },
                        { value: "offline", label: "Offline" },
                      ]}
                    />

                    {/* Provider */}
                    <EditSelectField
                      label="Provider"
                      icon={<Shield className="h-3.5 w-3.5" />}
                      control={form.control}
                      name="ai_provider"
                      options={[
                        { value: "anthropic", label: "Anthropic" },
                        { value: "google", label: "Google" },
                        { value: "openai", label: "OpenAI" },
                        { value: "openai-codex", label: "OpenAI Codex" },
                        { value: "other", label: "Other" },
                      ]}
                      onChange={(val) => {
                        const models = MODEL_MAP[val] ?? MODEL_MAP.anthropic
                        form.setValue("ai_model", models[0].id)
                      }}
                    />

                    {/* Model */}
                    <EditSelectField
                      label="Model"
                      icon={<Cpu className="h-3.5 w-3.5" />}
                      control={form.control}
                      name="ai_model"
                      options={modelOptions.map((m) => ({ value: m.id, label: m.label }))}
                    />

                    {/* Reports To */}
                    <Controller
                      control={form.control}
                      name="reports_to"
                      render={({ field }) => (
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <GitBranch className="h-3.5 w-3.5" />
                            Reports To
                          </label>
                          <Select
                            value={field.value ?? "none"}
                            onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No supervisor</SelectItem>
                              {reportsToOptions.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    />

                    {/* Active */}
                    <Controller
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Power className="h-3.5 w-3.5" />
                            Active
                          </label>
                          <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background">
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="scale-75"
                            />
                            <span className="text-xs text-foreground">
                              {field.value ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card/80 px-5 py-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <DetailField
                      icon={Cpu}
                      label="AI Model"
                      value={agent.ai_model || "Not configured"}
                    />
                    <DetailField
                      icon={Shield}
                      label="Provider"
                      value={agent.ai_provider || "None"}
                    />
                    <DetailField
                      icon={Circle}
                      label="Status"
                      value={statusConfig[agent.status].label}
                      renderIcon={() => (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <span className={cn("w-2.5 h-2.5 rounded-full", statusConfig[agent.status].dot)} />
                        </div>
                      )}
                    />
                    <DetailField
                      icon={Users}
                      label="Squad"
                      value={squadLabels[agent.squad]}
                    />
                    <DetailField
                      icon={Star}
                      label="Type"
                      value={typeLabels[agent.agent_type]}
                    />
                    <DetailField
                      icon={GitBranch}
                      label="Reports To"
                      value={agent.supervisor?.name || "None"}
                    />
                    <DetailField
                      icon={Clock}
                      label="Last Active"
                      value={formatLastActive(agent.last_active_at)}
                    />
                  </div>
                </div>
              )}

              {/* Skills section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    Skills
                  </h3>
                  {!isEditing && installedSkills.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground gap-1"
                      onClick={() => setIsEditing(true)}
                    >
                      <Plus className="h-3 w-3" />
                      Manage
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  installedSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {installedSkills.map((skill) => {
                        const isSelected = watchedSkills.some((s) => s.id === skill.id)
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                              isSelected
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                            )}
                          >
                            {isSelected && (
                              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {skill.name}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No skills available. Install skills from the{" "}
                      <button
                        type="button"
                        onClick={() => router.push("/skills/marketplace")}
                        className="text-primary underline underline-offset-2"
                      >
                        Skills Marketplace
                      </button>
                      .
                    </p>
                  )
                ) : (
                  <>
                    {(() => {
                      const agentSkills = Array.isArray(agent.skills)
                        ? (agent.skills as { id: string; name: string }[])
                        : []
                      if (agentSkills.length > 0) {
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {agentSkills.map((s) => (
                              <Badge
                                key={s.id}
                                variant="secondary"
                                className="rounded-full text-[11px] font-normal gap-1"
                              >
                                <Zap className="h-3 w-3" />
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        )
                      }
                      return (
                        <p className="text-xs text-muted-foreground">No skills assigned</p>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* Capabilities (read-only always) */}
              {agent.capabilities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Capabilities</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className="rounded-full text-[11px] font-normal"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px w-full bg-border/80" />

              {/* Activity Feed */}
              <div className="space-y-3 pt-1">
                <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
                <AgentActivityFeed activities={activities} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Editable select field ───────────────────────────────────────────

function EditSelectField({
  label,
  icon,
  control,
  name,
  options,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  control: ReturnType<typeof useForm<EditFormValues>>["control"]
  name: keyof EditFormValues
  options: { value: string; label: string }[]
  onChange?: (value: string) => void
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {icon}
            {label}
          </label>
          <Select
            value={(field.value as string) ?? ""}
            onValueChange={(v) => {
              field.onChange(v)
              onChange?.(v)
            }}
          >
            <SelectTrigger className="h-9 text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  )
}

// ── Field component matching TaskDetailFields icon-in-circle pattern ──

function DetailField({
  icon: Icon,
  label,
  value,
  renderIcon,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  renderIcon?: () => React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2 min-w-0">
      {renderIcon ? (
        renderIcon()
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-0.5 min-w-0 w-full">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

function AgentDetailPanelSkeleton() {
  return (
    <div className="p-5 space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="rounded-2xl border border-border p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 pt-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}
