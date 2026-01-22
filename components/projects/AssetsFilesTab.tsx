"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type { ProjectFile, User } from "@/lib/data/project-details"
import { RecentFileCard } from "@/components/projects/RecentFileCard"
import { FilesTable } from "@/components/projects/FilesTable"
import { AddFileModal } from "@/components/projects/AddFileModal"
import { deleteFile } from "@/lib/actions/files"
import { useFilesRealtime } from "@/hooks/use-realtime"
import { toQuickLinkType, bytesToMB } from "@/lib/utils/file-converters"

type AssetsFilesTabProps = {
    files: ProjectFile[]
    currentUser?: User
    projectId: string
}

const defaultUser: User = {
    id: "unknown",
    name: "Unknown User",
}

export function AssetsFilesTab({ files, currentUser = defaultUser, projectId }: AssetsFilesTabProps) {
    const [items, setItems] = useState<ProjectFile[]>(files)
    const [isAddOpen, setIsAddOpen] = useState(false)

    useEffect(() => {
        setItems(files)
    }, [files])

    // Subscribe to real-time file changes
    useFilesRealtime(projectId, {
        onInsert: (newFile) => {
            setItems((prev) => {
                if (prev.some((f) => f.id === newFile.id)) return prev

                const uiFile: ProjectFile = {
                    id: newFile.id,
                    name: newFile.name,
                    type: toQuickLinkType(newFile.file_type),
                    sizeMB: bytesToMB(newFile.size_bytes),
                    addedDate: new Date(newFile.created_at),
                    addedBy: currentUser,
                    url: newFile.url,
                }
                return [uiFile, ...prev]
            })
        },
        onUpdate: (updatedFile) => {
            setItems((prev) =>
                prev.map((file) =>
                    file.id === updatedFile.id
                        ? {
                              ...file,
                              name: updatedFile.name,
                              type: toQuickLinkType(updatedFile.file_type),
                              url: updatedFile.url,
                          }
                        : file
                )
            )
        },
        onDelete: (deletedFile) => {
            setItems((prev) => prev.filter((file) => file.id !== deletedFile.id))
        },
    })

    const recentFiles = useMemo(() => items.slice(0, 6), [items])

    const handleAddFile = () => {
        setIsAddOpen(true)
    }

    const handleCreateFiles = (newFiles: ProjectFile[]) => {
        // Optimistic update - add files to local state
        setItems((prev) => [...newFiles, ...prev])
        setIsAddOpen(false)
        // Real-time subscription will handle syncing with server data
    }

    const handleEditFile = (fileId: string) => {
        // TODO: Implement edit modal
        console.log("Edit file:", fileId)
    }

    const handleDeleteFile = async (fileId: string) => {
        // Optimistic update
        setItems((prev) => prev.filter((f) => f.id !== fileId))

        const result = await deleteFile(fileId)

        if (result.error) {
            toast.error(`Failed to delete file: ${result.error}`)
            // Revert optimistic update
            setItems(files)
        } else {
            toast.success("File deleted successfully")
            // Real-time subscription will handle syncing with server data
        }
    }

    return (
        <div className="space-y-8">
            <section>
                <h2 className="mb-4 text-sm font-semibold text-accent-foreground">Recent Files</h2>
                {recentFiles.length > 0 ? (
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
                ) : (
                    <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
                )}
            </section>

            <section>
                <h2 className="mb-4 text-sm font-semibold text-accent-foreground">All files</h2>
                <FilesTable
                    files={items}
                    onAddFile={handleAddFile}
                    onDeleteFile={handleDeleteFile}
                />
            </section>

            <AddFileModal
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                currentUser={currentUser}
                projectId={projectId}
                onCreate={handleCreateFiles}
            />
        </div>
    )
}
