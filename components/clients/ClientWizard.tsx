"use client"

import { useState, type ChangeEvent } from "react"
import { MotionDiv } from "@/components/ui/motion-lazy"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Client, ClientStatus } from "@/lib/supabase/types"
import { createClientAction, updateClient } from "@/lib/actions/clients"
import { X } from "@phosphor-icons/react/dist/ssr/X"

interface ClientWizardProps {
  mode: "create" | "edit"
  initialClient?: Client
  organizationId?: string
  onClose: () => void
  onSubmit?: (client: Client) => void
}

export function ClientWizard({ mode, initialClient, organizationId, onClose, onSubmit }: ClientWizardProps) {
  const [name, setName] = useState(initialClient?.name ?? "")
  const [status, setStatus] = useState<ClientStatus>(initialClient?.status ?? "active")
  const [primaryContactName, setPrimaryContactName] = useState(initialClient?.primary_contact_name ?? "")
  const [primaryContactEmail, setPrimaryContactEmail] = useState(initialClient?.primary_contact_email ?? "")
  const [industry, setIndustry] = useState(initialClient?.industry ?? "")
  const [website, setWebsite] = useState(initialClient?.website ?? "")
  const [location, setLocation] = useState(initialClient?.location ?? "")
  const [notes, setNotes] = useState(initialClient?.notes ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = mode === "edit"

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Client name is required")
      return
    }

    if (!isEdit && !organizationId) {
      toast.error("Organization ID is required")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit && initialClient) {
        const result = await updateClient(initialClient.id, {
          name: name.trim(),
          status,
          primary_contact_name: primaryContactName.trim() || null,
          primary_contact_email: primaryContactEmail.trim() || null,
          industry: industry.trim() || null,
          website: website.trim() || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
        })

        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success("Client updated")
        onSubmit?.(result.data!)
      } else {
        const result = await createClientAction(organizationId!, {
          name: name.trim(),
          status,
          primary_contact_name: primaryContactName.trim() || null,
          primary_contact_email: primaryContactEmail.trim() || null,
          industry: industry.trim() || null,
          website: website.trim() || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
        })

        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success("Client created")
        onSubmit?.(result.data!)
      }

      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-[24px] bg-background shadow-2xl border border-border"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div>
            <p className="text-base font-semibold text-foreground">
              {isEdit ? "Edit client" : "New client"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Basic information about the client, primary contact and context.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Client name</Label>
              <Input
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Primary contact name</Label>
              <Input
                value={primaryContactName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrimaryContactName(e.target.value)}
                placeholder="e.g. Sarah Lee"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Primary contact email</Label>
              <Input
                type="email"
                value={primaryContactEmail}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrimaryContactEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Industry</Label>
              <Input
                value={industry}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIndustry(e.target.value)}
                placeholder="Fintech, Healthcare..."
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Location</Label>
              <Input
                value={location}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                placeholder="City, Country"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Website</Label>
            <Input
              value={website}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
              placeholder="https://"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Context about this client, expectations, or important details."
              className="min-h-24 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-background px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
            {isEdit ? "Save changes" : "Create client"}
          </Button>
        </div>
      </MotionDiv>
    </div>
  )
}
