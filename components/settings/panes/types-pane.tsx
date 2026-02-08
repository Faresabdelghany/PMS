"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { Pencil } from "@phosphor-icons/react/dist/ssr/Pencil"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle"
import { Lock } from "@phosphor-icons/react/dist/ssr/Lock"
import { Spinner } from "@phosphor-icons/react/dist/ssr/Spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { SettingsPaneHeader } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import {
  getWorkflowStatuses,
  createWorkflowStatus,
  updateWorkflowStatus,
  deleteWorkflowStatus,
  initializeWorkflowStatuses,
  type WorkflowStatus,
  type WorkflowCategory,
  type WorkflowEntityType,
} from "@/lib/actions/workflow-statuses"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const typeNav = [
  { id: "task" as const, label: "Task", icon: "☑" },
  { id: "project" as const, label: "Project", icon: "▲" },
  { id: "workstream" as const, label: "Workstream", icon: "★" },
]

const categoryLabels: Record<WorkflowCategory, string> = {
  unstarted: "Unstarted",
  started: "Started",
  finished: "Finished",
  canceled: "Canceled",
}

const categoryOrder: WorkflowCategory[] = ["unstarted", "started", "finished", "canceled"]

export function TypesPane() {
  const { organization } = useOrganization()
  const [activeType, setActiveType] = useState<WorkflowEntityType>("task")
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<WorkflowStatus | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<WorkflowCategory>("started")

  // Form states
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")

  const loadStatuses = useCallback(async () => {
    if (!organization?.id) return
    setIsLoading(true)
    const result = await getWorkflowStatuses(organization.id, activeType)
    if (result.data) {
      // If no statuses exist, initialize defaults
      if (result.data.length === 0) {
        const initResult = await initializeWorkflowStatuses(organization.id)
        if (!initResult.error) {
          const reloadResult = await getWorkflowStatuses(organization.id, activeType)
          if (reloadResult.data) {
            setStatuses(reloadResult.data)
          }
        }
      } else {
        setStatuses(result.data)
      }
    } else if (result.error) {
      toast.error(result.error)
    }
    setIsLoading(false)
  }, [organization?.id, activeType])

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  const handleCreate = () => {
    startTransition(async () => {
      if (!organization?.id) return
      const result = await createWorkflowStatus(organization.id, {
        entity_type: activeType,
        category: selectedCategory,
        name: formName,
        description: formDescription || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Status created")
        setCreateDialogOpen(false)
        setFormName("")
        setFormDescription("")
        loadStatuses()
      }
    })
  }

  const handleUpdate = () => {
    if (!selectedStatus) return
    startTransition(async () => {
      const result = await updateWorkflowStatus(selectedStatus.id, {
        name: formName,
        description: formDescription || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Status updated")
        setEditDialogOpen(false)
        setSelectedStatus(null)
        setFormName("")
        setFormDescription("")
        loadStatuses()
      }
    })
  }

  const handleDelete = () => {
    if (!selectedStatus) return
    startTransition(async () => {
      const result = await deleteWorkflowStatus(selectedStatus.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Status deleted")
        setDeleteDialogOpen(false)
        setSelectedStatus(null)
        loadStatuses()
      }
    })
  }

  const openCreateDialog = (category: WorkflowCategory) => {
    setSelectedCategory(category)
    setFormName("")
    setFormDescription("")
    setCreateDialogOpen(true)
  }

  const openEditDialog = (status: WorkflowStatus) => {
    setSelectedStatus(status)
    setFormName(status.name)
    setFormDescription(status.description || "")
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (status: WorkflowStatus) => {
    setSelectedStatus(status)
    setDeleteDialogOpen(true)
  }

  const stepIcon = (category: WorkflowCategory) => {
    switch (category) {
      case "started":
        return { Icon: Circle, className: "text-blue-500" }
      case "finished":
        return { Icon: CheckCircle, className: "text-green-500" }
      case "canceled":
        return { Icon: Circle, className: "text-red-500" }
      default:
        return { Icon: Circle, className: "text-muted-foreground" }
    }
  }

  const groupedStatuses = categoryOrder.reduce((acc, category) => {
    acc[category] = statuses.filter((s) => s.category === category)
    return acc
  }, {} as Record<WorkflowCategory, WorkflowStatus[]>)

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Types"
        description="Configure workflow statuses and properties for your tasks, projects, and workstreams."
      />

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="border-b border-border/60 bg-card/70 lg:border-b-0 lg:border-r">
            <div className="px-4 py-3 border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Types
            </div>
            <div>
              {typeNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveType(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-3 text-sm transition",
                    activeType === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 bg-background/40 p-6">
            <div>
              <p className="text-sm font-semibold text-foreground">Edit type</p>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={typeNav.find((t) => t.id === activeType)?.label}
                  readOnly
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <Separator className="bg-border/80" />

            <div className="space-y-4 pt-2">
              <p className="text-sm font-semibold text-foreground">Workflow</p>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {categoryOrder.map((category) => {
                    const categoryStatuses = groupedStatuses[category]
                    const { Icon, className } = stepIcon(category)
                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>{categoryLabels[category]}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => openCreateDialog(category)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        {categoryStatuses.length > 0 && (
                          <div className="space-y-2">
                            {categoryStatuses.map((status) => (
                              <div
                                key={status.id}
                                className="flex items-center gap-4 rounded-2xl bg-muted/20 px-4 py-3"
                              >
                                <span className={cn("flex h-6 w-6 items-center justify-center", className)}>
                                  <Icon
                                    className="h-4 w-4"
                                    weight={category === "finished" ? "fill" : "regular"}
                                  />
                                </span>
                                <div className="flex flex-1 items-center gap-4 text-sm text-foreground">
                                  <span className="font-medium">{status.name}</span>
                                  <span className="flex-1 text-left text-muted-foreground">
                                    {status.description}
                                  </span>
                                </div>
                                <div className="text-muted-foreground">
                                  {status.is_locked ? (
                                    <Lock className="h-4 w-4" />
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button type="button" className="hover:text-foreground">
                                          <DotsThree className="h-4 w-4" weight="bold" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(status)}>
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Edit
                                        </DropdownMenuItem>
                                        {!status.is_default && (
                                          <DropdownMenuItem
                                            onClick={() => openDeleteDialog(status)}
                                            className="text-destructive"
                                          >
                                            <Trash className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Status</DialogTitle>
            <DialogDescription>
              Add a new status to the {categoryLabels[selectedCategory].toLowerCase()} category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Status name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || isPending}>
              {isPending ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
            <DialogDescription>
              Update the status name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Status name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formName.trim() || isPending}>
              {isPending ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedStatus?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
