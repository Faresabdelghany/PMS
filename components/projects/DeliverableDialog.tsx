"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { createDeliverable, updateDeliverable } from "@/lib/actions/deliverables"
import type { DeliverableStatus, PaymentStatus } from "@/lib/supabase/types"

export type DeliverableData = {
  id: string
  title: string
  value: number | null
  dueDate: string | null
  status: DeliverableStatus
  paymentStatus: PaymentStatus
}

type DeliverableDialogProps = {
  open: boolean
  onClose: () => void
  projectId: string
  currency: string
  editingDeliverable?: DeliverableData | null
  onSuccess?: () => void
}

const STATUS_OPTIONS: { value: DeliverableStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
]

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
]

export function DeliverableDialog({
  open,
  onClose,
  projectId,
  currency,
  editingDeliverable,
  onSuccess,
}: DeliverableDialogProps) {
  const [title, setTitle] = useState("")
  const [value, setValue] = useState<string>("")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [status, setStatus] = useState<DeliverableStatus>("pending")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!editingDeliverable

  // Reset form when dialog opens/closes or editing deliverable changes
  useEffect(() => {
    if (open && editingDeliverable) {
      setTitle(editingDeliverable.title)
      setValue(editingDeliverable.value?.toString() ?? "")
      setDueDate(editingDeliverable.dueDate ? new Date(editingDeliverable.dueDate) : undefined)
      setStatus(editingDeliverable.status)
      setPaymentStatus(editingDeliverable.paymentStatus)
    } else if (open) {
      setTitle("")
      setValue("")
      setDueDate(undefined)
      setStatus("pending")
      setPaymentStatus("unpaid")
    }
  }, [open, editingDeliverable])

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    const valueNum = value ? parseFloat(value) : null
    if (value && (isNaN(valueNum!) || valueNum! < 0)) {
      toast.error("Value must be a valid positive number")
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditing && editingDeliverable) {
        const result = await updateDeliverable({
          id: editingDeliverable.id,
          title: title.trim(),
          value: valueNum,
          dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          status,
          paymentStatus,
        })

        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success("Deliverable updated")
      } else {
        const result = await createDeliverable({
          projectId,
          title: title.trim(),
          value: valueNum,
          dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          status,
          paymentStatus,
        })

        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success("Deliverable created")
      }

      onSuccess?.()
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }, [title, value, dueDate, status, paymentStatus, isEditing, editingDeliverable, projectId, onSuccess, onClose])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Deliverable" : "Add Deliverable"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., MVP Release"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="value">Value ({currency})</Label>
              <Input
                id="value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarBlank className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DeliverableStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Deliverable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
