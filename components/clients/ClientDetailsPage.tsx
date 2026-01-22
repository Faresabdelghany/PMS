"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientWizard } from "@/components/clients/ClientWizard"
import Link from "next/link"
import type { Client, ClientStatus } from "@/lib/supabase/types"
import type { ProjectWithRelations } from "@/lib/actions/projects"

function statusLabel(status: ClientStatus): string {
  if (status === "prospect") return "Prospect"
  if (status === "active") return "Active"
  if (status === "on_hold") return "On hold"
  return "Archived"
}

type ClientWithProjectCount = Client & {
  project_count: number
  owner?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

type ClientDetailsPageProps = {
  client: ClientWithProjectCount
  relatedProjects: ProjectWithRelations[]
  organizationId: string
}

export function ClientDetailsPage({ client, relatedProjects, organizationId }: ClientDetailsPageProps) {
  const router = useRouter()
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const ownerName = client.owner?.full_name || client.owner?.email || null

  const handleWizardSuccess = () => {
    setIsWizardOpen(false)
    router.refresh()
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-medium text-foreground">{client.name}</p>
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize">
                {statusLabel(client.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Client · {client.project_count} project{client.project_count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsWizardOpen(true)}>
            Edit client
          </Button>
          <Link href={`/projects/new?clientId=${client.id}`}>
            <Button size="sm">
              New project
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-background px-2 my-0 rounded-b-lg min-w-0 border-t">
        <div className="px-4">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mt-0 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]">
              <div className="space-y-6 pt-4">
                <Tabs defaultValue="overview">
                  <TabsList className="w-full gap-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="projects">Projects</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Primary contact</p>
                        {client.primary_contact_name ? (
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{client.primary_contact_name}</p>
                            {client.primary_contact_email && (
                              <p className="text-xs text-muted-foreground">{client.primary_contact_email}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No primary contact set.</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Company info</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {client.industry && <p>Industry: {client.industry}</p>}
                          {client.location && <p>Location: {client.location}</p>}
                          {client.website && (
                            <p>
                              Website: <a href={client.website} className="underline underline-offset-2" target="_blank" rel="noreferrer">{client.website}</a>
                            </p>
                          )}
                          {!client.industry && !client.location && !client.website && (
                            <p>No company info yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Owner</p>
                        <p className="text-sm text-foreground">{ownerName ?? "Unassigned"}</p>
                      </div>
                    </div>

                    {client.notes && (
                      <div className="mt-6 rounded-lg border border-border bg-card/80 p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{client.notes}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="projects">
                    <div className="mt-6">
                      {relatedProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/60 rounded-lg bg-muted/30">
                          <p className="text-sm font-medium text-foreground">No projects for this client yet</p>
                          <p className="mt-1 text-xs text-muted-foreground">Create the first project and link it to this client.</p>
                          <Link href={`/projects/new?clientId=${client.id}`}>
                            <Button className="mt-4 h-8 px-3 text-xs rounded-lg">
                              New project
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border bg-card/80 overflow-hidden">
                          <div className="divide-y divide-border/80">
                            {relatedProjects.map((p) => (
                              <Link
                                key={p.id}
                                href={`/projects/${p.id}`}
                                className="flex items-center justify-between px-4 py-3 hover:bg-muted/80"
                              >
                                <div className="flex flex-col">
                                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)} · {p.priority.charAt(0).toUpperCase() + p.priority.slice(1)} priority
                                  </p>
                                </div>
                                <span className="text-[11px] text-muted-foreground">View project</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="hidden lg:block lg:border-l lg:border-border lg:pl-6 pt-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Summary</p>
                    <p className="text-sm text-foreground">
                      {client.name} currently has {client.project_count} linked project{client.project_count !== 1 ? "s" : ""}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />
      </div>
      {isWizardOpen && (
        <ClientWizard
          mode="edit"
          initialClient={client}
          organizationId={organizationId}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={handleWizardSuccess}
        />
      )}
    </div>
  )
}

function ClientDetailsSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="mt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-8 w-[360px]" />
          <Skeleton className="mt-3 h-5 w-[520px]" />
          <Skeleton className="mt-5 h-px w-full" />
          <Skeleton className="mt-5 h-16 w-full" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
