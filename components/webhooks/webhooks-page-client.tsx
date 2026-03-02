"use client"

import { useState, useEffect, useTransition, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { WebhooksLogo } from "@phosphor-icons/react/dist/ssr/WebhooksLogo"
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  getWebhookDeliveries,
  retryWebhookDelivery,
} from "@/lib/actions/webhook-deliveries"
import type { WebhookDeliveryWithWebhook } from "@/lib/actions/webhook-deliveries"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────

function statusColor(status: number | null): string {
  if (status === null) return "text-muted-foreground"
  if (status >= 200 && status < 300) return "text-emerald-500"
  if (status >= 400 && status < 500) return "text-amber-500"
  return "text-red-500"
}

function statusBadgeClasses(status: number | null): string {
  if (status === null)
    return "bg-muted text-muted-foreground border-border"
  if (status >= 200 && status < 300)
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  if (status >= 400 && status < 500)
    return "bg-amber-500/10 text-amber-500 border-amber-500/20"
  return "bg-red-500/10 text-red-500 border-red-500/20"
}

function statusLabel(status: number | null): string {
  if (status === null) return "Pending"
  return String(status)
}

function isRetryable(status: number | null): boolean {
  return status === null || status >= 400
}

function truncateUrl(url: string, max: number = 48): string {
  if (url.length <= max) return url
  return url.slice(0, max) + "\u2026"
}

// ── Stats Cards ───────────────────────────────────────────────────────

interface StatsProps {
  deliveries: WebhookDeliveryWithWebhook[]
}

function StatsCards({ deliveries }: StatsProps) {
  const total = deliveries.length

  const successCount = deliveries.filter(
    (d) => d.response_status !== null && d.response_status >= 200 && d.response_status < 300
  ).length
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0

  // eslint-disable-next-line react-hooks/purity -- snapshot on mount, not truly impure for display
  const oneDayAgo = useMemo(() => Date.now() - 24 * 60 * 60 * 1000, [])
  const failedLast24h = deliveries.filter(
    (d) =>
      isRetryable(d.response_status) &&
      new Date(d.created_at).getTime() > oneDayAgo
  ).length

  const durationsMs = deliveries
    .map((d) => d.duration_ms)
    .filter((ms): ms is number => ms !== null)
  const avgDuration =
    durationsMs.length > 0
      ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
      : 0

  const stats = [
    { label: "Total Deliveries", value: String(total) },
    { label: "Success Rate", value: `${successRate}%` },
    { label: "Failed (24h)", value: String(failedLast24h) },
    { label: "Avg Response Time", value: `${avgDuration}ms` },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Delivery Row ──────────────────────────────────────────────────────

interface DeliveryRowProps {
  delivery: WebhookDeliveryWithWebhook
  isExpanded: boolean
  onToggle: () => void
  onRetry: (deliveryId: string) => void
  retryingId: string | null
}

function DeliveryRow({
  delivery,
  isExpanded,
  onToggle,
  onRetry,
  retryingId,
}: DeliveryRowProps) {
  const url = delivery.webhook?.url ?? "Unknown URL"

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border/60 rounded-lg overflow-hidden">
        {/* Summary row */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
          >
            <CaretDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                isExpanded && "rotate-180"
              )}
            />
            {/* Time */}
            <span className="text-xs text-muted-foreground w-28 shrink-0">
              {formatDistanceToNow(new Date(delivery.created_at), {
                addSuffix: true,
              })}
            </span>
            {/* Event type */}
            <Badge variant="outline" className="text-xs shrink-0">
              {delivery.event_type}
            </Badge>
            {/* URL */}
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 font-mono">
              {truncateUrl(url)}
            </span>
            {/* Status badge */}
            <Badge
              variant="outline"
              className={cn("text-xs shrink-0", statusBadgeClasses(delivery.response_status))}
            >
              {delivery.response_status === null ? (
                "Pending"
              ) : delivery.response_status >= 200 && delivery.response_status < 300 ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" /> {delivery.response_status}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X className="h-3 w-3" /> {delivery.response_status}
                </span>
              )}
            </Badge>
            {/* Duration */}
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
              {delivery.duration_ms !== null ? `${delivery.duration_ms}ms` : "\u2014"}
            </span>
            {/* Attempts */}
            <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
              #{delivery.attempt_count}
            </span>
            {/* Retry button — stop propagation to avoid toggling the collapsible */}
            {isRetryable(delivery.response_status) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 shrink-0 text-muted-foreground hover:text-foreground"
                disabled={retryingId === delivery.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onRetry(delivery.id)
                }}
              >
                <ArrowClockwise
                  className={cn("h-3.5 w-3.5", retryingId === delivery.id && "animate-spin")}
                />
              </Button>
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expanded detail */}
        <CollapsibleContent>
          <div className="border-t border-border/40 px-4 py-4 space-y-4 bg-muted/30">
            {/* Full URL */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Webhook URL
              </p>
              <p className="text-xs font-mono text-foreground break-all">{url}</p>
            </div>

            {/* Request payload */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Request Payload
              </p>
              <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-60 text-foreground">
                {JSON.stringify(delivery.request_payload, null, 2)}
              </pre>
            </div>

            {/* Response body */}
            {delivery.response_body && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Response Body
                </p>
                <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-60 text-foreground">
                  {delivery.response_body}
                </pre>
              </div>
            )}

            {/* Metadata */}
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>
                Status:{" "}
                <span className={cn("font-medium", statusColor(delivery.response_status))}>
                  {statusLabel(delivery.response_status)}
                </span>
              </span>
              <span>
                Duration:{" "}
                <span className="font-medium text-foreground">
                  {delivery.duration_ms !== null ? `${delivery.duration_ms}ms` : "N/A"}
                </span>
              </span>
              <span>
                Attempts:{" "}
                <span className="font-medium text-foreground">
                  {delivery.attempt_count}
                </span>
              </span>
              <span>
                Created:{" "}
                <span className="font-medium text-foreground">
                  {new Date(delivery.created_at).toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ── Main Component ────────────────────────────────────────────────────

interface WebhooksPageClientProps {
  orgId: string
}

export function WebhooksPageClient({ orgId }: WebhooksPageClientProps) {
  const [deliveries, setDeliveries] = useState<WebhookDeliveryWithWebhook[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    const result = await getWebhookDeliveries(orgId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setDeliveries(result.data ?? [])
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const handleRetry = (deliveryId: string) => {
    setRetryingId(deliveryId)
    startTransition(async () => {
      const result = await retryWebhookDelivery(orgId, deliveryId)
      setRetryingId(null)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Webhook delivery retried")
      // Refresh the list to show the new retry entry
      await fetchDeliveries()
    })
  }

  const handleToggle = (id: string) => {
    setExpandedDeliveryId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {/* Skeleton stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/60 p-4 space-y-2">
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              <div className="h-7 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Skeleton rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 px-4 py-3">
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (deliveries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <WebhooksLogo className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No webhook deliveries recorded yet
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StatsCards deliveries={deliveries} />

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 text-xs font-medium text-muted-foreground">
        <span className="w-3.5 shrink-0" />
        <span className="w-28 shrink-0">Time</span>
        <span className="shrink-0">Event</span>
        <span className="flex-1 min-w-0">URL</span>
        <span className="shrink-0">Status</span>
        <span className="w-16 text-right shrink-0">Duration</span>
        <span className="w-10 text-right shrink-0">Tries</span>
        <span className="w-16 shrink-0" />
      </div>

      {/* Delivery rows */}
      <div className="flex flex-col gap-2">
        {deliveries.map((delivery) => (
          <DeliveryRow
            key={delivery.id}
            delivery={delivery}
            isExpanded={expandedDeliveryId === delivery.id}
            onToggle={() => handleToggle(delivery.id)}
            onRetry={handleRetry}
            retryingId={retryingId}
          />
        ))}
      </div>
    </div>
  )
}
