"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type {
  ProjectNote,
  ProjectNoteInsert,
  ProjectNoteUpdate,
  NoteType,
  NoteStatus,
  Json,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth } from "./auth-helpers"


// Extended note type with author info
export type ProjectNoteWithAuthor = ProjectNote & {
  author?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

// Audio data structure for audio notes
export type AudioData = {
  duration: number // in seconds
  transcription?: string
  storage_path?: string
}

// Note filters
export type NoteFilters = {
  type?: NoteType
  status?: NoteStatus
  search?: string
}

// Create a new note
export async function createNote(
  projectId: string,
  data: {
    title: string
    content?: string
    note_type?: NoteType
    audio_data?: AudioData
  }
): Promise<ActionResult<ProjectNote>> {
  try {
    const { user, supabase } = await requireAuth()

    // Validate title
    if (!data.title.trim()) {
      return { error: "Note title is required" }
    }

    // Create note record
    const noteRecord: ProjectNoteInsert = {
      project_id: projectId,
      title: data.title.trim(),
      content: data.content || null,
      note_type: data.note_type || "general",
      status: data.note_type === "audio" ? "processing" : "completed",
      added_by_id: user.id,
      audio_data: data.audio_data ? (data.audio_data as unknown as Json) : null,
    }

    const { data: note, error } = await supabase
      .from("project_notes")
      .insert(noteRecord)
      .select()
      .single()

    if (error) {
      return { error: `Failed to create note: ${error.message}` }
    }

    revalidatePath(`/projects/${projectId}`)
    return { data: note }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Update an existing note
export async function updateNote(
  noteId: string,
  data: {
    title?: string
    content?: string
    note_type?: NoteType
    status?: NoteStatus
    audio_data?: AudioData
  }
): Promise<ActionResult<ProjectNote>> {
  const supabase = await createClient()

  // Validate title if provided
  if (data.title !== undefined && !data.title.trim()) {
    return { error: "Note title cannot be empty" }
  }

  // Build update object
  const updateData: ProjectNoteUpdate = {}

  if (data.title !== undefined) {
    updateData.title = data.title.trim()
  }
  if (data.content !== undefined) {
    updateData.content = data.content
  }
  if (data.note_type !== undefined) {
    updateData.note_type = data.note_type
  }
  if (data.status !== undefined) {
    updateData.status = data.status
  }
  if (data.audio_data !== undefined) {
    updateData.audio_data = data.audio_data as unknown as Json
  }

  const { data: note, error } = await supabase
    .from("project_notes")
    .update(updateData)
    .eq("id", noteId)
    .select()
    .single()

  if (error) {
    return { error: `Failed to update note: ${error.message}` }
  }

  revalidatePath(`/projects/${note.project_id}`)
  return { data: note }
}

// Delete a note
export async function deleteNote(noteId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Get note first to get project_id for revalidation
  const { data: note, error: fetchError } = await supabase
    .from("project_notes")
    .select("id, project_id, audio_data")
    .eq("id", noteId)
    .single()

  if (fetchError || !note) {
    return { error: "Note not found" }
  }

  // If there's audio data with storage path, clean up the audio file
  const audioData = note.audio_data as AudioData | null
  if (audioData?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("project-media")
      .remove([audioData.storage_path])

    if (storageError) {
      console.error("Failed to delete audio file:", storageError)
      // Continue with note deletion even if audio cleanup fails
    }
  }

  // Delete the note
  const { error } = await supabase
    .from("project_notes")
    .delete()
    .eq("id", noteId)

  if (error) {
    return { error: `Failed to delete note: ${error.message}` }
  }

  revalidatePath(`/projects/${note.project_id}`)
  return {}
}

// Get a single note
export async function getNote(
  noteId: string
): Promise<ActionResult<ProjectNoteWithAuthor>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_notes")
    .select(`
      *,
      author:profiles!project_notes_added_by_id_fkey(
        id,
        full_name,
        email,
        avatar_url
      )
    `)
    .eq("id", noteId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as ProjectNoteWithAuthor }
}

// Get all notes for a project
export async function getProjectNotes(
  projectId: string,
  filters?: NoteFilters
): Promise<ActionResult<ProjectNoteWithAuthor[]>> {
  const supabase = await createClient()

  let query = supabase
    .from("project_notes")
    .select(`
      *,
      author:profiles!project_notes_added_by_id_fkey(
        id,
        full_name,
        email,
        avatar_url
      )
    `)
    .eq("project_id", projectId)

  // Apply filters
  if (filters?.type) {
    query = query.eq("note_type", filters.type)
  }

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query.order("updated_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: data as ProjectNoteWithAuthor[] }
}

// Get notes count for a project
export async function getProjectNotesCount(
  projectId: string,
  type?: NoteType
): Promise<ActionResult<number>> {
  const supabase = await createClient()

  let query = supabase
    .from("project_notes")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)

  if (type) {
    query = query.eq("note_type", type)
  }

  const { count, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data: count || 0 }
}

// Get notes by type
export async function getNotesByType(
  projectId: string,
  noteType: NoteType
): Promise<ActionResult<ProjectNoteWithAuthor[]>> {
  return getProjectNotes(projectId, { type: noteType })
}

// Mark audio note as completed (after transcription)
export async function completeAudioNote(
  noteId: string,
  transcription: string
): Promise<ActionResult<ProjectNote>> {
  const supabase = await createClient()

  // Get current audio data
  const { data: note, error: fetchError } = await supabase
    .from("project_notes")
    .select("audio_data")
    .eq("id", noteId)
    .single()

  if (fetchError || !note) {
    return { error: "Note not found" }
  }

  // Update audio data with transcription and mark as completed
  const currentAudioData = (note.audio_data as AudioData) || {}
  const updatedAudioData: AudioData = {
    ...currentAudioData,
    transcription,
  }

  const { data: updatedNote, error } = await supabase
    .from("project_notes")
    .update({
      status: "completed" as NoteStatus,
      audio_data: updatedAudioData as unknown as Json,
      content: transcription, // Also save transcription as content for search
    })
    .eq("id", noteId)
    .select()
    .single()

  if (error) {
    return { error: `Failed to complete audio note: ${error.message}` }
  }

  revalidatePath(`/projects/${updatedNote.project_id}`)
  return { data: updatedNote }
}

// Duplicate a note
export async function duplicateNote(
  noteId: string
): Promise<ActionResult<ProjectNote>> {
  try {
    const { user, supabase } = await requireAuth()

    // Get original note
    const { data: original, error: fetchError } = await supabase
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .single()

    if (fetchError || !original) {
      return { error: "Note not found" }
    }

    // Create duplicate
    const duplicateRecord: ProjectNoteInsert = {
      project_id: original.project_id,
      title: `${original.title} (Copy)`,
      content: original.content,
      note_type: original.note_type,
      status: "completed", // Don't copy processing status
      added_by_id: user.id,
      audio_data: null, // Don't duplicate audio data
    }

    const { data: duplicate, error } = await supabase
      .from("project_notes")
      .insert(duplicateRecord)
      .select()
      .single()

    if (error) {
      return { error: `Failed to duplicate note: ${error.message}` }
    }

    revalidatePath(`/projects/${original.project_id}`)
    return { data: duplicate }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get recent notes across all projects for a user
export async function getRecentNotes(
  limit: number = 10
): Promise<ActionResult<ProjectNoteWithAuthor[]>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("project_notes")
      .select(`
        *,
        author:profiles!project_notes_added_by_id_fkey(
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("added_by_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (error) {
      return { error: error.message }
    }

    return { data: data as ProjectNoteWithAuthor[] }
  } catch {
    return { error: "Not authenticated" }
  }
}
