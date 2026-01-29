"use client"

import { useState, useEffect } from "react"
import { Spinner, ShieldCheck, DiamondsFour } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader, SettingSection, SettingRow } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import { updateOrganization } from "@/lib/actions/organizations"

const identityCards = [
  {
    id: "saml",
    title: "SAML SSO",
    description:
      "Allow users to log in with SAML single sign-on (SSO). Read the help center article for configuration steps.",
    helpHref: "#",
    toggleLabel: "Enable SAML SSO",
    enabled: false,
  },
  {
    id: "scim",
    title: "SCIM",
    description:
      "Use SCIM provisioning to automatically create, update, and delete users. Read the help center article for configuration steps.",
    helpHref: "#",
    toggleLabel: "Enable SCIM",
    enabled: false,
  },
] as const

export function IdentityPane() {
  const { organization, refreshOrganizations } = useOrganization()
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (organization) {
      setName(organization.name)
    }
  }, [organization])

  async function handleSave() {
    if (!organization) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateOrganization(organization.id, { name })

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess("Organization updated successfully")
      await refreshOrganizations()
      setTimeout(() => setSuccess(null), 3000)
    }

    setIsSaving(false)
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
        title="Identity"
        description="Secure and streamline user access. Enable SAML SSO for single sign-on and SCIM provisioning for automated account management."
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 p-4 text-green-600 text-sm">{success}</div>
      )}

      <SettingSection title="Organization">
        <SettingRow label="Organization Name" description="This is the name shown across the workspace.">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="h-9 text-sm"
            />
            {isAdmin && (
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            )}
          </div>
        </SettingRow>
        <SettingRow label="Organization ID" description="Used for API integrations and support requests.">
          <Input value={organization.id} disabled className="h-9 text-sm font-mono" />
        </SettingRow>
      </SettingSection>

      <Separator />

      <div className="space-y-6">
        {identityCards.map((card) => (
          <div key={card.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {card.description.split("help center article")[0]}
              <Link href={card.helpHref} className="text-primary underline underline-offset-4">
                help center article
              </Link>
              {card.description.split("help center article")[1]}
            </p>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <span className="text-sm text-foreground">{card.toggleLabel}</span>
              <Switch disabled={!card.enabled} defaultChecked={card.enabled} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2">
          See plans
        </Button>
        <Button size="sm" className="gap-2">
          <DiamondsFour className="h-4 w-4" />
          Upgrade
        </Button>
      </div>
    </div>
  )
}
