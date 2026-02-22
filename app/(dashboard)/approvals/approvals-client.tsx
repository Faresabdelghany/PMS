"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { ClipboardText } from "@phosphor-icons/react/dist/ssr/ClipboardText"
import { updateApproval } from "@/lib/actions/approvals"
import type { Approval } from "@/lib/actions/approvals"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ApprovalStatus = Approval["status"]

const STATUS_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  cancelled: { label: "Cancelled", className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
}

interface ApprovalCardProps {
  approval: Approval
  onApprove: (id: string, reason?: string) => void
  onReject: (id: string, reason?: string) => void
  isPending: boolean
}

function ApprovalCard({ approval, onApprove, onReject, isPending }: ApprovalCardProps) {
  const [payloadOpen, setPayloadOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null)
  const [reason, setReason] = useState("")
  const statusStyle = STATUS_BADGE[approval.status]

  const handleDialogConfirm = () => {
    if (dialogAction === "approve") {
      onApprove(approval.id, reason || undefined)
    } else if (dialogAction === "reject") {
      onReject(approval.id, reason || undefined)
    }
    setDialogAction(null)
    setReason("")
  }

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold truncate">{approval.title}</span>
                <Badge
                  variant="outline"
                  className={cn("text-xs shrink-0", statusStyle.className)}
                >
                  {statusStyle.label}
                </Badge>
              </div>
              {approval.agent_id && (
                <p className="text-xs text-muted-foreground">
                  Agent ID: <span className="font-mono">{approval.agent_id}</span>
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground/60 shrink-0">
              {new Date(approval.created_at).toLocaleString()}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {approval.description && (
            <p className="text-sm text-muted-foreground">{approval.description}</p>
          )}

          {/* Payload */}
          {approval.payload && Object.keys(approval.payload).length > 0 && (
            <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <CaretDown
                    className={cn("h-3 w-3 transition-transform", payloadOpen && "rotate-180")}
                  />
                  View payload
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-auto max-h-48 text-muted-foreground">
                  {JSON.stringify(approval.payload, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Decision reason */}
          {approval.decision_reason && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Reason:</span> {approval.decision_reason}
            </p>
          )}

          {/* Actions */}
          {approval.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 hover:border-emerald-500 dark:hover:bg-emerald-950"
                onClick={() => setDialogAction("approve")}
                disabled={isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-500/30 hover:bg-red-50 hover:border-red-500 dark:hover:bg-red-950"
                onClick={() => setDialogAction("reject")}
                disabled={isPending}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reason Dialog */}
      <Dialog open={dialogAction !== null} onOpenChange={(open) => { if (!open) { setDialogAction(null); setReason("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? "Optionally add a note before approving."
                : "Optionally explain why this request is being rejected."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add a reason..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogAction(null); setReason("") }}>
              Cancel
            </Button>
            <Button
              onClick={handleDialogConfirm}
              disabled={isPending}
              variant={dialogAction === "reject" ? "destructive" : "default"}
            >
              {dialogAction === "approve" ? "Confirm Approve" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const TAB_FILTERS = ["all", "pending", "approved", "rejected"] as const
type TabFilter = (typeof TAB_FILTERS)[number]

interface ApprovalsClientProps {
  approvals: Approval[]
  currentStatus?: string
}

export function ApprovalsClient({ approvals, currentStatus }: ApprovalsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localApprovals, setLocalApprovals] = useState<Approval[]>(approvals)

  const tab = (TAB_FILTERS.includes(currentStatus as TabFilter) ? currentStatus : "all") as TabFilter

  const pending = localApprovals.filter((a) => a.status === "pending")
  const approved = localApprovals.filter((a) => a.status === "approved")
  const rejected = localApprovals.filter((a) => a.status === "rejected")

  const displayed =
    tab === "pending" ? pending :
    tab === "approved" ? approved :
    tab === "rejected" ? rejected :
    localApprovals

  const handleApprove = (id: string, reason?: string) => {
    startTransition(async () => {
      const result = await updateApproval(id, {
        status: "approved",
        decision_reason: reason || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Request approved")
      setLocalApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "approved" as const, decision_reason: reason || null } : a))
      )
      router.refresh()
    })
  }

  const handleReject = (id: string, reason?: string) => {
    startTransition(async () => {
      const result = await updateApproval(id, {
        status: "rejected",
        decision_reason: reason || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Request rejected")
      setLocalApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "rejected" as const, decision_reason: reason || null } : a))
      )
      router.refresh()
    })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(val) => {
        const url = val === "all" ? "/approvals" : `/approvals?status=${val}`
        router.push(url)
      }}
    >
      <TabsList>
        <TabsTrigger value="all">
          All <Badge variant="secondary" className="ml-1.5 text-xs">{localApprovals.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="pending">
          Pending
          {pending.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs bg-amber-500/10 text-amber-600">{pending.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="approved">Approved</TabsTrigger>
        <TabsTrigger value="rejected">Rejected</TabsTrigger>
      </TabsList>

      <div className="mt-4">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No {tab !== "all" ? tab : ""} approval requests
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {displayed.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={handleApprove}
                onReject={handleReject}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>
    </Tabs>
  )
}
