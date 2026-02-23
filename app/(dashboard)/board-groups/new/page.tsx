"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { createBoardGroup } from "@/lib/actions/board-groups"
import { useOrganization } from "@/hooks/use-organization"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function NewBoardGroupPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organization?.id) return
    setLoading(true)
    const result = await createBoardGroup(organization.id, {
      name,
      description: description || undefined,
    })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Board group created")
    router.push("/board-groups")
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Link href="/board-groups">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Board Group</h1>
          <p className="text-sm text-muted-foreground">Organize your boards into a logical group</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grp-name">Name *</Label>
              <Input
                id="grp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grp-desc">Description</Label>
              <Textarea
                id="grp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What boards belong here?"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Link href="/board-groups">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading || !name}>
                {loading ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
