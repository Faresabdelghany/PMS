/**
 * Note converters to transform Supabase note types to UI types
 */

import type {
  ProjectNote as UIProjectNote,
  User as UIUser,
  NoteType as UINoteType,
  NoteStatus as UINoteStatus,
  AudioNoteData,
  TranscriptSegment,
} from "@/lib/data/project-details"
import type { ProjectNoteWithAuthor, AudioData } from "@/lib/actions/notes"
import type { NoteType, NoteStatus } from "@/lib/supabase/types"

/**
 * Convert Supabase NoteType to UI NoteType
 */
function toUINoteType(noteType: NoteType): UINoteType {
  return noteType as UINoteType
}

/**
 * Convert Supabase NoteStatus to UI NoteStatus
 */
function toUINoteStatus(noteStatus: NoteStatus): UINoteStatus {
  return noteStatus as UINoteStatus
}

/**
 * Convert Supabase audio_data JSON to UI AudioNoteData
 */
function toUIAudioData(audioData: Record<string, unknown> | null): AudioNoteData | undefined {
  if (!audioData) return undefined

  const data = audioData as AudioData & {
    fileName?: string
    aiSummary?: string
    keyPoints?: string[]
    insights?: string[]
    transcript?: TranscriptSegment[]
  }

  return {
    duration: data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, "0")}` : "0:00",
    fileName: data.fileName || "Audio recording",
    aiSummary: data.aiSummary || data.transcription || "",
    keyPoints: data.keyPoints || [],
    insights: data.insights || [],
    transcript: data.transcript || [],
  }
}

/**
 * Convert Supabase ProjectNote to UI ProjectNote format
 */
export function toUIProjectNote(note: ProjectNoteWithAuthor): UIProjectNote {
  const author: UIUser = note.author
    ? {
        id: note.author.id,
        name: note.author.full_name || note.author.email.split("@")[0],
        avatarUrl: note.author.avatar_url || undefined,
      }
    : {
        id: note.added_by_id,
        name: "Unknown",
      }

  return {
    id: note.id,
    title: note.title,
    content: note.content || undefined,
    noteType: toUINoteType(note.note_type),
    status: toUINoteStatus(note.status),
    addedDate: new Date(note.created_at),
    addedBy: author,
    audioData: toUIAudioData(note.audio_data as Record<string, unknown> | null),
  }
}

/**
 * Convert array of Supabase notes to UI format
 */
export function toUIProjectNotes(notes: ProjectNoteWithAuthor[]): UIProjectNote[] {
  return notes.map(toUIProjectNote)
}
