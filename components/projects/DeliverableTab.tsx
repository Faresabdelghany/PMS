"use client"

import { useCallback, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { format } from "date-fns"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Pencil } from "@phosphor-icons/react/dist/ssr/Pencil"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { Package } from "@phosphor-icons/react/dist/ssr/Package"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Badge } from "@/components/ui/badge"
import type { DeliverableData } from "./DeliverableDialog"
import { updateDeliverable, deleteDeliverable } from "@/lib/actions/deliverables"
import type { DeliverableStatus, PaymentStatus } from "@/lib/supabase/types"

// Lazy load modal - only loaded when opened
const DeliverableDialog = dynamic(() => import("./DeliverableDialog").then(m => m.DeliverableDialog), { ssr: false })

type Deliverable = {
  id: string
  title: string
  due_date: string | null
  value: number | null
  status: DeliverableStatus
  payment_status: PaymentStatus
  sort_order: number
}

type DeliverableTabProps = {
  projectId: string
  deliverables: Deliverable[]
  currency: string
  onRefresh: () => void
}

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  invoiced: "Invoiced",
  paid: "Paid",
}

const STATUS_COLORS: Record<DeliverableStatus, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
}

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  invoiced: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
}

function formatCurrency(value: number | null, currency: string): string {
  if (value === null) return "-"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(date: string | null): string {
  if (!date) return "-"
  return format(new Date(date), "MMM d, yyyy")
}

export function DeliverableTab({
  projectId,
  deliverables,
  currency,
  onRefresh,
}: DeliverableTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDeliverable, setEditingDeliverable] = useState<DeliverableData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAddClick = useCallback(() => {
    setEditingDeliverable(null)
    setIsDialogOpen(true)
  }, [])

  const handleEditClick = useCallback((deliverable: Deliverable) => {
    setEditingDeliverable({
      id: deliverable.id,
      title: deliverable.title,
      value: deliverable.value,
      dueDate: deliverable.due_date,
      status: deliverable.status,
      paymentStatus: deliverable.payment_status,
    })
    setIsDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((id: string) => {
    setDeletingId(id)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingId) return

    const result = await deleteDeliverable(deletingId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Deliverable deleted")
      onRefresh()
    }
    setDeletingId(null)
  }, [deletingId, onRefresh])

  const handleStatusChange = useCallback(
    (id: string, newStatus: DeliverableStatus) => {
      startTransition(async () => {
        const result = await updateDeliverable({ id, status: newStatus })
        if (result.error) {
          toast.error(result.error)
        } else {
          onRefresh()
        }
      })
    },
    [onRefresh]
  )

  const handlePaymentStatusChange = useCallback(
    (id: string, newPaymentStatus: PaymentStatus) => {
      startTransition(async () => {
        const result = await updateDeliverable({ id, paymentStatus: newPaymentStatus })
        if (result.error) {
          toast.error(result.error)
        } else {
          onRefresh()
        }
      })
    },
    [onRefresh]
  )

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false)
    setEditingDeliverable(null)
  }, [])

  const handleDialogSuccess = useCallback(() => {
    onRefresh()
  }, [onRefresh])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Deliverables</h3>
          <Badge variant="secondary" className="text-xs">
            {currency}
          </Badge>
        </div>
        <Button onClick={handleAddClick} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Deliverable
        </Button>
      </div>

      {deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No deliverables yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first deliverable to track contract milestones.
          </p>
          <Button onClick={handleAddClick} className="mt-4" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Deliverable
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[120px]">Value</TableHead>
                <TableHead className="w-[120px]">Due Date</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[140px]">Payment</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.map((deliverable) => (
                <TableRow key={deliverable.id}>
                  <TableCell className="font-medium">{deliverable.title}</TableCell>
                  <TableCell>{formatCurrency(deliverable.value, currency)}</TableCell>
                  <TableCell>{formatDate(deliverable.due_date)}</TableCell>
                  <TableCell>
                    <Select
                      value={deliverable.status}
                      onValueChange={(v) => handleStatusChange(deliverable.id, v as DeliverableStatus)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue>
                          <Badge variant="secondary" className={STATUS_COLORS[deliverable.status]}>
                            {STATUS_LABELS[deliverable.status]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <Badge variant="secondary" className={STATUS_COLORS[value as DeliverableStatus]}>
                              {label}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={deliverable.payment_status}
                      onValueChange={(v) => handlePaymentStatusChange(deliverable.id, v as PaymentStatus)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue>
                          <Badge variant="secondary" className={PAYMENT_STATUS_COLORS[deliverable.payment_status]}>
                            {PAYMENT_STATUS_LABELS[deliverable.payment_status]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <Badge variant="secondary" className={PAYMENT_STATUS_COLORS[value as PaymentStatus]}>
                              {label}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditClick(deliverable)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(deliverable.id)}
                      >
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

      <DeliverableDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        projectId={projectId}
        currency={currency}
        editingDeliverable={editingDeliverable}
        onSuccess={handleDialogSuccess}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deliverable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deliverable? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
