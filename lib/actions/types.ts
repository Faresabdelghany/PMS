/**
 * Standard result type for all Server Actions.
 * Returns either data on success or an error message on failure.
 */
export type ActionResult<T = void> = {
  error?: string
  data?: T
}

/**
 * Paginated result type for cursor-based pagination.
 * Extends ActionResult with cursor metadata for "load more" patterns.
 *
 * Usage:
 *   const result = await getProjects(orgId, undefined, undefined, 50)
 *   // result.data       → T[]  (the page items)
 *   // result.nextCursor  → string | null (pass to next call)
 *   // result.hasMore     → boolean (show "Load More" button)
 */
export type PaginatedResult<T> = ActionResult<T[]> & {
  nextCursor?: string | null
  hasMore?: boolean
}
