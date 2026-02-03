"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  User as UserIcon,
  Flag,
  Calendar,
  Tag as TagIcon,
  Rows,
} from "@phosphor-icons/react/dist/ssr"
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
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type {
  TaskPriority,
  Profile,
  OrganizationMember,
  Workstream,
  OrganizationTag,
} from "@/lib/supabase/types"

interface TaskDetailFieldsProps {
  task: TaskWithRelations
  onUpdate: (field: string, value: unknown) => void
  organizationMembers?: (OrganizationMember & { profile: Profile })[]
  workstreams?: Workstream[]
  tags?: OrganizationTag[]
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "no-priority", label: "No priority", color: "text-muted-foreground" },
  { value: "low", label: "Low", color: "text-blue-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
]

export function TaskDetailFields({
  task,
  onUpdate,
  organizationMembers = [],
  workstreams = [],
  tags = [],
}: TaskDetailFieldsProps) {
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [workstreamOpen, setWorkstreamOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === task.priority)

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Assignee */}
      <FieldWrapper label="Assignee" icon={UserIcon}>
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start h-9 px-2 font-normal">
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={task.assignee.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(task.assignee.full_name || task.assignee.email || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {task.assignee.full_name || task.assignee.email}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[200px]" align="start">
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
                        <AvatarImage src={member.profile.avatar_url ?? undefined} />
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
          </PopoverContent>
        </Popover>
      </FieldWrapper>

      {/* Priority */}
      <FieldWrapper label="Priority" icon={Flag}>
        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start h-9 px-2 font-normal">
              <span className={cn(currentPriority?.color)}>
                {currentPriority?.label || "No priority"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[150px]" align="start">
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
          </PopoverContent>
        </Popover>
      </FieldWrapper>

      {/* Start Date */}
      <FieldWrapper label="Start date" icon={Calendar}>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start h-9 px-2 font-normal">
              {task.start_date ? (
                format(new Date(task.start_date), "MMM d, yyyy")
              ) : (
                <span className="text-muted-foreground">No start date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
          </PopoverContent>
        </Popover>
      </FieldWrapper>

      {/* Due Date */}
      <FieldWrapper label="Due date" icon={Calendar}>
        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start h-9 px-2 font-normal">
              {task.end_date ? (
                format(new Date(task.end_date), "MMM d, yyyy")
              ) : (
                <span className="text-muted-foreground">No due date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
          </PopoverContent>
        </Popover>
      </FieldWrapper>

      {/* Workstream */}
      {workstreams.length > 0 && (
        <FieldWrapper label="Workstream" icon={Rows}>
          <Popover open={workstreamOpen} onOpenChange={setWorkstreamOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="w-full justify-start h-9 px-2 font-normal">
                {task.workstream ? (
                  task.workstream.name
                ) : (
                  <span className="text-muted-foreground">No workstream</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[200px]" align="start">
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
            </PopoverContent>
          </Popover>
        </FieldWrapper>
      )}

      {/* Tag */}
      <FieldWrapper label="Tag" icon={TagIcon}>
        <Popover open={tagOpen} onOpenChange={setTagOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start h-9 px-2 font-normal">
              {task.tag ? (
                <span className="truncate">{task.tag}</span>
              ) : (
                <span className="text-muted-foreground">No tag</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[200px]" align="start">
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
          </PopoverContent>
        </Popover>
      </FieldWrapper>
    </div>
  )
}

function FieldWrapper({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {children}
    </div>
  )
}
