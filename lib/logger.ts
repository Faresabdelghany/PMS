/**
 * Structured logger for server-side code.
 *
 * - JSON in production (for log aggregation: Vercel, Datadog, etc.)
 * - Human-readable in development
 * - Includes timestamps, levels, and structured context
 *
 * Usage:
 *   import { logger } from "@/lib/logger"
 *   logger.error("Failed to fetch", { module: "cache", key, error })
 *   logger.warn("KV unavailable", { module: "rate-limit" })
 *   logger.info("Migration complete", { module: "auth" })
 */

type LogLevel = "debug" | "info" | "warn" | "error"

type LogContext = Record<string, unknown>

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isProduction = process.env.NODE_ENV === "production"
const minLevel = isProduction ? "info" : "debug"

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return String(err)
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return

  if (isProduction) {
    // JSON output for log aggregation
    const entry = {
      level,
      msg: message,
      ts: new Date().toISOString(),
      ...context,
      // Flatten error objects for better indexing
      ...(context?.error !== undefined
        ? { error: formatError(context.error) }
        : {}),
    }
    const output = JSON.stringify(entry)
    if (level === "error") {
      console.error(output)
    } else if (level === "warn") {
      console.warn(output)
    } else {
      console.log(output)
    }
  } else {
    // Human-readable in development
    const prefix = `[${level.toUpperCase()}]`
    const module = context?.module ? `[${context.module}]` : ""
    const parts = [prefix, module, message].filter(Boolean)
    const msg = parts.join(" ")

    // Omit module from extra context since it's already in prefix
    const extra = context ? { ...context } : undefined
    if (extra) delete extra.module

    const hasExtra = extra && Object.keys(extra).length > 0

    if (level === "error") {
      hasExtra ? console.error(msg, extra) : console.error(msg)
    } else if (level === "warn") {
      hasExtra ? console.warn(msg, extra) : console.warn(msg)
    } else {
      hasExtra ? console.log(msg, extra) : console.log(msg)
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
}
