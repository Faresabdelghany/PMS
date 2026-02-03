/**
 * Extracts user IDs from @mentions in text.
 * Supports format: @[Display Name](user-uuid)
 *
 * Example: "Hey @[John Doe](123e4567-e89b-12d3-a456-426614174000) check this"
 * Returns: ["123e4567-e89b-12d3-a456-426614174000"]
 */
export function extractMentions(text: string): string[] {
  if (!text) return []

  // Match @[Display Name](uuid) pattern
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]{36})\)/gi
  const userIds: string[] = []

  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const userId = match[2]
    if (userId && !userIds.includes(userId)) {
      userIds.push(userId)
    }
  }

  return userIds
}
