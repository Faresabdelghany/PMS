"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, capitalize } from "@/lib/utils"
import { Funnel } from "@phosphor-icons/react/dist/ssr/Funnel"
import { Spinner } from "@phosphor-icons/react/dist/ssr/Spinner"
import { Tag } from "@phosphor-icons/react/dist/ssr/Tag"
import { User } from "@phosphor-icons/react/dist/ssr/User"
import { ChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar"
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"

export type FilterChip = { key: string; value: string }

type FilterTemp = {
  status: Set<string>
  priority: Set<string>
  tags: Set<string>
  members: Set<string>
  agents: Set<string>
}

interface FilterCounts {
  status?: Record<string, number>
  priority?: Record<string, number>
  tags?: Record<string, number>
  members?: Record<string, number>
  agents?: Record<string, number>
}

export type MemberOption = {
  id: string
  label: string
  avatar?: string | null
}

export type TagOption = {
  id: string
  label: string
}

interface FilterPopoverProps {
  initialChips?: FilterChip[]
  onApply: (chips: FilterChip[]) => void
  onClear: () => void
  counts?: FilterCounts
  members?: MemberOption[]
  agents?: MemberOption[]
  tags?: TagOption[]
}

// Stable empty arrays to prevent infinite re-renders from default prop references
const EMPTY_MEMBERS: MemberOption[] = []
const EMPTY_AGENTS: MemberOption[] = []
const EMPTY_TAGS: TagOption[] = []

// Static filter categories - defined outside component to maintain stable reference
const FILTER_CATEGORIES = [
  { id: "status", label: "Status", icon: Spinner },
  { id: "priority", label: "Priority", icon: ChartBar },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "members", label: "Assigned to", icon: User },
  { id: "agents", label: "Agent tasks", icon: Sparkle },
] as const

const STATUS_OPTIONS = [
  { id: "todo", label: "To Do", color: "var(--chart-2)" },
  { id: "in-progress", label: "In Progress", color: "var(--chart-3)" },
  { id: "done", label: "Done", color: "var(--chart-1)" },
] as const

const PRIORITY_OPTIONS = [
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
] as const

export function FilterPopover({ initialChips, onApply, onClear, counts, members, agents, tags }: FilterPopoverProps) {
  // Use stable references for default values
  const stableMembers = members ?? EMPTY_MEMBERS
  const stableAgents = agents ?? EMPTY_AGENTS
  const stableTags = tags ?? EMPTY_TAGS
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<
    "status" | "priority" | "tags" | "members" | "agents"
  >("status")

  const [temp, setTemp] = useState<FilterTemp>(() => ({
    status: new Set<string>(),
    priority: new Set<string>(),
    tags: new Set<string>(),
    members: new Set<string>(),
    agents: new Set<string>(),
  }))

  const [tagSearch, setTagSearch] = useState("")

  // Build member options from props with "Unassigned" option
  const memberOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; avatar?: string | null }> = [
      { id: "unassigned", label: "Unassigned", avatar: undefined },
    ]
    for (const member of stableMembers) {
      options.push({
        id: member.id,
        label: member.label,
        avatar: member.avatar,
      })
    }
    return options
  }, [stableMembers])

  // Build tag options from props
  const tagOptions = useMemo(() => {
    return stableTags.map((tag) => ({
      id: tag.id,
      label: tag.label,
    }))
  }, [stableTags])

  const agentOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; avatar?: string | null }> = [
      { id: "all", label: "Any agent", avatar: undefined },
    ]
    for (const agent of stableAgents) {
      options.push({
        id: agent.id,
        label: agent.label,
        avatar: agent.avatar,
      })
    }
    return options
  }, [stableAgents])

  // Preselect from chips when opening
  useEffect(() => {
    if (!open) return
    const next: FilterTemp = {
      status: new Set<string>(),
      priority: new Set<string>(),
      tags: new Set<string>(),
      members: new Set<string>(),
      agents: new Set<string>(),
    }
    for (const c of initialChips || []) {
      const k = c.key.toLowerCase()
      if (k === "status") next.status.add(c.value.toLowerCase())
      if (k === "priority") next.priority.add(c.value.toLowerCase())
      if (k === "member" || k === "pic" || k === "members") {
        // Find the member id by label
        const member = memberOptions.find((m) => m.label === c.value)
        if (member) next.members.add(member.id)
      }
      if (k === "tag" || k === "tags") next.tags.add(c.value.toLowerCase())
      if (k === "agent") {
        if (c.value.toLowerCase() === "all") {
          next.agents.add("all")
        } else {
          const agent = agentOptions.find((a) => a.label === c.value)
          if (agent) next.agents.add(agent.id)
        }
      }
    }
    setTemp(next)
  }, [open, initialChips, memberOptions, agentOptions])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FILTER_CATEGORIES
    return FILTER_CATEGORIES.filter((c) => c.label.toLowerCase().includes(q))
  }, [query])

  const toggleSet = (set: Set<string>, v: string) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  const handleApply = () => {
    const chips: FilterChip[] = []
    temp.status.forEach((v) => chips.push({ key: "Status", value: capitalize(v) }))
    temp.priority.forEach((v) => chips.push({ key: "Priority", value: capitalize(v) }))
    temp.members.forEach((memberId) => {
      // Find the member label for display
      const member = memberOptions.find((m) => m.id === memberId)
      chips.push({ key: "Member", value: member?.label || memberId })
    })
    temp.agents.forEach((agentId) => {
      if (agentId === "all") {
        chips.push({ key: "Agent", value: "all" })
        return
      }
      const agent = agentOptions.find((a) => a.id === agentId)
      chips.push({ key: "Agent", value: agent?.label || agentId })
    })
    temp.tags.forEach((v) => chips.push({ key: "Tag", value: v }))
    onApply(chips)
    setOpen(false)
  }

  const handleClear = () => {
    setTemp({
      status: new Set<string>(),
      priority: new Set<string>(),
      tags: new Set<string>(),
      members: new Set<string>(),
      agents: new Set<string>(),
    })
    onClear()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg border-border/60 px-3 bg-transparent">
          <Funnel className="h-4 w-4" />
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[720px] p-0 rounded-xl">
        <div className="grid grid-cols-[260px_minmax(0,1fr)]">
          <div className="p-3 border-r border-border/40">
            <div className="px-1 pb-2">
              <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent",
                    active === cat.id && "bg-accent"
                  )}
                  onClick={() => setActive(cat.id)}
                >
                  <cat.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{cat.label}</span>
                  {counts && counts[cat.id as keyof FilterCounts] && (
                    <span className="text-xs text-muted-foreground">
                      {/* Sum of counts for that category if provided */}
                      {Object.values(counts[cat.id as keyof FilterCounts] as Record<string, number>).reduce(
                        (a, b) => a + (typeof b === "number" ? b : 0),
                        0,
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3">
            {active === "priority" && (
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={temp.priority.has(opt.id)}
                      onCheckedChange={() => setTemp((t) => ({ ...t, priority: toggleSet(t.priority, opt.id) }))}
                    />
                    <span className="text-sm flex-1">{opt.label}</span>
                    {counts?.priority?.[opt.id] != null && (
                      <span className="text-xs text-muted-foreground">{counts.priority[opt.id]}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {active === "status" && (
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                    <Checkbox
                      checked={temp.status.has(opt.id)}
                      onCheckedChange={() => setTemp((t) => ({ ...t, status: toggleSet(t.status, opt.id) }))}
                    />
                    <span className="text-sm flex-1">{opt.label}</span>
                    {counts?.status?.[opt.id] != null && (
                      <span className="text-xs text-muted-foreground">{counts.status[opt.id]}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {active === "members" && (
              <div className="space-y-2">
                {memberOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No members available</p>
                ) : (
                  memberOptions.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                      <Checkbox
                        checked={temp.members.has(m.id)}
                        onCheckedChange={() => setTemp((t) => ({ ...t, members: toggleSet(t.members, m.id) }))}
                      />
                      {m.avatar ? (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={m.avatar} alt={m.label} />
                          <AvatarFallback>{m.label.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : m.id !== "unassigned" ? (
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>{m.label.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : null}
                      <span className="text-sm flex-1">{m.label}</span>
                      {(counts?.members?.[m.id] != null || counts?.members?.[m.label.toLowerCase()] != null) && (
                        <span className="text-xs text-muted-foreground">
                          {counts?.members?.[m.id] ?? counts?.members?.[m.label.toLowerCase()]}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}

            {active === "agents" && (
              <div className="space-y-2">
                {agentOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No agents available</p>
                ) : (
                  agentOptions.map((agent) => (
                    <label key={agent.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                      <Checkbox
                        checked={temp.agents.has(agent.id)}
                        onCheckedChange={() => setTemp((t) => ({ ...t, agents: toggleSet(t.agents, agent.id) }))}
                      />
                      {agent.avatar ? (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={agent.avatar} alt={agent.label} />
                          <AvatarFallback>{agent.label.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : null}
                      <span className="text-sm flex-1">{agent.label}</span>
                      {(counts?.agents?.[agent.id] != null || counts?.agents?.[agent.label.toLowerCase()] != null) && (
                        <span className="text-xs text-muted-foreground">
                          {counts?.agents?.[agent.id] ?? counts?.agents?.[agent.label.toLowerCase()]}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}

            {active === "tags" && (
              <div>
                {tagOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No tags available</p>
                ) : (
                  <>
                    <div className="pb-2">
                      <Input
                        placeholder="Search tags..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {tagOptions
                        .filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
                        .map((t) => (
                          <label key={t.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                            <Checkbox
                              checked={temp.tags.has(t.id)}
                              onCheckedChange={() => setTemp((s) => ({ ...s, tags: toggleSet(s.tags, t.id) }))}
                            />
                            <span className="text-sm flex-1">{t.label}</span>
                            {counts?.tags?.[t.id] != null && (
                              <span className="text-xs text-muted-foreground">{counts.tags[t.id]}</span>
                            )}
                          </label>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
              <button onClick={handleClear} className="text-sm text-primary hover:underline">
                Clear
              </button>
              <Button size="sm" className="h-8 rounded-lg" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

