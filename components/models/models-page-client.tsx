"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { toast } from "sonner"
import { Brain } from "@phosphor-icons/react/dist/ssr/Brain"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Star } from "@phosphor-icons/react/dist/ssr/Star"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  getUserModels,
  createUserModel,
  updateUserModel,
  deleteUserModel,
  setDefaultModel,
  type UserModel,
} from "@/lib/actions/user-models"
import {
  getModelAssignments,
  upsertModelAssignment,
  type ModelAssignment,
} from "@/lib/actions/model-assignments"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "meta", label: "Meta" },
  { value: "mistral", label: "Mistral" },
  { value: "other", label: "Other" },
] as const

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  openai: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  google: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  meta: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  mistral: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
}

const USE_CASES = [
  { key: "coding", label: "Coding" },
  { key: "research", label: "Research" },
  { key: "review", label: "Review" },
  { key: "communication", label: "Communication" },
  { key: "general", label: "General" },
] as const

interface FormState {
  display_name: string
  provider: string
  model_id: string
  context_window: string
  cost_input: string
  cost_output: string
  api_key: string
  is_default: boolean
}

const EMPTY_FORM: FormState = {
  display_name: "",
  provider: "anthropic",
  model_id: "",
  context_window: "",
  cost_input: "",
  cost_output: "",
  api_key: "",
  is_default: false,
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ModelsPageClientProps {
  orgId: string
}

export function ModelsPageClient({ orgId }: ModelsPageClientProps) {
  const [models, setModels] = useState<UserModel[]>([])
  const [assignments, setAssignments] = useState<ModelAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<UserModel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserModel | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null)

  // ---- Data loading ----

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [modelsRes, assignRes] = await Promise.all([
      getUserModels(orgId),
      getModelAssignments(orgId),
    ])
    if (modelsRes.data) setModels(modelsRes.data)
    if (assignRes.data) setAssignments(assignRes.data)
    if (modelsRes.error) toast.error(modelsRes.error)
    if (assignRes.error) toast.error(assignRes.error)
    setIsLoading(false)
  }, [orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ---- Form helpers ----

  const openAddDialog = () => {
    setEditingModel(null)
    setForm(EMPTY_FORM)
    setShowDialog(true)
  }

  const openEditDialog = (model: UserModel) => {
    setEditingModel(model)
    setForm({
      display_name: model.display_name,
      provider: model.provider,
      model_id: model.model_id,
      context_window: model.context_window != null ? String(model.context_window) : "",
      cost_input: model.cost_input != null ? String(model.cost_input) : "",
      cost_output: model.cost_output != null ? String(model.cost_output) : "",
      api_key: "",
      is_default: model.is_default,
    })
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditingModel(null)
    setForm(EMPTY_FORM)
  }

  const handleFormChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ---- CRUD ----

  const handleSubmit = () => {
    if (!form.display_name.trim() || !form.model_id.trim()) {
      toast.error("Display name and model ID are required.")
      return
    }

    startTransition(async () => {
      const payload = {
        organization_id: orgId,
        display_name: form.display_name.trim(),
        provider: form.provider,
        model_id: form.model_id.trim(),
        api_key_encrypted: form.api_key || undefined,
        is_default: form.is_default,
        context_window: form.context_window ? Number(form.context_window) : null,
        cost_input: form.cost_input ? Number(form.cost_input) : null,
        cost_output: form.cost_output ? Number(form.cost_output) : null,
      }

      if (editingModel) {
        const result = await updateUserModel(editingModel.id, {
          ...payload,
          api_key_encrypted: form.api_key ? form.api_key : undefined,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Model updated")
      } else {
        const result = await createUserModel(payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Model added")
      }

      closeDialog()
      await loadData()
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      const result = await deleteUserModel(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Model deleted")
      setDeleteTarget(null)
      await loadData()
    })
  }

  const handleSetDefault = (model: UserModel) => {
    startTransition(async () => {
      const result = await setDefaultModel(model.id, orgId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${model.display_name} set as default`)
      await loadData()
    })
  }

  const handleAssignmentChange = async (useCase: string, value: string) => {
    setSavingAssignment(useCase)
    const modelId = value === "__none__" ? null : value
    const result = await upsertModelAssignment(orgId, useCase, modelId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Updated ${useCase} assignment`)
      await loadData()
    }
    setSavingAssignment(null)
  }

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Brain className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      {/* Add Model button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">AI Models</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure AI models available to your organization.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" weight="bold" />
          Add Model
        </Button>
      </div>

      {/* Models Grid */}
      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <Brain className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No models configured yet. Add your first AI model.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1" weight="bold" />
            Add Model
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => {
            const providerColor =
              PROVIDER_COLORS[model.provider] ?? PROVIDER_COLORS.other
            return (
              <Card key={model.id} className="relative group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={providerColor}>
                        {model.provider}
                      </Badge>
                      {model.is_default && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-600 border-amber-500/20"
                        >
                          <Star className="h-3 w-3 mr-0.5" weight="fill" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditDialog(model)}
                        disabled={isPending}
                      >
                        <PencilSimple className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(model)}
                        disabled={isPending}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-sm font-medium mt-1">
                    {model.display_name}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs break-all">
                    {model.model_id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {model.context_window != null && (
                      <span>Context: {formatNumber(model.context_window)} tokens</span>
                    )}
                    {model.cost_input != null && (
                      <span>In: ${Number(model.cost_input).toFixed(2)}/1M</span>
                    )}
                    {model.cost_output != null && (
                      <span>Out: ${Number(model.cost_output).toFixed(2)}/1M</span>
                    )}
                  </div>
                  {!model.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs w-full mt-2"
                      onClick={() => handleSetDefault(model)}
                      disabled={isPending}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set as Default
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Use Case Assignments */}
      {models.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Use Case Assignments</CardTitle>
            <CardDescription className="text-xs">
              Assign a specific model to each use case. Unassigned use cases fall back to
              the default model.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                      Use Case
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                      Assigned Model
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {USE_CASES.map((uc) => {
                    const current = assignments.find((a) => a.use_case === uc.key)
                    return (
                      <tr key={uc.key} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5 font-medium text-foreground capitalize">
                          {uc.label}
                        </td>
                        <td className="px-4 py-2">
                          <Select
                            value={current?.user_model_id ?? "__none__"}
                            onValueChange={(v) => handleAssignmentChange(uc.key, v)}
                            disabled={savingAssignment === uc.key}
                          >
                            <SelectTrigger className="h-8 w-full max-w-xs text-xs">
                              <SelectValue placeholder="Not set (use default)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                Not set (use default)
                              </SelectItem>
                              {models.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.display_name} ({m.provider})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingModel ? "Edit Model" : "Add Model"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                placeholder="e.g. Claude Sonnet 4"
                value={form.display_name}
                onChange={(e) => handleFormChange("display_name", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => handleFormChange("provider", v)}
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model_id">Model ID</Label>
              <Input
                id="model_id"
                placeholder="e.g. claude-sonnet-4-20250514"
                className="font-mono text-sm"
                value={form.model_id}
                onChange={(e) => handleFormChange("model_id", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="context_window">Context Window</Label>
                <Input
                  id="context_window"
                  type="number"
                  placeholder="200000"
                  value={form.context_window}
                  onChange={(e) => handleFormChange("context_window", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cost_input">$/1M Input</Label>
                <Input
                  id="cost_input"
                  type="number"
                  step="0.01"
                  placeholder="3.00"
                  value={form.cost_input}
                  onChange={(e) => handleFormChange("cost_input", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cost_output">$/1M Output</Label>
                <Input
                  id="cost_output"
                  type="number"
                  step="0.01"
                  placeholder="15.00"
                  value={form.cost_output}
                  onChange={(e) => handleFormChange("cost_output", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                placeholder={editingModel ? "Leave blank to keep current key" : "Enter API key"}
                value={form.api_key}
                onChange={(e) => handleFormChange("api_key", e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_default"
                checked={form.is_default}
                onCheckedChange={(v) => handleFormChange("is_default", v)}
              />
              <Label htmlFor="is_default" className="cursor-pointer">
                Set as Default Model
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? "Saving..."
                : editingModel
                  ? "Update Model"
                  : "Add Model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.display_name}</strong>. Any use-case
              assignments using this model will be unset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
