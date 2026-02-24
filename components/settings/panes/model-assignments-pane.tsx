"use client"

import { useState, useEffect, useCallback } from "react"
import { Spinner } from "@phosphor-icons/react/dist/ssr/Spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsPaneHeader, SettingSection, SettingRow } from "../setting-primitives"
import { getUserModels, type UserModel } from "@/lib/actions/user-models"
import {
  getModelAssignments,
  upsertModelAssignment,
  type ModelAssignment,
} from "@/lib/actions/model-assignments"
import { useOrganization } from "@/hooks/use-organization"

const USE_CASES = [
  { key: "heartbeat_crons", label: "Heartbeat Crons", description: "Model for agent heartbeat checks (runs every 15 min). Recommend: free/cheap." },
  { key: "daily_standup", label: "Daily Standup", description: "Model for the daily standup summary (runs at 10 PM)." },
  { key: "sub_agent_default", label: "Sub-Agent Default", description: "Default model when spawning sub-agents for tasks." },
  { key: "ai_chat", label: "AI Chat", description: "Model for the in-app AI chat assistant." },
  { key: "task_generation", label: "Task Generation", description: "Model for smart task generation from project descriptions." },
  { key: "note_summarization", label: "Note Summarization", description: "Model for summarizing meeting notes and updates." },
  { key: "project_description", label: "Project Descriptions", description: "Model for generating project descriptions." },
] as const

export function ModelAssignmentsPane() {
  const { organization } = useOrganization()
  const orgId = organization?.id ?? ""
  const [models, setModels] = useState<UserModel[]>([])
  const [assignments, setAssignments] = useState<ModelAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setIsLoading(true)
    const [modelsRes, assignRes] = await Promise.all([
      getUserModels(orgId),
      getModelAssignments(orgId),
    ])
    if (modelsRes.data) setModels(modelsRes.data)
    if (assignRes.data) setAssignments(assignRes.data)
    if (modelsRes.error || assignRes.error) setError(modelsRes.error || assignRes.error || null)
    setIsLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const handleChange = async (useCase: string, value: string) => {
    if (!orgId) return
    setSavingKey(useCase)
    setError(null)
    const modelId = value === "__none__" ? null : value
    const result = await upsertModelAssignment(orgId, useCase, modelId)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`Updated ${USE_CASES.find(u => u.key === useCase)?.label ?? useCase}`)
      setTimeout(() => setSuccess(null), 2000)
      await load()
    }
    setSavingKey(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsPaneHeader
        title="Model Assignments"
        description="Choose which AI model powers each system function. Agents have their own model setting on the Agents page."
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">{error}</div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 text-sm">{success}</div>
      )}

      {models.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No models configured yet. Add models in the <span className="font-medium text-foreground">Models</span> settings first.
        </div>
      ) : (
        <SettingSection title="System Functions" description="Select which model to use for each function.">
          {USE_CASES.map((uc) => {
            const current = assignments.find((a) => a.use_case === uc.key)
            return (
              <SettingRow key={uc.key} label={uc.label} description={uc.description}>
                <Select
                  value={current?.user_model_id ?? "__none__"}
                  onValueChange={(v) => handleChange(uc.key, v)}
                  disabled={savingKey === uc.key}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue placeholder="Not set (use default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set (use default)</SelectItem>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name} ({m.provider}/{m.model_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            )
          })}
        </SettingSection>
      )}
    </div>
  )
}
