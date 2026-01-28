"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Loader2, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useOrganization } from "@/hooks/use-organization"
import { getLabels, createLabel, updateLabel, deleteLabel } from "@/lib/actions/labels"
import { TAG_COLORS } from "@/lib/actions/tags"
import { ColorPicker } from "@/components/ui/color-picker"
import type { OrganizationLabel, LabelCategory } from "@/lib/supabase/types"

const CATEGORY_INFO: Record<LabelCategory, { title: string; description: string }> = {
  type: {
    title: "Type Labels",
    description: "Categorize projects by type (e.g., Internal, Client Work, R&D)",
  },
  duration: {
    title: "Duration Labels",
    description: "Indicate project duration (e.g., Short-term, Long-term, Ongoing)",
  },
  group: {
    title: "Group Labels",
    description: "Group projects by department or category (e.g., Marketing, Engineering)",
  },
  badge: {
    title: "Badge Labels",
    description: "Highlight project status or attributes (e.g., Featured, On Hold, Priority)",
  },
}

export function LabelsSettings() {
  const { organization } = useOrganization()
  const [labels, setLabels] = useState<OrganizationLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<LabelCategory>("type")
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<OrganizationLabel | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(TAG_COLORS[10].hex)
  const [isSaving, setIsSaving] = useState(false)

  const loadLabels = useCallback(async () => {
    if (!organization) return
    setIsLoading(true)
    const result = await getLabels(organization.id)
    if (result.data) {
      setLabels(result.data)
    }
    setIsLoading(false)
  }, [organization])

  useEffect(() => {
    loadLabels()
  }, [loadLabels])

  const resetForm = () => {
    setName("")
    setDescription("")
    setColor(TAG_COLORS[10].hex)
    setError(null)
  }

  const handleCreate = async () => {
    if (!organization) return
    setIsSaving(true)
    setError(null)

    const result = await createLabel(organization.id, {
      category: activeCategory,
      name,
      description,
      color,
    })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsCreateOpen(false)
    resetForm()
    await loadLabels()
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedLabel) return
    setIsSaving(true)
    setError(null)

    const result = await updateLabel(selectedLabel.id, { name, description, color })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsEditOpen(false)
    setSelectedLabel(null)
    resetForm()
    await loadLabels()
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedLabel) return

    const result = await deleteLabel(selectedLabel.id)

    if (result.error) {
      setError(result.error)
      return
    }

    setIsDeleteOpen(false)
    setSelectedLabel(null)
    await loadLabels()
  }

  const openEditDialog = (label: OrganizationLabel) => {
    setSelectedLabel(label)
    setName(label.name)
    setDescription(label.description || "")
    setColor(label.color)
    setError(null)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (label: OrganizationLabel) => {
    setSelectedLabel(label)
    setIsDeleteOpen(true)
  }

  const filteredLabels = labels.filter((label) => label.category === activeCategory)

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Labels</CardTitle>
          <CardDescription>
            Create and manage labels to categorize your projects by type, duration, group, and badges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as LabelCategory)}>
            <TabsList className="mb-4">
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="duration">Duration</TabsTrigger>
              <TabsTrigger value="group">Group</TabsTrigger>
              <TabsTrigger value="badge">Badge</TabsTrigger>
            </TabsList>

            {(["type", "duration", "group", "badge"] as LabelCategory[]).map((category) => (
              <TabsContent key={category} value={category} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{CATEGORY_INFO[category].title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {CATEGORY_INFO[category].description}
                    </p>
                  </div>
                  <Dialog open={isCreateOpen && activeCategory === category} onOpenChange={(open) => {
                    setIsCreateOpen(open)
                    if (!open) resetForm()
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        New Label
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create {CATEGORY_INFO[category].title.replace(" Labels", "")} Label</DialogTitle>
                        <DialogDescription>
                          Add a new label for categorizing projects.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Internal, Short-term, Marketing"
                            maxLength={50}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description"
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <ColorPicker value={color} onChange={setColor} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium">{name || "Preview"}</span>
                        </div>
                      </div>
                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={!name.trim() || isSaving}>
                          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Label
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLabels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No {category} labels yet. Create your first one!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLabels.map((label) => (
                      <div
                        key={label.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          <div>
                            <p className="font-medium">{label.name}</p>
                            {label.description && (
                              <p className="text-sm text-muted-foreground">{label.description}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(label)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(label)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open)
        if (!open) {
          setSelectedLabel(null)
          resetForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
            <DialogDescription>
              Update the label details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-md"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{name || "Preview"}</span>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the label &ldquo;{selectedLabel?.name}&rdquo;? This action cannot be undone.
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
    </div>
  )
}
