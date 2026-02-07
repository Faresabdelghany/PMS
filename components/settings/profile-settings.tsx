"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Camera, Trash2 } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { uploadAvatar, deleteAvatar } from "@/lib/actions/user-settings"
import { UI_TOAST_TIMEOUT, UI_EMAIL_CONFIRM_TIMEOUT, MAX_AVATAR_SIZE } from "@/lib/constants"

export function ProfileSettings() {
  const { user, profile, isLoading, refreshProfile } = useUser()
  const [fullName, setFullName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
        if (refreshProfile) {
          await refreshProfile()
        }
        setTimeout(() => setSuccess(null), UI_TOAST_TIMEOUT)
      }
    } catch {
      setError("Failed to update profile")
    }

    setIsSaving(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    // Validate file size (5MB)
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Image must be less than 5MB")
      return
    }

    setIsUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    // Show preview immediately
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to server
    const formData = new FormData()
    formData.append("avatar", file)

    const result = await uploadAvatar(formData)

    if (result.error) {
      setError(result.error)
      // Revert preview on error
      setAvatarPreview(profile?.avatar_url || null)
    } else {
      setSuccess("Avatar updated successfully")
      if (refreshProfile) {
        await refreshProfile()
      }
      setTimeout(() => setSuccess(null), UI_TOAST_TIMEOUT)
    }

    setIsUploadingAvatar(false)
    // Reset file input
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
      setTimeout(() => setSuccess(null), UI_TOAST_TIMEOUT)
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
        setTimeout(() => setSuccess(null), UI_EMAIL_CONFIRM_TIMEOUT)
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
        setTimeout(() => setSuccess(null), UI_TOAST_TIMEOUT)
      }
    } catch {
      setError("Failed to update password")
    }

    setIsChangingPassword(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 p-4 text-green-600 text-sm">
          {success}
        </div>
      )}

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal information and photo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Avatar with upload */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview || undefined} alt={profile.full_name || "Profile picture"} />
                  <AvatarFallback className="text-2xl">
                    {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <p className="font-medium">{profile.full_name || "No name set"}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Change photo
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteAvatar}
                      disabled={isUploadingAvatar}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email Change */}
      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>
            Change the email address associated with your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input value={profile.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
              />
              <p className="text-xs text-muted-foreground">
                A confirmation link will be sent to your new email address.
              </p>
            </div>
            <Button type="submit" disabled={isChangingEmail || !newEmail.trim()}>
              {isChangingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Email
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long.
              </p>
            </div>
            <Button
              type="submit"
              disabled={isChangingPassword || !newPassword || !confirmPassword}
            >
              {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
