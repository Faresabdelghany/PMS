"use client"

import { useEffect, useMemo, useState } from "react"

import type { ProjectFile, User } from "@/lib/data/project-details"
import { RecentFileCard } from "@/components/projects/RecentFileCard"
import { FilesTable } from "@/components/projects/FilesTable"
import { AddFileModal } from "@/components/projects/AddFileModal"
import { EditFileModal } from "@/components/projects/EditFileModal"
import { deleteFile } from "@/lib/actions/files"

type AssetsFilesTabProps = {
    files: ProjectFile[]
    currentUser?: User
}

const defaultUser: User = {
    id: "jason-d",
    name: "JasonD",
}

export function AssetsFilesTab({ files, currentUser = defaultUser }: AssetsFilesTabProps) {
    const [items, setItems] = useState<ProjectFile[]>(files)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingFile, setEditingFile] = useState<ProjectFile | null>(null)
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        setItems(files)
    }, [files])

    const recentFiles = useMemo(() => items.slice(0, 6), [items])

    const handleAddFile = () => {
        setIsAddOpen(true)
    }

    const handleCreateFiles = (newFiles: ProjectFile[]) => {
        setItems((prev) => [...newFiles, ...prev])
        setIsAddOpen(false)
    }

    const handleEditFile = (fileId: string) => {
        const file = items.find((f) => f.id === fileId)
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

        // Remove the file from local state
        setItems((prev) => prev.filter((file) => file.id !== fileId))
    }

    const handleFilesRefresh = () => {
        // Will be replaced with real-time updates in Task 4
        // For now, the edit modal just updates local state optimistically
    }

    const handleEditSuccess = () => {
        // Update local state with the edited file name
        if (editingFile) {
            // Refetch would be ideal, but for now we just close the modal
            // Real-time subscription in Task 4 will handle this properly
        }
        handleFilesRefresh()
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
                    files={items}
                    onAddFile={handleAddFile}
                    onEditFile={handleEditFile}
                    onDeleteFile={handleDeleteFile}
                    isDeleting={isDeleting}
                />
            </section>

            <AddFileModal
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
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
