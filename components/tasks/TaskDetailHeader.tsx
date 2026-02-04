"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import type { TaskWithRelations } from "@/lib/actions/tasks"

interface TaskDetailHeaderProps {
  task: TaskWithRelations
  onNameChange?: (name: string) => void
}

export function TaskDetailHeader({
  task,
  onNameChange,
}: TaskDetailHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(task.name)
  const inputRef = useRef<HTMLInputElement>(null)

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
            <button
              type="button"
              className="text-sm font-medium text-foreground truncate cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 transition-colors text-left w-full"
              onClick={() => setIsEditingName(true)}
            >
              {task.name}
            </button>
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
    </div>
  )
}
