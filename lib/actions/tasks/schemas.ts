import { z } from "zod"
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  DEFAULT_TASK_STATUS,
  DEFAULT_TASK_PRIORITY,
} from "@/lib/constants/status"

export const createTaskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Task name is required")
    .max(500, "Task name must be less than 500 characters"),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).default(DEFAULT_TASK_STATUS),
  priority: z.enum(TASK_PRIORITIES).default(DEFAULT_TASK_PRIORITY),
  workstream_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  tag: z.string().max(50).optional().nullable(),
  source_report_id: z.string().uuid().optional().nullable(),
})

export const updateTaskSchema = createTaskSchema.partial()

export const reorderTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, "At least one task ID is required"),
  workstreamId: z.string().uuid().optional().nullable(),
})
