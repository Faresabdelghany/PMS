"use client"

import { useState, useEffect, useRef } from "react"
import { Camera, Trash, Spinner, Copy, Check } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader, SettingSection, SettingRow } from "../setting-primitives"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { uploadAvatar, deleteAvatar } from "@/lib/actions/user-settings"

export function AccountPane() {
  const { user, profile, isLoading, refreshProfile } = useUser()
  const [fullName, setFullName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)

  // Avatar upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Email change state
  const [newEmail, setNewEmail] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)

  // Password change state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setAvatarPreview(profile.avatar_url || null)
    }
  }, [profile])

  useEffect(() => {
    if (!copiedId) return
    const t = setTimeout(() => setCopiedId(false), 1500)
    return () => clearTimeout(t)
  }, [copiedId])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess("Profile updated successfully")
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {
      setError("Failed to update profile")
    }

    setIsSaving(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB")
      return
    }

    setIsUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    const formData = new FormData()
    formData.append("avatar", file)

    const result = await uploadAvatar(formData)

    if (result.error) {
      setError(result.error)
      setAvatarPreview(profile?.avatar_url || null)
    } else {
      setSuccess("Avatar updated successfully")
      if (refreshProfile) {
        await refreshProfile()
      }
      setTimeout(() => setSuccess(null), 3000)
    }

    setIsUploadingAvatar(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function handleDeleteAvatar() {
    if (!confirm("Are you sure you want to remove your profile photo?")) return

    setIsUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    const result = await deleteAvatar()

    if (result.error) {
      setError(result.error)
    } else {
      setAvatarPreview(null)
      setSuccess("Avatar removed successfully")
      if (refreshProfile) {
        await refreshProfile()
      }
      setTimeout(() => setSuccess(null), 3000)
    }

    setIsUploadingAvatar(false)
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) return

    setIsChangingEmail(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const { error: emailError } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      })

      if (emailError) {
        setError(emailError.message)
      } else {
        setSuccess("Confirmation email sent to your new address. Please check your inbox.")
        setNewEmail("")
        setTimeout(() => setSuccess(null), 5000)
      }
    } catch {
      setError("Failed to update email")
    }

    setIsChangingEmail(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsChangingPassword(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (passwordError) {
        setError(passwordError.message)
      } else {
        setSuccess("Password updated successfully")
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {
      setError("Failed to update password")
    }

    setIsChangingPassword(false)
  }

  const handleCopyUserId = async () => {
    if (!user?.id) return
    try {
      await navigator.clipboard.writeText(user.id)
      setCopiedId(true)
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Account"
        description="Manage your personal information and account preferences."
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 p-4 text-green-600 text-sm">{success}</div>
      )}

      <SettingSection title="Information">
        <SettingRow label="Profile photo" description="This image appears across your workspace.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="text-xl">
                  {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Spinner className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                <Camera className="h-4 w-4 mr-1" />
                Change photo
              </Button>
              {avatarPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                  onClick={handleDeleteAvatar}
                  disabled={isUploadingAvatar}
                >
                  <Trash className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                aria-label="Upload profile photo"
              />
            </div>
          </div>
        </SettingRow>
        <SettingRow label="Full name">
          <form onSubmit={handleSaveProfile} className="flex gap-2">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="h-9 text-sm"
            />
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </form>
        </SettingRow>
        <SettingRow label="Email address" description="Notifications will be sent to this address.">
          <Input value={profile.email} type="email" className="h-9 text-sm" readOnly />
        </SettingRow>
        <SettingRow label="Password" description="Keep your account secure with a strong password.">
          <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span>••••••••</span>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => {
              const el = document.getElementById('password-section')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}>
              Set password
            </Button>
          </div>
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Change Email">
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <SettingRow label="New Email">
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                className="h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={isChangingEmail || !newEmail.trim()}>
                {isChangingEmail && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </div>
          </SettingRow>
        </form>
      </SettingSection>

      <Separator />

      <SettingSection title="Change Password" id="password-section">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <SettingRow label="New Password">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="h-9 text-sm"
            />
          </SettingRow>
          <SettingRow label="Confirm Password">
            <div className="flex gap-2">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-9 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isChangingPassword || !newPassword || !confirmPassword}
              >
                {isChangingPassword && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </div>
          </SettingRow>
        </form>
      </SettingSection>

      <Separator />

      <SettingSection title="Authentication">
        <SettingRow label="Token" description="Manage your API key, a bearer authentication token.">
          <Button variant="outline" size="sm" className="h-8 gap-2 px-3 text-xs">
            + Create authentication token
          </Button>
        </SettingRow>
        <SettingRow label="User ID" description="Share this ID if you contact support.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={user.id} readOnly className="font-mono text-sm" />
            <Button variant="ghost" size="sm" onClick={handleCopyUserId}>
              {copiedId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
