// Client types - data is now fetched from Supabase via lib/actions/clients.ts

export type ClientStatus = "prospect" | "active" | "on_hold" | "archived"

export type Client = {
  id: string
  name: string
  status: ClientStatus
  industry?: string
  website?: string
  location?: string
  owner?: string
  primaryContactName?: string
  primaryContactEmail?: string
  notes?: string
  segment?: string
  lastActivityLabel?: string
}
