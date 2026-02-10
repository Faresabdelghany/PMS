"use client"

import { useState, useMemo, useCallback, memo } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { FunnelSimple } from "@phosphor-icons/react/dist/ssr/FunnelSimple"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { ChatCircle } from "@phosphor-icons/react/dist/ssr/ChatCircle"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { Users } from "@phosphor-icons/react/dist/ssr/Users"
import { Flag } from "@phosphor-icons/react/dist/ssr/Flag"
import { Bell } from "@phosphor-icons/react/dist/ssr/Bell"
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle"
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { toast } from "sonner"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import type { InboxItemWithRelations, InboxItemType } from "@/lib/supabase/types"
import { markAsRead, markAllAsRead, deleteInboxItem } from "@/lib/actions/inbox"
import { useInboxRealtime } from "@/hooks/use-realtime"
import { useUser } from "@/hooks/use-user"
import type { Icon } from "@phosphor-icons/react"

type TabFilter = "all" | "unread" | InboxItemType

const tabs: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "comment", label: "Comments" },
  { id: "task_update", label: "Tasks" },
  { id: "client_update", label: "Clients" },
  { id: "project_milestone", label: "Milestones" },
]

const itemTypeIcons: Record<InboxItemType, Icon> = {
  comment: ChatCircle,
  task_update: ArrowsClockwise,
  client_update: Users,
  project_milestone: Flag,
  system: Bell,
}

const itemTypeColors: Record<InboxItemType, string> = {
  comment: "text-blue-500",
  task_update: "text-amber-500",
  client_update: "text-teal-500",
  project_milestone: "text-purple-500",
  system: "text-zinc-500",
}

interface InboxItemRowProps {
  item: InboxItemWithRelations
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

const InboxItemRow = memo(function InboxItemRow({ item, onMarkAsRead, onDelete }: InboxItemRowProps) {
  const Icon = itemTypeIcons[item.item_type]
  const iconColor = itemTypeColors[item.item_type]

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group [content-visibility:auto] [contain-intrinsic-size:auto_72px] ${
        !item.is_read ? "bg-primary/5" : ""
      }`}
    >
      <div className="relative flex-shrink-0">
        {item.actor ? (
          <Avatar className="h-9 w-9">
            <AvatarImage src={item.actor.avatar_url || undefined} alt={item.actor.full_name || "User"} />
            <AvatarFallback className="text-xs">
              {item.actor.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={`h-9 w-9 rounded-full flex items-center justify-center bg-muted ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        {!item.is_read && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-sm ${!item.is_read ? "font-medium" : ""} text-foreground line-clamp-1`}>
              {item.title}
            </p>
            {item.message && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {item.message}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </span>
              {item.project && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <Link
                    href={`/projects/${item.project.id}`}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {item.project.name}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!item.is_read && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => onMarkAsRead(item.id)}
                title="Mark as read"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}
              title="Delete"
            >
              <Trash className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

interface InboxContentProps {
  initialItems: InboxItemWithRelations[]
  initialUnreadCount: number
  organizationId: string
}

export function InboxContent({ initialItems, initialUnreadCount, organizationId }: InboxContentProps) {
  const { user } = useUser()
  const [items, setItems] = useState(initialItems)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TabFilter>("all")
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Set<InboxItemType>>(new Set())

  // Realtime updates
  useInboxRealtime(user?.id, {
    onInsert: (newItem) => {
      setItems((prev) => [newItem as InboxItemWithRelations, ...prev])
      if (!newItem.is_read) {
        setUnreadCount((prev) => prev + 1)
      }
    },
    onUpdate: (updatedItem) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === updatedItem.id ? { ...item, ...updatedItem } : item
        )
      )
    },
    onDelete: (deletedItem) => {
      setItems((prev) => prev.filter((item) => item.id !== deletedItem.id))
      if (!deletedItem.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    },
  })

  const filtered = useMemo(() => {
    let list = items.slice()

    // Tab filter
    if (activeTab === "unread") {
      list = list.filter((item) => !item.is_read)
    } else if (activeTab !== "all") {
      list = list.filter((item) => item.item_type === activeTab)
    }

    // Type filter from popover
    if (selectedTypes.size > 0) {
      list = list.filter((item) => selectedTypes.has(item.item_type))
    }

    // Search
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.message && item.message.toLowerCase().includes(q))
      )
    }

    return list
  }, [items, activeTab, selectedTypes, query])

  const handleMarkAsRead = useCallback(async (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item || item.is_read) return

    const result = await markAsRead(itemId)
    if (result.error) {
      toast.error("Failed to mark as read")
      return
    }

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, is_read: true } : i))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [items])

  const handleMarkAllAsRead = useCallback(async () => {
    const result = await markAllAsRead()
    if (result.error) {
      toast.error("Failed to mark all as read")
      return
    }

    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })))
    setUnreadCount(0)
    toast.success("All items marked as read")
  }, [])

  const handleDelete = useCallback(async (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    const result = await deleteInboxItem(itemId)
    if (result.error) {
      toast.error("Failed to delete item")
      return
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId))
    if (item && !item.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
    toast.success("Item deleted")
  }, [items])

  const toggleTypeFilter = (type: InboxItemType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex flex-col border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Inbox</p>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-3 pt-3 gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs bg-muted rounded-lg px-2 py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 rounded-full text-xs ${isActive ? "bg-background" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-9 px-3 ${selectedTypes.size > 0 ? "bg-muted" : ""}`}
                >
                  <FunnelSimple className="h-4 w-4 mr-1" />
                  Filter
                  {selectedTypes.size > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({selectedTypes.size})
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="end">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  Filter by type
                </p>
                {(["comment", "task_update", "client_update", "project_milestone", "system"] as InboxItemType[]).map(
                  (type) => {
                    const Icon = itemTypeIcons[type]
                    const isSelected = selectedTypes.has(type)
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleTypeFilter(type)}
                        className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        <Checkbox checked={isSelected} />
                        <Icon className={`h-3.5 w-3.5 ${itemTypeColors[type]}`} />
                        <span className="flex-1 text-left capitalize">
                          {type.replace("_", " ")}
                        </span>
                      </button>
                    )
                  }
                )}
                {selectedTypes.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 text-xs"
                    onClick={() => setSelectedTypes(new Set())}
                  >
                    Clear filters
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            <div className="flex-1 max-w-xs relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inbox"
                className="h-9 rounded-lg bg-muted/50 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20 border-border border shadow-none pl-9"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === "unread"
                ? "You're all caught up!"
                : "When you receive notifications, they'll appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <InboxItemRow
                key={item.id}
                item={item}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
