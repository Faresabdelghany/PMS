"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface ErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  /** Short label shown in the heading, e.g. "Projects" → "Something went wrong loading Projects" */
  routeName?: string
}

export function ErrorFallback({ error, reset, routeName }: ErrorFallbackProps) {
  const router = useRouter()

  useEffect(() => {
    // Server errors have a digest and are already captured by Sentry's onRequestError
    // in instrumentation.ts — only report client-only errors to avoid duplicates
    if (!error.digest) {
      Sentry.captureException(error)
    }
  }, [error])

  const heading = routeName
    ? `Something went wrong loading ${routeName}`
    : "Something went wrong"

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Go back
          </Button>
          <Button size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
