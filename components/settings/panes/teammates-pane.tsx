"use client"

import { useState, useEffect, useCallback } from "react"
import { Spinner } from "@phosphor-icons/react/dist/ssr/Spinner"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple"
import { UserPlus } from "@phosphor-icons/react/dist/ssr/UserPlus"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { SettingsPaneHeader } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import {
  getOrganizationMembers,
  removeOrganizationMember,
  updateMemberRole,
} from "@/lib/actions/organizations"
import {
  inviteMember,
  getPendingInvitations,
  cancelInvitation,
  resendInvitation,
} from "@/lib/actions/invitations"
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

export function TeammatesPane() {
  const { organization } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
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
    loadData()
  }, [loadData])

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
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isAdmin = organization.role === "admin"

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Teammates"
        description={
          <>
            Invite and manage your teammates to collaborate. You can also{" "}
            <Link href="#" className="text-primary underline underline-offset-4">
              set up AI agents
            </Link>{" "}
            to work alongside your team.
          </>
        }
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      {/* Invite Form */}
      {isAdmin && (
        <div className="space-y-3">
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="email"
              placeholder="Invite teammates by email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgMemberRole)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isInviting} className="sm:w-auto">
              {isInviting ? (
                <Spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Invite
            </Button>
          </form>
        </div>
      )}

      <Separator />

      {/* Members List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-2xl border border-border">
          <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-muted-foreground">
            <span className="col-span-6">Name</span>
            <span className="col-span-3">Status</span>
            <span className="col-span-3 text-right sm:text-left">Role</span>
          </div>
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="grid grid-cols-12 items-center px-4 py-4">
                <div className="col-span-6 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={getOptimizedAvatarUrl(member.profile.avatar_url)} alt={member.profile.full_name || "Team member"} />
                    <AvatarFallback>
                      {member.profile.full_name?.[0] || member.profile.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {member.profile.full_name || member.profile.email}
                    </span>
                    <span className="text-xs text-muted-foreground">{member.profile.email}</span>
                  </div>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">Active</div>
                <div className="col-span-3 flex items-center justify-end gap-2 sm:justify-start">
                  {isAdmin ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleUpdateRole(member.profile.id, v as OrgMemberRole)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {members.length > 1 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this member from the organization?
                                They will lose access to all organization resources.
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
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {member.role}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-4">Pending Invitations</h4>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <EnvelopeSimple className="h-4 w-4 text-muted-foreground" />
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
    </div>
  )
}
