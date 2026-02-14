import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only initialize if DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: 5% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop",
    // Network errors users can't control
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // Next.js navigation
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
