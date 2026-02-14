"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { cacheGet, CacheKeys, CacheTTL, invalidateCache } from "@/lib/cache"
import { requireOrgMember } from "./auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import { sanitizeSearchInput } from "@/lib/search-utils"
import { CLIENT_STATUSES, createClientStatusCounts } from "@/lib/constants/status"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"
import { encodeCursor, decodeCursor } from "./cursor"
import type { Client, ClientInsert, ClientUpdate, ClientStatus } from "@/lib/supabase/types"
import type { ActionResult, PaginatedResult } from "./types"

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
    await invalidateCache.client({ orgId })
  })

  return { data: client }
}

// Get clients for organization with filters and cursor-based pagination
export async function getClients(
  orgId: string,
  filters?: ClientFilters,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<Client>> {
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

  // Only cache unfiltered, first-page queries
  if (!hasFilters && !cursor) {
    try {
      const clients = await cacheGet(
        CacheKeys.clients(orgId),
        async () => {
          const { data, error } = await supabase
            .from("clients")
            .select("*, owner:profiles(id, full_name, email, avatar_url)")
            .eq("organization_id", orgId)
            .order("name")
            .limit(limit + 1)

          if (error) throw error
          return data ?? []
        },
        CacheTTL.CLIENTS
      )

      const hasMore = clients.length > limit
      const items = hasMore ? clients.slice(0, limit) : clients
      const nextCursor = hasMore
        ? encodeCursor(items[items.length - 1].name, items[items.length - 1].id)
        : null

      return { data: items as Client[], nextCursor, hasMore }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to fetch clients",
      }
    }
  }

  // Filtered or cursor query - don't cache
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

  // Compound cursor: (name, id) ASC
  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      query = query.or(
        `name.gt.${value},and(name.eq.${value},id.gt.${id})`
      )
    } catch {
      return { error: "Invalid cursor" }
    }
  }

  const { data, error } = await query
    .order("name")
    .order("id")
    .limit(limit + 1)

  if (error) {
    return { error: error.message }
  }

  const hasMore = (data?.length || 0) > limit
  const items = hasMore ? data!.slice(0, limit) : (data || [])
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].name, items[items.length - 1].id)
    : null

  return {
    data: items as Client[],
    nextCursor,
    hasMore,
  }
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
    if (client.organization_id) {
      await invalidateCache.client({ clientId: id, orgId: client.organization_id })
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
    await invalidateCache.client({ clientId: id, orgId: client.organization_id })
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
  filters?: ClientFilters,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<ClientWithProjectCount>> {
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

  // Compound cursor: (name, id) ASC
  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      query = query.or(
        `name.gt.${value},and(name.eq.${value},id.gt.${id})`
      )
    } catch {
      return { error: "Invalid cursor" }
    }
  }

  const { data: clients, error: clientsError } = await query
    .order("name")
    .order("id")
    .limit(limit + 1)

  if (clientsError) {
    return { error: clientsError.message }
  }

  if (!clients || clients.length === 0) {
    return { data: [], hasMore: false, nextCursor: null }
  }

  // Determine pagination before project count enrichment
  const clientsHasMore = clients.length > limit
  const paginatedClients = clientsHasMore ? clients.slice(0, limit) : clients

  // Get project counts via SQL aggregation RPC (single grouped query instead of N rows)
  const clientIds = paginatedClients.map((c) => c.id)
  const { data: countRows, error: countsError } = await supabase.rpc(
    "get_project_counts_for_clients",
    { p_client_ids: clientIds }
  )

  if (countsError) {
    return { error: countsError.message }
  }

  // Build lookup map from RPC result (already aggregated)
  const countMap = new Map<string, { total: number; active: number; planned: number; completed: number }>()
  ;(countRows ?? []).forEach((row: { client_id: string; total: number; active: number; planned: number; completed: number }) => {
    countMap.set(row.client_id, {
      total: Number(row.total),
      active: Number(row.active),
      planned: Number(row.planned),
      completed: Number(row.completed),
    })
  })

  // Merge counts into clients
  const clientsWithCounts: ClientWithProjectCount[] = paginatedClients.map((client) => {
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

  const nextCursor = clientsHasMore
    ? encodeCursor(paginatedClients[paginatedClients.length - 1].name, paginatedClients[paginatedClients.length - 1].id)
    : null

  return { data: clientsWithCounts, nextCursor, hasMore: clientsHasMore }
}

// Get client stats for organization (uses SQL aggregation RPC — single row instead of N rows)
export async function getClientStats(orgId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<ClientStatus, number>
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_client_stats", {
    p_org_id: orgId,
  })

  if (error) {
    return { error: error.message }
  }

  const stats = data as {
    total: number
    byStatus: Record<string, number>
  }

  const byStatus = { ...createClientStatusCounts(), ...stats.byStatus }

  return {
    data: {
      total: stats.total,
      byStatus: byStatus as Record<ClientStatus, number>,
    },
  }
}
