"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { CacheTags } from "@/lib/cache-tags"
import type { Client, ClientInsert, ClientUpdate, ClientStatus } from "@/lib/supabase/types"
import type { ActionResult } from "./types"


export type ClientFilters = {
  status?: ClientStatus
  search?: string
  ownerId?: string
}

// Create client
export async function createClientAction(
  orgId: string,
  data: Omit<ClientInsert, "organization_id">
): Promise<ActionResult<Client>> {
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      ...data,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/clients")
  revalidateTag(CacheTags.clients(orgId))
  return { data: client }
}

// Get clients for organization with filters
export async function getClients(
  orgId: string,
  filters?: ClientFilters
): Promise<ActionResult<Client[]>> {
  const supabase = await createClient()

  let query = supabase
    .from("clients")
    .select("*, owner:profiles(id, full_name, email, avatar_url)")
    .eq("organization_id", orgId)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.ownerId) {
    query = query.eq("owner_id", filters.ownerId)
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,primary_contact_name.ilike.%${filters.search}%,primary_contact_email.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query.order("name")

  if (error) {
    return { error: error.message }
  }

  return { data: data as Client[] }
}

// Get single client
export async function getClient(id: string): Promise<ActionResult<Client>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("clients")
    .select("*, owner:profiles(id, full_name, email, avatar_url)")
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as Client }
}

// Get client with project count
export async function getClientWithProjects(
  id: string
): Promise<ActionResult<Client & { project_count: number }>> {
  const supabase = await createClient()

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*, owner:profiles(id, full_name, email, avatar_url)")
    .eq("id", id)
    .single()

  if (clientError) {
    return { error: clientError.message }
  }

  const { count, error: countError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id)

  if (countError) {
    return { error: countError.message }
  }

  return {
    data: {
      ...client,
      project_count: count || 0,
    } as Client & { project_count: number },
  }
}

// Update client
export async function updateClient(
  id: string,
  data: ClientUpdate
): Promise<ActionResult<Client>> {
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from("clients")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/clients")
  revalidateTag(CacheTags.client(id))
  if (client.organization_id) {
    revalidateTag(CacheTags.clients(client.organization_id))
  }
  return { data: client }
}

// Delete client
export async function deleteClient(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Get org_id for cache invalidation before deleting
  const { data: client } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", id)
    .single()

  // Check if client has projects
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id)

  if (count && count > 0) {
    return { error: "Cannot delete client with existing projects" }
  }

  const { error } = await supabase.from("clients").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/clients")
  revalidateTag(CacheTags.client(id))
  if (client?.organization_id) {
    revalidateTag(CacheTags.clients(client.organization_id))
  }
  return {}
}

// Project count breakdown by status
export type ProjectCountBreakdown = {
  active: number
  planned: number
  completed: number
}

// Get clients with project counts (for list view)
export type ClientWithProjectCount = Client & {
  project_count: number
  project_breakdown: ProjectCountBreakdown
  owner?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export async function getClientsWithProjectCounts(
  orgId: string,
  filters?: ClientFilters
): Promise<ActionResult<ClientWithProjectCount[]>> {
  const supabase = await createClient()

  // First get clients
  let query = supabase
    .from("clients")
    .select("*, owner:profiles(id, full_name, email, avatar_url)")
    .eq("organization_id", orgId)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.ownerId) {
    query = query.eq("owner_id", filters.ownerId)
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,primary_contact_name.ilike.%${filters.search}%,primary_contact_email.ilike.%${filters.search}%`
    )
  }

  const { data: clients, error: clientsError } = await query.order("name")

  if (clientsError) {
    return { error: clientsError.message }
  }

  if (!clients || clients.length === 0) {
    return { data: [] }
  }

  // Get project counts with status for all clients in one query
  const clientIds = clients.map((c) => c.id)
  const { data: projectData, error: countsError } = await supabase
    .from("projects")
    .select("client_id, status")
    .in("client_id", clientIds)

  if (countsError) {
    return { error: countsError.message }
  }

  // Count projects per client with breakdown by status
  const countMap = new Map<string, { total: number; active: number; planned: number; completed: number }>()
  projectData?.forEach((p) => {
    if (p.client_id) {
      const current = countMap.get(p.client_id) || { total: 0, active: 0, planned: 0, completed: 0 }
      current.total++
      if (p.status === "active") current.active++
      else if (p.status === "planned" || p.status === "backlog") current.planned++
      else if (p.status === "completed") current.completed++
      countMap.set(p.client_id, current)
    }
  })

  // Merge counts into clients
  const clientsWithCounts: ClientWithProjectCount[] = clients.map((client) => {
    const counts = countMap.get(client.id) || { total: 0, active: 0, planned: 0, completed: 0 }
    return {
      ...client,
      project_count: counts.total,
      project_breakdown: {
        active: counts.active,
        planned: counts.planned,
        completed: counts.completed,
      },
    }
  })

  return { data: clientsWithCounts }
}

// Get client stats for organization
export async function getClientStats(orgId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<ClientStatus, number>
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("clients")
    .select("status")
    .eq("organization_id", orgId)

  if (error) {
    return { error: error.message }
  }

  const byStatus: Record<ClientStatus, number> = {
    prospect: 0,
    active: 0,
    on_hold: 0,
    archived: 0,
  }

  data.forEach((client) => {
    byStatus[client.status]++
  })

  return {
    data: {
      total: data.length,
      byStatus,
    },
  }
}
