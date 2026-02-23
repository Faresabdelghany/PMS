"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { getAgent, updateAgent } from "@/lib/actions/agents"
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
import { PageSkeleton } from "@/components/ui/page-skeleton"
import type { AgentType, AgentSquad, AgentStatus, AgentWithSupervisor } from "@/lib/supabase/types"

const AI_MODELS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
]

export default function EditAgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<AgentWithSupervisor | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [description, setDescription] = useState("")
  const [agentType, setAgentType] = useState<AgentType>("specialist")
  const [squad, setSquad] = useState<AgentSquad>("engineering")
  const [aiModel, setAiModel] = useState("claude-sonnet-4-6")
  const [status, setStatus] = useState<AgentStatus>("offline")

  useEffect(() => {
    getAgent(agentId).then((result) => {
      if (result.data) {
        const a = result.data
        setAgent(a)
        setName(a.name)
        setRole(a.role)
        setDescription(a.description || "")
        setAgentType(a.agent_type)
        setSquad(a.squad)
        setAiModel(a.ai_model || "claude-sonnet-4-6")
        setStatus(a.status)
      }
      setLoading(false)
    })
  }, [agentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const aiProvider = aiModel.startsWith("claude") ? "anthropic" : aiModel.startsWith("gemini") ? "google" : "openai"

    const result = await updateAgent(agentId, {
      name,
      role,
      description: description || null,
      agent_type: agentType,
      squad,
      ai_provider: aiProvider,
      ai_model: aiModel,
      status,
    })

    setSaving(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Agent updated successfully")
    router.push(`/agents/${agentId}`)
  }

  if (loading) return <PageSkeleton />

  if (!agent) {
    return (
      <div className="flex flex-col flex-1">
        <PageHeader title="Edit Agent" />
        <div className="p-6">
          <p className="text-muted-foreground">Agent not found.</p>
          <Link href="/agents"><Button variant="outline" className="mt-4">Back to Agents</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Edit Agent"
        actions={
          <Link href={`/agents/${agentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
        }
      />
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Details — {agent.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">Role *</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={agentType} onValueChange={(v) => setAgentType(v as AgentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supreme">Supreme</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="specialist">Specialist</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Squad</Label>
                  <Select value={squad} onValueChange={(v) => setSquad(v as AgentSquad)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>AI Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link href={`/agents/${agentId}`}>
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={saving || !name || !role}>
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
