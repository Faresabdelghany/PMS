import { memo, useCallback, useRef } from "react"
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple"
import Image from "next/image"

import type { QuickLink } from "@/lib/data/project-details"
import { getFileUrl } from "@/lib/actions/files"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FileLinkRowProps = {
  file: QuickLink
  className?: string
}

export function getFileIcon(type: QuickLink["type"]) {
  switch (type) {
    case "pdf":
      return { src: "/pdf.png", alt: "PDF" }
    case "zip":
      return { src: "/zip.png", alt: "ZIP" }
    case "fig":
      return { src: "/figma.png", alt: "Figma" }
    default:
      return { src: "/pdf.png", alt: "File" }
  }
}

export const FileLinkRow = memo(function FileLinkRow({ file, className }: FileLinkRowProps) {
  const icon = getFileIcon(file.type)
  const fetchingRef = useRef(false)

  const handleDownload = useCallback(async () => {
    // No storage path — use stored url directly (link asset)
    if (!file.storagePath) {
      window.open(file.url, "_blank", "noopener,noreferrer")
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
  }, [file.url, file.storagePath, file.type])

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 rounded-lg flex items-center justify-center">
          <Image
            src={icon.src}
            alt={icon.alt}
            width={36}
            height={36}
            className="rounded"
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
          <div className="text-sm text-muted-foreground">{file.sizeMB.toFixed(1)} MB</div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl"
        aria-label={`Download ${file.name}`}
        onClick={handleDownload}
      >
        <DownloadSimple className="h-4 w-4" />
      </Button>
    </div>
  )
})
