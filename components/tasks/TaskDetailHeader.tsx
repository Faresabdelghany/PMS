"use client"

import { useState, useRef, useEffect } from "react"
import { CheckCircle, Circle, Clock } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { TaskStatus } from "@/lib/supabase/types"

interface TaskDetailHeaderProps {
  task: TaskWithRelations
  onStatusChange: (status: TaskStatus) => void
  onNameChange?: (name: string) => void
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  todo: {
    label: "To Do",
    icon: Circle,
    color: "text-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    color: "text-blue-500",
  },
  done: {
    label: "Done",
    icon: CheckCircle,
    color: "text-green-500",
  },
}

export function TaskDetailHeader({
  task,
  onStatusChange,
  onNameChange,
}: TaskDetailHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(task.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const statusConfig = STATUS_CONFIG[task.status]
  const StatusIcon = statusConfig.icon

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingName])

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== task.name && onNameChange) {
      onNameChange(editedName.trim())
    } else {
      setEditedName(task.name)
    }
    setIsEditingName(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSave()
    } else if (e.key === "Escape") {
      setEditedName(task.name)
      setIsEditingName(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Task Name */}
      <div className="pr-8">
        {isEditingName ? (
          <Input
            ref={inputRef}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleKeyDown}
            className="text-xl font-semibold h-auto py-1 px-2 -ml-2"
          />
        ) : (
          <h2
            className="text-xl font-semibold cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 transition-colors"
            onClick={() => onNameChange && setIsEditingName(true)}
          >
            {task.name}
          </h2>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", statusConfig.color)}
            >
              <StatusIcon className="h-4 w-4" weight="fill" />
              {statusConfig.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((status) => {
              const config = STATUS_CONFIG[status]
              const Icon = config.icon
              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className={cn("gap-2", config.color)}
                >
                  <Icon className="h-4 w-4" weight={task.status === status ? "fill" : "regular"} />
                  {config.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Project name badge */}
        {task.project && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {task.project.name}
          </span>
        )}

        {/* Workstream badge */}
        {task.workstream && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {task.workstream.name}
          </span>
        )}
      </div>
    </div>
  )
}
