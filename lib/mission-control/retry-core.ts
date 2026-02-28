export interface RetryPolicyConfig {
  maxAttempts: number
  backoffSeconds: number
}

export interface RetryDecision {
  shouldRetry: boolean
  shouldEscalate: boolean
  nextAttempt: number
}

export function decideRetryAttempt(
  priorAttempts: number,
  policy: RetryPolicyConfig
): RetryDecision {
  const nextAttempt = priorAttempts + 1
  const shouldRetry = nextAttempt <= policy.maxAttempts
  return {
    shouldRetry,
    shouldEscalate: !shouldRetry,
    nextAttempt,
  }
}

export function computeNextRetryAt(
  now: Date,
  backoffSeconds: number
): Date {
  return new Date(now.getTime() + backoffSeconds * 1000)
}

