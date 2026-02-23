"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { TextT } from "@phosphor-icons/react/dist/ssr/TextT"
import {
  createCustomFieldDef,
  updateCustomFieldDef,
  deleteCustomFieldDef,
} from "@/lib/actions/custom-fields"
import type { CustomFieldDef, FieldType } from "@/lib/actions/custom-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const FIELD_TYPES: FieldType[] = ["text", "number", "date", "select", "checkbox", "url"]

interface Props {
  fields: CustomFieldDef[]
  orgId: string
}

function FieldForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<CustomFieldDef>
  onSave: (data: { name: string; field_type: FieldType; options: string[]; required: boolean }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [fieldType, setFieldType] = useState<FieldType>(initial?.field_type ?? "text")
  const [required, setRequired] = useState(initial?.required ?? false)
  const [options, setOptions] = useState<string[]>(initial?.options ?? [])
  const [optionInput, setOptionInput] = useState("")

  const addOption = () => {
    const v = optionInput.trim()
    if (v && !options.includes(v)) {
      setOptions((prev) => [...prev, v])
      setOptionInput("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priority" required />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fieldType === "select" && (
        <div className="space-y-1.5">
          <Label>Options</Label>
          <div className="flex gap-2">
            <Input
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              placeholder="Add option…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption() } }}
            />
            <Button type="button" variant="outline" onClick={addOption}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {options.map((o) => (
              <Badge key={o} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setOptions((prev) => prev.filter((x) => x !== o))}>
                {o} ×
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Switch id="required" checked={required} onCheckedChange={setRequired} />
        <Label htmlFor="required">Required</Label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} type="button">Cancel</Button>
        <Button
          onClick={() => onSave({ name, field_type: fieldType, options, required })}
          disabled={loading || !name}
        >
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function CustomFieldsClient({ fields: initial, orgId }: Props) {
  const [fields, setFields] = useState<CustomFieldDef[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFieldDef | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDef | null>(null)
  const [isPending, startTransition] = useTransition()

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (f: CustomFieldDef) => { setEditing(f); setDialogOpen(true) }

  const handleSave = (data: { name: string; field_type: FieldType; options: string[]; required: boolean }) => {
    startTransition(async () => {
      if (editing) {
        const res = await updateCustomFieldDef(editing.id, {
          name: data.name,
          field_type: data.field_type,
          options: data.field_type === "select" ? data.options : null,
          required: data.required,
        })
        if (res.error) { toast.error(res.error); return }
        setFields((prev) => prev.map((f) => f.id === editing.id ? res.data! : f))
        toast.success("Field updated")
      } else {
        const res = await createCustomFieldDef(orgId, {
          name: data.name,
          field_type: data.field_type,
          options: data.field_type === "select" ? data.options : undefined,
          required: data.required,
        })
        if (res.error) { toast.error(res.error); return }
        setFields((prev) => [...prev, res.data!])
        toast.success("Field created")
      }
      setDialogOpen(false)
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      const res = await deleteCustomFieldDef(id)
      if (res.error) { toast.error(res.error); return }
      setFields((prev) => prev.filter((f) => f.id !== id))
      setDeleteTarget(null)
      toast.success("Field deleted")
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          New Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <TextT className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No custom fields yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Create fields to capture extra data on tasks</p>
          <Button size="sm" variant="outline" onClick={openNew}>Create your first field</Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Required</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{f.field_type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.board_id ? "Board-specific" : "Global"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.required ? "default" : "secondary"}>
                      {f.required ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                        <PencilSimple className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(f)} disabled={isPending}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Field" : "New Custom Field"}</DialogTitle>
          </DialogHeader>
          <FieldForm
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
            <AlertDialogTitle>Delete Field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all its values.
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
