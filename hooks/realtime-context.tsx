"use client"

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

type TableName = keyof Database["public"]["Tables"]
type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"]

/**
 * Subscription key format: "table:filter" or "table:all"
 */
type SubscriptionKey = string

type Listener<T extends TableName = TableName> = {
  id: string
  onInsert?: (record: TableRow<T>) => void
  onUpdate?: (record: TableRow<T>, oldRecord: TableRow<T>) => void
  onDelete?: (oldRecord: TableRow<T>) => void
}

type SubscriptionState = {
  channel: RealtimeChannel
  listeners: Map<string, Listener>
  table: TableName
  filter?: string
}

type RealtimeContextValue = {
  subscribe: <T extends TableName>(
    table: T,
    filter: string | undefined,
    listener: Listener<T>
  ) => () => void
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

/**
 * Hook to track document visibility state
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
 * Provider that manages pooled real-time subscriptions
 *
 * Instead of each component creating its own subscription, all components
 * share subscriptions through this context. When multiple components need
 * the same table/filter combination, only one subscription is created.
 *
 * Benefits:
 * - Reduced WebSocket connections
 * - Automatic cleanup when all listeners unsubscribe
 * - Visibility-aware pausing (subscriptions pause when tab is hidden)
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const subscriptionsRef = useRef<Map<SubscriptionKey, SubscriptionState>>(new Map())
  const listenerIdCounter = useRef(0)
  const isVisible = useDocumentVisibility()
  const [isConnected, setIsConnected] = useState(false)

  // Pause/resume subscriptions based on visibility
  useEffect(() => {
    const subscriptions = subscriptionsRef.current

    if (!isVisible) {
      // Unsubscribe all channels when hidden
      subscriptions.forEach((sub) => {
        sub.channel.unsubscribe()
      })
      setIsConnected(false)
    } else {
      // Resubscribe all channels when visible
      subscriptions.forEach((sub) => {
        sub.channel.subscribe()
      })
      setIsConnected(subscriptions.size > 0)
    }
  }, [isVisible])

  const subscribe = useCallback(<T extends TableName>(
    table: T,
    filter: string | undefined,
    listener: Listener<T>
  ): (() => void) => {
    const key: SubscriptionKey = `${table}:${filter || "all"}`
    const listenerId = `listener-${++listenerIdCounter.current}`

    // Check if we already have a subscription for this key
    let subscription = subscriptionsRef.current.get(key)

    if (!subscription) {
      // Create new subscription
      const supabase = createClient()
      const channelName = `pooled:${key}`
      const channel = supabase.channel(channelName)

       
      const config: any = {
        event: "*",
        schema: "public",
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
            // Get current listeners for this subscription
            const sub = subscriptionsRef.current.get(key)
            if (!sub) return

            // Notify all listeners
            sub.listeners.forEach((l) => {
              switch (payload.eventType) {
                case "INSERT":
                  (l as Listener<T>).onInsert?.(payload.new as TableRow<T>)
                  break
                case "UPDATE":
                  (l as Listener<T>).onUpdate?.(
                    payload.new as TableRow<T>,
                    payload.old as TableRow<T>
                  )
                  break
                case "DELETE":
                  (l as Listener<T>).onDelete?.(payload.old as TableRow<T>)
                  break
              }
            })
          }
        )
        .subscribe()

      subscription = {
        channel,
        listeners: new Map(),
        table,
        filter,
      }
      subscriptionsRef.current.set(key, subscription)
      setIsConnected(true)
    }

    // Add listener to subscription
    subscription.listeners.set(listenerId, listener as Listener)

    // Return unsubscribe function
    return () => {
      const sub = subscriptionsRef.current.get(key)
      if (!sub) return

      sub.listeners.delete(listenerId)

      // If no more listeners, clean up subscription
      if (sub.listeners.size === 0) {
        const supabase = createClient()
        sub.channel.unsubscribe()
        supabase.removeChannel(sub.channel)
        subscriptionsRef.current.delete(key)

        if (subscriptionsRef.current.size === 0) {
          setIsConnected(false)
        }
      }
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ subscribe, isConnected }}>
      {children}
    </RealtimeContext.Provider>
  )
}

/**
 * Hook to access the pooled real-time subscription context
 */
export function useRealtimeContext() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error("useRealtimeContext must be used within a RealtimeProvider")
  }
  return context
}

/**
 * Hook for subscribing to real-time changes using the pooled context
 *
 * This is an alternative to useRealtime that uses the shared subscription pool.
 * Use this when you have many components subscribing to the same data.
 *
 * @example
 * ```tsx
 * usePooledRealtime({
 *   table: "tasks",
 *   filter: `project_id=eq.${projectId}`,
 *   onInsert: (task) => setTasks(prev => [...prev, task]),
 *   onUpdate: (task) => setTasks(prev => prev.map(t => t.id === task.id ? task : t)),
 *   onDelete: (task) => setTasks(prev => prev.filter(t => t.id !== task.id)),
 * })
 * ```
 */
export function usePooledRealtime<T extends TableName>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: {
  table: T
  filter?: string
  onInsert?: (record: TableRow<T>) => void
  onUpdate?: (record: TableRow<T>, oldRecord: TableRow<T>) => void
  onDelete?: (oldRecord: TableRow<T>) => void
  enabled?: boolean
}) {
  const { subscribe } = useRealtimeContext()

  // Store callbacks in refs to prevent subscription recreation
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)

  useEffect(() => {
    onInsertRef.current = onInsert
    onUpdateRef.current = onUpdate
    onDeleteRef.current = onDelete
  })

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = subscribe(table, filter, {
      id: `${table}-${filter || "all"}`,
      onInsert: (record) => onInsertRef.current?.(record as TableRow<T>),
      onUpdate: (record, oldRecord) =>
        onUpdateRef.current?.(record as TableRow<T>, oldRecord as TableRow<T>),
      onDelete: (record) => onDeleteRef.current?.(record as TableRow<T>),
    })

    return unsubscribe
  }, [table, filter, enabled, subscribe])
}

/**
 * Pre-built hooks for common entities using pooled subscriptions
 */
export function usePooledTasksRealtime(
  projectId: string | undefined,
  callbacks: {
    onInsert?: (task: TableRow<"tasks">) => void
    onUpdate?: (task: TableRow<"tasks">, oldTask: TableRow<"tasks">) => void
    onDelete?: (task: TableRow<"tasks">) => void
  }
) {
  usePooledRealtime({
    table: "tasks",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    ...callbacks,
  })
}

export function usePooledProjectsRealtime(
  organizationId: string | undefined,
  callbacks: {
    onInsert?: (project: TableRow<"projects">) => void
    onUpdate?: (project: TableRow<"projects">, oldProject: TableRow<"projects">) => void
    onDelete?: (project: TableRow<"projects">) => void
  }
) {
  usePooledRealtime({
    table: "projects",
    filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
    enabled: !!organizationId,
    ...callbacks,
  })
}

export function usePooledClientsRealtime(
  organizationId: string | undefined,
  callbacks: {
    onInsert?: (client: TableRow<"clients">) => void
    onUpdate?: (client: TableRow<"clients">, oldClient: TableRow<"clients">) => void
    onDelete?: (client: TableRow<"clients">) => void
  }
) {
  usePooledRealtime({
    table: "clients",
    filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
    enabled: !!organizationId,
    ...callbacks,
  })
}

export function usePooledWorkstreamsRealtime(
  projectId: string | undefined,
  callbacks: {
    onInsert?: (workstream: TableRow<"workstreams">) => void
    onUpdate?: (workstream: TableRow<"workstreams">, oldWorkstream: TableRow<"workstreams">) => void
    onDelete?: (workstream: TableRow<"workstreams">) => void
  }
) {
  usePooledRealtime({
    table: "workstreams",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    ...callbacks,
  })
}
