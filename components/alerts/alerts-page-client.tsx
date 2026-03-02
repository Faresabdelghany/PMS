"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Bell } from "@phosphor-icons/react/dist/ssr/Bell"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  getAlertHistory,
} from "@/lib/actions/alerts"
import type {
  AlertRule,
  AlertHistoryEntry,
  AlertEntityType,
  AlertOperator,
  AlertActionType,
} from "@/lib/actions/alerts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

// ── Constants ─────────────────────────────────────────────────────────

const ENTITY_TYPES: { value: AlertEntityType; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "task", label: "Task" },
  { value: "session", label: "Session" },
  { value: "gateway", label: "Gateway" },
  { value: "cost", label: "Cost" },
]

const OPERATORS: { value: AlertOperator; label: string }[] = [
  { value: "=", label: "= (equals)" },
  { value: "!=", label: "!= (not equals)" },
  { value: ">", label: "> (greater than)" },
  { value: "<", label: "< (less than)" },
  { value: ">=", label: ">= (greater or equal)" },
  { value: "<=", label: "<= (less or equal)" },
  { value: "contains", label: "contains" },
]

const ACTION_TYPES: { value: AlertActionType; label: string }[] = [
  { value: "notification", label: "Notification" },
  { value: "webhook", label: "Webhook" },
  { value: "email", label: "Email" },
]

const ENTITY_BADGE_CLASSES: Record<AlertEntityType, string> = {
  agent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  task: "bg-green-500/10 text-green-600 border-green-500/20",
  session: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  gateway: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  cost: "bg-red-500/10 text-red-600 border-red-500/20",
}

// ── Default form state ────────────────────────────────────────────────

interface RuleFormState {
  name: string
  entity_type: AlertEntityType
  condition_field: string
  condition_operator: AlertOperator
  condition_value: string
  action_type: AlertActionType
  action_target: string
  cooldown_minutes: number
  enabled: boolean
}

const DEFAULT_FORM: RuleFormState = {
  name: "",
  entity_type: "agent",
  condition_field: "",
  condition_operator: "=",
  condition_value: "",
  action_type: "notification",
  action_target: "",
  cooldown_minutes: 60,
  enabled: true,
}

// ── Component ─────────────────────────────────────────────────────────

interface AlertsPageClientProps {
  orgId: string
}

export function AlertsPageClient({ orgId }: AlertsPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Data
  const [rules, setRules] = useState<AlertRule[]>([])
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null)
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM)

  // History expansion
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const [rulesResult, historyResult] = await Promise.all([
      getAlertRules(orgId),
      getAlertHistory(orgId),
    ])
    if (rulesResult.data) setRules(rulesResult.data)
    if (historyResult.data) setHistory(historyResult.data)
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Form helpers ──────────────────────────────────────────────────

  function updateForm(patch: Partial<RuleFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function openCreate() {
    setForm(DEFAULT_FORM)
    setEditingRule(null)
    setShowCreateDialog(true)
  }

  function openEdit(rule: AlertRule) {
    setEditingRule(rule)
    setForm({
      name: rule.name,
      entity_type: rule.entity_type,
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
      action_type: rule.action_type,
      action_target: rule.action_target ?? "",
      cooldown_minutes: rule.cooldown_minutes,
      enabled: rule.enabled,
    })
    setShowCreateDialog(true)
  }

  function closeDialog() {
    setShowCreateDialog(false)
    setEditingRule(null)
    setForm(DEFAULT_FORM)
  }

  // ── Actions ───────────────────────────────────────────────────────

  function handleSave() {
    if (!form.name.trim() || !form.condition_field.trim() || !form.condition_value.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    startTransition(async () => {
      const payload = {
        name: form.name.trim(),
        entity_type: form.entity_type,
        condition_field: form.condition_field.trim(),
        condition_operator: form.condition_operator,
        condition_value: form.condition_value.trim(),
        action_type: form.action_type,
        action_target: form.action_target.trim() || null,
        cooldown_minutes: form.cooldown_minutes,
        enabled: form.enabled,
      }

      if (editingRule) {
        const result = await updateAlertRule(orgId, editingRule.id, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Alert rule updated")
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? result.data! : r))
        )
      } else {
        const result = await createAlertRule(orgId, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Alert rule created")
        setRules((prev) => [result.data!, ...prev])
      }

      closeDialog()
      router.refresh()
    })
  }

  function handleToggle(rule: AlertRule, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleAlertRule(orgId, rule.id, enabled)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? result.data! : r))
      )
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id

    startTransition(async () => {
      const result = await deleteAlertRule(orgId, id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Alert rule deleted")
      setRules((prev) => prev.filter((r) => r.id !== id))
      setDeleteTarget(null)
      router.refresh()
    })
  }

  // ── Condition summary ─────────────────────────────────────────────

  function conditionSummary(rule: AlertRule) {
    return `${rule.entity_type}.${rule.condition_field} ${rule.condition_operator} ${rule.condition_value}`
  }

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading alerts...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue="rules">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>

        {/* ── Rules Tab ──────────────────────────────────────────── */}
        <TabsContent value="rules" className="mt-4">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
              <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No alert rules yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                Create rules to get notified when important events happen.
              </p>
              <Button size="sm" variant="outline" onClick={openCreate}>
                Create your first rule
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rules.map((rule) => (
                <Card key={rule.id} className="transition-colors hover:bg-muted/30">
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Enable toggle */}
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => handleToggle(rule, checked)}
                      disabled={isPending}
                    />

                    {/* Rule info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{rule.name}</p>
                        <Badge
                          variant="outline"
                          className={ENTITY_BADGE_CLASSES[rule.entity_type]}
                        >
                          {rule.entity_type}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground">
                          {rule.action_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {conditionSummary(rule)}
                      </p>
                      {rule.last_triggered_at && (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Last triggered{" "}
                          {formatDistanceToNow(new Date(rule.last_triggered_at), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                    </div>

                    {/* Cooldown info */}
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {rule.cooldown_minutes}m cooldown
                    </p>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(rule)}
                        disabled={isPending}
                      >
                        <PencilSimple className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(rule)}
                        disabled={isPending}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── History Tab ────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
              <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No alert history</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Triggered alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {entry.rule && (
                            <Badge
                              variant="outline"
                              className={
                                ENTITY_BADGE_CLASSES[
                                  entry.rule.entity_type as AlertEntityType
                                ] ?? ""
                              }
                            >
                              {entry.rule.name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{entry.message}</p>
                      </div>

                      {/* Expand metadata */}
                      {entry.metadata &&
                        Object.keys(entry.metadata).length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs shrink-0"
                            onClick={() =>
                              setExpandedHistoryId(
                                expandedHistoryId === entry.id ? null : entry.id
                              )
                            }
                          >
                            {expandedHistoryId === entry.id
                              ? "Hide details"
                              : "Details"}
                          </Button>
                        )}
                    </div>

                    {/* Expanded metadata */}
                    {expandedHistoryId === entry.id &&
                      entry.metadata &&
                      Object.keys(entry.metadata).length > 0 && (
                        <pre className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create / Edit Dialog ──────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the alert rule configuration."
                : "Define a new alert rule to monitor your workspace."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name *</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g. Agent went offline"
                maxLength={200}
              />
            </div>

            {/* Entity Type */}
            <div className="space-y-1.5">
              <Label>Entity Type *</Label>
              <Select
                value={form.entity_type}
                onValueChange={(v) =>
                  updateForm({ entity_type: v as AlertEntityType })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition Field */}
            <div className="space-y-1.5">
              <Label htmlFor="condition-field">Condition Field *</Label>
              <Input
                id="condition-field"
                value={form.condition_field}
                onChange={(e) => updateForm({ condition_field: e.target.value })}
                placeholder="e.g. status"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                The field to monitor on the entity (e.g. status, error_count, response_time).
              </p>
            </div>

            {/* Condition Operator */}
            <div className="space-y-1.5">
              <Label>Operator *</Label>
              <Select
                value={form.condition_operator}
                onValueChange={(v) =>
                  updateForm({ condition_operator: v as AlertOperator })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition Value */}
            <div className="space-y-1.5">
              <Label htmlFor="condition-value">Value *</Label>
              <Input
                id="condition-value"
                value={form.condition_value}
                onChange={(e) => updateForm({ condition_value: e.target.value })}
                placeholder="e.g. error"
                maxLength={500}
              />
            </div>

            {/* Action Type */}
            <div className="space-y-1.5">
              <Label>Action Type</Label>
              <Select
                value={form.action_type}
                onValueChange={(v) =>
                  updateForm({ action_type: v as AlertActionType })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      {at.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Target */}
            <div className="space-y-1.5">
              <Label htmlFor="action-target">Action Target</Label>
              <Input
                id="action-target"
                value={form.action_target}
                onChange={(e) => updateForm({ action_target: e.target.value })}
                placeholder={
                  form.action_type === "webhook"
                    ? "https://hooks.example.com/..."
                    : form.action_type === "email"
                      ? "team@example.com"
                      : "Optional"
                }
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {form.action_type === "webhook"
                  ? "URL to receive the webhook payload."
                  : form.action_type === "email"
                    ? "Email address to send alerts to."
                    : "Leave empty for in-app notifications."}
              </p>
            </div>

            {/* Cooldown */}
            <div className="space-y-1.5">
              <Label htmlFor="cooldown">Cooldown (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                min={1}
                max={10080}
                value={form.cooldown_minutes}
                onChange={(e) =>
                  updateForm({
                    cooldown_minutes: Math.max(
                      1,
                      Math.min(10080, parseInt(e.target.value, 10) || 60)
                    ),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum time between repeated triggers (1 min to 7 days).
              </p>
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="enabled-switch">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  The rule will start evaluating immediately when enabled.
                </p>
              </div>
              <Switch
                id="enabled-switch"
                checked={form.enabled}
                onCheckedChange={(checked) => updateForm({ enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isPending ||
                !form.name.trim() ||
                !form.condition_field.trim() ||
                !form.condition_value.trim()
              }
            >
              {isPending
                ? editingRule
                  ? "Saving..."
                  : "Creating..."
                : editingRule
                  ? "Save Changes"
                  : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This will also remove
              all associated history entries. This action cannot be undone.
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
