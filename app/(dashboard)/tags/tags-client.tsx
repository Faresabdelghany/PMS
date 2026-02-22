"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { Tag } from "@phosphor-icons/react/dist/ssr/Tag"
import { createMCTag, updateMCTag, deleteMCTag } from "@/lib/actions/mc-tags"
import type { MCTag } from "@/lib/actions/mc-tags"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"

const COLOR_PRESETS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#84cc16", // lime
  "#64748b", // slate
  "#a8a29e", // stone
]

interface TagsClientProps {
  tags: MCTag[]
  orgId: string
}

export function TagsClient({ tags: initialTags, orgId }: TagsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tags, setTags] = useState<MCTag[]>(initialTags)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(COLOR_PRESETS[4])

  // Edit dialog
  const [editTag, setEditTag] = useState<MCTag | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<MCTag | null>(null)

  function openEdit(tag: MCTag) {
    setEditTag(tag)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  const handleCreate = () => {
    if (!newName.trim()) return

    startTransition(async () => {
      const result = await createMCTag(orgId, { name: newName.trim(), color: newColor })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Tag created")
      setTags((prev) => [...prev, result.data!])
      setCreateOpen(false)
      setNewName("")
      setNewColor(COLOR_PRESETS[4])
      router.refresh()
    })
  }

  const handleUpdate = () => {
    if (!editTag || !editName.trim()) return

    startTransition(async () => {
      const result = await updateMCTag(editTag.id, {
        name: editName.trim(),
        color: editColor,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Tag updated")
      setTags((prev) => prev.map((t) => (t.id === editTag.id ? result.data! : t)))
      setEditTag(null)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id

    startTransition(async () => {
      const result = await deleteMCTag(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Tag deleted")
      setTags((prev) => prev.filter((t) => t.id !== id))
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <Tag className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No tags yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
            Create tags to organize tasks, projects, and content.
          </p>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            Create your first tag
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
            >
              {/* Color dot */}
              <div
                className="h-4 w-4 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tag.name}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEdit(tag)}
                  disabled={isPending}
                >
                  <PencilSimple className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(tag)}
                  disabled={isPending}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>Add a new tag to organize your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. urgent"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      newColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-8 w-16 cursor-pointer rounded border"
                />
                <span className="text-xs text-muted-foreground font-mono">{newColor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending || !newName.trim()}>
              {isPending ? "Creating..." : "Create Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTag} onOpenChange={(open) => { if (!open) setEditTag(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      editColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-8 w-16 cursor-pointer rounded border"
                />
                <span className="text-xs text-muted-foreground font-mono">{editColor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTag(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isPending || !editName.trim()}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This will remove the tag from all items it&apos;s assigned to.
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
