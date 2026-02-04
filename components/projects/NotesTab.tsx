"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Plus } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"

import type { ProjectNote, User } from "@/lib/data/project-details"
import { createNote, deleteNote, updateNote } from "@/lib/actions/notes"
import { useNotesRealtime } from "@/hooks/use-realtime"
import { Button } from "@/components/ui/button"
import { NoteCard } from "@/components/projects/NoteCard"
import { NotesTable } from "@/components/projects/NotesTable"

// Lazy load modals - only loaded when opened
const CreateNoteModal = dynamic(() => import("@/components/projects/CreateNoteModal").then(m => m.CreateNoteModal), { ssr: false })
const UploadAudioModal = dynamic(() => import("@/components/projects/UploadAudioModal").then(m => m.UploadAudioModal), { ssr: false })
const NotePreviewModal = dynamic(() => import("@/components/projects/NotePreviewModal").then(m => m.NotePreviewModal), { ssr: false })

type NotesTabProps = {
    projectId: string
    projectName?: string
    notes: ProjectNote[]
    currentUser?: User
    onRefresh?: () => void
}

const defaultUser: User = {
    id: "jason-d",
    name: "JasonD",
    avatarUrl: undefined,
}

export function NotesTab({ projectId, projectName, notes, currentUser = defaultUser, onRefresh }: NotesTabProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const recentNotes = notes.slice(0, 8)

    // Real-time subscription for notes - use startTransition for non-blocking updates
    const handleRealtimeChange = useCallback(() => {
        startTransition(() => {
            if (onRefresh) {
                onRefresh()
            } else {
                router.refresh()
            }
        })
    }, [onRefresh, router, startTransition])

    useNotesRealtime(projectId, {
        onInsert: handleRealtimeChange,
        onUpdate: handleRealtimeChange,
        onDelete: handleRealtimeChange,
    })

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
    const [selectedNote, setSelectedNote] = useState<ProjectNote | null>(null)
    const [editingNote, setEditingNote] = useState<ProjectNote | null>(null)

    const handleAddNote = () => {
        setEditingNote(null)
        setIsCreateModalOpen(true)
    }

    const handleCreateNote = async (title: string, content: string) => {
        startTransition(async () => {
            const result = await createNote(projectId, {
                title,
                content,
                note_type: "general",
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success("Note created")
            setIsCreateModalOpen(false)

            // Refresh the page data
            if (onRefresh) {
                onRefresh()
            } else {
                router.refresh()
            }
        })
    }

    const handleUploadAudio = () => {
        setIsUploadModalOpen(true)
    }

    const handleFileSelect = (fileName: string) => {
        console.log("File selected:", fileName)

        // Close both modals
        setIsUploadModalOpen(false)
        setIsCreateModalOpen(false)

        // Simulate processing the uploaded file into a note
        toast(`Processing "${fileName}" into a note...`)

        setTimeout(() => {
            toast.success(`Note created from "${fileName}"`)
        }, 5000)
    }

    const handleNoteClick = (note: ProjectNote) => {
        setSelectedNote(note)
        setIsPreviewModalOpen(true)
    }

    const handleEditNote = (noteId: string) => {
        const noteToEdit = notes.find(n => n.id === noteId)
        if (noteToEdit) {
            setEditingNote(noteToEdit)
            setIsCreateModalOpen(true)
        }
    }

    const handleUpdateNote = async (noteId: string, title: string, content: string) => {
        startTransition(async () => {
            const result = await updateNote(noteId, {
                title,
                content,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success("Note updated")
            setIsCreateModalOpen(false)
            setEditingNote(null)

            // Refresh the page data
            if (onRefresh) {
                onRefresh()
            } else {
                router.refresh()
            }
        })
    }

    const handleDeleteNote = async (noteId: string) => {
        startTransition(async () => {
            const result = await deleteNote(noteId)

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success("Note deleted")

            // Refresh the page data
            if (onRefresh) {
                onRefresh()
            } else {
                router.refresh()
            }
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
            </section>

            <section>
                <h2 className="mb-4 text-sm font-semibold text-accent-foreground">
                    All notes
                </h2>
                <NotesTable
                    notes={notes}
                    onAddNote={handleAddNote}
                    onEditNote={handleEditNote}
                    onDeleteNote={handleDeleteNote}
                    onNoteClick={handleNoteClick}
                />
            </section>

            <CreateNoteModal
                open={isCreateModalOpen}
                onOpenChange={(open) => {
                    setIsCreateModalOpen(open)
                    if (!open) setEditingNote(null)
                }}
                currentUser={currentUser}
                onCreateNote={handleCreateNote}
                onUpdateNote={handleUpdateNote}
                onUploadAudio={handleUploadAudio}
                editingNote={editingNote}
                projectName={projectName}
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
