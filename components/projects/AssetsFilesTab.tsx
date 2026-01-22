"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { ProjectFile, User } from "@/lib/data/project-details"
import { RecentFileCard } from "@/components/projects/RecentFileCard"
import { FilesTable } from "@/components/projects/FilesTable"
import { AddFileModal } from "@/components/projects/AddFileModal"
import { deleteFile } from "@/lib/actions/files"

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
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [items, setItems] = useState<ProjectFile[]>(files)
    const [isAddOpen, setIsAddOpen] = useState(false)

    useEffect(() => {
        setItems(files)
    }, [files])

    const recentFiles = useMemo(() => items.slice(0, 6), [items])

    const handleAddFile = () => {
        setIsAddOpen(true)
    }

    const handleCreateFiles = (newFiles: ProjectFile[]) => {
        // Optimistic update - add files to local state
        setItems((prev) => [...newFiles, ...prev])
        setIsAddOpen(false)
        // Refresh to get actual server data
        startTransition(() => {
            router.refresh()
        })
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
            startTransition(() => {
                router.refresh()
            })
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
