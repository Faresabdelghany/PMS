/**
 * Cursor encoding/decoding for cursor-based pagination.
 *
 * Uses compound cursors (value + id) to guarantee uniqueness
 * even when the ordering column has ties (e.g., same updated_at).
 * Cursors are opaque base64url strings — clients never decode them.
 */

/** Encode a compound cursor from ordering value + row ID */
export function encodeCursor(value: string | number, id: string): string {
  return Buffer.from(JSON.stringify([value, id])).toString("base64url")
}

/** Decode a compound cursor, returning [orderingValue, rowId] */
export function decodeCursor(cursor: string): { value: string; id: string } {
  try {
    const [value, id] = JSON.parse(Buffer.from(cursor, "base64url").toString())
    return { value: String(value), id: String(id) }
  } catch {
    throw new Error("Invalid cursor")
  }
}
