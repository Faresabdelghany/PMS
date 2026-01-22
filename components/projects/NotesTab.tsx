"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"

import type { ProjectNote, User } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { NoteCard } from "@/components/projects/NoteCard"
import { NotesTable } from "@/components/projects/NotesTable"
import { CreateNoteModal } from "@/components/projects/CreateNoteModal"
import { UploadAudioModal } from "@/components/projects/UploadAudioModal"
import { NotePreviewModal } from "@/components/projects/NotePreviewModal"
import { createNote, deleteNote } from "@/lib/actions/notes"

type NotesTabProps = {
    notes: ProjectNote[]
    projectId: string
    currentUser?: User
}

const defaultUser: User = {
    id: "unknown",
    name: "Unknown User",
    avatarUrl: undefined,
}

export function NotesTab({ notes, projectId, currentUser = defaultUser }: NotesTabProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [localNotes, setLocalNotes] = useState<ProjectNote[]>(notes)
    const recentNotes = localNotes.slice(0, 8)

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
    const [selectedNote, setSelectedNote] = useState<ProjectNote | null>(null)

    // Sync local notes with props
    useState(() => {
        setLocalNotes(notes)
    })

    const handleAddNote = () => {
        setIsCreateModalOpen(true)
    }

    const handleCreateNote = async (title: string, content: string) => {
        const result = await createNote(projectId, {
            title,
            content,
            note_type: "general",
        })

        if (result.error) {
            toast.error(`Failed to create note: ${result.error}`)
            return
        }

        if (result.data) {
            // Optimistic update with converted note
            const newNote: ProjectNote = {
                id: result.data.id,
                title: result.data.title,
                content: result.data.content || undefined,
                noteType: result.data.note_type,
                status: result.data.status,
                addedDate: new Date(result.data.created_at),
                addedBy: currentUser,
            }
            setLocalNotes((prev) => [newNote, ...prev])
            toast.success("Note created successfully")
            setIsCreateModalOpen(false)
            startTransition(() => {
                router.refresh()
            })
        }
    }

    const handleUploadAudio = () => {
        setIsUploadModalOpen(true)
    }

    const handleFileSelect = async (fileName: string) => {
        // For audio notes, we'd need to actually upload the file
        // For now, create a note with audio type
        const result = await createNote(projectId, {
            title: fileName,
            note_type: "audio",
            audio_data: {
                duration: 0,
                transcription: "Processing audio transcription...",
            },
        })

        // Close both modals
        setIsUploadModalOpen(false)
        setIsCreateModalOpen(false)

        if (result.error) {
            toast.error(`Failed to process audio: ${result.error}`)
            return
        }

        toast.success(`Audio note created from "${fileName}"`)
        startTransition(() => {
            router.refresh()
        })
    }

    const handleNoteClick = (note: ProjectNote) => {
        setSelectedNote(note)
        setIsPreviewModalOpen(true)
    }

    const handleEditNote = (noteId: string) => {
        // Find the note and open in edit mode
        const note = localNotes.find((n) => n.id === noteId)
        if (note) {
            setSelectedNote(note)
            // TODO: Open edit modal
            toast.info("Edit functionality coming soon")
        }
    }

    const handleDeleteNote = async (noteId: string) => {
        // Optimistic update
        setLocalNotes((prev) => prev.filter((n) => n.id !== noteId))

        const result = await deleteNote(noteId)

        if (result.error) {
            toast.error(`Failed to delete note: ${result.error}`)
            // Revert optimistic update
            setLocalNotes(notes)
            return
        }

        toast.success("Note deleted successfully")
        startTransition(() => {
            router.refresh()
        })
    }

    return (
        <div className="space-y-8">
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-accent-foreground">
                        Recent notes
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAddNote}
                    >
                        <Plus className="h-4 w-4" />
                        Add notes
                    </Button>
                </div>

                {recentNotes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {recentNotes.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onEdit={handleEditNote}
                                onDelete={handleDeleteNote}
                                onClick={() => handleNoteClick(note)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No notes yet. Click "Add notes" to create one.</p>
                )}
            </section>

            <section>
                <h2 className="mb-4 text-sm font-semibold text-accent-foreground">
                    All notes
                </h2>
                <NotesTable
                    notes={localNotes}
                    onAddNote={handleAddNote}
                    onEditNote={handleEditNote}
                    onDeleteNote={handleDeleteNote}
                    onNoteClick={handleNoteClick}
                />
            </section>

            <CreateNoteModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                currentUser={currentUser}
                onCreateNote={handleCreateNote}
                onUploadAudio={handleUploadAudio}
            />

            <UploadAudioModal
                open={isUploadModalOpen}
                onOpenChange={setIsUploadModalOpen}
                onFileSelect={handleFileSelect}
            />

            <NotePreviewModal
                open={isPreviewModalOpen}
                onOpenChange={setIsPreviewModalOpen}
                note={selectedNote}
            />
        </div>
    )
}
