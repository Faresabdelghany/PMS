"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Client, ClientInsert, ClientUpdate, ClientStatus } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

export type { ActionResult }

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
  return { data: client }
}

// Delete client
export async function deleteClient(id: string): Promise<ActionResult> {
  const supabase = await createClient()

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
  return {}
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
