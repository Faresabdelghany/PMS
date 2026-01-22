"use server"

/**
 * Standard result type for all Server Actions.
 * Returns either data on success or an error message on failure.
 */
export type ActionResult<T = void> = {
  error?: string
  data?: T
}
