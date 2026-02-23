"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { createBoardWebhook } from "@/lib/actions/board-webhooks"
import { useOrganization } from "@/hooks/use-organization"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

const ALL_EVENTS = [
  "task.created",
  "task.updated",
  "task.completed",
  "approval.created",
  "approval.decided",
]

export default function NewWebhookPage() {
  const router = useRouter()
  const params = useParams()
  const boardId = params.boardId as string
  const { organization } = useOrganization()

  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["task.created", "task.updated", "task.completed"])
  const [loading, setLoading] = useState(false)

  const toggleEvent = (evt: string) => {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organization?.id) return
    if (!selectedEvents.length) {
      toast.error("Select at least one event")
      return
    }
    setLoading(true)
    const result = await createBoardWebhook({
      board_id: boardId,
      org_id: organization.id,
      url,
      events: selectedEvents,
      secret: secret || undefined,
      enabled,
    })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Webhook created")
    router.push(`/boards/${boardId}/webhooks`)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Link href={`/boards/${boardId}/webhooks`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Webhook</h1>
          <p className="text-sm text-muted-foreground">Receive board events at an external URL</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">URL *</Label>
              <Input
                id="wh-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wh-secret">Secret (optional)</Label>
              <Input
                id="wh-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Used to sign payloads"
              />
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {ALL_EVENTS.map((evt) => (
                  <div key={evt} className="flex items-center gap-2">
                    <Checkbox
                      id={`evt-${evt}`}
                      checked={selectedEvents.includes(evt)}
                      onCheckedChange={() => toggleEvent(evt)}
                    />
                    <Label htmlFor={`evt-${evt}`} className="font-mono text-sm cursor-pointer">
                      {evt}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="wh-enabled" />
              <Label htmlFor="wh-enabled">Enabled</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Link href={`/boards/${boardId}/webhooks`}>
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading || !url}>
                {loading ? "Creating..." : "Create Webhook"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
