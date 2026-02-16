"use client"

import { Suspense, useState, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn, signInWithGoogle } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Loader2, ArrowRight, Shield } from "lucide-react"

// Login schema - intentionally loose password validation
// Password strength is only enforced during signup, not login
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(error)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  })

  function onSubmit(values: LoginFormValues) {
    setFormError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.append("email", values.email)
      formData.append("password", values.password)

      const result = await signIn(formData)

      if (result?.error) {
        setFormError(result.error)
      }
    })
  }

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      await signInWithGoogle()
    })
  }

  const isLoading = isPending || isGooglePending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      {/* Error message - always rendered to avoid layout shift */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ${formError ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
            {formError}
          </div>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-11 text-sm bg-muted/40 border-border/60 focus:bg-background transition-colors"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-medium">Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-11 text-sm bg-muted/40 border-border/60 focus:bg-background transition-colors"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold shadow-sm group"
            disabled={isLoading}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </Button>
        </form>
      </Form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">
            or
          </span>
        </div>
      </div>

      {/* Google Sign In */}
      <Button
        variant="outline"
        className="w-full h-11 text-sm font-medium border-border/60 hover:bg-accent/50 transition-colors"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        {isGooglePending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {isGooglePending ? "Connecting..." : "Continue with Google"}
      </Button>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-foreground font-medium hover:underline underline-offset-4"
        >
          Create one
        </Link>
      </p>

      {/* Trust badge */}
      <div className="flex items-center justify-center gap-1.5 pt-2">
        <Shield className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] text-muted-foreground/60">
          Enterprise-grade encryption
        </span>
      </div>
    </div>
  )
}

export function LoginSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-8 w-24 bg-muted rounded-md" />
        <div className="h-4 w-56 bg-muted rounded-md" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-12 bg-muted rounded" />
          <div className="h-11 w-full bg-muted rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-11 w-full bg-muted rounded-md" />
        </div>
        <div className="h-11 w-full bg-muted rounded-md" />
      </div>
      <div className="h-px w-full bg-muted" />
      <div className="h-11 w-full bg-muted rounded-md" />
    </div>
  )
}

export default function LoginFormWrapper() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
