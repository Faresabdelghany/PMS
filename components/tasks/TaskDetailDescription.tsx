"use client"

import { useState, useCallback, useEffect } from "react"
import { sanitizeHtml } from "@/lib/sanitize"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { Button } from "@/components/ui/button"
import { generateTaskDescription } from "@/lib/actions/ai"
import dynamic from "next/dynamic"

const ProjectDescriptionEditor = dynamic(
  () => import("@/components/project-wizard/ProjectDescriptionEditor").then((m) => m.ProjectDescriptionEditor),
  { ssr: false, loading: () => <div className="h-32 bg-muted/30 rounded animate-pulse" /> }
)

interface TaskDetailDescriptionProps {
  description: string | null
  onSave: (description: string | null) => void
  taskName?: string
  projectName?: string
}

export function TaskDetailDescription({
  description,
  onSave,
  taskName,
  projectName,
}: TaskDetailDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState(description || "")
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!description) {
      setSanitizedHtml(null)
      return
    }
    let cancelled = false
    sanitizeHtml(description).then((html) => {
      if (!cancelled) setSanitizedHtml(html)
    })
    return () => { cancelled = true }
  }, [description])

  const handleSave = useCallback(() => {
    const trimmed = editedDescription.trim()
    onSave(trimmed || null)
    setIsEditing(false)
  }, [editedDescription, onSave])

  const handleCancel = useCallback(() => {
    setEditedDescription(description || "")
    setIsEditing(false)
  }, [description])

  const handleAIGenerate = useCallback(async () => {
    if (!taskName?.trim()) return null
    const result = await generateTaskDescription({
      taskName: taskName.trim(),
      projectName,
      existingDescription: editedDescription || undefined,
    })
    return result.data ?? null
  }, [taskName, projectName, editedDescription])

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Description</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-7 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 px-2"
            >
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
        <ProjectDescriptionEditor
          value={editedDescription}
          onChange={setEditedDescription}
          placeholder="Add a description..."
          showTemplates={false}
          className="min-h-[120px]"
          onAIGenerate={taskName ? handleAIGenerate : undefined}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Description</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <PencilSimple className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>
      {description && sanitizedHtml ? (
        <div
          className="text-sm cursor-pointer hover:bg-muted/30 rounded p-2 -m-2 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          <div
            className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </div>
      ) : (
        <div
          className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 rounded p-3 border border-dashed border-muted-foreground/30 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          Click to add a description...
        </div>
      )}
    </div>
  )
}
