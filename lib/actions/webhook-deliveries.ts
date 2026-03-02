"use server"

import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export interface WebhookDelivery {
  id: string
  webhook_id: string
  organization_id: string
  event_type: string
  request_payload: Record<string, unknown>
  response_status: number | null
  response_body: string | null
  duration_ms: number | null
  attempt_count: number
  created_at: string
}

export interface WebhookDeliveryWithWebhook extends WebhookDelivery {
  webhook?: { id: string; url: string; event_types: string[] } | null
}

// ── Actions ──────────────────────────────────────────────────────────

/**
 * List webhook deliveries with optional filters.
 * Includes a join to the parent webhook for URL and event info.
 */
export async function getWebhookDeliveries(
  orgId: string,
  filters?: { webhookId?: string; limit?: number }
): Promise<ActionResult<WebhookDeliveryWithWebhook[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    let query = supabase
      .from("webhook_deliveries" as any)
      .select(`
        *,
        webhook:board_webhooks(id, url, events)
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    if (filters?.webhookId) {
      query = query.eq("webhook_id", filters.webhookId)
    }

    query = query.limit(filters?.limit ?? 50)

    const { data, error } = await query

    if (error) return { error: error.message }

    // Normalize the webhook join shape (events → event_types)
    const deliveries = ((data ?? []) as unknown as any[]).map((d) => ({
      ...d,
      webhook: d.webhook
        ? { id: d.webhook.id, url: d.webhook.url, event_types: d.webhook.events ?? [] }
        : null,
    })) as WebhookDeliveryWithWebhook[]

    return { data: deliveries }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Retry a failed webhook delivery.
 * Fetches the original delivery, re-sends the request_payload to the webhook URL,
 * and inserts a new delivery record with the response.
 */
export async function retryWebhookDelivery(
  orgId: string,
  deliveryId: string
): Promise<ActionResult<WebhookDelivery>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    // Fetch the original delivery
    const { data: delivery, error: fetchErr } = await supabase
      .from("webhook_deliveries" as any)
      .select("*")
      .eq("id", deliveryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchErr || !delivery) return { error: "Delivery not found" }

    const typedDelivery = delivery as unknown as WebhookDelivery

    // Fetch the webhook to get the URL
    const { data: webhook, error: whErr } = await supabase
      .from("board_webhooks" as any)
      .select("id, url, secret")
      .eq("id", typedDelivery.webhook_id)
      .single()

    if (whErr || !webhook) return { error: "Associated webhook not found" }

    const webhookUrl = (webhook as any).url as string

    // Re-send the request
    let responseStatus: number | null = null
    let responseBody: string | null = null
    let durationMs: number | null = null

    const start = Date.now()
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PMS-Event": typedDelivery.event_type,
          "X-PMS-Delivery-ID": deliveryId,
          "X-PMS-Retry": "true",
        },
        body: JSON.stringify(typedDelivery.request_payload),
        signal: AbortSignal.timeout(10000),
      })
      durationMs = Date.now() - start
      responseStatus = res.status
      responseBody = await res.text().catch(() => null)
    } catch {
      durationMs = Date.now() - start
      responseStatus = null
      responseBody = "Failed to reach webhook URL"
    }

    // Insert a new delivery record for the retry attempt
    const { data: newDelivery, error: insertErr } = await supabase
      .from("webhook_deliveries" as any)
      .insert({
        webhook_id: typedDelivery.webhook_id,
        organization_id: orgId,
        event_type: typedDelivery.event_type,
        request_payload: typedDelivery.request_payload,
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
        attempt_count: typedDelivery.attempt_count + 1,
      })
      .select()
      .single()

    if (insertErr) return { error: insertErr.message }

    return { data: newDelivery as unknown as WebhookDelivery }
  } catch {
    return { error: "Not authorized" }
  }
}
