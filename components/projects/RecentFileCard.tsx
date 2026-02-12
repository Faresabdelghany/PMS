import { useCallback, useRef } from "react"
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut"
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"

import type { ProjectFile } from "@/lib/data/project-details"
import { getFileUrl } from "@/lib/actions/files"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileTypeIcon } from "@/components/projects/FileTypeIcon"

type RecentFileCardProps = {
    file: ProjectFile
    onEdit?: (fileId: string) => void
    onDelete?: (fileId: string) => void
}

export function RecentFileCard({ file, onEdit, onDelete }: RecentFileCardProps) {
    const sizeLabel = file.isLinkAsset || file.sizeMB === 0 ? "Link" : `${file.sizeMB.toFixed(1)} MB`
    const fetchingRef = useRef(false)

    const handleOpenFile = useCallback(async () => {
        // Link assets have no storage path — use url directly
        if (file.isLinkAsset || !file.storagePath) {
            if (file.url) {
                window.open(file.url, "_blank", "noopener,noreferrer")
            }
            return
        }

        if (fetchingRef.current) return
        fetchingRef.current = true

        try {
            const result = await getFileUrl(file.storagePath, file.type)
            if (result.data) {
                window.open(result.data, "_blank", "noopener,noreferrer")
            } else {
                window.open(file.url, "_blank", "noopener,noreferrer")
            }
        } finally {
            fetchingRef.current = false
        }
    }, [file.url, file.storagePath, file.type, file.isLinkAsset])

    return (
        <div
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleOpenFile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleOpenFile()
                }
            }}
        >
            <div className="flex items-start gap-2 min-w-0">
                <FileTypeIcon type={file.type} wrapperSize={44} iconSize={40} background={false} />
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
                    <div className="text-sm text-muted-foreground">{sizeLabel}</div>
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={`Open actions for ${file.name}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DotsThree className="h-4 w-4" weight="bold" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleOpenFile}>
                        {file.isLinkAsset ? (
                            <>
                                <ArrowSquareOut className="mr-2 h-4 w-4" />
                                Open link
                            </>
                        ) : (
                            <>
                                <DownloadSimple className="mr-2 h-4 w-4" />
                                Download
                            </>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit?.(file.id)}>
                        <PencilSimple className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete?.(file.id)} className="text-destructive focus:text-destructive">
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
