"use client"

import { useEffect, useMemo, useState } from "react"
import { Paperclip } from "@phosphor-icons/react/dist/ssr/Paperclip"
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple"
import { X } from "@phosphor-icons/react/dist/ssr/X"

import type { ProjectFile, QuickLink, User } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { QuickCreateModalLayout } from "@/components/QuickCreateModalLayout"
import { ProjectDescriptionEditorLazy as ProjectDescriptionEditor } from "@/components/project-wizard/ProjectDescriptionEditorLazy"
import { UploadAssetFilesModal } from "@/components/projects/UploadAssetFilesModal"
import { createLinkAsset, uploadFile } from "@/lib/actions/files"

type AddFileModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    currentUser: User
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

export function AddFileModal({ open, onOpenChange, projectId, currentUser, onCreate }: AddFileModalProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState<string | undefined>(undefined)
    const [link, setLink] = useState("")
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const [isExpanded, setIsExpanded] = useState(false)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return

        setTitle("")
        setDescription(undefined)
        setLink("")
        setPendingFiles([])
        setIsUploadModalOpen(false)
        setIsExpanded(false)
        setIsSubmitting(false)
        setSubmitError(null)
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
        onOpenChange(false)
    }

    const buildQuickLinkFromFile = (file: File, idPrefix: string): QuickLink => {
        const name = file.name
        const ext = name.includes(".") ? name.split(".").pop() || "" : ""
        return {
            id: idPrefix,
            name,
            type: toQuickLinkType(ext),
            sizeMB: +(file.size / (1024 * 1024)).toFixed(1),
            url: "#",
        }
    }

    const canSubmit = Boolean(link.trim() || pendingFiles.length > 0) && !isSubmitting

    const handleCreateAsset = async () => {
        if (!canSubmit || isSubmitting) return

        setIsSubmitting(true)
        setSubmitError(null)

        const trimmedLink = link.trim()
        const hasLink = Boolean(trimmedLink)

        try {
            if (hasLink) {
                // Create a link asset using the server action
                const result = await createLinkAsset(projectId, {
                    name: title || trimmedLink,
                    url: trimmedLink,
                    description: description || undefined,
                })

                if (result.error) {
                    setSubmitError(result.error)
                    setIsSubmitting(false)
                    return
                }

                // Also upload any attached files
                for (const file of pendingFiles) {
                    const formData = new FormData()
                    formData.append("file", file)
                    await uploadFile(projectId, formData, {
                        name: file.name,
                        description: undefined,
                    })
                }
            } else {
                // Upload files
                if (!pendingFiles.length) {
                    setIsSubmitting(false)
                    return
                }

                for (let i = 0; i < pendingFiles.length; i++) {
                    const file = pendingFiles[i]
                    const formData = new FormData()
                    formData.append("file", file)
                    const result = await uploadFile(projectId, formData, {
                        name: i === 0 && title ? title : file.name,
                        description: i === 0 ? description || undefined : undefined,
                    })

                    if (result.error) {
                        setSubmitError(result.error)
                        setIsSubmitting(false)
                        return
                    }
                }
            }

            // Success - real-time subscription will update the list
            onCreate([])
            onOpenChange(false)
        } catch (err) {
            setSubmitError("An unexpected error occurred")
            setIsSubmitting(false)
        }
    }

    const handleFilesSelected = (files: File[]) => {
        if (!files.length) return
        setPendingFiles((prev) => [...prev, ...files])
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
                    />
                </div>

                <div className="mt-3 w-full">
                    {submitError && (
                        <p className="text-sm text-destructive mb-2">{submitError}</p>
                    )}
                    {attachmentSummaries.length > 0 ? (
                        <div className="space-y-2">
                            {attachmentSummaries.map((s) => (
                                <div
                                    key={s.name}
                                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                                        <div className="truncate">{s.name}</div>
                                    </div>
                                    <div className="text-muted-foreground text-xs">{s.sizeMB.toFixed(1)} MB</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No files attached yet.</p>
                    )}
                </div>

                <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground">
                            <Paperclip className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            <UploadSimple className="h-4 w-4" />
                            Upload files
                        </Button>
                        <Button size="sm" onClick={handleCreateAsset} disabled={!canSubmit}>
                            {isSubmitting ? "Creating..." : "Create asset"}
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
