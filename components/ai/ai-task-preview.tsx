"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import type { GeneratedTask } from "@/components/project-wizard/types"

interface AITaskPreviewProps {
  tasks: GeneratedTask[]
  workstreams: string[]
  onTasksChange: (tasks: GeneratedTask[]) => void
  onRegenerate?: () => void
  isRegenerating?: boolean
  className?: string
}

export function AITaskPreview({
  tasks,
  workstreams,
  onTasksChange,
  onRegenerate,
  isRegenerating = false,
  className,
}: AITaskPreviewProps) {
  const updateTask = (id: string, updates: Partial<GeneratedTask>) => {
    onTasksChange(
      tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
  }

  const removeTask = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id))
  }

  const addTask = () => {
    const newTask: GeneratedTask = {
      id: `custom-${Date.now()}`,
      title: "",
      priority: "medium",
      workstream: workstreams[0] || undefined,
      included: true,
    }
    onTasksChange([...tasks, newTask])
  }

  const includedCount = tasks.filter((t) => t.included).length

  return (
    <div className={cn("rounded-lg border border-border bg-background", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm text-muted-foreground">
          {includedCount} task{includedCount !== 1 ? "s" : ""} selected
        </span>
        {onRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 text-xs"
          >
            <ArrowsClockwise className={cn("size-3 mr-1", isRegenerating && "animate-spin")} />
            Regenerate
          </Button>
        )}
      </div>

      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              !task.included && "opacity-50"
            )}
          >
            <Checkbox
              checked={task.included}
              onCheckedChange={(checked) =>
                updateTask(task.id, { included: checked === true })
              }
            />

            <Input
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              placeholder="Task title"
              className="flex-1 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
            />

            {workstreams.length > 0 && (
              <Select
                value={task.workstream || ""}
                onValueChange={(value) => updateTask(task.id, { workstream: value })}
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue placeholder="Stream" />
                </SelectTrigger>
                <SelectContent>
                  {workstreams.map((ws) => (
                    <SelectItem key={ws} value={ws}>
                      {ws}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={task.priority}
              onValueChange={(value: "low" | "medium" | "high") =>
                updateTask(task.id, { priority: value })
              }
            >
              <SelectTrigger className="w-20 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeTask(task.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={addTask}
          className="h-7 text-xs text-muted-foreground"
        >
          <Plus className="size-3 mr-1" />
          Add custom task
        </Button>
      </div>
    </div>
  )
}
