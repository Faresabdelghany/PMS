"use server"

import { revalidatePath } from "next/cache"
import type {
  ProjectFile,
  ProjectFileInsert,
  FileType,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth } from "@/lib/actions/auth-helpers"
import { getStoragePublicUrl, removeStorageFile } from "@/lib/supabase/storage-utils"


// Extended file type with uploader info
export type ProjectFileWithUploader = ProjectFile & {
  uploader?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

// File metadata for upload
export type FileMetadata = {
  name: string
  description?: string
  fileType?: FileType
}

// Allowed MIME types for file uploads (SEC-07)
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  // "image/svg+xml" — removed: SVGs can contain embedded <script> tags enabling stored XSS
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  // Misc
  // Note: application/octet-stream intentionally excluded — too permissive.
  // Figma files use the .fig extension; type is detected via getFileTypeFromExtension.
])

// Bucket configuration
const BUCKET_CONFIG: Record<string, { bucket: string; maxSize: number }> = {
  // Document types
  pdf: { bucket: "project-files", maxSize: 52428800 },
  doc: { bucket: "project-files", maxSize: 52428800 },
  zip: { bucket: "project-files", maxSize: 52428800 },
  file: { bucket: "project-files", maxSize: 52428800 },
  fig: { bucket: "project-files", maxSize: 52428800 },
  // Image types
  image: { bucket: "project-images", maxSize: 10485760 },
  // Media types
  video: { bucket: "project-media", maxSize: 104857600 },
  audio: { bucket: "project-media", maxSize: 104857600 },
}

// Determine file type from MIME type
function getFileTypeFromMime(mimeType: string): FileType {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType === "application/pdf") return "pdf"
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "doc"
  }
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  ) {
    return "zip"
  }
  return "file"
}

// Determine file type from file extension
function getFileTypeFromExtension(filename: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase() || ""

  switch (ext) {
    case "pdf":
      return "pdf"
    case "doc":
    case "docx":
      return "doc"
    case "zip":
    case "rar":
    case "7z":
      return "zip"
    case "fig":
    case "figma":
      return "fig"
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return "image"
    case "svg":
      return "file" // SVG treated as generic file — not in image allowlist due to XSS risk
    case "mp4":
    case "webm":
    case "mov":
    case "avi":
      return "video"
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return "audio"
    default:
      return "file"
  }
}

// Get bucket for file type
function getBucketForFileType(fileType: FileType): string {
  return BUCKET_CONFIG[fileType]?.bucket || "project-files"
}

// Generate unique filename
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = originalName.includes(".")
    ? `.${originalName.split(".").pop()}`
    : ""
  const baseName = originalName.replace(/\.[^/.]+$/, "")
  // Sanitize filename - remove special characters
  const sanitizedBase = baseName
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 50)
  return `${sanitizedBase}_${timestamp}_${random}${ext}`
}

// Upload a file to storage and create database record
export async function uploadFile(
  projectId: string,
  formData: FormData,
  metadata?: FileMetadata
): Promise<ActionResult<ProjectFile>> {
  try {
    const { user, supabase } = await requireAuth()

    // Get file from FormData
    const file = formData.get("file") as File | null
    if (!file) {
      return { error: "No file provided" }
    }

    // Get project to verify access and get org_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      return { error: "Project not found or access denied" }
    }

    // Validate MIME type (SEC-07: enforce allowlist)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return { error: `File type "${file.type}" is not allowed` }
    }

    // Determine file type
    const fileType =
      metadata?.fileType ||
      getFileTypeFromMime(file.type) ||
      getFileTypeFromExtension(file.name)

    // Get bucket configuration
    const bucket = getBucketForFileType(fileType)
    const config = BUCKET_CONFIG[fileType] || BUCKET_CONFIG.file

    // Validate file size
    if (file.size > config.maxSize) {
      const maxMB = Math.round(config.maxSize / (1024 * 1024))
      return { error: `File size exceeds maximum allowed (${maxMB}MB)` }
    }

    // Generate storage path: {org_id}/{project_id}/{unique_filename}
    const uniqueFilename = generateUniqueFilename(file.name)
    const storagePath = `${project.organization_id}/${projectId}/${uniqueFilename}`

    // Convert File to ArrayBuffer then to Uint8Array for upload
    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileData, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      return { error: `Failed to upload file: ${uploadError.message}` }
    }

    // Get public URL for the file
    const publicUrl = getStoragePublicUrl(supabase, bucket, storagePath)

    // For private buckets, create a signed URL instead
    let fileUrl = publicUrl || ""
    if (!publicUrl || bucket !== "avatars") {
      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year

      if (signedData?.signedUrl) {
        fileUrl = signedData.signedUrl
      }
    }

    // Create database record
    const fileRecord: ProjectFileInsert = {
      project_id: projectId,
      name: metadata?.name || file.name,
      file_type: fileType,
      size_bytes: file.size,
      storage_path: storagePath,
      url: fileUrl,
      description: metadata?.description || null,
      added_by_id: user.id,
    }

    const { data: dbFile, error: dbError } = await supabase
      .from("project_files")
      .insert(fileRecord)
      .select()
      .single()

    if (dbError) {
      // If database insert fails, try to clean up the storage file
      await removeStorageFile(supabase, bucket, [storagePath])
      return { error: `Failed to save file record: ${dbError.message}` }
    }

    revalidatePath(`/projects/${projectId}`)
    return { data: dbFile }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Upload a link-based asset (no file upload, just URL)
export async function createLinkAsset(
  projectId: string,
  data: {
    name: string
    url: string
    description?: string
    fileType?: FileType
  }
): Promise<ActionResult<ProjectFile>> {
  try {
    const { user, supabase } = await requireAuth()

    // Validate URL
    try {
      new URL(data.url)
    } catch {
      return { error: "Invalid URL provided" }
    }

    // Determine file type from URL if not provided
    const fileType = data.fileType || detectFileTypeFromUrl(data.url)

    // Create database record
    const fileRecord: ProjectFileInsert = {
      project_id: projectId,
      name: data.name,
      file_type: fileType,
      size_bytes: 0, // Links don't have size
      storage_path: "", // No storage path for links
      url: data.url,
      description: data.description || null,
      added_by_id: user.id,
    }

    const { data: dbFile, error: dbError } = await supabase
      .from("project_files")
      .insert(fileRecord)
      .select()
      .single()

    if (dbError) {
      return { error: `Failed to save link: ${dbError.message}` }
    }

    revalidatePath(`/projects/${projectId}`)
    return { data: dbFile }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Detect file type from URL
function detectFileTypeFromUrl(url: string): FileType {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()

    // Figma detection
    if (host.includes("figma.com")) return "fig"

    // Extension-based detection
    if (pathname.endsWith(".pdf")) return "pdf"
    if (pathname.endsWith(".zip")) return "zip"
    if (pathname.endsWith(".doc") || pathname.endsWith(".docx")) return "doc"
    if (
      pathname.endsWith(".png") ||
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg") ||
      pathname.endsWith(".gif") ||
      pathname.endsWith(".webp")
    ) {
      return "image"
    }
    if (
      pathname.endsWith(".mp4") ||
      pathname.endsWith(".webm") ||
      pathname.endsWith(".mov")
    ) {
      return "video"
    }
    if (
      pathname.endsWith(".mp3") ||
      pathname.endsWith(".wav") ||
      pathname.endsWith(".ogg")
    ) {
      return "audio"
    }

    return "file"
  } catch {
    return "file"
  }
}

// Delete a file
export async function deleteFile(fileId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    // Get file record first
    const { data: file, error: fetchError } = await supabase
      .from("project_files")
      .select("id, project_id, storage_path, file_type")
      .eq("id", fileId)
      .single()

    if (fetchError || !file) {
      return { error: "File not found" }
    }

    // If there's a storage path, delete from storage
    if (file.storage_path) {
      const bucket = getBucketForFileType(file.file_type)
      // Continue to delete database record even if storage delete fails
      await removeStorageFile(supabase, bucket, [file.storage_path])
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from("project_files")
      .delete()
      .eq("id", fileId)

    if (dbError) {
      return { error: `Failed to delete file record: ${dbError.message}` }
    }

    revalidatePath(`/projects/${file.project_id}`)
    return {}
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get all files for a project
export async function getProjectFiles(
  projectId: string
): Promise<ActionResult<ProjectFileWithUploader[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("project_files")
      .select(`
        *,
        uploader:profiles!project_files_added_by_id_fkey(
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { data: data as ProjectFileWithUploader[] }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get a single file
export async function getFile(
  fileId: string
): Promise<ActionResult<ProjectFileWithUploader>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("project_files")
      .select(`
        *,
        uploader:profiles!project_files_added_by_id_fkey(
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("id", fileId)
      .single()

    if (error) {
      return { error: error.message }
    }

    return { data: data as ProjectFileWithUploader }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get a fresh signed URL for a file (for downloads)
export async function getFileUrl(
  storagePath: string,
  fileType: FileType = "file",
  expiresIn: number = 3600 // 1 hour default
): Promise<ActionResult<string>> {
  try {
    const { supabase } = await requireAuth()

    if (!storagePath) {
      return { error: "No storage path provided" }
    }

    const bucket = getBucketForFileType(fileType)

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      return { error: `Failed to generate download URL: ${error.message}` }
    }

    return { data: data.signedUrl }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Download a file (returns blob)
export async function downloadFile(
  storagePath: string,
  fileType: FileType = "file"
): Promise<ActionResult<Blob>> {
  try {
    const { supabase } = await requireAuth()

    if (!storagePath) {
      return { error: "No storage path provided" }
    }

    const bucket = getBucketForFileType(fileType)

    const { data, error } = await supabase.storage.from(bucket).download(storagePath)

    if (error) {
      return { error: `Failed to download file: ${error.message}` }
    }

    return { data }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Update file metadata (name, description)
export async function updateFile(
  fileId: string,
  data: { name?: string; description?: string }
): Promise<ActionResult<ProjectFile>> {
  try {
    const { supabase } = await requireAuth()

    const { data: file, error } = await supabase
      .from("project_files")
      .update(data)
      .eq("id", fileId)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/projects/${file.project_id}`)
    return { data: file }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get files count for a project
export async function getProjectFilesCount(
  projectId: string
): Promise<ActionResult<number>> {
  try {
    const { supabase } = await requireAuth()

    const { count, error } = await supabase
      .from("project_files")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)

    if (error) {
      return { error: error.message }
    }

    return { data: count || 0 }
  } catch {
    return { error: "Not authenticated" }
  }
}
