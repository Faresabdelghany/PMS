"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { Flask } from "@phosphor-icons/react/dist/ssr/Flask"
import { ToggleLeft } from "@phosphor-icons/react/dist/ssr/ToggleLeft"
import { ToggleRight } from "@phosphor-icons/react/dist/ssr/ToggleRight"
import { Link as LinkIcon } from "@phosphor-icons/react/dist/ssr/Link"
import { deleteBoardWebhook, updateBoardWebhook, testWebhook } from "@/lib/actions/board-webhooks"
import type { BoardWebhook } from "@/lib/actions/board-webhooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Props {
  webhooks: BoardWebhook[]
  boardId: string
}

export function BoardWebhooksClient({ webhooks: initial, boardId }: Props) {
  const [webhooks, setWebhooks] = useState<BoardWebhook[]>(initial)
  const [deleteTarget, setDeleteTarget] = useState<BoardWebhook | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      const res = await deleteBoardWebhook(id)
      if (res.error) { toast.error(res.error); return }
      toast.success("Webhook deleted")
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
      setDeleteTarget(null)
    })
  }

  const handleToggle = (webhook: BoardWebhook) => {
    startTransition(async () => {
      const res = await updateBoardWebhook(webhook.id, { enabled: !webhook.enabled })
      if (res.error) { toast.error(res.error); return }
      setWebhooks((prev) => prev.map((w) => w.id === webhook.id ? { ...w, enabled: !w.enabled } : w))
    })
  }

  const handleTest = (webhook: BoardWebhook) => {
    startTransition(async () => {
      toast.loading("Sending test webhook...", { id: "test-webhook" })
      const res = await testWebhook(webhook.id)
      toast.dismiss("test-webhook")
      if (res.error) {
        toast.error(`Test failed: ${res.error}`)
      } else if (res.data?.ok) {
        toast.success(`Test delivered (HTTP ${res.data.status})`)
        setWebhooks((prev) => prev.map((w) => w.id === webhook.id ? { ...w, last_triggered_at: new Date().toISOString() } : w))
      } else {
        toast.warning(`Webhook responded with HTTP ${res.data?.status}`)
      }
    })
  }

  if (webhooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
        <LinkIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No webhooks yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add a webhook to receive board events at an external URL.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Triggered</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell className="font-mono text-xs max-w-[200px] truncate">{wh.url}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {wh.events.map((e) => (
                      <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={wh.enabled ? "text-emerald-600 border-emerald-500/20" : "text-slate-500 border-slate-500/20"}>
                    {wh.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {wh.last_triggered_at ? new Date(wh.last_triggered_at).toLocaleString() : "Never"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTest(wh)} disabled={isPending} title="Send test">
                      <Flask className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggle(wh)} disabled={isPending} title="Toggle">
                      {wh.enabled ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(wh)} disabled={isPending}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the webhook for <strong>{deleteTarget?.url}</strong>.
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
