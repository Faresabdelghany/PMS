"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAgent, createAgent, updateAgent } from "@/lib/actions/agents"
import type { AgentWithSupervisor } from "@/lib/supabase/types"

const MODEL_MAP: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-3-5", label: "Claude Haiku 3.5" },
  ],
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "o1", label: "o1" },
    { value: "o3-mini", label: "o3-mini" },
  ],
  other: [{ value: "custom", label: "Custom / Other" }],
}

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
}

interface AgentDetailPanelProps {
  agents: AgentWithSupervisor[]
  orgId: string
}

export function AgentDetailPanel({ agents, orgId }: AgentDetailPanelProps) {
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

  useEffect(() => {
    if (!agentParam || agentParam === "new") {
      form.reset(DEFAULTS)
      return
    }
    setLoading(true)
    getAgent(agentParam).then((result) => {
      if (result.data) {
        const a = result.data
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
        })
      }
      setLoading(false)
    })
  }, [agentParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => router.push("/agents")

  const onSubmit = async (values: AgentFormValues) => {
    setSaving(true)
    try {
      const result = isNew
        ? await createAgent(orgId, {
            ...values,
            sort_order: 0,
            capabilities: [],
            skills: [],
          } as Parameters<typeof createAgent>[1])
        : await updateAgent(agentParam!, values)

      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(isNew ? "Agent created" : "Agent updated")
      router.push("/agents")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-[440px] sm:w-[500px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <SheetTitle className="text-base font-semibold leading-snug">
            {isNew ? "New Agent" : "Edit Agent"}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 px-5 py-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 bg-accent rounded animate-pulse" />
                <div className="h-9 bg-accent/60 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Agent name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Senior Frontend Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What does this agent do?"
                          rows={3}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="agent_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="supreme">Supreme</SelectItem>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="specialist">Specialist</SelectItem>
                            <SelectItem value="integration">Integration</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="squad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Squad</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="engineering">Engineering</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="busy">Busy</SelectItem>
                          <SelectItem value="idle">Idle</SelectItem>
                          <SelectItem value="offline">Offline</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ai_provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Provider</FormLabel>
                      <Select
                        value={field.value ?? "anthropic"}
                        onValueChange={(val) => {
                          field.onChange(val)
                          const models = MODEL_MAP[val] ?? MODEL_MAP.anthropic
                          form.setValue("ai_model", models[0].value)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ai_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Model</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(MODEL_MAP[provider] ?? MODEL_MAP.anthropic).map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reports_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reports To</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No supervisor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">— No supervisor</SelectItem>
                          {agents
                            .filter((a) => a.id !== agentParam)
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name} ({a.role})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <FormLabel className="text-sm font-medium">Active</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Agent can receive tasks and commands
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t border-border p-4 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : isNew ? "Create Agent" : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  )
}
