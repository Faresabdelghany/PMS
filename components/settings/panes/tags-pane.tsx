"use client"

import { useState, useEffect, useCallback } from "react"
import { Spinner } from "@phosphor-icons/react/dist/ssr/Spinner"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { Pencil } from "@phosphor-icons/react/dist/ssr/Pencil"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { SettingsPaneHeader } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import { getTags, createTag, updateTag, deleteTag } from "@/lib/actions/tags"
import { TAG_COLORS } from "@/lib/constants/tag-colors"
import { ColorPicker } from "@/components/ui/color-picker"
import type { OrganizationTag } from "@/lib/supabase/types"

export function TagsPane() {
  const { organization } = useOrganization()
  const [tags, setTags] = useState<OrganizationTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<OrganizationTag | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState<string>(TAG_COLORS[10].hex)
  const [isSaving, setIsSaving] = useState(false)

  const loadTags = useCallback(async () => {
    if (!organization) return
    setIsLoading(true)
    const result = await getTags(organization.id)
    if (result.data) {
      setTags(result.data)
    }
    setIsLoading(false)
  }, [organization])

  useEffect(() => {
    loadTags()
  }, [loadTags])

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

    const result = await createTag(organization.id, { name, description, color })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsCreateOpen(false)
    resetForm()
    await loadTags()
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedTag) return
    setIsSaving(true)
    setError(null)

    const result = await updateTag(selectedTag.id, { name, description, color })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsEditOpen(false)
    setSelectedTag(null)
    resetForm()
    await loadTags()
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedTag) return

    const result = await deleteTag(selectedTag.id)

    if (result.error) {
      setError(result.error)
      return
    }

    setIsDeleteOpen(false)
    setSelectedTag(null)
    await loadTags()
  }

  const openEditDialog = (tag: OrganizationTag) => {
    setSelectedTag(tag)
    setName(tag.name)
    setDescription(tag.description || "")
    setColor(tag.color)
    setError(null)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (tag: OrganizationTag) => {
    setSelectedTag(tag)
    setIsDeleteOpen(true)
  }

  const filteredTags = tags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Tags"
        description="Create and manage tags to categorize your projects and tasks."
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      {/* Header with search and add button */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tag</DialogTitle>
              <DialogDescription>Add a new tag to organize your projects and tasks.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Urgent, Backend, Design"
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
                <div className="h-6 w-6 rounded-md" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium">{name || "Preview"}</span>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!name.trim() || isSaving}>
                {isSaving && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Create Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tags List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "No tags match your search" : "No tags yet. Create your first tag!"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                <div>
                  <p className="font-medium">{tag.name}</p>
                  {tag.description && (
                    <p className="text-sm text-muted-foreground">{tag.description}</p>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <DotsThree className="h-4 w-4" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditDialog(tag)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openDeleteDialog(tag)} className="text-destructive">
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setSelectedTag(null)
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Update the tag details.</DialogDescription>
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
              <div className="h-6 w-6 rounded-md" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium">{name || "Preview"}</span>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || isSaving}>
              {isSaving && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag &quot;{selectedTag?.name}&quot;? This action
              cannot be undone.
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
