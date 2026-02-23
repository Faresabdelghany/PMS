"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { createGateway } from "@/lib/actions/gateways"
import { useOrganization } from "@/hooks/use-organization"
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

export default function NewGatewayPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState("")
  const [url, setUrl] = useState("http://localhost:18789")
  const [authMode, setAuthMode] = useState<"none" | "token" | "basic">("none")
  const [authToken, setAuthToken] = useState("")
  const [workspaceRoot, setWorkspaceRoot] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organization?.id) return

    setLoading(true)

    const result = await createGateway(organization.id, {
      name,
      url: url || undefined,
      workspace_root: workspaceRoot || undefined,
      auth_mode: authMode,
      auth_token: authToken || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Gateway created successfully")
    router.push(`/gateways/${result.data!.id}`)
  }

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="New Gateway"
        actions={
          <Link href="/gateways">
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
            <CardTitle className="text-base">Gateway Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gw-name">Name *</Label>
                <Input
                  id="gw-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Local Gateway"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gw-url">Gateway URL</Label>
                <Input
                  id="gw-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:18789"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gw-workspace">Workspace Root</Label>
                <Input
                  id="gw-workspace"
                  value={workspaceRoot}
                  onChange={(e) => setWorkspaceRoot(e.target.value)}
                  placeholder="/path/to/workspace (optional)"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Authentication Mode</Label>
                <Select value={authMode} onValueChange={(v) => setAuthMode(v as "none" | "token" | "basic")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="token">Token</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {authMode !== "none" && (
                <div className="space-y-1.5">
                  <Label htmlFor="gw-token">
                    {authMode === "token" ? "Auth Token" : "Password"}
                  </Label>
                  <Input
                    id="gw-token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="Enter token..."
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Link href="/gateways">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={loading || !name}>
                  {loading ? "Creating..." : "Create Gateway"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
