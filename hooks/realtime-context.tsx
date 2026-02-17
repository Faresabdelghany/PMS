"use client"

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type {
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresChangesFilter,
} from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { useDocumentVisibility } from "./use-document-visibility"

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
  client: SupabaseClient
  listeners: Map<string, Listener>
  table: TableName
  filter?: string
}

/** Connection health status for the realtime system */
export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

/** Context for the stable subscribe function — rarely changes */
type RealtimeSubscribeContextValue = {
  subscribe: <T extends TableName>(
    table: T,
    filter: string | undefined,
    listener: Listener<T>
  ) => () => void
}

/** Context for connection status — changes frequently */
type RealtimeStatusContextValue = {
  /** Whether at least one channel is actively connected */
  isConnected: boolean
  /** Overall connection health status */
  connectionStatus: RealtimeConnectionStatus
  /** Most recent connection error, if any */
  lastError: string | null
}

// Split into two contexts so connection status changes don't re-render
// components that only need `subscribe` (which is the majority)
const RealtimeSubscribeContext = createContext<RealtimeSubscribeContextValue | null>(null)
const RealtimeStatusContext = createContext<RealtimeStatusContextValue | null>(null)

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
 * - Connection health monitoring surfaced to the UI
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const subscriptionsRef = useRef<Map<SubscriptionKey, SubscriptionState>>(new Map())
  const listenerIdCounter = useRef(0)
  const isVisible = useDocumentVisibility()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("disconnected")
  const [lastError, setLastError] = useState<string | null>(null)

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
      if (subscriptions.size > 0) {
        setIsConnected(true)
        setConnectionStatus("connected")
      }
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

      // Build properly typed config instead of using `any`
      const config = (filter
        ? { event: "*" as const, schema: "public", table, filter }
        : { event: "*" as const, schema: "public", table }
      ) as unknown as RealtimePostgresChangesFilter<"*">

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
        .subscribe((status, err) => {
          if (err) {
            console.error(`[Realtime] ${key} subscription error:`, err)
            setLastError(`${key}: ${err.message}`)
            setConnectionStatus("error")
          } else if (status === "SUBSCRIBED") {
            setConnectionStatus("connected")
            setLastError(null)
          } else if (status === "CHANNEL_ERROR") {
            setConnectionStatus("error")
            setLastError(`${key}: channel error`)
          } else if (status === "TIMED_OUT") {
            setConnectionStatus("error")
            setLastError(`${key}: subscription timed out`)
          } else if (status === "CLOSED") {
            // Channel was intentionally closed (e.g. visibility hide)
            // Only set disconnected if no other channels are active
            const hasActiveChannels = Array.from(subscriptionsRef.current.values()).some(
              (s) => s.channel !== channel
            )
            if (!hasActiveChannels) {
              setConnectionStatus("disconnected")
            }
          }
        })

      subscription = {
        channel,
        client: supabase,
        listeners: new Map(),
        table,
        filter,
      }
      subscriptionsRef.current.set(key, subscription)
      setIsConnected(true)
      setConnectionStatus("connecting")
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
        sub.channel.unsubscribe()
        sub.client.removeChannel(sub.channel)
        subscriptionsRef.current.delete(key)

        if (subscriptionsRef.current.size === 0) {
          setIsConnected(false)
          setConnectionStatus("disconnected")
        }
      }
    }
  }, [])

  // Memoize subscribe context — `subscribe` is already a stable useCallback
  const subscribeValue = useMemo<RealtimeSubscribeContextValue>(
    () => ({ subscribe }),
    [subscribe]
  )

  // Memoize status context — only re-creates when status actually changes
  const statusValue = useMemo<RealtimeStatusContextValue>(
    () => ({ isConnected, connectionStatus, lastError }),
    [isConnected, connectionStatus, lastError]
  )

  return (
    <RealtimeSubscribeContext.Provider value={subscribeValue}>
      <RealtimeStatusContext.Provider value={statusValue}>
        {children}
      </RealtimeStatusContext.Provider>
    </RealtimeSubscribeContext.Provider>
  )
}

/**
 * Hook to access the pooled real-time subscription context.
 * Returns both subscribe function and connection status for backward compatibility.
 */
export function useRealtimeContext() {
  const subscribeCtx = useContext(RealtimeSubscribeContext)
  const statusCtx = useContext(RealtimeStatusContext)
  if (!subscribeCtx || !statusCtx) {
    throw new Error("useRealtimeContext must be used within a RealtimeProvider")
  }
  return { ...subscribeCtx, ...statusCtx }
}

/**
 * Hook to access just the subscribe function.
 * Components using this will NOT re-render when connection status changes.
 */
function useRealtimeSubscribe() {
  const context = useContext(RealtimeSubscribeContext)
  if (!context) {
    throw new Error("useRealtimeSubscribe must be used within a RealtimeProvider")
  }
  return context
}

/**
 * Hook to access just the connection health status.
 * Useful for building connection indicators in the UI.
 * Only components that actually display status will re-render on status changes.
 *
 * @example
 * ```tsx
 * const { connectionStatus, lastError } = useRealtimeConnectionStatus()
 * if (connectionStatus === "error") {
 *   return <Banner>Connection issue: {lastError}</Banner>
 * }
 * ```
 */
export function useRealtimeConnectionStatus() {
  const context = useContext(RealtimeStatusContext)
  if (!context) {
    throw new Error("useRealtimeConnectionStatus must be used within a RealtimeProvider")
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
  const { subscribe } = useRealtimeSubscribe()

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

export function usePooledInboxRealtime(
  userId: string | undefined,
  callbacks: {
    onInsert?: (item: TableRow<"inbox_items">) => void
    onUpdate?: (item: TableRow<"inbox_items">, oldItem: TableRow<"inbox_items">) => void
    onDelete?: (item: TableRow<"inbox_items">) => void
  }
) {
  usePooledRealtime({
    table: "inbox_items",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    ...callbacks,
  })
}
