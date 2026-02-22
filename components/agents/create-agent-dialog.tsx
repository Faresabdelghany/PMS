"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { createAgent } from "@/lib/actions/agents"
import { toast } from "sonner"
import type { Agent, AgentType, AgentSquad, AgentWithSupervisor } from "@/lib/supabase/types"

interface CreateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  agents: AgentWithSupervisor[]
  onCreated?: (agent: Agent) => void
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  organizationId,
  agents,
  onCreated,
}: CreateAgentDialogProps) {
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [description, setDescription] = useState("")
  const [agentType, setAgentType] = useState<AgentType>("specialist")
  const [squad, setSquad] = useState<AgentSquad>("engineering")
  const [aiProvider, setAiProvider] = useState("")
  const [aiModel, setAiModel] = useState("")
  const [capabilitiesStr, setCapabilitiesStr] = useState("")
  const [reportsTo, setReportsTo] = useState<string>("")

  function resetForm() {
    setName("")
    setRole("")
    setDescription("")
    setAgentType("specialist")
    setSquad("engineering")
    setAiProvider("")
    setAiModel("")
    setCapabilitiesStr("")
    setReportsTo("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const capabilities = capabilitiesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    const result = await createAgent(organizationId, {
      name,
      role,
      description: description || null,
      agent_type: agentType,
      squad,
      ai_provider: aiProvider || null,
      ai_model: aiModel || null,
      capabilities,
      reports_to: reportsTo || null,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(`${name} has been created.`)
    resetForm()
    onOpenChange(false)
    onCreated?.(result.data!)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>Add a new AI agent to your organization.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Name *</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Code Review Agent"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-role">Role *</Label>
              <Input
                id="agent-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Code Reviewer"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="agent-desc">Description</Label>
            <Textarea
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
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

          {/* AI Provider & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ai-provider">AI Provider</Label>
              <Input
                id="ai-provider"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                placeholder="e.g. anthropic"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">AI Model</Label>
              <Input
                id="ai-model"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="e.g. claude-opus-4-6"
              />
            </div>
          </div>

          {/* Capabilities */}
          <div className="space-y-1.5">
            <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
            <Input
              id="capabilities"
              value={capabilitiesStr}
              onChange={(e) => setCapabilitiesStr(e.target.value)}
              placeholder="e.g. code-review, testing, deployment"
            />
          </div>

          {/* Reports To */}
          <div className="space-y-1.5">
            <Label>Reports To</Label>
            <Select value={reportsTo} onValueChange={setReportsTo}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name || !role}>
              {loading ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
