import { z } from "zod"
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from "@/lib/constants/status"

// Validation schema for project creation
export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(200, "Project name must be less than 200 characters"),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  type_label: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  intent: z.enum(["delivery", "experiment", "internal"]).optional().nullable(),
  success_type: z.enum(["deliverable", "metric", "undefined"]).optional().nullable(),
  deadline_type: z.enum(["none", "target", "fixed"]).optional().nullable(),
  deadline_date: z.string().optional().nullable(),
  work_structure: z.enum(["linear", "milestones", "multistream"]).optional().nullable(),
  deliverables: z.array(z.object({
    title: z.string().max(500),
    due_date: z.string().optional().nullable(),
  })).optional(),
  metrics: z.array(z.object({
    name: z.string().max(200),
    target: z.string().max(100).optional().nullable(),
  })).optional(),
  owner_id: z.string().uuid().optional(),
  contributor_ids: z.array(z.string().uuid()).optional(),
  stakeholder_ids: z.array(z.string().uuid()).optional(),
  workstreams: z.array(z.string().max(200)).optional(),
  starter_tasks: z.array(z.object({
    title: z.string().max(500),
    description: z.string().max(5000).optional(),
    priority: z.string().max(50),
    workstream: z.string().max(200).optional(),
  })).optional(),
})
