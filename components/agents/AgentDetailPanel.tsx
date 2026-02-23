"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form"
import { QuickCreateModalLayout } from "@/components/QuickCreateModalLayout"
import { GenericPicker } from "@/components/project-wizard/steps/StepQuickCreate"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { Users } from "@phosphor-icons/react/dist/ssr/Users"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { CircleHalf } from "@phosphor-icons/react/dist/ssr/CircleHalf"
import { Cpu } from "@phosphor-icons/react/dist/ssr/Cpu"
import { TreeStructure } from "@phosphor-icons/react/dist/ssr/TreeStructure"
import { Plugs } from "@phosphor-icons/react/dist/ssr/Plugs"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { cn } from "@/lib/utils"
import { getAgent, createAgent, updateAgent } from "@/lib/actions/agents"
import type { AgentWithSupervisor } from "@/lib/supabase/types"
import type { Skill } from "@/lib/actions/skills"

// ── Model map ───────────────────────────────────────────────────────

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
  other: [{ id: "custom", label: "Custom / Other" }],
}

// ── Picker option types ─────────────────────────────────────────────

type PickerOption = { id: string; label: string }

const TYPE_OPTIONS: PickerOption[] = [
  { id: "supreme", label: "Supreme" },
  { id: "lead", label: "Lead" },
  { id: "specialist", label: "Specialist" },
  { id: "integration", label: "Integration" },
]

const SQUAD_OPTIONS: PickerOption[] = [
  { id: "engineering", label: "Engineering" },
  { id: "marketing", label: "Marketing" },
  { id: "all", label: "All" },
]

const STATUS_OPTIONS: PickerOption[] = [
  { id: "online", label: "Online" },
  { id: "busy", label: "Busy" },
  { id: "idle", label: "Idle" },
  { id: "offline", label: "Offline" },
]

const PROVIDER_OPTIONS: PickerOption[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "openai", label: "OpenAI" },
  { id: "other", label: "Other" },
]

// ── Form schema ─────────────────────────────────────────────────────

const agentFormSchema = z.object({
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

type AgentFormValues = z.infer<typeof agentFormSchema>

const DEFAULTS: AgentFormValues = {
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
}

// ── Component ───────────────────────────────────────────────────────

interface AgentDetailPanelProps {
  agents: AgentWithSupervisor[]
  orgId: string
  skills?: Skill[]
}

export function AgentDetailPanel({ agents, orgId, skills = [] }: AgentDetailPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentParam = searchParams.get("agent")

  const isOpen = agentParam !== null
  const isNew = agentParam === "new"

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: DEFAULTS,
  })

  const provider = form.watch("ai_provider") ?? "anthropic"
  const selectedSkills = form.watch("skills")

  // Track open transitions to only reset on fresh open
  const prevOpenRef = useRef(false)

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = isOpen
    if (!isOpen || wasOpen) return

    if (isNew) {
      form.reset(DEFAULTS)
      return
    }

    setLoading(true)
    getAgent(agentParam!).then((result) => {
      if (result.data) {
        const a = result.data
        const existingSkills = Array.isArray(a.skills)
          ? (a.skills as { id: string; name: string }[])
          : []
        form.reset({
          name: a.name,
          role: a.role,
          description: a.description ?? "",
          agent_type: a.agent_type as AgentFormValues["agent_type"],
          squad: a.squad as AgentFormValues["squad"],
          status: a.status as AgentFormValues["status"],
          ai_provider: a.ai_provider ?? "anthropic",
          ai_model: a.ai_model ?? "claude-sonnet-4-6",
          reports_to: a.reports_to ?? null,
          is_active: a.is_active ?? true,
          skills: existingSkills,
        })
      }
      setLoading(false)
    })
  }, [isOpen, isNew, agentParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("agent")
    const qs = params.toString()
    router.push(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false })
  }, [router, searchParams])

  const onSubmit = async (values: AgentFormValues) => {
    setSaving(true)
    try {
      const result = isNew
        ? await createAgent(orgId, {
            ...values,
            sort_order: 0,
            capabilities: [],
          } as Parameters<typeof createAgent>[1])
        : await updateAgent(agentParam!, values)

      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(isNew ? "Agent created" : "Agent updated")
      handleClose()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = form.handleSubmit(onSubmit)

  // Toggle a skill on/off
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

  // Build model options for current provider
  const modelOptions = (MODEL_MAP[provider] ?? MODEL_MAP.anthropic).map((m) => ({
    id: m.id,
    label: m.label,
  }))

  // Build "reports to" options
  const reportsToOptions: PickerOption[] = [
    { id: "none", label: "No supervisor" },
    ...agents
      .filter((a) => a.id !== agentParam)
      .map((a) => ({ id: a.id, label: `${a.name} (${a.role})` })),
  ]

  // Installed skills only
  const installedSkills = skills.filter((s) => s.installed && s.enabled)

  return (
    <QuickCreateModalLayout
      open={isOpen}
      onClose={handleClose}
      onSubmitShortcut={handleSubmit}
    >
      {loading ? (
        <div className="space-y-4 py-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-accent/60 rounded-md animate-pulse" />
          ))}
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Header row: icon + close */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Robot className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {isNew ? "New Agent" : "Edit Agent"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Name input (large) */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <input
                      {...field}
                      type="text"
                      placeholder="Agent name"
                      className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
                      autoComplete="off"
                      autoFocus
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Role input */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <input
                      {...field}
                      type="text"
                      placeholder="Role (e.g. Senior Frontend Engineer)"
                      className="w-full text-sm text-foreground placeholder:text-muted-foreground outline-none bg-transparent border-none p-0"
                      autoComplete="off"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="What does this agent do?"
                      rows={2}
                      className="w-full text-sm text-muted-foreground placeholder:text-muted-foreground/60 outline-none bg-transparent border-none p-0 resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Property pills row */}
            <div className="flex flex-wrap gap-2.5 items-start w-full">
              {/* Type */}
              <FormField
                control={form.control}
                name="agent_type"
                render={({ field }) => (
                  <GenericPicker
                    items={TYPE_OPTIONS}
                    selectedId={field.value}
                    onSelect={(item) => field.onChange(item.id)}
                    placeholder="Agent type..."
                    renderItem={(item) => <span>{item.label}</span>}
                    trigger={
                      <button
                        type="button"
                        className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors"
                      >
                        <Lightning className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm leading-5">
                          {TYPE_OPTIONS.find((o) => o.id === field.value)?.label ?? "Type"}
                        </span>
                      </button>
                    }
                  />
                )}
              />

              {/* Squad */}
              <FormField
                control={form.control}
                name="squad"
                render={({ field }) => (
                  <GenericPicker
                    items={SQUAD_OPTIONS}
                    selectedId={field.value}
                    onSelect={(item) => field.onChange(item.id)}
                    placeholder="Squad..."
                    renderItem={(item) => <span>{item.label}</span>}
                    trigger={
                      <button
                        type="button"
                        className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors"
                      >
                        <Users className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm leading-5">
                          {SQUAD_OPTIONS.find((o) => o.id === field.value)?.label ?? "Squad"}
                        </span>
                      </button>
                    }
                  />
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <GenericPicker
                    items={STATUS_OPTIONS}
                    selectedId={field.value}
                    onSelect={(item) => field.onChange(item.id)}
                    placeholder="Status..."
                    renderItem={(item) => <span>{item.label}</span>}
                    trigger={
                      <button
                        type="button"
                        className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors"
                      >
                        <CircleHalf className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm leading-5">
                          {STATUS_OPTIONS.find((o) => o.id === field.value)?.label ?? "Status"}
                        </span>
                      </button>
                    }
                  />
                )}
              />

              {/* Provider */}
              <FormField
                control={form.control}
                name="ai_provider"
                render={({ field }) => (
                  <GenericPicker
                    items={PROVIDER_OPTIONS}
                    selectedId={field.value ?? "anthropic"}
                    onSelect={(item) => {
                      field.onChange(item.id)
                      const models = MODEL_MAP[item.id] ?? MODEL_MAP.anthropic
                      form.setValue("ai_model", models[0].id)
                    }}
                    placeholder="Provider..."
                    renderItem={(item) => <span>{item.label}</span>}
                    trigger={
                      <button
                        type="button"
                        className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors"
                      >
                        <Plugs className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm leading-5">
                          {PROVIDER_OPTIONS.find((o) => o.id === (field.value ?? "anthropic"))
                            ?.label ?? "Provider"}
                        </span>
                      </button>
                    }
                  />
                )}
              />

              {/* Model */}
              <FormField
                control={form.control}
                name="ai_model"
                render={({ field }) => (
                  <GenericPicker
                    items={modelOptions}
                    selectedId={field.value ?? ""}
                    onSelect={(item) => field.onChange(item.id)}
                    placeholder="Model..."
                    renderItem={(item) => <span>{item.label}</span>}
                    trigger={
                      <button
                        type="button"
                        className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors"
                      >
                        <Cpu className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm leading-5">
                          {modelOptions.find((o) => o.id === field.value)?.label ?? "Model"}
                        </span>
                      </button>
                    }
                  />
                )}
              />

              {/* Reports To */}
              <FormField
                control={form.control}
                name="reports_to"
                render={({ field }) => (
                  <GenericPicker
                    items={reportsToOptions}
                    selectedId={field.value ?? "none"}
                    onSelect={(item) => field.onChange(item.id === "none" ? null : item.id)}
                    placeholder="Reports to..."
                    renderItem={(item) => <span>{item.label}</span>}
                    trigger={
                      <button
                        type="button"
                        className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors"
                      >
                        <TreeStructure className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm leading-5">
                          {field.value
                            ? reportsToOptions.find((o) => o.id === field.value)?.label ?? "Reports to"
                            : "Reports to"}
                        </span>
                      </button>
                    }
                  />
                )}
              />

              {/* Active toggle */}
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <div className="flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border bg-background">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="scale-75"
                    />
                    <span className="font-medium text-foreground text-sm leading-5">Active</span>
                  </div>
                )}
              />
            </div>

            {/* Skills section */}
            {installedSkills.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {installedSkills.map((skill) => {
                    const isSelected = selectedSkills.some((s) => s.id === skill.id)
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
                        {isSelected && <Check className="size-3" />}
                        {skill.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 mt-auto pt-4">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.watch("name")?.trim()}
                className="h-10 px-4 rounded-xl"
              >
                {saving ? "Saving..." : isNew ? "Create Agent" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </QuickCreateModalLayout>
  )
}
