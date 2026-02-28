import { test, expect } from "@playwright/test"
import { decideRetryAttempt, computeNextRetryAt } from "@/lib/mission-control/retry-core"

test.describe("retry-core unit", () => {
  test("schedules retry while attempts are within max", async () => {
    const decision = decideRetryAttempt(1, {
      maxAttempts: 3,
      backoffSeconds: 30,
    })

    expect(decision.shouldRetry).toBeTruthy()
    expect(decision.shouldEscalate).toBeFalsy()
    expect(decision.nextAttempt).toBe(2)
  })

  test("escalates when attempts exceed max", async () => {
    const decision = decideRetryAttempt(3, {
      maxAttempts: 3,
      backoffSeconds: 30,
    })

    expect(decision.shouldRetry).toBeFalsy()
    expect(decision.shouldEscalate).toBeTruthy()
    expect(decision.nextAttempt).toBe(4)
  })

  test("computes fixed backoff retry timestamp", async () => {
    const now = new Date("2026-02-28T00:00:00.000Z")
    const next = computeNextRetryAt(now, 30)

    expect(next.toISOString()).toBe("2026-02-28T00:00:30.000Z")
  })
})

