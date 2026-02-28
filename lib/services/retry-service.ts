import { createAdminClient } from "@/lib/supabase/admin"
import { computeNextRetryAt, decideRetryAttempt } from "@/lib/mission-control/retry-core"

type RetryPolicyRow = {
  id: string
  max_attempts: number
  backoff_seconds: number
  escalation_channel: "telegram"
  escalation_target: string | null
}

export type RetryFailureInput = {
  orgId: string
  taskId: string
  taskType?: string | null
  agentSessionId?: string | null
  errorMessage: string
}

export type RetryFailureResult =
  | { action: "retry_scheduled"; attempt: number; nextRetryAt: string }
  | { action: "escalated"; attempt: number }

async function getRetryPolicy(
  orgId: string,
  taskType: string | null | undefined
): Promise<RetryPolicyRow> {
  const supabase = createAdminClient()
  const normalizedTaskType = taskType && taskType.trim().length > 0 ? taskType : "default"

  const { data: exact } = await supabase
    .from("retry_policies" as any)
    .select("id, max_attempts, backoff_seconds, escalation_channel, escalation_target")
    .eq("organization_id", orgId)
    .eq("task_type", normalizedTaskType)
    .eq("enabled", true)
    .maybeSingle()

  if (exact) return exact as unknown as RetryPolicyRow

  const { data: fallback } = await supabase
    .from("retry_policies" as any)
    .select("id, max_attempts, backoff_seconds, escalation_channel, escalation_target")
    .eq("organization_id", orgId)
    .eq("task_type", "default")
    .eq("enabled", true)
    .maybeSingle()

  return (fallback as unknown as RetryPolicyRow | null) ?? {
    id: "default-in-code",
    max_attempts: 3,
    backoff_seconds: 30,
    escalation_channel: "telegram",
    escalation_target: null,
  }
}

async function sendTelegramEscalation(
  message: string,
  escalationTarget: string | null
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = escalationTarget?.trim() || process.env.TELEGRAM_CHAT_ID?.trim()
  if (!botToken || !chatId) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
    }),
    cache: "no-store",
  })
}

export async function handleTaskFailureWithRetry(
  input: RetryFailureInput
): Promise<RetryFailureResult> {
  const supabase = createAdminClient()
  const policy = await getRetryPolicy(input.orgId, input.taskType)

  const { count: attemptsCount } = await supabase
    .from("retry_log" as any)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.orgId)
    .eq("task_id", input.taskId)

  const priorAttempts = attemptsCount ?? 0
  const decision = decideRetryAttempt(priorAttempts, {
    maxAttempts: policy.max_attempts,
    backoffSeconds: policy.backoff_seconds,
  })

  if (decision.shouldRetry) {
    const nextRetryAt = computeNextRetryAt(new Date(), policy.backoff_seconds)
    await supabase.from("retry_log" as any).insert({
      organization_id: input.orgId,
      task_id: input.taskId,
      policy_id: policy.id === "default-in-code" ? null : policy.id,
      agent_session_id: input.agentSessionId ?? null,
      attempt: decision.nextAttempt,
      error: input.errorMessage,
      outcome: "retrying",
      next_retry_at: nextRetryAt.toISOString(),
    })

    await supabase
      .from("tasks")
      .update({ dispatch_status: "dispatched" })
      .eq("id", input.taskId)

    return {
      action: "retry_scheduled",
      attempt: decision.nextAttempt,
      nextRetryAt: nextRetryAt.toISOString(),
    }
  }

  await supabase.from("retry_log" as any).insert({
    organization_id: input.orgId,
    task_id: input.taskId,
    policy_id: policy.id === "default-in-code" ? null : policy.id,
    agent_session_id: input.agentSessionId ?? null,
    attempt: decision.nextAttempt,
    error: input.errorMessage,
    outcome: "escalated",
    escalated_at: new Date().toISOString(),
  })

  await sendTelegramEscalation(
    `Mission Control escalation\nTask: ${input.taskId}\nAttempts: ${decision.nextAttempt}\nError: ${input.errorMessage}`,
    policy.escalation_target
  )

  return {
    action: "escalated",
    attempt: decision.nextAttempt,
  }
}
