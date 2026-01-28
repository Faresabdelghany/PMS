// lib/cache/client.ts
import { kv } from "@vercel/kv"

/**
 * Re-export the Vercel KV client.
 * Centralized for easier mocking in tests and potential client switching.
 */
export { kv }

/**
 * Check if KV is available (has required env vars).
 */
export function isKVAvailable(): boolean {
  return !!(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  )
}
