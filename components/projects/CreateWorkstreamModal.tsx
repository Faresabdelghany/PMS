'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { Tag as TagIcon } from "@phosphor-icons/react/dist/ssr/Tag"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { CheckSquare } from "@phosphor-icons/react/dist/ssr/CheckSquare"

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { GenericPicker, DatePicker } from '@/components/project-wizard/steps/StepQuickCreate'
import { ProjectDescriptionEditorLazy as ProjectDescriptionEditor } from '@/components/project-wizard/ProjectDescriptionEditorLazy'
import { QuickCreateModalLayout } from '@/components/QuickCreateModalLayout'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { createWorkstream, updateWorkstream, type CreateWorkstreamInput, type UpdateWorkstreamInput } from '@/lib/actions/workstreams'
import type { Workstream, OrganizationTagLean } from '@/lib/supabase/types'

type TaskOption = {
  id: string
  name: string
  workstreamId: string | null
  workstreamName: string | null
}

interface CreateWorkstreamModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectEndDate?: string | null
  existingTasks?: TaskOption[]
  editingWorkstream?: Workstream | null
  organizationTags?: OrganizationTagLean[]
  onWorkstreamCreated?: (workstream: Workstream) => void
  onWorkstreamUpdated?: (workstream: Workstream) => void
}

export function CreateWorkstreamModal({
  open,
  onClose,
  projectId,
  projectEndDate,
  existingTasks = [],
  editingWorkstream,
  organizationTags = [],
  onWorkstreamCreated,
  onWorkstreamUpdated,
}: CreateWorkstreamModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [createMore, setCreateMore] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [selectedTag, setSelectedTag] = useState<OrganizationTagLean | undefined>(undefined)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Parse project end date for validation
  const maxEndDate = projectEndDate ? new Date(projectEndDate) : undefined

  // Available tasks that aren't already in another workstream (or allow moving)
  const availableTasks = useMemo(() => {
    return existingTasks.map((task) => ({
      ...task,
      inOtherWorkstream: task.workstreamId !== null && task.workstreamId !== editingWorkstream?.id,
    }))
  }, [existingTasks, editingWorkstream])

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return

    if (editingWorkstream) {
      setTitle(editingWorkstream.name)
      setDescription(editingWorkstream.description || undefined)
      setStartDate(editingWorkstream.start_date ? new Date(editingWorkstream.start_date) : undefined)
      setEndDate(editingWorkstream.end_date ? new Date(editingWorkstream.end_date) : undefined)
      const tagOption = editingWorkstream.tag
        ? organizationTags.find((t) => t.name.toLowerCase() === editingWorkstream.tag?.toLowerCase())
        : undefined
      setSelectedTag(tagOption)
      // Pre-select tasks that are already in this workstream
      const tasksInWorkstream = existingTasks
        .filter((task) => task.workstreamId === editingWorkstream.id)
        .map((task) => task.id)
      setSelectedTaskIds(tasksInWorkstream)
      setCreateMore(false)
      setIsDescriptionExpanded(false)
    } else {
      setTitle('')
      setDescription(undefined)
      setStartDate(undefined)
      setEndDate(undefined)
      setSelectedTag(undefined)
      setSelectedTaskIds([])
      setCreateMore(false)
      setIsDescriptionExpanded(false)
    }
  }, [open, editingWorkstream, organizationTags])

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    )
  }, [])

  const handleSubmit = async () => {
    if (isSubmitting) return
    if (!title.trim()) {
      toast.error('Please enter a workstream name')
      return
    }

    // Validate end date against project end date
    if (endDate && maxEndDate && endDate > maxEndDate) {
      toast.error(`End date cannot be after project end date (${format(maxEndDate, 'dd/MM/yyyy')})`)
      return
    }

    // Validate start date before end date
    if (startDate && endDate && startDate > endDate) {
      toast.error('Start date cannot be after end date')
      return
    }

    setIsSubmitting(true)

    try {
      if (editingWorkstream) {
        // Update existing workstream
        const input: UpdateWorkstreamInput = {
          name: title.trim(),
          description: description || null,
          startDate: startDate?.toISOString().split('T')[0] || null,
          endDate: endDate?.toISOString().split('T')[0] || null,
          tag: selectedTag?.name || null,
          taskIds: selectedTaskIds, // Include task assignments
        }

        const result = await updateWorkstream(editingWorkstream.id, input)

        if (result.error) {
          toast.error(result.error)
          return
        }

        onWorkstreamUpdated?.(result.data!)
        toast.success('Workstream updated successfully')
        onClose()
      } else {
        // Create new workstream
        const input: CreateWorkstreamInput = {
          projectId,
          name: title.trim(),
          description: description || null,
          startDate: startDate?.toISOString().split('T')[0] || null,
          endDate: endDate?.toISOString().split('T')[0] || null,
          tag: selectedTag?.name || null,
          taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
        }

        const result = await createWorkstream(input)

        if (result.error) {
          toast.error(result.error)
          return
        }

        onWorkstreamCreated?.(result.data!)

        if (createMore) {
          toast.success('Workstream created! Ready for another.')
          setTitle('')
          setDescription(undefined)
          setStartDate(undefined)
          setEndDate(undefined)
          setSelectedTag(undefined)
          setSelectedTaskIds([])
          return
        }

        toast.success('Workstream created successfully')
        onClose()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <QuickCreateModalLayout
      open={open}
      onClose={onClose}
      isDescriptionExpanded={isDescriptionExpanded}
      onSubmitShortcut={handleSubmit}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {editingWorkstream ? 'Edit Workstream' : 'New Workstream'}
        </h2>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-2 w-full shrink-0 mt-1">
        <div className="flex gap-1 h-10 items-center w-full">
          <input
            id="workstream-create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Workstream title"
            className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>

      {/* Description */}
      <ProjectDescriptionEditor
        value={description}
        onChange={setDescription}
        onExpandChange={setIsDescriptionExpanded}
        placeholder="Describe the purpose or goals of this workstream..."
        showTemplates={false}
      />

      {/* Properties */}
      <div className="flex flex-wrap gap-2.5 items-start w-full shrink-0">
        {/* Start date */}
        <DatePicker
          date={startDate}
          onSelect={setStartDate}
          trigger={
            <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
              <CalendarBlank className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {startDate ? `Start: ${format(startDate, 'dd/MM/yyyy')}` : 'Start date'}
              </span>
            </button>
          }
        />

        {/* End date */}
        <DatePicker
          date={endDate}
          onSelect={setEndDate}
          trigger={
            <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
              <CalendarBlank className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {endDate ? `End: ${format(endDate, 'dd/MM/yyyy')}` : 'End date'}
              </span>
            </button>
          }
        />

        {/* Tag */}
        {organizationTags.length > 0 && (
          <GenericPicker
            items={organizationTags}
            onSelect={setSelectedTag}
            selectedId={selectedTag?.id}
            placeholder="Search tags..."
            renderItem={(item) => (
              <div className="flex items-center gap-2 w-full">
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1">{item.name}</span>
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                {selectedTag ? (
                  <span
                    className="size-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedTag.color }}
                  />
                ) : (
                  <TagIcon className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground text-sm leading-5">
                  {selectedTag?.name ?? 'Tag'}
                </span>
              </button>
            }
          />
        )}
      </div>

      {/* Project end date info */}
      {projectEndDate && (
        <p className="text-xs text-muted-foreground">
          Project ends: {format(new Date(projectEndDate), 'dd MMM yyyy')}
        </p>
      )}

      {/* Add/manage tasks section */}
      {availableTasks.length > 0 && (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {editingWorkstream ? 'Manage tasks' : 'Add existing tasks'}
            </span>
            {selectedTaskIds.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({selectedTaskIds.length} selected)
              </span>
            )}
          </div>
          <ScrollArea className="h-[120px] w-full rounded-lg border border-border bg-muted/30 p-2">
            <div className="space-y-1">
              {availableTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTaskIds.includes(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                  />
                  <span className="text-sm text-foreground flex-1 truncate">
                    {task.name}
                  </span>
                  {task.inOtherWorkstream && (
                    <span className="text-xs text-muted-foreground">
                      (in {task.workstreamName})
                    </span>
                  )}
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
        <div />

        <div className="flex items-center gap-4">
          {!editingWorkstream && (
            <div className="flex items-center gap-2">
              <Switch
                aria-label="Create more"
                checked={createMore}
                onCheckedChange={(value) => setCreateMore(Boolean(value))}
              />
              <span className="text-sm font-medium text-foreground">Create more</span>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="h-10 px-4 rounded-xl"
          >
            {isSubmitting
              ? 'Saving...'
              : editingWorkstream
                ? 'Save changes'
                : 'Create Workstream'}
          </Button>
        </div>
      </div>
    </QuickCreateModalLayout>
  )
}
