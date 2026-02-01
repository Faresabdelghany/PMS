"use client"

import { useEffect, useState, useCallback } from "react"
import { Paperclip, Microphone, UploadSimple, Tag, X } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"

import type { User, ProjectNote } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { QuickCreateModalLayout } from "@/components/QuickCreateModalLayout"
import { ProjectDescriptionEditorLazy as ProjectDescriptionEditor } from "@/components/project-wizard/ProjectDescriptionEditorLazy"
import { enhanceNoteContent } from "@/lib/actions/ai"

type CreateNoteModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentUser: User
    onCreateNote: (title: string, content: string) => void
    onUpdateNote?: (noteId: string, title: string, content: string) => void
    onUploadAudio: () => void
    editingNote?: ProjectNote | null
    projectName?: string
}

export function CreateNoteModal({
    open,
    onOpenChange,
    currentUser,
    onCreateNote,
    onUpdateNote,
    onUploadAudio,
    editingNote,
    projectName,
}: CreateNoteModalProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState<string | undefined>(undefined)
    const [isExpanded, setIsExpanded] = useState(false)

    const isEditing = !!editingNote

    // Custom AI handler for note enhancement
    const handleNoteAIGenerate = useCallback(async (currentContent: string): Promise<string | null> => {
        if (!currentContent.trim()) {
            toast.error("Please write some content first")
            return null
        }

        const result = await enhanceNoteContent(currentContent, {
            title: title || undefined,
            projectName: projectName,
            noteType: "general",
        })

        if (result.error) {
            toast.error(result.error)
            return null
        }

        if (result.data) {
            toast.success("Note enhanced with AI")
            return result.data
        }

        return null
    }, [title, projectName])

    useEffect(() => {
        if (!open) return

        if (editingNote) {
            setTitle(editingNote.title)
            setDescription(editingNote.content || undefined)
        } else {
            setTitle("")
            setDescription(undefined)
        }
        setIsExpanded(false)
    }, [open, editingNote])

    const handleClose = () => {
        onOpenChange(false)
    }

    const handleSubmit = () => {
        if (isEditing && editingNote && onUpdateNote) {
            onUpdateNote(editingNote.id, title, description ?? "")
        } else {
            onCreateNote(title, description ?? "")
        }
        setTitle("")
        setDescription(undefined)
        onOpenChange(false)
    }

    const handleUploadClick = () => {
        onUploadAudio()
    }

    return (
        <QuickCreateModalLayout
            open={open}
            onClose={handleClose}
            isDescriptionExpanded={isExpanded}
            onSubmitShortcut={handleSubmit}
        >
            {/* Title row with close button */}
            <div className="flex items-center justify-between gap-2 w-full shrink-0 mt-1">
                <div className="flex flex-col gap-2 flex-1">
                    <div className="flex gap-1 h-10 items-center w-full">
                        <input
                            id="note-create-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Note title"
                            className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
                            autoComplete="off"
                        />
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
                    onClick={handleClose}
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </Button>
            </div>

            {/* Description */}
            <ProjectDescriptionEditor
                value={description}
                onChange={setDescription}
                onExpandChange={setIsExpanded}
                placeholder="Write the details of this note..."
                showTemplates={false}
                onAIGenerate={handleNoteAIGenerate}
            />

            {/* Note context (author + tag) */}
            <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50">
                    <Avatar className="h-5 w-5">
                        <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                        <AvatarFallback className="text-[10px]">
                            {currentUser.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{currentUser.name}</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">General note</span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                        <Microphone className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing && (
                        <Button variant="secondary" size="sm" onClick={handleUploadClick}>
                            <UploadSimple className="h-4 w-4" />
                            Upload audio file
                        </Button>
                    )}
                    <Button size="sm" onClick={handleSubmit}>
                        {isEditing ? "Save Note" : "Create Note"}
                    </Button>
                </div>
            </div>
        </QuickCreateModalLayout>
    )
}
