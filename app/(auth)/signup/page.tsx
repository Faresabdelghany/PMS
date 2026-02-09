"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signUp, signInWithGoogle } from "@/lib/actions/auth"
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
import { Loader2, ArrowRight, Check, Sparkles } from "lucide-react"

const signupSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .min(2, "Full name must be at least 2 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
})

type SignupFormValues = z.infer<typeof signupSchema>

// Password strength checker
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" }
  if (score <= 2) return { score: 2, label: "Fair", color: "bg-orange-500" }
  if (score <= 3) return { score: 3, label: "Good", color: "bg-yellow-500" }
  if (score <= 4) return { score: 4, label: "Strong", color: "bg-green-500" }
  return { score: 5, label: "Very Strong", color: "bg-emerald-500" }
}

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [passwordValue, setPasswordValue] = useState("")

  const passwordStrength = passwordValue ? getPasswordStrength(passwordValue) : null

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
    mode: "onChange",
  })

  function onSubmit(values: SignupFormValues) {
    setFormError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.append("fullName", values.fullName)
      formData.append("email", values.email)
      formData.append("password", values.password)

      const result = await signUp(formData)

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
  const isFormValid = form.formState.isValid

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">
          Start managing projects like a pro
        </p>
      </div>

      {/* Error message - always rendered to avoid layout shift */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ${formError ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl">
            {formError}
          </div>
        </div>
      </div>

      {/* Google Sign In */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
        <Button
          variant="outline"
          className="w-full h-12 text-base font-medium border-2 hover:bg-accent/50 transition-colors duration-200"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isGooglePending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
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
      </div>

      {/* Divider */}
      <div className="relative animate-in fade-in duration-500 delay-150">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground font-medium">
            or continue with email
          </span>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                <FormLabel className="text-sm font-medium">Full name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    disabled={isLoading}
                    className="h-12 text-base border-2 focus:border-primary/50 transition-colors"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-250">
                <FormLabel className="text-sm font-medium">Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-12 text-base border-2 focus:border-primary/50 transition-colors"
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
              <FormItem className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                <FormLabel className="text-sm font-medium">Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-12 text-base border-2 focus:border-primary/50 transition-colors"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      setPasswordValue(e.target.value)
                    }}
                  />
                </FormControl>
                {/* Password strength indicator - always rendered to avoid layout shift */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ${passwordValue && passwordStrength ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-2 pt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                              passwordStrength && level <= passwordStrength.score
                                ? passwordStrength.color
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Password strength: <span className="font-medium">{passwordStrength?.label ?? ""}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-400">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-colors duration-200 group"
              disabled={isLoading || !isFormValid}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Benefits list */}
      <div className="space-y-3 pt-2 animate-in fade-in duration-500 delay-500">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What you&apos;ll get:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Unlimited projects",
            "Team collaboration",
            "AI-powered insights",
            "Real-time updates",
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div className="text-center animate-in fade-in duration-500 delay-600">
        <p className="text-xs text-muted-foreground leading-relaxed">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div className="text-center animate-in fade-in duration-500 delay-700">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 font-semibold transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Trust badge */}
      <div className="flex items-center justify-center gap-2 pt-2 animate-in fade-in duration-500 delay-800">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Free 14-day trial, no credit card required
        </span>
      </div>
    </div>
  )
}
