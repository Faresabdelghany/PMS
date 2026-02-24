"use client"

import { useState, useEffect, useCallback } from "react"
import { Spinner } from "@phosphor-icons/react/dist/ssr/Spinner"
import { Eye } from "@phosphor-icons/react/dist/ssr/Eye"
import { EyeClosed } from "@phosphor-icons/react/dist/ssr/EyeClosed"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { Star } from "@phosphor-icons/react/dist/ssr/Star"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsPaneHeader } from "../setting-primitives"
import { AI_MODELS, AI_PROVIDERS } from "@/lib/constants/ai"
import {
  getUserModels,
  createUserModel,
  updateUserModel,
  deleteUserModel,
  setDefaultModel,
  type UserModel,
} from "@/lib/actions/user-models"
import { useOrganization } from "@/hooks/use-organization"
import { Separator } from "@/components/ui/separator"
import {
  getModelAssignments,
  upsertModelAssignment,
  type ModelAssignment,
} from "@/lib/actions/model-assignments"

function maskApiKey(key: string | null): string {
  if (!key) return "—"
  if (key.length <= 8) return "••••••••"
  return "••••••••" + key.slice(-4)
}

interface ModelFormData {
  display_name: string
  provider: string
  model_id: string
  api_key: string
  is_default: boolean
}

const emptyForm: ModelFormData = {
  display_name: "",
  provider: "",
  model_id: "",
  api_key: "",
  is_default: false,
}

const USE_CASES = [
  { key: "heartbeat_crons", label: "Heartbeat Crons", description: "Model for agent heartbeat checks (every 15 min). Recommend: free/cheap model." },
  { key: "daily_standup", label: "Daily Standup", description: "Model for generating the daily standup summary (runs at 10 PM)." },
  { key: "sub_agent_default", label: "Sub-Agent Default", description: "Default model when spawning sub-agents for tasks." },
  { key: "ai_chat", label: "AI Chat", description: "Model for the in-app AI chat assistant." },
  { key: "task_generation", label: "Task Generation", description: "Model for smart task generation from project descriptions." },
  { key: "note_summarization", label: "Note Summarization", description: "Model for summarizing meeting notes and updates." },
  { key: "project_description", label: "Project Descriptions", description: "Model for generating project descriptions." },
] as const

export function AgentsPane() {
  const { organization } = useOrganization()
  const orgId = organization?.id ?? ""
  const [models, setModels] = useState<UserModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Model assignments state
  const [assignments, setAssignments] = useState<ModelAssignment[]>([])

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ModelFormData>(emptyForm)
  const [showApiKey, setShowApiKey] = useState(false)

  const loadAssignments = useCallback(async () => {
    if (!orgId) return
    const result = await getModelAssignments(orgId)
    if (result.data) setAssignments(result.data)
  }, [orgId])

  const handleAssignmentChange = async (useCase: string, userModelId: string) => {
    if (!orgId) return
    const modelId = userModelId === "__none__" ? null : userModelId
    const result = await upsertModelAssignment(orgId, useCase, modelId)
    if (result.error) {
      setError(result.error)
    } else {
      await loadAssignments()
    }
  }

  const loadModels = useCallback(async () => {
    if (!orgId) return
    setIsLoading(true)
    const result = await getUserModels(orgId)
    if (result.data) setModels(result.data)
    if (result.error) setError(result.error)
    setIsLoading(false)
  }, [orgId])

  useEffect(() => {
    loadModels()
    loadAssignments()
  }, [loadModels, loadAssignments])

  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setShowApiKey(false)
  }

  const handleEdit = (model: UserModel) => {
    setEditingId(model.id)
    setForm({
      display_name: model.display_name,
      provider: model.provider,
      model_id: model.model_id,
      api_key: "",
      is_default: model.is_default,
    })
    setShowForm(true)
    setShowApiKey(false)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  const handleSave = async () => {
    if (!form.display_name.trim() || !form.provider || !form.model_id) {
      setError("Display name, provider, and model are required.")
      return
    }
    setIsSaving(true)
    setError(null)

    const payload = {
      organization_id: orgId,
      display_name: form.display_name.trim(),
      provider: form.provider,
      model_id: form.model_id,
      api_key_encrypted: form.api_key.trim() || undefined,
      is_default: form.is_default,
    }

    let result
    if (editingId) {
      result = await updateUserModel(editingId, payload)
    } else {
      result = await createUserModel(payload)
    }

    if (result.error) {
      setError(result.error)
    } else {
      handleCancel()
      await loadModels()
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this model configuration?")) return
    setIsSaving(true)
    const result = await deleteUserModel(id)
    if (result.error) setError(result.error)
    else await loadModels()
    setIsSaving(false)
  }

  const handleSetDefault = async (id: string) => {
    setIsSaving(true)
    const result = await setDefaultModel(id, orgId)
    if (result.error) setError(result.error)
    else await loadModels()
    setIsSaving(false)
  }

  const providerModels = form.provider ? AI_MODELS[form.provider] || [] : []

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
        title="Models"
        description="Manage AI models available to your agents."
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">{error}</div>
      )}

      {/* Model list */}
      <div className="space-y-3">
        {models.map((model) => (
          <div
            key={model.id}
            className={`flex items-center justify-between rounded-lg border p-4 ${
              model.is_default ? "border-primary/50 bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{model.display_name}</span>
                {model.is_default && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs font-normal">
                  {AI_PROVIDERS[model.provider]?.name ?? model.provider}
                </Badge>
                <span>{model.model_id}</span>
                <span className="text-muted-foreground/60">
                  {maskApiKey(model.api_key_encrypted)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!model.is_default && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleSetDefault(model.id)}
                  disabled={isSaving}
                  title="Set as default"
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(model)}
                disabled={isSaving}
              >
                <PencilSimple className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(model.id)}
                disabled={isSaving}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {models.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No models configured yet. Add one to get started.
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
          <h3 className="text-sm font-semibold">
            {editingId ? "Edit Model" : "Add Model"}
          </h3>

          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Display Name
              </label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder='e.g. "Fast Claude", "GPT for Tasks"'
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Provider
                </label>
                <Select
                  value={form.provider}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      provider: v,
                      model_id: AI_MODELS[v]?.[0]?.value ?? "",
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AI_PROVIDERS).map(([key, { name }]) => (
                      <SelectItem key={key} value={key}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Model
                </label>
                <Select
                  value={form.model_id}
                  onValueChange={(v) => setForm({ ...form, model_id: v })}
                  disabled={!form.provider}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerModels.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                API Key {editingId && "(leave blank to keep current)"}
              </label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="Enter API key"
                  className="pr-10 h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeClosed className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_default"
                checked={form.is_default}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_default: checked === true })
                }
              />
              <label htmlFor="is_default" className="text-sm">
                Set as default model
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button onClick={handleAdd} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Model
        </Button>
      )}

      {/* Model Assignments */}
      <Separator />
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Model Assignments</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Assign which model to use for each system function.
          </p>
        </div>
        {USE_CASES.map((uc) => {
          const current = assignments.find((a) => a.use_case === uc.key)
          return (
            <div key={uc.key} className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium">{uc.label}</span>
                <span className="text-xs text-muted-foreground">{uc.description}</span>
              </div>
              <Select
                value={current?.user_model_id ?? "__none__"}
                onValueChange={(v) => handleAssignmentChange(uc.key, v)}
              >
                <SelectTrigger className="h-9 w-[220px] shrink-0 text-sm">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name} ({m.provider}/{m.model_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      {/* Help text */}
      <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
        <p className="font-medium">Where to get API keys:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          {Object.entries(AI_PROVIDERS).map(([key, { name, keyUrl }]) => (
            <li key={key}>
              <a
                href={keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {name} API Keys
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
