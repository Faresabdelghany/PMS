/**
 * Sanitize search input to prevent PostgREST filter injection.
 * Escapes special characters used in PostgREST filter syntax.
 *
 * Extracted from lib/actions/search.ts so it can be imported
 * without the "use server" constraint (all exports in "use server"
 * files must be async functions in Next.js 16).
 */
export function sanitizeSearchInput(input: string): string {
  // Remove or escape characters that have special meaning in PostgREST filters
  // These include: . , ( ) and potentially others
  return input
    .replace(/[%_]/g, "\\$&") // Escape SQL LIKE wildcards
    .replace(/[.,()]/g, "") // Remove PostgREST special characters
    .trim()
}
