"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Paperclip, Upload, X } from "lucide-react"
import { toast } from "sonner"

import type { ProjectFile, QuickLink, User } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { QuickCreateModalLayout } from "@/components/QuickCreateModalLayout"
import { ProjectDescriptionEditor } from "@/components/project-wizard/ProjectDescriptionEditor"
import { UploadAssetFilesModal } from "@/components/projects/UploadAssetFilesModal"
import { uploadFile, createLinkAsset } from "@/lib/actions/files"
import { toUIProjectFile } from "@/lib/utils/file-converters"

type AddFileModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentUser: User
    projectId: string
    onCreate: (files: ProjectFile[]) => void
}

function toQuickLinkType(ext: string): QuickLink["type"] {
    const e = ext.toLowerCase()
    if (e === "pdf") return "pdf"
    if (e === "zip") return "zip"
    if (e === "fig" || e === "figma") return "fig"
    if (e === "doc" || e === "docx") return "doc"
    return "file"
}

export function AddFileModal({ open, onOpenChange, currentUser, projectId, onCreate }: AddFileModalProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState<string | undefined>(undefined)
    const [link, setLink] = useState("")
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const [isExpanded, setIsExpanded] = useState(false)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string>("")

    useEffect(() => {
        if (!open) return

        setTitle("")
        setDescription(undefined)
        setLink("")
        setPendingFiles([])
        setIsUploadModalOpen(false)
        setIsExpanded(false)
        setIsUploading(false)
        setUploadProgress("")
    }, [open])

    const attachmentSummaries = useMemo(
        () =>
            pendingFiles.map((f) => ({
                name: f.name,
                sizeMB: +(f.size / (1024 * 1024)).toFixed(1),
            })),
        [pendingFiles],
    )

    const handleClose = () => {
        if (isUploading) return // Prevent closing during upload
        onOpenChange(false)
    }

    const canSubmit = Boolean(link.trim() || pendingFiles.length > 0) && !isUploading

    const handleCreateAsset = async () => {
        if (!canSubmit) return

        setIsUploading(true)
        const trimmedLink = link.trim()
        const hasLink = Boolean(trimmedLink)
        const createdFiles: ProjectFile[] = []

        try {
            if (hasLink) {
                // Create link asset
                setUploadProgress("Creating link asset...")
                const result = await createLinkAsset(projectId, {
                    name: title || trimmedLink,
                    url: trimmedLink,
                    description: description,
                })

                if (result.error) {
                    toast.error(`Failed to create link: ${result.error}`)
                    setIsUploading(false)
                    return
                }

                if (result.data) {
                    // Convert to UI format with current user info
                    const uiFile = toUIProjectFile({
                        ...result.data,
                        uploader: {
                            id: currentUser.id,
                            full_name: currentUser.name,
                            email: currentUser.id,
                            avatar_url: currentUser.avatarUrl || null,
                        },
                    })
                    createdFiles.push(uiFile)
                }

                // Also upload any attached files
                for (let i = 0; i < pendingFiles.length; i++) {
                    const file = pendingFiles[i]
                    setUploadProgress(`Uploading attachment ${i + 1}/${pendingFiles.length}...`)

                    const formData = new FormData()
                    formData.append("file", file)

                    const uploadResult = await uploadFile(projectId, formData, {
                        name: file.name,
                        description: `Attachment for: ${title || trimmedLink}`,
                    })

                    if (uploadResult.error) {
                        toast.error(`Failed to upload ${file.name}: ${uploadResult.error}`)
                        continue
                    }

                    if (uploadResult.data) {
                        const uiFile = toUIProjectFile({
                            ...uploadResult.data,
                            uploader: {
                                id: currentUser.id,
                                full_name: currentUser.name,
                                email: currentUser.id,
                                avatar_url: currentUser.avatarUrl || null,
                            },
                        })
                        createdFiles.push(uiFile)
                    }
                }
            } else {
                // Upload files directly
                for (let i = 0; i < pendingFiles.length; i++) {
                    const file = pendingFiles[i]
                    setUploadProgress(`Uploading ${i + 1}/${pendingFiles.length}: ${file.name}`)

                    const formData = new FormData()
                    formData.append("file", file)

                    const uploadResult = await uploadFile(projectId, formData, {
                        name: i === 0 && title ? title : file.name,
                        description: i === 0 ? description : undefined,
                    })

                    if (uploadResult.error) {
                        toast.error(`Failed to upload ${file.name}: ${uploadResult.error}`)
                        continue
                    }

                    if (uploadResult.data) {
                        const uiFile = toUIProjectFile({
                            ...uploadResult.data,
                            uploader: {
                                id: currentUser.id,
                                full_name: currentUser.name,
                                email: currentUser.id,
                                avatar_url: currentUser.avatarUrl || null,
                            },
                        })
                        createdFiles.push(uiFile)
                    }
                }
            }

            if (createdFiles.length > 0) {
                toast.success(
                    createdFiles.length === 1
                        ? "File uploaded successfully"
                        : `${createdFiles.length} files uploaded successfully`
                )
                onCreate(createdFiles)
                onOpenChange(false)
            }
        } catch (error) {
            toast.error("An error occurred while uploading")
            console.error("Upload error:", error)
        } finally {
            setIsUploading(false)
            setUploadProgress("")
        }
    }

    const handleFilesSelected = (files: File[]) => {
        if (!files.length) return
        setPendingFiles((prev) => [...prev, ...files])
    }

    const handleRemoveFile = (index: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== index))
    }

    return (
        <>
            <QuickCreateModalLayout
                open={open}
                onClose={handleClose}
                isDescriptionExpanded={isExpanded}
                onSubmitShortcut={handleCreateAsset}
            >
                <div className="flex items-center justify-between gap-2 w-full shrink-0 mt-1">
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex gap-1 h-10 items-center w-full">
                            <input
                                id="asset-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Asset title"
                                className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
                                autoComplete="off"
                                disabled={isUploading}
                            />
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
                        onClick={handleClose}
                        disabled={isUploading}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>

                <ProjectDescriptionEditor
                    value={description}
                    onChange={setDescription}
                    onExpandChange={setIsExpanded}
                    placeholder="Describe this asset..."
                    showTemplates={false}
                />

                <div className="flex items-center gap-2 mt-2">
                    <input
                        id="asset-link"
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Paste a link (Figma, Drive, or any URL)"
                        className="w-full text-md leading-6 text-foreground placeholder:text-muted-foreground outline-none bg-transparent border-none p-0"
                        autoComplete="off"
                        disabled={isUploading}
                    />
                </div>

                <div className="mt-3 w-full">
                    {attachmentSummaries.length > 0 ? (
                        <div className="space-y-2">
                            {attachmentSummaries.map((s, index) => (
                                <div
                                    key={`${s.name}-${index}`}
                                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                                        <div className="truncate">{s.name}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs">{s.sizeMB.toFixed(1)} MB</span>
                                        {!isUploading && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleRemoveFile(index)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No files attached yet.</p>
                    )}
                </div>

                {isUploading && uploadProgress && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{uploadProgress}</span>
                    </div>
                )}

                <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground"
                            onClick={() => setIsUploadModalOpen(true)}
                            disabled={isUploading}
                        >
                            <Paperclip className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsUploadModalOpen(true)}
                            disabled={isUploading}
                        >
                            <Upload className="h-4 w-4" />
                            Upload files
                        </Button>
                        <Button size="sm" onClick={handleCreateAsset} disabled={!canSubmit}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Uploading...
                                </>
                            ) : (
                                "Create asset"
                            )}
                        </Button>
                    </div>
                </div>
            </QuickCreateModalLayout>

            <UploadAssetFilesModal
                open={isUploadModalOpen}
                onOpenChange={setIsUploadModalOpen}
                onFilesSelect={handleFilesSelected}
            />
        </>
    )
}

function detectTypeFromUrl(url: string): QuickLink["type"] {
    try {
        const parsed = new URL(url)
        const host = parsed.hostname.toLowerCase()
        const pathname = parsed.pathname.toLowerCase()

        if (host.includes("figma.com") || pathname.endsWith(".fig")) return "fig"
        if (pathname.endsWith(".pdf")) return "pdf"
        if (pathname.endsWith(".zip")) return "zip"
        if (pathname.endsWith(".doc") || pathname.endsWith(".docx")) return "doc"

        const parts = pathname.split(".")
        const ext = parts.length > 1 ? parts.pop() || "" : ""
        return toQuickLinkType(ext)
    } catch {
        return "file"
    }
}
