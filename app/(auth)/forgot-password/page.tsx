"use client"

import { useState } from "react"
import Link from "next/link"
import { resetPassword } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setFormError(null)

    const result = await resetPassword(formData)

    if (result?.error) {
      setFormError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      setSuccess(true)
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-2xl font-bold leading-none tracking-tight">Check your email</h2>
          <CardDescription>
            Check your email for a password reset link
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/login">
            <Button variant="outline">Back to sign in</Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <h2 className="text-2xl font-bold leading-none tracking-tight">Forgot password</h2>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {formError && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {formError}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Sending reset link..." : "Send reset link"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href="/login" className="text-sm text-muted-foreground underline underline-offset-4 decoration-1 hover:text-primary hover:decoration-2">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
