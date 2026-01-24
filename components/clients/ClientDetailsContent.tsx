"use client"

import Link from "next/link"
import { ArrowLeft, PencilSimple, Trash } from "@phosphor-icons/react/dist/ssr"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Client, ClientStatus } from "@/lib/supabase/types"

function statusLabel(status: ClientStatus): string {
  if (status === "prospect") return "Prospect"
  if (status === "active") return "Active"
  if (status === "on_hold") return "On hold"
  return "Archived"
}

interface ClientDetailsContentProps {
  client: Client & { project_count: number }
}

export function ClientDetailsContent({ client }: ClientDetailsContentProps) {
  const initials = client.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clients" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to clients
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <PencilSimple className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <Trash className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Client Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-foreground">{client.name}</h1>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium capitalize">
                  {statusLabel(client.status)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {client.project_count} project{client.project_count === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.primary_contact_name ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Primary Contact</p>
                      <p className="text-sm font-medium">{client.primary_contact_name}</p>
                    </div>
                    {client.primary_contact_email && (
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm">{client.primary_contact_email}</p>
                      </div>
                    )}
                    {client.primary_contact_phone && (
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm">{client.primary_contact_phone}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No primary contact set.</p>
                )}
              </CardContent>
            </Card>

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.industry && (
                  <div>
                    <p className="text-xs text-muted-foreground">Industry</p>
                    <p className="text-sm">{client.industry}</p>
                  </div>
                )}
                {client.location && (
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm">{client.location}</p>
                  </div>
                )}
                {client.website && (
                  <div>
                    <p className="text-xs text-muted-foreground">Website</p>
                    <a
                      href={client.website}
                      className="text-sm text-primary underline underline-offset-2"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {client.website}
                    </a>
                  </div>
                )}
                {!client.industry && !client.location && !client.website && (
                  <p className="text-sm text-muted-foreground">No company information yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {client.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-line">{client.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes added yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
