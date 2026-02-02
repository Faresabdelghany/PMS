import { z } from "zod"
import {
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  CLIENT_STATUSES,
} from "@/lib/constants/status"

/**
 * Centralized Zod validation schemas for server actions
 * These schemas validate input data at runtime before database operations
 */

// ============================================================================
// Common / Reusable Schemas
// ============================================================================

/** UUID validation */
export const uuidSchema = z.string().uuid("Invalid ID format")

/** Non-empty trimmed string */
export const nonEmptyString = z.string().trim().min(1, "This field is required")

/** Optional trimmed string (empty becomes undefined) */
export const optionalString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional()

/** URL validation (optional) */
export const optionalUrl = z
  .string()
  .trim()
  .url("Invalid URL format")
  .optional()
  .or(z.literal(""))
  .transform((val) => (val === "" ? undefined : val))

/** Email validation */
export const emailSchema = z.string().trim().email("Invalid email address").toLowerCase()

/** Password validation */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")

// ============================================================================
// Auth Schemas
// ============================================================================

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must be less than 100 characters"),
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
})

export const updatePasswordSchema = z.object({
  password: passwordSchema,
})

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must be less than 100 characters"),
  avatarUrl: optionalUrl,
})

// ============================================================================
// Organization Schemas
// ============================================================================

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be less than 100 characters"),
})

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be less than 100 characters")
    .optional(),
})

// ============================================================================
// Project Schemas
// ============================================================================

export const projectStatusSchema = z.enum(PROJECT_STATUSES)
export const projectPrioritySchema = z.enum(PROJECT_PRIORITIES)

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(200, "Project name must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be less than 5000 characters")
    .optional()
    .nullable(),
  status: projectStatusSchema.default("planned"),
  client_id: uuidSchema.optional().nullable(),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  budget: z.number().min(0, "Budget cannot be negative").optional().nullable(),
  priority: projectPrioritySchema.default("medium"),
})

export const updateProjectSchema = createProjectSchema.partial()

// ============================================================================
// Task Schemas
// ============================================================================

export const taskStatusSchema = z.enum(TASK_STATUSES)
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)

export const createTaskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Task name is required")
    .max(500, "Task name must be less than 500 characters"),
  description: z
    .string()
    .trim()
    .max(10000, "Description must be less than 10000 characters")
    .optional()
    .nullable(),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  project_id: uuidSchema,
  workstream_id: uuidSchema.optional().nullable(),
  assignee_id: uuidSchema.optional().nullable(),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  tag: z
    .string()
    .trim()
    .max(50, "Tag must be less than 50 characters")
    .optional()
    .nullable(),
})

export const updateTaskSchema = createTaskSchema.partial().omit({ project_id: true })

export const reorderTasksSchema = z.object({
  taskIds: z.array(uuidSchema).min(1, "At least one task ID is required"),
  workstreamId: uuidSchema.optional().nullable(),
})

// ============================================================================
// Client Schemas
// ============================================================================

export const clientStatusSchema = z.enum(CLIENT_STATUSES)

export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name is required")
    .max(200, "Client name must be less than 200 characters"),
  industry: z
    .string()
    .trim()
    .max(100, "Industry must be less than 100 characters")
    .optional()
    .nullable(),
  website: optionalUrl.nullable(),
  location: z
    .string()
    .trim()
    .max(200, "Location must be less than 200 characters")
    .optional()
    .nullable(),
  status: clientStatusSchema.default("active"),
  primary_contact_name: z
    .string()
    .trim()
    .max(100, "Contact name must be less than 100 characters")
    .optional()
    .nullable(),
  primary_contact_email: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("")),
})

export const updateClientSchema = createClientSchema.partial()

// ============================================================================
// Workstream Schemas
// ============================================================================

export const createWorkstreamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workstream name is required")
    .max(200, "Workstream name must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .nullable(),
  project_id: uuidSchema,
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format (use hex like #FF5733)")
    .optional()
    .nullable(),
})

export const updateWorkstreamSchema = createWorkstreamSchema.partial().omit({ project_id: true })

export const reorderWorkstreamsSchema = z.object({
  workstreamIds: z.array(uuidSchema).min(1, "At least one workstream ID is required"),
})

// ============================================================================
// Search Schema
// ============================================================================

export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query is required")
    .max(200, "Search query must be less than 200 characters"),
  organizationId: uuidSchema,
})

// ============================================================================
// Invitation Schemas
// ============================================================================

export const createInvitationSchema = z.object({
  email: emailSchema,
  organizationId: uuidSchema,
  role: z.enum(["admin", "member"]).default("member"),
})

// ============================================================================
// AI Settings Schemas
// ============================================================================

export const aiProviderSchema = z.enum(["openai", "anthropic", "google"])

export const saveAISettingsSchema = z.object({
  ai_provider: aiProviderSchema.optional(),
  ai_model_preference: z
    .string()
    .trim()
    .max(100, "Model preference must be less than 100 characters")
    .optional()
    .nullable(),
})

export const saveAIApiKeySchema = z.object({
  apiKey: z
    .string()
    .min(10, "API key appears to be too short")
    .max(500, "API key must be less than 500 characters"),
})

// ============================================================================
// Helper function to validate and return formatted errors
// ============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)

  if (!result.success) {
    // Get the first error message
    const firstError = result.error.errors[0]
    const path = firstError.path.length > 0 ? `${firstError.path.join(".")}: ` : ""
    return { success: false, error: `${path}${firstError.message}` }
  }

  return { success: true, data: result.data }
}

/**
 * Helper to extract form data into an object for validation
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  formData.forEach((value, key) => {
    // Handle multiple values with same key
    if (obj[key] !== undefined) {
      if (Array.isArray(obj[key])) {
        (obj[key] as unknown[]).push(value)
      } else {
        obj[key] = [obj[key], value]
      }
    } else {
      obj[key] = value
    }
  })
  return obj
}
