"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

type TableName = keyof Database["public"]["Tables"]
type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"]

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*"

export type RealtimeCallback<T extends TableName> = (
  payload: RealtimePostgresChangesPayload<TableRow<T>>
) => void

export type UseRealtimeOptions<T extends TableName> = {
  table: T
  schema?: string
  event?: RealtimeEvent
  filter?: string
  onInsert?: (record: TableRow<T>) => void
  onUpdate?: (record: TableRow<T>, oldRecord: TableRow<T>) => void
  onDelete?: (oldRecord: TableRow<T>) => void
  onChange?: RealtimeCallback<T>
  enabled?: boolean
  /** Pause subscription when tab is hidden (default: true) */
  pauseWhenHidden?: boolean
}

/**
 * Hook to track document visibility state
 * Used to pause realtime subscriptions when tab is hidden
 */
function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  )

  useEffect(() => {
    if (typeof document === "undefined") return

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible")
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  return isVisible
}

/**
 * Hook for subscribing to Supabase Realtime changes on a table
 * Uses refs to store callbacks to prevent subscription recreation on callback changes
 * Supports pausing when tab is hidden to reduce subscription proliferation
 */
export function useRealtime<T extends TableName>({
  table,
  schema = "public",
  event = "*",
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
  pauseWhenHidden = true,
}: UseRealtimeOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isVisible = useDocumentVisibility()

  // Effective enabled state considers both explicit enabled and visibility
  const isEffectivelyEnabled = enabled && (pauseWhenHidden ? isVisible : true)

  // Store callbacks in refs to avoid recreating subscription when callbacks change
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onChangeRef = useRef(onChange)

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onInsertRef.current = onInsert
    onUpdateRef.current = onUpdate
    onDeleteRef.current = onDelete
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!isEffectivelyEnabled) {
      // Clean up existing channel when disabled or hidden
      // Clear ref first to prevent double cleanup on rapid visibility changes
      const channel = channelRef.current
      if (channel) {
        channelRef.current = null
        const supabase = createClient()
        channel.unsubscribe()
        supabase.removeChannel(channel)
      }
      return
    }

    const supabase = createClient()

    // Create channel with unique name
    const channelName = `realtime:${schema}:${table}:${filter || "all"}`
    const channel = supabase.channel(channelName)

    // Subscribe to changes - use type assertion for the config object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      event,
      schema,
      table,
    }

    if (filter) {
      config.filter = filter
    }

    channel
      .on(
        "postgres_changes",
        config,
        (payload: RealtimePostgresChangesPayload<TableRow<T>>) => {
          // Call generic onChange handler using ref
          onChangeRef.current?.(payload)

          // Call specific handlers based on event type using refs
          switch (payload.eventType) {
            case "INSERT":
              onInsertRef.current?.(payload.new as TableRow<T>)
              break
            case "UPDATE":
              onUpdateRef.current?.(payload.new as TableRow<T>, payload.old as TableRow<T>)
              break
            case "DELETE":
              onDeleteRef.current?.(payload.old as TableRow<T>)
              break
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      // Proper cleanup: unsubscribe first, then remove channel
      channel.unsubscribe()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [table, schema, event, filter, isEffectivelyEnabled]) // Removed callback dependencies

  return channelRef.current
}

/**
 * Hook for subscribing to task changes for a specific project
 */
export function useTasksRealtime(
  projectId: string | undefined,
  callbacks: {
    onInsert?: (task: TableRow<"tasks">) => void
    onUpdate?: (task: TableRow<"tasks">, oldTask: TableRow<"tasks">) => void
    onDelete?: (task: TableRow<"tasks">) => void
  }
) {
  return useRealtime({
    table: "tasks",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    ...callbacks,
  })
}

/**
 * Hook for subscribing to workstream changes for a specific project
 */
export function useWorkstreamsRealtime(
  projectId: string | undefined,
  callbacks: {
    onInsert?: (workstream: TableRow<"workstreams">) => void
    onUpdate?: (workstream: TableRow<"workstreams">, oldWorkstream: TableRow<"workstreams">) => void
    onDelete?: (workstream: TableRow<"workstreams">) => void
  }
) {
  return useRealtime({
    table: "workstreams",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    ...callbacks,
  })
}

/**
 * Hook for subscribing to project changes
 */
export function useProjectRealtime(
  projectId: string | undefined,
  callbacks: {
    onUpdate?: (project: TableRow<"projects">, oldProject: TableRow<"projects">) => void
    onDelete?: (project: TableRow<"projects">) => void
  }
) {
  return useRealtime({
    table: "projects",
    filter: projectId ? `id=eq.${projectId}` : undefined,
    event: "*",
    enabled: !!projectId,
    ...callbacks,
  })
}

/**
 * Hook for subscribing to all projects in an organization
 */
export function useProjectsRealtime(
  organizationId: string | undefined,
  callbacks: {
    onInsert?: (project: TableRow<"projects">) => void
    onUpdate?: (project: TableRow<"projects">, oldProject: TableRow<"projects">) => void
    onDelete?: (project: TableRow<"projects">) => void
  }
) {
  return useRealtime({
    table: "projects",
    filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
    enabled: !!organizationId,
    ...callbacks,
  })
}

/**
 * Hook for subscribing to client changes in an organization
 */
export function useClientsRealtime(
  organizationId: string | undefined,
  callbacks: {
    onInsert?: (client: TableRow<"clients">) => void
    onUpdate?: (client: TableRow<"clients">, oldClient: TableRow<"clients">) => void
    onDelete?: (client: TableRow<"clients">) => void
  }
) {
  return useRealtime({
    table: "clients",
    filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
    enabled: !!organizationId,
    ...callbacks,
  })
}

/**
 * Hook for subscribing to file changes for a specific project
 */
export function useFilesRealtime(
  projectId: string | undefined,
  callbacks: {
    onInsert?: (file: TableRow<"project_files">) => void
    onUpdate?: (file: TableRow<"project_files">, oldFile: TableRow<"project_files">) => void
    onDelete?: (file: TableRow<"project_files">) => void
  }
) {
  return useRealtime({
    table: "project_files",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    ...callbacks,
  })
}

/**
 * Hook for subscribing to note changes for a specific project
 */
export function useNotesRealtime(
  projectId: string | undefined,
  callbacks: {
    onInsert?: (note: TableRow<"project_notes">) => void
    onUpdate?: (note: TableRow<"project_notes">, oldNote: TableRow<"project_notes">) => void
    onDelete?: (note: TableRow<"project_notes">) => void
  }
) {
  return useRealtime({
    table: "project_notes",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    ...callbacks,
  })
}

/**
 * Hook that refreshes the current page when changes occur
 * Useful for Server Components that need to refetch data
 */
export function useRealtimeRefresh<T extends TableName>(options: Omit<UseRealtimeOptions<T>, "onChange">) {
  const router = useRouter()

  const handleChange = useCallback(() => {
    router.refresh()
  }, [router])

  return useRealtime({
    ...options,
    onChange: handleChange,
  })
}

/**
 * Hook for subscribing to organization member changes
 */
export function useOrganizationMembersRealtime(
  organizationId: string | undefined,
  callbacks: {
    onInsert?: (member: TableRow<"organization_members">) => void
    onUpdate?: (member: TableRow<"organization_members">, oldMember: TableRow<"organization_members">) => void
    onDelete?: (member: TableRow<"organization_members">) => void
  }
) {
  return useRealtime({
    table: "organization_members",
    filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
    enabled: !!organizationId,
    ...callbacks,
  })
}
