'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarBlank, ChartBar, Paperclip, Tag as TagIcon, Microphone, UserCircle, X, Folder, Rows } from '@phosphor-icons/react/dist/ssr'
import { toast } from 'sonner'

import type { ProjectTask, User } from '@/lib/data/project-details'
import type { ProjectWithRelations } from '@/lib/actions/projects'
import { createTask, updateTask as updateTaskAction } from '@/lib/actions/tasks'
import { getAvatarUrl } from '@/lib/assets/avatars'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { GenericPicker, DatePicker } from '@/components/project-wizard/steps/StepQuickCreate'
import { ProjectDescriptionEditor } from '@/components/project-wizard/ProjectDescriptionEditor'
import { QuickCreateModalLayout } from '@/components/QuickCreateModalLayout'

export type CreateTaskContext = {
  projectId?: string
  workstreamId?: string
  workstreamName?: string
}

interface TaskQuickCreateModalProps {
  open: boolean
  onClose: () => void
  context?: CreateTaskContext
  onTaskCreated?: (task: ProjectTask) => void
  editingTask?: ProjectTask
  onTaskUpdated?: (task: ProjectTask) => void
  projects?: ProjectWithRelations[]
  workstreamsByProject?: Record<string, { id: string; name: string }[]>
  organizationId?: string
}

type TaskStatusId = 'todo' | 'in-progress' | 'done'

type StatusOption = {
  id: TaskStatusId
  label: string
}

type AssigneeOption = {
  id: string
  name: string
}

type PriorityOption = {
  id: "no-priority" | "low" | "medium" | "high" | "urgent"
  label: string
}

export type TagOption = {
  id: string
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
  { id: 'urgent', label: 'Urgent' },
]

export const TAG_OPTIONS: TagOption[] = [
  { id: 'feature', label: 'Feature' },
  { id: 'bug', label: 'Bug' },
  { id: 'internal', label: 'Internal' },
]

function toUser(option: AssigneeOption | undefined): User | undefined {
  if (!option) return undefined
  return {
    id: option.id,
    name: option.name,
    avatarUrl: getAvatarUrl(option.name),
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
  workstreamsByProject = {},
  organizationId,
}: TaskQuickCreateModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [createMore, setCreateMore] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [workstreamId, setWorkstreamId] = useState<string | undefined>(undefined)
  const [workstreamName, setWorkstreamName] = useState<string | undefined>(undefined)

  const [assignee, setAssignee] = useState<AssigneeOption | undefined>(undefined)
  const [status, setStatus] = useState<StatusOption>(STATUS_OPTIONS[0])
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined)
  const [priority, setPriority] = useState<PriorityOption | undefined>(PRIORITY_OPTIONS[0])
  const [selectedTag, setSelectedTag] = useState<TagOption | undefined>(undefined)

  // Build assignee options from project members
  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    if (!projectId) return []
    const project = projects.find((p) => p.id === projectId)
    if (!project?.members) return []
    return project.members.map((m) => ({
      id: m.user_id,
      name: m.profile?.full_name || m.profile?.email || 'Unknown',
    }))
  }, [projectId, projects])

  // Initialize form state when modal opens
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

      // Set assignee by looking up in project members
      const project = projects.find((p) => p.id === editingTask.projectId)
      if (editingTask.assignee && project?.members) {
        const assigneeOption = project.members
          .map((m) => ({
            id: m.user_id,
            name: m.profile?.full_name || m.profile?.email || 'Unknown',
          }))
          .find((a) => a.name === editingTask.assignee?.name)
        setAssignee(assigneeOption)
      } else {
        setAssignee(undefined)
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
        ? TAG_OPTIONS.find((t) => t.label === editingTask.tag)
        : undefined
      setSelectedTag(tagOption)

      return
    }

    const defaultProjectId = context?.projectId || projects[0]?.id
    setProjectId(defaultProjectId)

    const workstreams = defaultProjectId ? workstreamsByProject[defaultProjectId] || [] : []
    const initialWorkstream = workstreams.find((ws) => ws.id === context?.workstreamId)

    setWorkstreamId(initialWorkstream?.id)
    setWorkstreamName(context?.workstreamName ?? initialWorkstream?.name)

    setTitle('')
    setDescription(undefined)
    setCreateMore(false)
    setIsDescriptionExpanded(false)
    setAssignee(undefined)
    setStatus(STATUS_OPTIONS[0])
    setStartDate(new Date())
    setTargetDate(undefined)
    setPriority(PRIORITY_OPTIONS[0])
    setSelectedTag(undefined)
  }, [open, context?.projectId, context?.workstreamId, context?.workstreamName, editingTask, projects, workstreamsByProject])

  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, label: p.name })),
    [projects],
  )

  const workstreamOptions = useMemo(
    () => (projectId ? workstreamsByProject[projectId] || [] : []).map((ws) => ({ id: ws.id, label: ws.name })),
    [projectId, workstreamsByProject],
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

  const handleSubmit = async () => {
    if (editingTask) {
      // Update existing task
      startTransition(async () => {
        const result = await updateTaskAction(editingTask.id, {
          name: title.trim() || 'Untitled task',
          status: status.id,
          priority: priority?.id || 'no-priority',
          tag: selectedTag?.label || null,
          description: description || null,
          start_date: startDate?.toISOString() || null,
          end_date: targetDate?.toISOString() || null,
          assignee_id: assignee?.id || null,
          workstream_id: workstreamId || null,
        })

        if (result.error) {
          toast.error(`Failed to update task: ${result.error}`)
          return
        }

        toast.success("Task updated successfully")
        onTaskUpdated?.({
          ...editingTask,
          name: title.trim() || 'Untitled task',
          status: status.id,
          priority: priority?.id,
          tag: selectedTag?.label,
          description,
          startDate,
          assignee: toUser(assignee),
          workstreamId: workstreamId ?? editingTask.workstreamId,
          workstreamName: workstreamName ?? editingTask.workstreamName,
        })
        router.refresh()
        onClose()
      })
      return
    }

    // Create new task
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

    startTransition(async () => {
      const result = await createTask(effectiveProjectId, {
        name: title.trim() || 'Untitled task',
        status: status.id,
        priority: priority?.id || 'no-priority',
        tag: selectedTag?.label || null,
        description: description || null,
        start_date: startDate?.toISOString() || null,
        end_date: targetDate?.toISOString() || null,
        assignee_id: assignee?.id || null,
        workstream_id: workstreamId || null,
      })

      if (result.error) {
        toast.error(`Failed to create task: ${result.error}`)
        return
      }

      const newTask: ProjectTask = {
        id: result.data!.id,
        name: result.data!.name,
        status: result.data!.status,
        priority: result.data!.priority,
        tag: result.data!.tag || undefined,
        description: result.data!.description || undefined,
        startDate: result.data!.start_date ? new Date(result.data!.start_date) : undefined,
        assignee: toUser(assignee),
        projectId: effectiveProjectId,
        projectName: project.name,
        workstreamId: workstreamId ?? '',
        workstreamName: workstreamName ?? 'No Workstream',
      }

      onTaskCreated?.(newTask)

      if (createMore) {
        toast.success("Task created! Ready for another.")
        setTitle('')
        setDescription(undefined)
        setStatus(STATUS_OPTIONS[0])
        setTargetDate(undefined)
        router.refresh()
        return
      }

      toast.success("Task created successfully")
      router.refresh()
      onClose()
    })
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
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {item.name.charAt(0)}
                </div>
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
        <GenericPicker
          items={TAG_OPTIONS}
          onSelect={setSelectedTag}
          selectedId={selectedTag?.id}
          placeholder="Add tag..."
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              <span className="flex-1">{item.label}</span>
            </div>
          )}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <TagIcon className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {selectedTag?.label ?? 'Tag'}
              </span>
            </button>
          }
        />
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

          <Button
            type="button"
            onClick={handleSubmit}
            className="h-10 px-4 rounded-xl"
            disabled={isPending}
          >
            {isPending ? 'Saving...' : editingTask ? 'Save changes' : 'Create Task'}
          </Button>
        </div>
      </div>
    </QuickCreateModalLayout>
  )
}
