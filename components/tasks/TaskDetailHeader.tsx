"use client"

import { useState, useRef, useEffect } from "react"
import { CheckCircle, Circle, Clock } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { TaskStatus } from "@/lib/supabase/types"

interface TaskDetailHeaderProps {
  task: TaskWithRelations
  onStatusChange: (status: TaskStatus) => void
  onNameChange?: (name: string) => void
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dotColor: string }> = {
  todo: {
    label: "To Do",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    color: "text-blue-500",
    dotColor: "bg-blue-500",
  },
  done: {
    label: "Done",
    color: "text-green-500",
    dotColor: "bg-green-500",
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
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        {/* Task Name */}
        <div className="min-w-0">
          {isEditingName ? (
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleKeyDown}
              className="text-sm font-medium h-auto py-1 px-2"
            />
          ) : (
            <p
              className="text-sm font-medium text-foreground truncate cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 transition-colors"
              onClick={() => onNameChange && setIsEditingName(true)}
            >
              {task.name}
            </p>
          )}
        </div>

        {/* Project and Workstream badges */}
        {(task.project || task.workstream) && (
          <div className="flex items-center gap-2 flex-wrap px-2 -ml-2">
            {task.project && (
              <span className="text-xs text-muted-foreground">
                {task.project.name}
              </span>
            )}
            {task.project && task.workstream && (
              <span className="text-xs text-muted-foreground">·</span>
            )}
            {task.workstream && (
              <span className="text-xs text-muted-foreground">
                {task.workstream.name}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Status Select */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={task.status} onValueChange={(value) => onStatusChange(value as TaskStatus)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", statusConfig.dotColor)} />
                  <span className={statusConfig.color}>{statusConfig.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((status) => {
                const config = STATUS_CONFIG[status]
                return (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", config.dotColor)} />
                      <span className={config.color}>{config.label}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
