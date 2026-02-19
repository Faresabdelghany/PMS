"use client"

import { useState } from "react"
import { format } from "date-fns"
import { User as UserIcon } from "@phosphor-icons/react/dist/ssr/User"
import { Flag } from "@phosphor-icons/react/dist/ssr/Flag"
import { Calendar } from "@phosphor-icons/react/dist/ssr/Calendar"
import { Tag as TagIcon } from "@phosphor-icons/react/dist/ssr/Tag"
import { Rows } from "@phosphor-icons/react/dist/ssr/Rows"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type {
  TaskPriority,
  TaskStatus,
  Workstream,
  OrganizationTagLean,
} from "@/lib/supabase/types"
import type { TaskPanelMember } from "./TaskDetailPanel"

interface TaskDetailFieldsProps {
  task: TaskWithRelations
  onUpdate: (field: string, value: unknown) => void
  organizationMembers?: TaskPanelMember[]
  workstreams?: Workstream[]
  tags?: OrganizationTagLean[]
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "no-priority", label: "No priority", color: "text-muted-foreground" },
  { value: "low", label: "Low", color: "text-blue-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string; dotColor: string }[] = [
  { value: "todo", label: "To Do", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
  { value: "in-progress", label: "In Progress", color: "text-blue-500", dotColor: "bg-blue-500" },
  { value: "done", label: "Done", color: "text-green-500", dotColor: "bg-green-500" },
]

export function TaskDetailFields({
  task,
  onUpdate,
  organizationMembers = [],
  workstreams = [],
  tags = [],
}: TaskDetailFieldsProps) {
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [workstreamOpen, setWorkstreamOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === task.priority)
  const currentStatus = STATUS_OPTIONS.find(s => s.value === task.status)

  const fields = [
    {
      id: "assignee",
      label: "Assignee",
      icon: UserIcon,
      value: task.assignee ? (task.assignee.full_name || task.assignee.email) : "Unassigned",
      popoverOpen: assigneeOpen,
      setPopoverOpen: setAssigneeOpen,
      renderIcon: () =>
        task.assignee ? (
          <Avatar className="h-9 w-9">
            <AvatarImage src={getOptimizedAvatarUrl(task.assignee.avatar_url)} alt={task.assignee.full_name || task.assignee.email} />
            <AvatarFallback className="text-xs font-medium">
              {(task.assignee.full_name || task.assignee.email).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
      renderPopoverContent: () => (
        <Command>
          <CommandInput placeholder="Search members..." />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onUpdate("assignee_id", null)
                  setAssigneeOpen(false)
                }}
              >
                <span className="text-muted-foreground">Unassigned</span>
              </CommandItem>
              {organizationMembers.map((member) => (
                <CommandItem
                  key={member.user_id}
                  onSelect={() => {
                    onUpdate("assignee_id", member.user_id)
                    setAssigneeOpen(false)
                  }}
                >
                  <Avatar className="h-5 w-5 mr-2">
                    <AvatarImage src={getOptimizedAvatarUrl(member.profile.avatar_url)} alt={member.profile.full_name || member.profile.email} />
                    <AvatarFallback className="text-xs">
                      {(member.profile.full_name || member.profile.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {member.profile.full_name || member.profile.email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      ),
    },
    {
      id: "status",
      label: "Status",
      icon: Flag,
      value: currentStatus?.label || "To Do",
      popoverOpen: statusOpen,
      setPopoverOpen: setStatusOpen,
      renderIcon: () => (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <span className={cn("w-2.5 h-2.5 rounded-full", currentStatus?.dotColor || "bg-muted-foreground")} />
        </div>
      ),
      renderPopoverContent: () => (
        <Command>
          <CommandList>
            <CommandGroup>
              {STATUS_OPTIONS.map((status) => (
                <CommandItem
                  key={status.value}
                  onSelect={() => {
                    onUpdate("status", status.value)
                    setStatusOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <span className={cn("w-2 h-2 rounded-full", status.dotColor)} />
                  <span className={cn(status.color)}>{status.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      ),
    },
    {
      id: "priority",
      label: "Priority",
      icon: Flag,
      value: currentPriority?.label || "No priority",
      popoverOpen: priorityOpen,
      setPopoverOpen: setPriorityOpen,
      renderIcon: () => (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Flag className={cn("h-4 w-4", currentPriority?.color || "text-muted-foreground")} />
        </div>
      ),
      renderPopoverContent: () => (
        <Command>
          <CommandList>
            <CommandGroup>
              {PRIORITY_OPTIONS.map((priority) => (
                <CommandItem
                  key={priority.value}
                  onSelect={() => {
                    onUpdate("priority", priority.value)
                    setPriorityOpen(false)
                  }}
                  className={cn(priority.color)}
                >
                  {priority.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      ),
    },
    {
      id: "start_date",
      label: "Start date",
      icon: Calendar,
      value: task.start_date ? format(new Date(task.start_date), "MMM d, yyyy") : "No start date",
      popoverOpen: startDateOpen,
      setPopoverOpen: setStartDateOpen,
      renderPopoverContent: () => (
        <>
          <CalendarComponent
            mode="single"
            selected={task.start_date ? new Date(task.start_date) : undefined}
            onSelect={(date) => {
              onUpdate("start_date", date ? format(date, "yyyy-MM-dd") : null)
              setStartDateOpen(false)
            }}
            initialFocus
          />
          {task.start_date && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onUpdate("start_date", null)
                  setStartDateOpen(false)
                }}
              >
                Clear date
              </Button>
            </div>
          )}
        </>
      ),
    },
    {
      id: "end_date",
      label: "Due date",
      icon: Calendar,
      value: task.end_date ? format(new Date(task.end_date), "MMM d, yyyy") : "No due date",
      popoverOpen: endDateOpen,
      setPopoverOpen: setEndDateOpen,
      renderPopoverContent: () => (
        <>
          <CalendarComponent
            mode="single"
            selected={task.end_date ? new Date(task.end_date) : undefined}
            onSelect={(date) => {
              onUpdate("end_date", date ? format(date, "yyyy-MM-dd") : null)
              setEndDateOpen(false)
            }}
            initialFocus
          />
          {task.end_date && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onUpdate("end_date", null)
                  setEndDateOpen(false)
                }}
              >
                Clear date
              </Button>
            </div>
          )}
        </>
      ),
    },
  ]

  // Add workstream field if workstreams exist
  if (workstreams.length > 0) {
    fields.push({
      id: "workstream",
      label: "Workstream",
      icon: Rows,
      value: task.workstream ? task.workstream.name : "No workstream",
      popoverOpen: workstreamOpen,
      setPopoverOpen: setWorkstreamOpen,
      renderPopoverContent: () => (
        <Command>
          <CommandInput placeholder="Search workstreams..." />
          <CommandList>
            <CommandEmpty>No workstreams found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onUpdate("workstream_id", null)
                  setWorkstreamOpen(false)
                }}
              >
                <span className="text-muted-foreground">No workstream</span>
              </CommandItem>
              {workstreams.map((ws) => (
                <CommandItem
                  key={ws.id}
                  onSelect={() => {
                    onUpdate("workstream_id", ws.id)
                    setWorkstreamOpen(false)
                  }}
                >
                  {ws.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      ),
    })
  }

  // Add tag field
  const taskTag = tags.find(tag => tag.name === task.tag)
  fields.push({
    id: "tag",
    label: "Tag",
    icon: TagIcon,
    value: task.tag || "No tag",
    popoverOpen: tagOpen,
    setPopoverOpen: setTagOpen,
    renderIcon: () => (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        {taskTag ? (
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: taskTag.color }} />
        ) : (
          <TagIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    ),
    renderPopoverContent: () => (
      <Command>
        <CommandInput placeholder="Search tags..." />
        <CommandList>
          <CommandEmpty>No tags found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              onSelect={() => {
                onUpdate("tag", null)
                setTagOpen(false)
              }}
            >
              <span className="text-muted-foreground">No tag</span>
            </CommandItem>
            {tags.map((tag) => (
              <CommandItem
                key={tag.id}
                onSelect={() => {
                  onUpdate("tag", tag.name)
                  setTagOpen(false)
                }}
              >
                <span
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    ),
  })

  return (
    <div className="rounded-2xl border border-border bg-card/80 px-5 py-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {fields.map((field) => {
          const Icon = field.icon
          return (
            <Popover key={field.id} open={field.popoverOpen} onOpenChange={field.setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex flex-col items-start gap-2 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {'renderIcon' in field && field.renderIcon ? (
                    field.renderIcon()
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="space-y-0.5 min-w-0 w-full">
                    <p className="text-[11px] font-medium text-muted-foreground">{field.label}</p>
                    <p className="text-xs text-foreground truncate">{field.value}</p>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className={cn("p-0", field.id.includes("date") ? "w-auto" : "w-[200px]")} align="start">
                {field.renderPopoverContent()}
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
    </div>
  )
}
