"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { createBoard } from "@/lib/actions/boards"
import { getAgents } from "@/lib/actions/agents"
import { getGateways } from "@/lib/actions/gateways"
import { useOrganization } from "@/hooks/use-organization"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AgentWithSupervisor } from "@/lib/supabase/types"
import type { Gateway } from "@/lib/actions/gateways"

export default function NewBoardPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState<AgentWithSupervisor[]>([])
  const [gateways, setGateways] = useState<Gateway[]>([])

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [agentId, setAgentId] = useState("")
  const [gatewayId, setGatewayId] = useState("")

  useEffect(() => {
    if (!organization?.id) return
    Promise.all([
      getAgents(organization.id),
      getGateways(organization.id),
    ]).then(([agentsResult, gatewaysResult]) => {
      setAgents(agentsResult.data || [])
      setGateways(gatewaysResult.data || [])
    })
  }, [organization?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organization?.id) return

    setLoading(true)

    const result = await createBoard(organization.id, {
      name,
      description: description || undefined,
      agent_id: (agentId && agentId !== "none") ? agentId : undefined,
      gateway_id: (gatewayId && gatewayId !== "none") ? gatewayId : undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Board created successfully")
    router.push(`/boards/${result.data!.id}`)
  }

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="New Board"
        actions={
          <Link href="/boards">
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
            <CardTitle className="text-base">Board Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="board-name">Name *</Label>
                <Input
                  id="board-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Sprint Board"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="board-desc">Description</Label>
                <Textarea
                  id="board-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this board for?"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Agent</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} — {agent.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Gateway</Label>
                <Select value={gatewayId} onValueChange={setGatewayId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gateway (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {gateways.map((gw) => (
                      <SelectItem key={gw.id} value={gw.id}>
                        {gw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link href="/boards">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={loading || !name}>
                  {loading ? "Creating..." : "Create Board"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
