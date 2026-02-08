"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { getInvitationByToken, acceptInvitation } from "@/lib/actions/invitations"
import { createClient } from "@/lib/supabase/client"

type InvitationState = "loading" | "valid" | "expired" | "already_accepted" | "error" | "accepting" | "success"

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [state, setState] = useState<InvitationState>("loading")
  const [invitation, setInvitation] = useState<{
    email: string
    organization: { name: string }
    role: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    async function loadInvitation() {
      const { token: inviteToken } = await params
      setToken(inviteToken)

      // Check auth status
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)

      // Load invitation
      const result = await getInvitationByToken(inviteToken)

      if (result.error) {
        if (result.error.includes("expired")) {
          setState("expired")
        } else if (result.error.includes("already")) {
          setState("already_accepted")
        } else {
          setState("error")
          setError(result.error)
        }
        return
      }

      if (result.data) {
        setInvitation(result.data)
        setState("valid")
      }
    }

    loadInvitation()
  }, [params])

  async function handleAccept() {
    if (!token) return

    setState("accepting")

    const result = await acceptInvitation(token)

    if (result.error) {
      setState("error")
      setError(result.error)
      return
    }

    setState("success")
    setTimeout(() => {
      router.push("/inbox")
    }, 2000)
  }

  function handleLogin() {
    if (token) {
      router.push(`/login?redirect=/invite/${token}`)
    }
  }

  function handleSignup() {
    if (token && invitation) {
      router.push(`/signup?email=${encodeURIComponent(invitation.email)}&redirect=/invite/${token}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        {state === "loading" && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Loading Invitation</CardTitle>
              <CardDescription>Please wait...</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </>
        )}

        {state === "valid" && invitation && (
          <>
            <CardHeader className="text-center">
              <CardTitle>You&apos;re Invited!</CardTitle>
              <CardDescription>
                You&apos;ve been invited to join <strong>{invitation.organization.name}</strong> as a{" "}
                <strong>{invitation.role}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">Invitation for</p>
                <p className="font-medium">{invitation.email}</p>
              </div>

              {isAuthenticated ? (
                <Button onClick={handleAccept} className="w-full" size="lg">
                  Accept Invitation
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Please sign in or create an account to accept this invitation.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={handleLogin} variant="outline" className="flex-1">
                      Sign In
                    </Button>
                    <Button onClick={handleSignup} className="flex-1">
                      Create Account
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}

        {state === "accepting" && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Accepting Invitation</CardTitle>
              <CardDescription>Please wait...</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </>
        )}

        {state === "success" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Welcome!</CardTitle>
              <CardDescription>
                You&apos;ve successfully joined {invitation?.organization.name}. Redirecting...
              </CardDescription>
            </CardHeader>
          </>
        )}

        {state === "expired" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle>Invitation Expired</CardTitle>
              <CardDescription>
                This invitation has expired. Please ask for a new invitation from the organization admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/login")} variant="outline" className="w-full">
                Go to Login
              </Button>
            </CardContent>
          </>
        )}

        {state === "already_accepted" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Already Accepted</CardTitle>
              <CardDescription>
                This invitation has already been accepted. You may already be a member of this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/inbox")} className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </>
        )}

        {state === "error" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Error</CardTitle>
              <CardDescription>{error || "Something went wrong. Please try again."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/login")} variant="outline" className="w-full">
                Go to Login
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
