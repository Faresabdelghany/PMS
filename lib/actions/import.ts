"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "./types"
import type { TaskInsert, TaskPriority, TaskStatus } from "@/lib/supabase/types"

// Column mapping type
export type ColumnMapping = {
  title: number // Required - column index
  description?: number
  status?: number
  priority?: number
  assignee_email?: number
  tags?: number
  start_date?: number
  end_date?: number
}

// Import result
export type ImportResult = {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

// CSV Parser state
type CSVParserState = {
  lines: string[][]
  currentLine: string[]
  currentField: string
  inQuotes: boolean
  skipNext: boolean
}

// Handle character inside quotes
function handleQuotedChar(
  state: CSVParserState,
  char: string,
  nextChar: string | undefined
): boolean {
  if (char === '"' && nextChar === '"') {
    state.currentField += '"'
    state.skipNext = true
    return true
  }
  if (char === '"') {
    state.inQuotes = false
    return true
  }
  state.currentField += char
  return true
}

// Handle character outside quotes
function handleUnquotedChar(
  state: CSVParserState,
  char: string,
  nextChar: string | undefined
): void {
  if (char === '"') {
    state.inQuotes = true
    return
  }
  if (char === ',') {
    state.currentLine.push(state.currentField.trim())
    state.currentField = ""
    return
  }
  if (char === '\n' || (char === '\r' && nextChar === '\n')) {
    finalizeLine(state)
    if (char === '\r') state.skipNext = true
    return
  }
  if (char !== '\r') {
    state.currentField += char
  }
}

// Finalize current line
function finalizeLine(state: CSVParserState): void {
  state.currentLine.push(state.currentField.trim())
  if (state.currentLine.some(f => f !== "")) {
    state.lines.push(state.currentLine)
  }
  state.currentLine = []
  state.currentField = ""
}

// Parse CSV content
function parseCSV(content: string): string[][] {
  const state: CSVParserState = {
    lines: [],
    currentLine: [],
    currentField: "",
    inQuotes: false,
    skipNext: false,
  }

  for (let i = 0; i < content.length; i++) {
    if (state.skipNext) {
      state.skipNext = false
      continue
    }

    const char = content[i]
    const nextChar = content[i + 1]

    if (state.inQuotes) {
      handleQuotedChar(state, char, nextChar)
    } else {
      handleUnquotedChar(state, char, nextChar)
    }
  }

  // Handle last field/line
  if (state.currentField || state.currentLine.length > 0) {
    finalizeLine(state)
  }

  return state.lines
}

// Map status string to TaskStatus enum
function mapStatus(value: string): TaskStatus {
  const normalized = value.toLowerCase().trim()
  if (normalized === "done" || normalized === "completed" || normalized === "complete") {
    return "done"
  }
  if (normalized === "in-progress" || normalized === "in progress" || normalized === "doing" || normalized === "started") {
    return "in-progress"
  }
  return "todo"
}

// Map priority string to TaskPriority enum
function mapPriority(value: string): TaskPriority {
  const normalized = value.toLowerCase().trim()
  if (normalized === "urgent" || normalized === "critical") return "urgent"
  if (normalized === "high") return "high"
  if (normalized === "medium" || normalized === "normal") return "medium"
  if (normalized === "low") return "low"
  return "no-priority"
}

// Helper functions for CSV import

function parseRowTitle(row: string[], mapping: ColumnMapping): string | null {
  const title = row[mapping.title]?.trim()
  return title || null
}

function applyOptionalField<T extends TaskInsert, K extends keyof T>(
  task: T,
  fieldKey: K,
  value: T[K] | undefined
): void {
  if (value !== undefined) {
    task[fieldKey] = value
  }
}

function mapOptionalFields(
  row: string[],
  mapping: ColumnMapping,
  emailToUserId: Map<string, string>
): Partial<TaskInsert> {
  const fields: Partial<TaskInsert> = {}

  if (mapping.description !== undefined && row[mapping.description]) {
    fields.description = row[mapping.description].trim()
  }

  if (mapping.status !== undefined && row[mapping.status]) {
    fields.status = mapStatus(row[mapping.status])
  }

  if (mapping.priority !== undefined && row[mapping.priority]) {
    fields.priority = mapPriority(row[mapping.priority])
  }

  if (mapping.assignee_email !== undefined && row[mapping.assignee_email]) {
    const email = row[mapping.assignee_email].trim().toLowerCase()
    const userId = emailToUserId.get(email)
    if (userId) {
      fields.assignee_id = userId
    }
  }

  if (mapping.tags !== undefined && row[mapping.tags]) {
    fields.tag = row[mapping.tags].trim()
  }

  if (mapping.start_date !== undefined && row[mapping.start_date]) {
    const date = row[mapping.start_date].trim()
    if (date && !isNaN(Date.parse(date))) {
      fields.start_date = new Date(date).toISOString().split("T")[0]
    }
  }

  if (mapping.end_date !== undefined && row[mapping.end_date]) {
    const date = row[mapping.end_date].trim()
    if (date && !isNaN(Date.parse(date))) {
      fields.end_date = new Date(date).toISOString().split("T")[0]
    }
  }

  return fields
}

function processCSVRow(
  row: string[],
  rowNum: number,
  mapping: ColumnMapping,
  projectId: string,
  sortOrder: number,
  emailToUserId: Map<string, string>,
  result: ImportResult
): TaskInsert | null {
  const title = parseRowTitle(row, mapping)
  if (!title) {
    result.skipped++
    result.errors.push(`Row ${rowNum}: Missing title`)
    return null
  }

  const task: TaskInsert = {
    project_id: projectId,
    name: title,
    sort_order: sortOrder,
  }

  const optionalFields = mapOptionalFields(row, mapping, emailToUserId)
  Object.assign(task, optionalFields)

  return task
}

async function batchInsertTasks(
  supabase: any,
  tasksToInsert: TaskInsert[]
): Promise<{ success: boolean; error?: string }> {
  if (tasksToInsert.length === 0) {
    return { success: true }
  }

  const { error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert)

  if (insertError) {
    return { success: false, error: `Failed to import tasks: ${insertError.message}` }
  }

  return { success: true }
}

// Import tasks from CSV
export async function importTasksFromCSV(
  projectId: string,
  csvContent: string,
  mapping: ColumnMapping,
  hasHeader: boolean = true
): Promise<ActionResult<ImportResult>> {
  const supabase = await createClient()

  // Verify user has access to project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id")
    .eq("id", projectId)
    .single()

  if (projectError || !project) {
    return { error: "Project not found or access denied" }
  }

  // Parse CSV
  const rows = parseCSV(csvContent)
  if (rows.length === 0) {
    return { error: "No data found in CSV" }
  }

  // Skip header if present
  const dataRows = hasHeader ? rows.slice(1) : rows

  if (dataRows.length === 0) {
    return { error: "No data rows found (only header)" }
  }

  // Get organization members for email mapping
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, profiles(email)")
    .eq("organization_id", project.organization_id)

  const emailToUserId = new Map<string, string>()
  members?.forEach((m: any) => {
    if (m.profiles?.email) {
      emailToUserId.set(m.profiles.email.toLowerCase(), m.user_id)
    }
  })

  // Get current max sort_order
  const { data: maxOrderData } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single()

  let sortOrder = maxOrderData ? maxOrderData.sort_order + 1 : 0

  // Process rows
  const result: ImportResult = {
    total: dataRows.length,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  const tasksToInsert: TaskInsert[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = hasHeader ? i + 2 : i + 1 // 1-indexed, accounting for header

    const task = processCSVRow(row, rowNum, mapping, projectId, sortOrder++, emailToUserId, result)
    if (task) {
      tasksToInsert.push(task)
    }
  }

  // Batch insert tasks
  const insertResult = await batchInsertTasks(supabase, tasksToInsert)
  if (!insertResult.success) {
    return { error: insertResult.error }
  }

  result.imported = tasksToInsert.length

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/tasks")

  return { data: result }
}

// Preview CSV content (returns headers and first few rows)
export async function previewCSV(
  csvContent: string
): Promise<ActionResult<{ headers: string[]; rows: string[][]; totalRows: number }>> {
  const rows = parseCSV(csvContent)

  if (rows.length === 0) {
    return { error: "No data found in CSV" }
  }

  return {
    data: {
      headers: rows[0] || [],
      rows: rows.slice(1, 6), // First 5 data rows
      totalRows: rows.length - 1,
    },
  }
}
