"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import { requireOrgMember } from "./auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import { sanitizeSearchInput } from "@/lib/search-utils"
import { CLIENT_STATUSES, createClientStatusCounts } from "@/lib/constants/status"
import type { Client, ClientInsert, ClientUpdate, ClientStatus } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Client validation schemas
const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name is required")
    .max(200, "Client name must be less than 200 characters"),
  industry: z.string().max(100).optional().nullable(),
  website: z
    .string()
    .url("Invalid website URL")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((val) => (val === "" ? null : val)),
  location: z.string().max(200).optional().nullable(),
  status: z.enum(CLIENT_STATUSES).default("active"),
  primary_contact_name: z.string().max(100).optional().nullable(),
  primary_contact_email: z
    .string()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((val) => (val === "" ? null : val)),
  owner_id: z.string().uuid().optional().nullable(),
})

const updateClientSchema = createClientSchema.partial()

// Search filter validation (prevent injection via search)
const clientFiltersSchema = z.object({
  status: z.enum(["prospect", "active", "on_hold", "archived"]).optional(),
  search: z
    .string()
    .max(200, "Search query too long")
    .optional()
    .transform((val) => val?.replace(/[%_]/g, "")), // Escape SQL wildcards
  ownerId: z.string().uuid().optional(),
})

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
  // Validate organization ID
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) {
    return { error: "Invalid organization ID" }
  }

  // Validate client data
  const validation = validate(createClientSchema, data)
  if (!validation.success) {
    return { error: validation.error }
  }

  // Require org membership
  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member to create clients" }
  }

  const validatedData = validation.data
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      ...validatedData,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath("/clients")
    revalidateTag(CacheTags.clients(orgId))
    // KV cache invalidation
    await invalidate.client(orgId)
  })

  return { data: client }
}

// Get clients for organization with filters
export async function getClients(
  orgId: string,
  filters?: ClientFilters
): Promise<ActionResult<Client[]>> {
  // Validate organization ID
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) {
    return { error: "Invalid organization ID" }
  }

  // Validate and sanitize filters
  const filtersValidation = validate(clientFiltersSchema, filters || {})
  const validatedFilters = filtersValidation.success ? filtersValidation.data : {}

  const supabase = await createClient()

  // Check if any filters are applied
  const hasFilters = Object.values(validatedFilters).some(
    (v) => v !== undefined && v !== ""
  )

  // Only cache unfiltered queries
  if (!hasFilters) {
    try {
      const clients = await cacheGet(
        CacheKeys.clients(orgId),
        async () => {
          const { data, error } = await supabase
            .from("clients")
            .select("*, owner:profiles(id, full_name, email, avatar_url)")
            .eq("organization_id", orgId)
            .order("name")

          if (error) throw error
          return data ?? []
        },
        CacheTTL.CLIENTS
      )
      return { data: clients as Client[] }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to fetch clients",
      }
    }
  }

  // Filtered query - don't cache
  let query = supabase
    .from("clients")
    .select("*, owner:profiles(id, full_name, email, avatar_url)")
    .eq("organization_id", orgId)

  if (validatedFilters.status) {
    query = query.eq("status", validatedFilters.status)
  }

  if (validatedFilters.ownerId) {
    query = query.eq("owner_id", validatedFilters.ownerId)
  }

  if (validatedFilters.search) {
    // Search is already sanitized by the schema
    query = query.or(
      `name.ilike.%${validatedFilters.search}%,primary_contact_name.ilike.%${validatedFilters.search}%,primary_contact_email.ilike.%${validatedFilters.search}%`
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

  // Fetch client and project count in parallel
  const [clientResult, countResult] = await Promise.all([
    supabase
      .from("clients")
      .select("*, owner:profiles(id, full_name, email, avatar_url)")
      .eq("id", id)
      .single(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id),
  ])

  if (clientResult.error) {
    return { error: clientResult.error.message }
  }

  if (countResult.error) {
    return { error: countResult.error.message }
  }

  return {
    data: {
      ...clientResult.data,
      project_count: countResult.count || 0,
    } as Client & { project_count: number },
  }
}

// Update client
export async function updateClient(
  id: string,
  data: ClientUpdate
): Promise<ActionResult<Client>> {
  const supabase = await createClient()

  // First fetch the client to check org membership
  const { data: existingClient } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", id)
    .single()

  if (!existingClient) {
    return { error: "Client not found" }
  }

  // Require org membership
  try {
    await requireOrgMember(existingClient.organization_id)
  } catch {
    return { error: "You must be an organization member to update clients" }
  }

  const { data: client, error } = await supabase
    .from("clients")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath("/clients")
    revalidateTag(CacheTags.client(id))
    if (client.organization_id) {
      revalidateTag(CacheTags.clients(client.organization_id))
      // KV cache invalidation
      await invalidate.client(client.organization_id)
    }
  })

  return { data: client }
}

// Delete client
export async function deleteClient(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Fetch client first to get org_id for auth check
  const { data: client } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", id)
    .single()

  if (!client) {
    return { error: "Client not found" }
  }

  // Auth check FIRST — prevent information disclosure via differing error messages
  try {
    await requireOrgMember(client.organization_id)
  } catch {
    return { error: "You must be an organization member to delete clients" }
  }

  // THEN check business logic (project count)
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

  after(async () => {
    revalidatePath("/clients")
    revalidateTag(CacheTags.client(id))
    revalidateTag(CacheTags.clients(client.organization_id))
    // KV cache invalidation
    await invalidate.client(client.organization_id)
  })

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
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(
        `name.ilike.%${sanitized}%,primary_contact_name.ilike.%${sanitized}%,primary_contact_email.ilike.%${sanitized}%`
      )
    }
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

  const byStatus = createClientStatusCounts()

  data.forEach((client) => {
    if (client.status in byStatus) {
      byStatus[client.status as ClientStatus]++
    }
  })

  return {
    data: {
      total: data.length,
      byStatus,
    },
  }
}
