"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createOrganization } from "@/lib/actions/organizations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await createOrganization(formData)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result.data) {
      router.push("/inbox")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md p-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Welcome to PMS</CardTitle>
            <CardDescription>
              Let&apos;s get started by creating your organization. You can invite team members later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Acme Inc."
                  required
                  minLength={2}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  This will be your workspace for managing projects and team members.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
