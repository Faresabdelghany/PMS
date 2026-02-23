"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Rows } from "@phosphor-icons/react/dist/ssr/Rows"
import {
  createBoardGroup,
  updateBoardGroup,
  deleteBoardGroup,
} from "@/lib/actions/board-groups"
import type { BoardGroup } from "@/lib/actions/board-groups"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  groups: BoardGroup[]
  orgId: string
}

function GroupForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<BoardGroup>
  onSave: (data: { name: string; description: string }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" required />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What boards belong here?" rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} type="button">Cancel</Button>
        <Button onClick={() => onSave({ name, description })} disabled={loading || !name}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function BoardGroupsClient({ groups: initial, orgId }: Props) {
  const [groups, setGroups] = useState<BoardGroup[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BoardGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoardGroup | null>(null)
  const [isPending, startTransition] = useTransition()

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (g: BoardGroup) => { setEditing(g); setDialogOpen(true) }

  const handleSave = (data: { name: string; description: string }) => {
    startTransition(async () => {
      if (editing) {
        const res = await updateBoardGroup(editing.id, {
          name: data.name,
          description: data.description || null,
        })
        if (res.error) { toast.error(res.error); return }
        setGroups((prev) => prev.map((g) => g.id === editing.id ? res.data! : g))
        toast.success("Group updated")
      } else {
        const res = await createBoardGroup(orgId, {
          name: data.name,
          description: data.description || undefined,
        })
        if (res.error) { toast.error(res.error); return }
        setGroups((prev) => [...prev, res.data!])
        toast.success("Group created")
      }
      setDialogOpen(false)
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      const res = await deleteBoardGroup(id)
      if (res.error) { toast.error(res.error); return }
      setGroups((prev) => prev.filter((g) => g.id !== id))
      setDeleteTarget(null)
      toast.success("Group deleted")
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <Rows className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No board groups yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Group your boards to keep things organized</p>
          <Button size="sm" variant="outline" onClick={openNew}>Create your first group</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                      <PencilSimple className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(g)} disabled={isPending}>
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {g.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{g.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Group" : "New Board Group"}</DialogTitle>
          </DialogHeader>
          <GroupForm
            initial={editing ?? undefined}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
            loading={isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be deleted. Boards in this group will become ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
