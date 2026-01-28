import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

/**
 * Encryption utilities for sensitive data storage
 * Uses AES-256-GCM (authenticated encryption) for security
 *
 * IMPORTANT: Set ENCRYPTION_KEY environment variable (32 bytes / 64 hex chars)
 * Generate with: openssl rand -hex 32
 */

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // GCM standard
const AUTH_TAG_LENGTH = 16 // GCM standard
const ENCODING = "hex"

/**
 * Get the encryption key from environment variable
 * Throws if not configured (fail-fast for security)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -hex 32"
    )
  }

  // Key should be 32 bytes (64 hex characters) for AES-256
  if (key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    )
  }

  return Buffer.from(key, "hex")
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  // Use Uint8Array for compatibility with Node.js crypto types
  const cipher = createCipheriv(ALGORITHM, new Uint8Array(key), new Uint8Array(iv))

  let encrypted = cipher.update(plaintext, "utf8", ENCODING)
  encrypted += cipher.final(ENCODING)

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext
  return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`
}

/**
 * Decrypt a ciphertext string encrypted with encrypt()
 * Input format: iv:authTag:ciphertext (all hex encoded)
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()

  const parts = ciphertext.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format")
  }

  const [ivHex, authTagHex, encryptedHex] = parts

  const iv = Buffer.from(ivHex, ENCODING)
  const authTag = Buffer.from(authTagHex, ENCODING)

  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length")
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length")
  }

  // Use Uint8Array for compatibility with Node.js crypto types
  const decipher = createDecipheriv(ALGORITHM, new Uint8Array(key), new Uint8Array(iv))
  decipher.setAuthTag(new Uint8Array(authTag))

  let decrypted = decipher.update(encryptedHex, ENCODING, "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Check if a string appears to be encrypted with our format
 * (useful for migrating existing BASE64 data)
 */
export function isEncryptedFormat(value: string): boolean {
  const parts = value.split(":")
  if (parts.length !== 3) return false

  const [ivHex, authTagHex] = parts

  // Check if parts are valid hex and correct lengths
  try {
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH
  } catch {
    return false
  }
}

/**
 * Migrate a BASE64-encoded value to proper encryption
 * Returns null if the value is already encrypted or invalid
 */
export function migrateFromBase64(base64Value: string): string | null {
  // If already in our encrypted format, skip
  if (isEncryptedFormat(base64Value)) {
    return null
  }

  try {
    // Decode the BASE64 value
    const plaintext = Buffer.from(base64Value, "base64").toString("utf-8")

    // Re-encrypt with proper encryption
    return encrypt(plaintext)
  } catch {
    return null
  }
}
