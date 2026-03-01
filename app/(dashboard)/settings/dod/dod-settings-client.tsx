"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus } from "lucide-react"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
  createDoDPolicy,
  updateDoDPolicy,
  deleteDoDPolicy,
  type DoDPolicy,
  type DoDPolicyInsert,
  type DoDCheckResultHistory,
} from "@/lib/actions/dod-policies"
import type { DoDCheckConfig, DoDCheckType } from "@/lib/mission-control/dod-runner"

// ── Schema ──────────────────────────────────────────────────────────

const CHECK_TYPE_OPTIONS: { value: DoDCheckType; label: string; description: string }[] = [
  { value: "required_fields", label: "Required Fields", description: "Ensure specific task fields are filled" },
  { value: "reviewer_approved", label: "Reviewer Approved", description: "Require reviewer approval" },
  { value: "tests_passing", label: "Tests Passing", description: "Check if tests are passing (via metadata)" },
  { value: "pr_merged", label: "PR Merged", description: "Require linked PR to be merged" },
  { value: "documentation_updated", label: "Documentation Updated", description: "Check if documentation was updated" },
]

const DEFAULT_REQUIRED_FIELDS_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "description", label: "Description" },
  { value: "assignee_id", label: "Assignee" },
  { value: "end_date", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "tag", label: "Tag" },
]

const policyFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  mode: z.enum(["warn", "block", "auto-reopen"]),
  project_id: z.string().nullable(),
  selectedChecks: z.array(z.string()).min(1, "Select at least one check"),
  requiredFields: z.array(z.string()),
})

type PolicyFormValues = z.infer<typeof policyFormSchema>

// ── Types ───────────────────────────────────────────────────────────

type ProjectOption = { id: string; name: string }

interface DoDSettingsClientProps {
  orgId: string
  policies: DoDPolicy[]
  projects: ProjectOption[]
  history: DoDCheckResultHistory[]
}

const MODE_BADGE: Record<string, { label: string; className: string }> = {
  warn: { label: "Warn", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  block: { label: "Block", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  "auto-reopen": { label: "Auto-Reopen", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
}

function checksToForm(checks: DoDCheckConfig[]): { selectedChecks: string[]; requiredFields: string[] } {
  const selectedChecks = checks.map((c) => c.type)
  const requiredFields = checks
    .filter((c): c is Extract<DoDCheckConfig, { type: "required_fields" }> => c.type === "required_fields")
    .flatMap((c) => c.fields)
  return { selectedChecks, requiredFields }
}

function formToChecks(selectedChecks: string[], requiredFields: string[]): DoDCheckConfig[] {
  const configs: DoDCheckConfig[] = []
  for (const type of selectedChecks) {
    if (type === "required_fields") {
      configs.push({ type: "required_fields", fields: requiredFields.length > 0 ? requiredFields : ["name", "description", "assignee_id"] })
    } else {
      configs.push({ type } as DoDCheckConfig)
    }
  }
  return configs
}

// ── Component ───────────────────────────────────────────────────────

export function DoDSettingsClient({ orgId, policies: initialPolicies, projects, history }: DoDSettingsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [policies, setPolicies] = useState<DoDPolicy[]>(initialPolicies)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<DoDPolicy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      name: "",
      mode: "warn",
      project_id: null,
      selectedChecks: ["required_fields"],
      requiredFields: ["name", "description", "assignee_id"],
    },
  })

  const selectedChecks = form.watch("selectedChecks")

  const openCreateDialog = () => {
    setEditingPolicy(null)
    form.reset({
      name: "",
      mode: "warn",
      project_id: null,
      selectedChecks: ["required_fields"],
      requiredFields: ["name", "description", "assignee_id"],
    })
    setDialogOpen(true)
  }

  const openEditDialog = (policy: DoDPolicy) => {
    setEditingPolicy(policy)
    const { selectedChecks: sc, requiredFields: rf } = checksToForm(policy.checks)
    form.reset({
      name: policy.name,
      mode: policy.mode,
      project_id: policy.project_id,
      selectedChecks: sc.length > 0 ? sc : ["required_fields"],
      requiredFields: rf.length > 0 ? rf : ["name", "description", "assignee_id"],
    })
    setDialogOpen(true)
  }

  const handleSubmit = (values: PolicyFormValues) => {
    startTransition(async () => {
      const checks = formToChecks(values.selectedChecks, values.requiredFields)
      const input: DoDPolicyInsert = {
        name: values.name,
        mode: values.mode,
        project_id: values.project_id,
        checks,
      }

      if (editingPolicy) {
        const result = await updateDoDPolicy(editingPolicy.id, input)
        if (result.error) {
          toast.error(result.error)
          return
        }
        if (result.data) {
          setPolicies((prev) => prev.map((p) => (p.id === editingPolicy.id ? result.data! : p)))
          toast.success("Policy updated")
        }
      } else {
        const result = await createDoDPolicy(orgId, input)
        if (result.error) {
          toast.error(result.error)
          return
        }
        if (result.data) {
          setPolicies((prev) => [result.data!, ...prev])
          toast.success("Policy created")
        }
      }

      setDialogOpen(false)
      router.refresh()
    })
  }

  const handleToggleActive = (policy: DoDPolicy) => {
    startTransition(async () => {
      const result = await updateDoDPolicy(policy.id, { active: !policy.active })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        setPolicies((prev) => prev.map((p) => (p.id === policy.id ? result.data! : p)))
        toast.success(result.data.active ? "Policy enabled" : "Policy disabled")
      }
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteDoDPolicy(deleteTarget)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setPolicies((prev) => prev.filter((p) => p.id !== deleteTarget))
      setDeleteTarget(null)
      toast.success("Policy deleted")
      router.refresh()
    })
  }

  return (
    <>
      <Tabs defaultValue="policies">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="policies">
              Policies
              <Badge variant="secondary" className="ml-1.5 text-xs">{policies.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="history">
              Check History
              <Badge variant="secondary" className="ml-1.5 text-xs">{history.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Policy
          </Button>
        </div>

        <TabsContent value="policies" className="mt-4">
          {policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No DoD policies configured. Create one to enforce quality checks.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {policies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onEdit={() => openEditDialog(policy)}
                  onDelete={() => setDeleteTarget(policy.id)}
                  onToggleActive={() => handleToggleActive(policy)}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No check results yet. Results appear when tasks transition to done.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.check_name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          item.passed
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : item.overridden
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-red-500/10 text-red-600 border-red-500/20"
                        )}
                      >
                        {item.passed ? "Passed" : item.overridden ? "Overridden" : "Failed"}
                      </Badge>
                      {typeof item.metadata?.mode === "string" && (
                        <Badge variant="outline" className={cn("text-xs", MODE_BADGE[item.metadata.mode]?.className)}>
                          {MODE_BADGE[item.metadata.mode]?.label ?? item.metadata.mode}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.message}</p>
                    {item.overridden && item.override_reason && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Override reason: {item.override_reason}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60 shrink-0 ml-4">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create / Edit Policy Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : "New DoD Policy"}</DialogTitle>
            <DialogDescription>
              Define checks that must pass before tasks can be marked as done.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Engineering DoD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="warn">Warn (soft reminder)</SelectItem>
                        <SelectItem value="block">Block (prevents completion)</SelectItem>
                        <SelectItem value="auto-reopen">Auto-Reopen</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Scope</FormLabel>
                    <Select
                      value={field.value ?? "__all__"}
                      onValueChange={(val) => field.onChange(val === "__all__" ? null : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__all__">All Projects</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selectedChecks"
                render={() => (
                  <FormItem>
                    <FormLabel>Checks</FormLabel>
                    <div className="space-y-2">
                      {CHECK_TYPE_OPTIONS.map((option) => (
                        <FormField
                          key={option.value}
                          control={form.control}
                          name="selectedChecks"
                          render={({ field }) => (
                            <FormItem className="flex items-start gap-2.5">
                              <FormControl>
                                <Checkbox
                                  checked={field.value.includes(option.value)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, option.value])
                                    } else {
                                      field.onChange(field.value.filter((v) => v !== option.value))
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="leading-none">
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedChecks.includes("required_fields") && (
                <FormField
                  control={form.control}
                  name="requiredFields"
                  render={() => (
                    <FormItem>
                      <FormLabel>Required Fields</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {DEFAULT_REQUIRED_FIELDS_OPTIONS.map((option) => (
                          <FormField
                            key={option.value}
                            control={form.control}
                            name="requiredFields"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...field.value, option.value])
                                      } else {
                                        field.onChange(field.value.filter((v) => v !== option.value))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {editingPolicy ? "Update Policy" : "Create Policy"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this policy? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── PolicyCard ──────────────────────────────────────────────────────

interface PolicyCardProps {
  policy: DoDPolicy
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  isPending: boolean
}

function PolicyCard({ policy, onEdit, onDelete, onToggleActive, isPending }: PolicyCardProps) {
  const modeStyle = MODE_BADGE[policy.mode]

  const checkLabels = policy.checks.map((c) => {
    const opt = CHECK_TYPE_OPTIONS.find((o) => o.value === c.type)
    return opt?.label ?? c.type
  })

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold truncate">{policy.name}</span>
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0", modeStyle?.className)}
              >
                {modeStyle?.label ?? policy.mode}
              </Badge>
              {!policy.active && (
                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
                  Disabled
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {policy.project?.name ?? "All Projects"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={policy.active}
              onCheckedChange={onToggleActive}
              disabled={isPending}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} disabled={isPending}>
              <PencilSimple className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} disabled={isPending}>
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {checkLabels.map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
