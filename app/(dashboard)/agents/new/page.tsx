"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { createAgent } from "@/lib/actions/agents"
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
import type { AgentType, AgentSquad, AgentStatus } from "@/lib/supabase/types"

const AI_MODELS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
]

export default function NewAgentPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [description, setDescription] = useState("")
  const [agentType, setAgentType] = useState<AgentType>("specialist")
  const [squad, setSquad] = useState<AgentSquad>("engineering")
  const [aiModel, setAiModel] = useState("claude-sonnet-4-6")
  const [status, setStatus] = useState<AgentStatus>("offline")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organization?.id) return

    setLoading(true)

    // Derive provider from model
    const aiProvider = aiModel.startsWith("claude") ? "anthropic" : aiModel.startsWith("gemini") ? "google" : "openai"

    const result = await createAgent(organization.id, {
      name,
      role,
      description: description || null,
      agent_type: agentType,
      squad,
      ai_provider: aiProvider,
      ai_model: aiModel,
      status,
      capabilities: [],
      skills: [],
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Agent created successfully")
    router.push(`/agents/${result.data!.id}`)
  }

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="New Agent"
        actions={
          <Link href="/agents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Agents
            </Button>
          </Link>
        }
      />
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Code Review Agent"
                  required
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Code Reviewer"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this agent do?"
                  rows={3}
                />
              </div>

              {/* Type & Squad */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={agentType} onValueChange={(v) => setAgentType(v as AgentType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Model */}
              <div className="space-y-1.5">
                <Label>AI Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Initial Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link href="/agents">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={loading || !name || !role}>
                  {loading ? "Creating..." : "Create Agent"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
