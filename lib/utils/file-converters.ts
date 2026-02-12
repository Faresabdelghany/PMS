/**
 * File converters to transform Supabase file types to UI types
 */

import type { ProjectFile as UIProjectFile, User as UIUser, QuickLink } from "@/lib/data/project-details"
import type { ProjectFileWithUploader } from "@/lib/actions/files"
import type { FileType } from "@/lib/supabase/types"

/**
 * Convert Supabase FileType to UI QuickLink type
 */
export function toQuickLinkType(fileType: FileType): QuickLink["type"] {
  switch (fileType) {
    case "pdf":
      return "pdf"
    case "zip":
      return "zip"
    case "fig":
      return "fig"
    case "doc":
      return "doc"
    case "image":
    case "video":
    case "audio":
    case "file":
    default:
      return "file"
  }
}

/**
 * Convert bytes to megabytes
 */
export function bytesToMB(bytes: number): number {
  return +(bytes / (1024 * 1024)).toFixed(2)
}

/**
 * Convert Supabase ProjectFile to UI ProjectFile format
 */
export function toUIProjectFile(file: ProjectFileWithUploader): UIProjectFile {
  const uploader: UIUser = file.uploader
    ? {
        id: file.uploader.id,
        name: file.uploader.full_name || file.uploader.email.split("@")[0],
        avatarUrl: file.uploader.avatar_url || undefined,
      }
    : {
        id: file.added_by_id,
        name: "Unknown",
      }

  const isLinkAsset = !file.storage_path || file.storage_path === ""

  return {
    id: file.id,
    name: file.name,
    type: toQuickLinkType(file.file_type),
    sizeMB: bytesToMB(file.size_bytes),
    url: file.url,
    storagePath: file.storage_path || undefined,
    addedBy: uploader,
    addedDate: new Date(file.created_at),
    description: file.description || undefined,
    isLinkAsset,
    attachments: undefined, // Attachments not currently supported in DB schema
  }
}

/**
 * Convert array of Supabase files to UI format
 */
export function toUIProjectFiles(files: ProjectFileWithUploader[]): UIProjectFile[] {
  return files.map(toUIProjectFile)
}

/**
 * Convert UI User to a form compatible with server actions
 */
export function fromUIUser(user: UIUser): {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
} {
  return {
    id: user.id,
    full_name: user.name,
    email: user.id, // In UI, we don't always have email - use ID as fallback
    avatar_url: user.avatarUrl || null,
  }
}
