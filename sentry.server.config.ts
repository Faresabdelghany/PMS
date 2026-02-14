import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Filter out noisy errors
  ignoreErrors: [
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],
})
