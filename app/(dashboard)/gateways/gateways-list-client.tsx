"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Eye } from "@phosphor-icons/react/dist/ssr/Eye"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"
import { deleteGateway } from "@/lib/actions/gateways"
import type { Gateway } from "@/lib/actions/gateways"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  online: {
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    dot: "bg-emerald-500",
    label: "Online",
  },
  offline: {
    badge: "bg-red-500/10 text-red-600 border-red-500/20",
    dot: "bg-red-500",
    label: "Offline",
  },
  unknown: {
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    dot: "bg-slate-400",
    label: "Unknown",
  },
}

interface GatewayWithChecked extends Gateway {
  _lastChecked?: Date
}

interface GatewaysListClientProps {
  gateways: Gateway[]
}

export function GatewaysListClient({ gateways: initialGateways }: GatewaysListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [gateways, setGateways] = useState<GatewayWithChecked[]>(initialGateways)
  const [deleteTarget, setDeleteTarget] = useState<Gateway | null>(null)

  // Poll gateway status from DB every 30 seconds (not URL ping — that fails for local gateways on Vercel)
  const refreshFromDb = useCallback(async () => {
    if (gateways.length === 0) return
    const orgId = gateways[0].org_id
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("gateways" as any)
        .select("id, status, last_seen_at")
        .eq("org_id", orgId)
      if (data) {
        const statusMap = new Map((data as any[]).map((r) => [r.id, r]))
        setGateways((prev) =>
          prev.map((g) => {
            const fresh = statusMap.get(g.id)
            return fresh
              ? { ...g, status: fresh.status, last_seen_at: fresh.last_seen_at, _lastChecked: new Date() }
              : g
          })
        )
      }
    } catch { /* ignore */ }
  }, [gateways])

  useEffect(() => {
    refreshFromDb()
    const interval = setInterval(refreshFromDb, 120_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id

    startTransition(async () => {
      const result = await deleteGateway(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Gateway deleted")
      setGateways((prev) => prev.filter((g) => g.id !== id))
      setDeleteTarget(null)
      router.refresh()
    })
  }

  if (gateways.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
        <PlugsConnected className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No gateways yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
          Create a gateway to connect boards and manage agent sessions.
        </p>
        <Link href="/gateways/new">
          <Button size="sm" variant="outline">Create your first gateway</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Auth Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gateways.map((gateway) => {
              const statusStyle = STATUS_STYLE[gateway.status] ?? STATUS_STYLE.unknown
              return (
                <TableRow key={gateway.id}>
                  <TableCell className="font-medium">
                    <Link href={`/gateways/${gateway.id}`} className="hover:underline">
                      {gateway.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {gateway.url}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {gateway.auth_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline" className={statusStyle.badge}>
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                        {statusStyle.label}
                      </Badge>
                      {gateway._lastChecked && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Checked {gateway._lastChecked.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {gateway.last_seen_at
                      ? new Date(gateway.last_seen_at).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/gateways/${gateway.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/gateways/${gateway.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilSimple className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(gateway)}
                        disabled={isPending}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gateway?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. Boards using this gateway will need a new one assigned.
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
