"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { getBoard, updateBoard } from "@/lib/actions/boards"
import { getAgents } from "@/lib/actions/agents"
import { getGateways } from "@/lib/actions/gateways"
import { getBoardGroups } from "@/lib/actions/board-groups"
import { useOrganization } from "@/hooks/use-organization"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AgentWithSupervisor } from "@/lib/supabase/types"
import type { Gateway } from "@/lib/actions/gateways"
import type { BoardGroup } from "@/lib/actions/board-groups"
import type { Board } from "@/lib/actions/boards"

export default function EditBoardPage() {
  const router = useRouter()
  const params = useParams()
  const boardId = params.boardId as string
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(false)
  const [board, setBoard] = useState<Board | null>(null)
  const [agents, setAgents] = useState<AgentWithSupervisor[]>([])
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([])

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"active" | "archived" | "paused">("active")
  const [agentId, setAgentId] = useState("none")
  const [gatewayId, setGatewayId] = useState("none")
  const [boardGroupId, setBoardGroupId] = useState("none")

  useEffect(() => {
    if (!boardId || !organization?.id) return
    Promise.all([
      getBoard(boardId),
      getAgents(organization.id),
      getGateways(organization.id),
      getBoardGroups(organization.id),
    ]).then(([boardResult, agentsResult, gatewaysResult, groupsResult]) => {
      if (boardResult.data) {
        const b = boardResult.data
        setBoard(b)
        setName(b.name)
        setDescription(b.description ?? "")
        setStatus(b.status)
        setAgentId(b.agent_id ?? "none")
        setGatewayId(b.gateway_id ?? "none")
        setBoardGroupId((b as any).board_group_id ?? "none")
      }
      setAgents(agentsResult.data ?? [])
      setGateways(gatewaysResult.data ?? [])
      setBoardGroups(groupsResult.data ?? [])
    })
  }, [boardId, organization?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await updateBoard(boardId, {
      name,
      description: description || null,
      status,
      agent_id: agentId !== "none" ? agentId : null,
      gateway_id: gatewayId !== "none" ? gatewayId : null,
      board_group_id: boardGroupId !== "none" ? boardGroupId : null,
    } as any)

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Board updated")
    router.push(`/boards/${boardId}`)
  }

  if (!board) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-xl">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Link href={`/boards/${boardId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Board</h1>
          <p className="text-sm text-muted-foreground">Update board settings</p>
        </div>
      </div>

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
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
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

            <div className="space-y-1.5">
              <Label>Board Group</Label>
              <Select value={boardGroupId} onValueChange={setBoardGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {boardGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Link href={`/boards/${boardId}`}>
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading || !name}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
