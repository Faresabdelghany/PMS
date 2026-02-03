"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"

import type { ProjectFile, User } from "@/lib/data/project-details"
import { RecentFileCard } from "@/components/projects/RecentFileCard"
import { FilesTable } from "@/components/projects/FilesTable"
import { deleteFile } from "@/lib/actions/files"
import { useProjectFilesRealtime } from "@/hooks/use-project-files-realtime"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load modals - only loaded when opened
const AddFileModal = dynamic(() => import("@/components/projects/AddFileModal").then(m => m.AddFileModal), { ssr: false })
const EditFileModal = dynamic(() => import("@/components/projects/EditFileModal").then(m => m.EditFileModal), { ssr: false })

type AssetsFilesTabProps = {
    projectId: string
    currentUser?: User
}

const defaultUser: User = {
    id: "jason-d",
    name: "JasonD",
}

export function AssetsFilesTab({ projectId, currentUser = defaultUser }: AssetsFilesTabProps) {
    const { files, isLoading, error, refetch } = useProjectFilesRealtime(projectId)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingFile, setEditingFile] = useState<ProjectFile | null>(null)
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const recentFiles = useMemo(() => files.slice(0, 6), [files])

    const handleAddFile = () => {
        setIsAddOpen(true)
    }

    const handleCreateFiles = (_newFiles: ProjectFile[]) => {
        // Real-time subscription will automatically update the list
        setIsAddOpen(false)
    }

    const handleEditFile = (fileId: string) => {
        const file = files.find((f) => f.id === fileId)
        if (file) {
            setEditingFile(file)
            setEditModalOpen(true)
        }
    }

    const handleDeleteFile = async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) {
            return
        }

        setIsDeleting(true)
        const result = await deleteFile(fileId)
        setIsDeleting(false)

        if (result.error) {
            alert(`Failed to delete file: ${result.error}`)
            return
        }

        // Real-time subscription will automatically update the list
    }

    const handleEditSuccess = () => {
        // Real-time subscription will automatically update the list
        // Close the modal
        setEditModalOpen(false)
        setEditingFile(null)
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-8">
                <section>
                    <h2 className="mb-4 text-sm font-semibold text-accent-foreground">Recent Files</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                        ))}
                    </div>
                </section>
                <section>
                    <h2 className="mb-4 text-sm font-semibold text-accent-foreground">All files</h2>
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </section>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-md bg-destructive/10 p-4 text-destructive">
                Failed to load files: {error}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <section>
                <h2 className="mb-4 text-sm font-semibold text-accent-foreground">Recent Files</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {recentFiles.map((file) => (
                        <RecentFileCard
                            key={file.id}
                            file={file}
                            onEdit={handleEditFile}
                            onDelete={handleDeleteFile}
                        />
                    ))}
                </div>
            </section>

            <section>
                <h2 className="mb-4 text-sm font-semibold text-accent-foreground">All files</h2>
                <FilesTable
                    files={files}
                    onAddFile={handleAddFile}
                    onEditFile={handleEditFile}
                    onDeleteFile={handleDeleteFile}
                    isDeleting={isDeleting}
                />
            </section>

            <AddFileModal
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                projectId={projectId}
                currentUser={currentUser}
                onCreate={handleCreateFiles}
            />

            {editingFile && (
                <EditFileModal
                    file={editingFile}
                    open={editModalOpen}
                    onOpenChange={setEditModalOpen}
                    onSuccess={handleEditSuccess}
                />
            )}
        </div>
    )
}
