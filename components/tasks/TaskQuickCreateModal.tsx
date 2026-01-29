'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarBlank, ChartBar, Paperclip, Tag as TagIcon, Microphone, UserCircle, X, Folder, Rows } from '@phosphor-icons/react/dist/ssr'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { GenericPicker, DatePicker } from '@/components/project-wizard/steps/StepQuickCreate'
import { ProjectDescriptionEditorLazy as ProjectDescriptionEditor } from '@/components/project-wizard/ProjectDescriptionEditorLazy'
import { QuickCreateModalLayout } from '@/components/QuickCreateModalLayout'
import { toast } from 'sonner'
import { createTask, updateTask } from '@/lib/actions/tasks'
import type { OrganizationTag } from "@/lib/supabase/types"

// Types for data passed from parent
type ProjectOption = {
  id: string
  name: string
  workstreams?: { id: string; name: string }[]
}

type OrganizationMember = {
  id: string
  user_id: string
  role: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

type User = {
  id: string
  name: string
  avatarUrl: string | null
}

export type CreateTaskContext = {
  projectId?: string
  workstreamId?: string
  workstreamName?: string
}

// Task data returned by the modal
export type TaskData = {
  id: string
  name: string
  status: 'todo' | 'in-progress' | 'done'
  priority?: string
  tag?: string | null
  assignee?: User | null
  startDate?: Date | null
  endDate?: Date | null
  dueLabel?: string | null
  description?: string | null
  projectId: string
  projectName: string
  workstreamId?: string | null
  workstreamName?: string | null
}

interface TaskQuickCreateModalProps {
  open: boolean
  onClose: () => void
  context?: CreateTaskContext
  onTaskCreated?: (task: TaskData) => void
  editingTask?: TaskData
  onTaskUpdated?: (task: TaskData) => void
  projects?: ProjectOption[]
  organizationMembers?: OrganizationMember[]
  tags?: OrganizationTag[]
}

type TaskStatusId = 'todo' | 'in-progress' | 'done'

type StatusOption = {
  id: TaskStatusId
  label: string
}

type AssigneeOption = {
  id: string
  name: string
  avatar?: string | null
}

type PriorityOption = {
  id: "no-priority" | "low" | "medium" | "high" | "urgent"
  label: string
}

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS: PriorityOption[] = [
  { id: 'no-priority', label: 'No priority' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

function toUser(option: AssigneeOption | undefined): User | null {
  if (!option) return null
  return {
    id: option.id,
    name: option.name,
    avatarUrl: option.avatar || null,
  }
}

export function TaskQuickCreateModal({
  open,
  onClose,
  context,
  onTaskCreated,
  editingTask,
  onTaskUpdated,
  projects = [],
  organizationMembers = [],
  tags = [],
}: TaskQuickCreateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [createMore, setCreateMore] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [workstreamId, setWorkstreamId] = useState<string | undefined>(undefined)
  const [workstreamName, setWorkstreamName] = useState<string | undefined>(undefined)

  // Convert org members to picker format
  const assigneeOptions: AssigneeOption[] = useMemo(() =>
    organizationMembers.map((m) => ({
      id: m.user_id,
      name: m.profile.full_name || m.profile.email,
      avatar: m.profile.avatar_url,
    })),
    [organizationMembers]
  )

  const [assignee, setAssignee] = useState<AssigneeOption | undefined>(undefined)

  // Get workstreams for current project from props
  const getWorkstreamsForProject = useCallback((projId: string | undefined): { id: string; label: string }[] => {
    if (!projId) return []
    const project = projects.find((p) => p.id === projId)
    if (!project?.workstreams) return []
    return project.workstreams.map((ws) => ({ id: ws.id, label: ws.name }))
  }, [projects])
  const [status, setStatus] = useState<StatusOption>(STATUS_OPTIONS[0])
  const [startDate, setStartDate] = useState<Date | undefined>(() => new Date())
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined)
  const [priority, setPriority] = useState<PriorityOption | undefined>(PRIORITY_OPTIONS[0])
  const [selectedTag, setSelectedTag] = useState<OrganizationTag | undefined>(undefined)

  useEffect(() => {
    if (!open) return

    if (editingTask) {
      setProjectId(editingTask.projectId)
      setWorkstreamId(editingTask.workstreamId)
      setWorkstreamName(editingTask.workstreamName)

      setTitle(editingTask.name)
      setDescription(editingTask.description)
      setCreateMore(false)
      setIsDescriptionExpanded(false)

      if (editingTask.assignee) {
        const assigneeOption = assigneeOptions.find((a) => a.name === editingTask.assignee?.name)
        setAssignee(assigneeOption ?? assigneeOptions[0])
      } else {
        setAssignee(assigneeOptions[0])
      }

      const statusOption = STATUS_OPTIONS.find((s) => s.id === editingTask.status)
      setStatus(statusOption ?? STATUS_OPTIONS[0])

      setStartDate(editingTask.startDate ?? new Date())
      setTargetDate(undefined)

      const priorityOption = editingTask.priority
        ? PRIORITY_OPTIONS.find((p) => p.id === editingTask.priority)
        : undefined
      setPriority(priorityOption ?? PRIORITY_OPTIONS[0])

      const tagOption = editingTask.tag
        ? tags.find((t) => t.name === editingTask.tag)
        : undefined
      setSelectedTag(tagOption)

      return
    }

    const defaultProjectId = context?.projectId
    setProjectId(defaultProjectId)

    const workstreams = getWorkstreamsForProject(defaultProjectId)
    const initialWorkstream = workstreams.find((ws) => ws.id === context?.workstreamId)

    setWorkstreamId(initialWorkstream?.id)
    setWorkstreamName(context?.workstreamName ?? initialWorkstream?.label)

    setTitle('')
    setDescription(undefined)
    setCreateMore(false)
    setIsDescriptionExpanded(false)
    setAssignee(assigneeOptions[0])
    setStatus(STATUS_OPTIONS[0])
    setStartDate(new Date())
    setTargetDate(undefined)
    setPriority(PRIORITY_OPTIONS[0])
    setSelectedTag(undefined)
  }, [open, context?.projectId, context?.workstreamId, context?.workstreamName, editingTask, assigneeOptions, getWorkstreamsForProject, tags])

  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, label: p.name })),
    [projects],
  )

  const workstreamOptions = useMemo(
    () => getWorkstreamsForProject(projectId),
    [projectId, getWorkstreamsForProject],
  )

  useEffect(() => {
    if (!projectId) return

    if (!workstreamOptions.length) {
      setWorkstreamId(undefined)
      setWorkstreamName(undefined)
      return
    }

    const existing = workstreamOptions.find((ws) => ws.id === workstreamId)
    const fallback = workstreamOptions[0]
    const next = existing ?? fallback
    setWorkstreamId(next?.id)
    if (!workstreamName) {
      setWorkstreamName(next?.label)
    }
  }, [projectId, workstreamOptions, workstreamId, workstreamName])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      if (editingTask) {
        const effectiveProjectId = projectId ?? editingTask.projectId
        const project = effectiveProjectId
          ? projects.find((p) => p.id === effectiveProjectId)
          : undefined

        // Call updateTask server action
        const result = await updateTask(editingTask.id, {
          name: title.trim() || 'Untitled task',
          status: status.id,
          priority: priority?.id || 'no-priority',
          tag: selectedTag?.name || null,
          description: description || null,
          start_date: startDate?.toISOString().split('T')[0] || null,
          end_date: targetDate?.toISOString().split('T')[0] || null,
          workstream_id: workstreamId || null,
          assignee_id: assignee?.id || null,
        })

        if (result.error) {
          toast.error(result.error)
          return
        }

        const updatedTask: TaskData = {
          ...editingTask,
          name: title.trim() || 'Untitled task',
          status: status.id,
          dueLabel: targetDate ? format(targetDate, 'dd/MM/yyyy') : editingTask.dueLabel,
          assignee: toUser(assignee),
          startDate,
          priority: priority?.id,
          tag: selectedTag?.name,
          description,
          projectId: effectiveProjectId ?? editingTask.projectId,
          projectName: project?.name ?? editingTask.projectName,
          workstreamId: workstreamId ?? editingTask.workstreamId,
          workstreamName: workstreamName ?? editingTask.workstreamName,
        }

        onTaskUpdated?.(updatedTask)
        toast.success("Task updated successfully")
        onClose()
        return
      }

      const effectiveProjectId = projectId ?? projects[0]?.id
      if (!effectiveProjectId) {
        toast.error("Please select a project")
        return
      }

      const project = projects.find((p) => p.id === effectiveProjectId)
      if (!project) {
        toast.error("Project not found")
        return
      }

      // Call createTask server action
      const result = await createTask(effectiveProjectId, {
        name: title.trim() || 'Untitled task',
        status: status.id,
        priority: priority?.id || 'no-priority',
        tag: selectedTag?.name || null,
        description: description || null,
        start_date: startDate?.toISOString().split('T')[0] || null,
        end_date: targetDate?.toISOString().split('T')[0] || null,
        workstream_id: workstreamId || null,
        assignee_id: assignee?.id || null,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      const newTask: TaskData = {
        id: result.data!.id,
        name: title.trim() || 'Untitled task',
        status: status.id,
        dueLabel: targetDate ? format(targetDate, 'dd/MM/yyyy') : undefined,
        assignee: toUser(assignee),
        startDate,
        endDate: targetDate || null,
        priority: priority?.id,
        tag: selectedTag?.name,
        description,
        projectId: effectiveProjectId,
        projectName: project.name,
        workstreamId: workstreamId || null,
        workstreamName: workstreamName || null,
      }

      onTaskCreated?.(newTask)

      if (createMore) {
        toast.success("Task created! Ready for another.")
        setTitle('')
        setDescription(undefined)
        setStatus(STATUS_OPTIONS[0])
        setTargetDate(undefined)
        return
      }

      toast.success("Task created successfully")
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const projectLabel = projectOptions.find((p) => p.id === projectId)?.label

  return (
    <QuickCreateModalLayout
      open={open}
      onClose={onClose}
      isDescriptionExpanded={isDescriptionExpanded}
      onSubmitShortcut={handleSubmit}
    >
      {/* Context row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <GenericPicker
            items={projectOptions}
            selectedId={projectId}
            onSelect={(item) => setProjectId(item.id)}
            placeholder="Choose project..."
            renderItem={(item) => (
              <div className="flex items-center justify-between w-full gap-2">
                <span>{item.label}</span>
              </div>
            )}
            trigger={
              <button
                className="bg-background flex gap-2 h-7 items-center px-2 py-1 rounded-lg border border-background hover:border-primary/50 transition-colors text-xs disabled:opacity-60"
              >
                <Folder className="size-4 text-muted-foreground" />
                <span className="truncate max-w-[160px] font-medium text-foreground">
                  {projectLabel ?? 'Choose project'}
                </span>
              </button>
            }
          />
          {workstreamOptions.length > 0 && (
            <>
              <div className="w-2 h-2 bg-muted-foreground/15 rounded-full" />
              <GenericPicker
                items={workstreamOptions}
                selectedId={workstreamId}
                onSelect={(item) => {
                  setWorkstreamId(item.id)
                  setWorkstreamName(item.label)
                }}
                placeholder="Choose workstream..."
                renderItem={(item) => (
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{item.label}</span>
                  </div>
                )}
                trigger={
                  <button
                    className="bg-background flex gap-2 h-7 items-center px-2 py-1 rounded-lg border border-background hover:border-primary/50 transition-colors text-xs disabled:opacity-60"
                  >
                    <Rows className="size-4 text-muted-foreground" />
                    <span className="truncate max-w-[160px] font-medium text-foreground">
                      {workstreamName ?? 'Choose workstream'}
                    </span>
                  </button>
                }
              />
            </>
          )}
        </div>

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
            id="task-create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Description */}
      <ProjectDescriptionEditor
        value={description}
        onChange={setDescription}
        onExpandChange={setIsDescriptionExpanded}
        placeholder="Briefly describe the goal or details of this task..."
        showTemplates={false}
      />

      {/* Properties */}
      <div className="flex flex-wrap gap-2.5 items-start w-full shrink-0">
        {/* Assignee */}
        {assigneeOptions.length > 0 && (
          <GenericPicker
            items={assigneeOptions}
            onSelect={setAssignee}
            selectedId={assignee?.id}
            placeholder="Assign owner..."
            renderItem={(item) => (
              <div className="flex items-center gap-2 w-full">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt=""
                    className="size-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {item.name.charAt(0)}
                  </div>
                )}
                <span className="flex-1">{item.name}</span>
              </div>
            )}
            trigger={
              <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="size-4 rounded-full bg-background flex items-center justify-center text-[10px] font-medium">
                  {assignee?.name.charAt(0) ?? '?'}
                </div>
                <span className="font-medium text-foreground text-sm leading-5">
                  {assignee?.name ?? 'Assignee'}
                </span>
              </button>
            }
          />
        )}

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

        {/* Status */}
        <GenericPicker
          items={STATUS_OPTIONS}
          onSelect={setStatus}
          selectedId={status.id}
          placeholder="Change status..."
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              <span className="flex-1">{item.label}</span>
            </div>
          )}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <UserCircle className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {status.label}
              </span>
            </button>
          }
        />

        {/* Target date */}
        <DatePicker
          date={targetDate}
          onSelect={setTargetDate}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <CalendarBlank className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {targetDate ? format(targetDate, 'dd/MM/yyyy') : 'Target'}
              </span>
            </button>
          }
        />

        {/* Priority */}
        <GenericPicker
          items={PRIORITY_OPTIONS}
          onSelect={setPriority}
          selectedId={priority?.id}
          placeholder="Set priority..."
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              <span className="flex-1">{item.label}</span>
            </div>
          )}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <ChartBar className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {priority?.label ?? 'Priority'}
              </span>
            </button>
          }
        />

        {/* Tag */}
        {tags.length > 0 && (
          <GenericPicker
            items={tags}
            onSelect={setSelectedTag}
            selectedId={selectedTag?.id}
            placeholder="Add tag..."
            renderItem={(item) => (
              <div className="flex items-center gap-2 w-full">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1">{item.name}</span>
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                {selectedTag && (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: selectedTag.color }}
                  />
                )}
                {!selectedTag && <TagIcon className="size-4 text-muted-foreground" />}
                <span className="font-medium text-foreground text-sm leading-5">
                  {selectedTag?.name ?? 'Tag'}
                </span>
              </button>
            }
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
        <div className="flex items-center gap-1">
          <button className="flex items-center justify-center size-10 rounded-lg hover:bg-muted transition-colors">
            <Paperclip className="size-4 text-muted-foreground" />
          </button>
          <button className="flex items-center justify-center size-10 rounded-lg hover:bg-muted transition-colors">
            <Microphone className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {!editingTask && (
            <div className="flex items-center gap-2">
              <Switch
                checked={createMore}
                onCheckedChange={(value) => setCreateMore(Boolean(value))}
              />
              <span className="text-sm font-medium text-foreground">Create more</span>
            </div>
          )}

          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="h-10 px-4 rounded-xl">
            {isSubmitting ? 'Saving...' : editingTask ? 'Save changes' : 'Create Task'}
          </Button>
        </div>
      </div>
    </QuickCreateModalLayout>
  )
}
