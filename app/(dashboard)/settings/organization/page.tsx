"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2, UserPlus, Trash2, Mail } from "lucide-react"
import { useOrganization } from "@/hooks/use-organization"
import { updateOrganization, getOrganizationMembers, removeOrganizationMember, updateMemberRole } from "@/lib/actions/organizations"
import { inviteMember, getPendingInvitations, cancelInvitation, resendInvitation } from "@/lib/actions/invitations"
import type { OrgMemberRole, Invitation } from "@/lib/supabase/types"

type Member = {
  id: string
  role: OrgMemberRole
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

export default function OrganizationSettingsPage() {
  const router = useRouter()
  const { organization, refreshOrganizations } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [name, setName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>("member")
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!organization) return
    setIsLoading(true)

    const [membersResult, invitationsResult] = await Promise.all([
      getOrganizationMembers(organization.id),
      getPendingInvitations(organization.id),
    ])

    if (membersResult.data) {
      setMembers(membersResult.data as Member[])
    }
    if (invitationsResult.data) {
      setInvitations(invitationsResult.data)
    }

    setIsLoading(false)
  }, [organization])

  useEffect(() => {
    if (organization) {
      setName(organization.name)
      loadData()
    }
  }, [organization, loadData])

  async function handleSave() {
    if (!organization) return
    setIsSaving(true)
    setError(null)

    const result = await updateOrganization(organization.id, { name })

    if (result.error) {
      setError(result.error)
    } else {
      await refreshOrganizations()
    }

    setIsSaving(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!organization || !inviteEmail) return

    setIsInviting(true)
    setError(null)

    const result = await inviteMember(organization.id, inviteEmail, inviteRole)

    if (result.error) {
      setError(result.error)
    } else {
      setInviteEmail("")
      setInviteRole("member")
      await loadData()
    }

    setIsInviting(false)
  }

  async function handleRemoveMember(userId: string) {
    if (!organization) return

    const result = await removeOrganizationMember(organization.id, userId)
    if (result.error) {
      setError(result.error)
    } else {
      await loadData()
    }
  }

  async function handleUpdateRole(userId: string, role: OrgMemberRole) {
    if (!organization) return

    const result = await updateMemberRole(organization.id, userId, role)
    if (result.error) {
      setError(result.error)
    } else {
      await loadData()
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    const result = await cancelInvitation(invitationId)
    if (result.error) {
      setError(result.error)
    } else {
      await loadData()
    }
  }

  async function handleResendInvitation(invitationId: string) {
    const result = await resendInvitation(invitationId)
    if (result.error) {
      setError(result.error)
    } else {
      await loadData()
    }
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isAdmin = organization.role === "admin"

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization settings and team members.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your organization information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label>Organization ID</Label>
            <Input value={organization.id} disabled />
            <p className="text-xs text-muted-foreground">
              Used for API integrations and support requests.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage who has access to this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Form */}
          {isAdmin && (
            <>
              <form onSubmit={handleInvite} className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgMemberRole)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Invite
                </Button>
              </form>
              <Separator />
            </>
          )}

          {/* Members List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {member.profile.full_name?.[0] || member.profile.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.profile.full_name || member.profile.email}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleUpdateRole(member.profile.id, v as OrgMemberRole)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{member.role}</Badge>
                    )}
                    {isAdmin && members.length > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this member from the organization? They will lose access to all organization resources.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.profile.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-4">Pending Invitations</h4>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{invitation.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited as {invitation.role} • Expires{" "}
                            {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation.id)}
                          >
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleCancelInvitation(invitation.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
