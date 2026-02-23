"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { getGateway, updateGateway } from "@/lib/actions/gateways"
import type { Gateway } from "@/lib/actions/gateways"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function EditGatewayPage({ params }: { params: Promise<{ gatewayId: string }> }) {
  const { gatewayId } = use(params)
  const router = useRouter()
  const [gateway, setGateway] = useState<Gateway | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [authMode, setAuthMode] = useState<"none" | "token" | "basic">("none")
  const [authToken, setAuthToken] = useState("")
  const [workspaceRoot, setWorkspaceRoot] = useState("")

  useEffect(() => {
    getGateway(gatewayId).then((result) => {
      if (result.data) {
        const g = result.data
        setGateway(g)
        setName(g.name)
        setUrl(g.url)
        setAuthMode(g.auth_mode)
        setWorkspaceRoot(g.workspace_root || "")
      }
      setLoading(false)
    })
  }, [gatewayId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const result = await updateGateway(gatewayId, {
      name,
      url,
      auth_mode: authMode,
      auth_token: authToken || null,
      workspace_root: workspaceRoot || null,
    })

    setSaving(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Gateway updated")
    router.push(`/gateways/${gatewayId}`)
  }

  if (loading) return <PageSkeleton />

  if (!gateway) {
    return (
      <div className="flex flex-col flex-1">
        <PageHeader title="Edit Gateway" />
        <div className="p-6">
          <p className="text-muted-foreground">Gateway not found.</p>
          <Link href="/gateways"><Button variant="outline" className="mt-4">Back</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Edit Gateway"
        actions={
          <Link href={`/gateways/${gatewayId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
        }
      />
      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gateway Details — {gateway.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="url">Gateway URL</Label>
                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:18789" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workspace">Workspace Root</Label>
                <Input
                  id="workspace"
                  value={workspaceRoot}
                  onChange={(e) => setWorkspaceRoot(e.target.value)}
                  placeholder="/path/to/workspace"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Authentication Mode</Label>
                <Select value={authMode} onValueChange={(v) => setAuthMode(v as "none" | "token" | "basic")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="token">Token</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {authMode !== "none" && (
                <div className="space-y-1.5">
                  <Label htmlFor="token">
                    {authMode === "token" ? "Auth Token" : "Password"}
                  </Label>
                  <Input
                    id="token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="Leave blank to keep existing"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Link href={`/gateways/${gatewayId}`}>
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
