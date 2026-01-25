"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Lazy-loaded version of ProjectDescriptionEditor
 *
 * The Tiptap editor and its extensions are heavy (~150KB+).
 * This wrapper uses Next.js dynamic imports to code-split the editor
 * and only load it when actually needed.
 *
 * Usage:
 *   import { ProjectDescriptionEditorLazy } from "@/components/project-wizard/ProjectDescriptionEditorLazy"
 *   // Use exactly like ProjectDescriptionEditor
 */

function EditorLoadingState({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-30 w-full rounded-lg" />
    </div>
  )
}

export const ProjectDescriptionEditorLazy = dynamic(
  () =>
    import("./ProjectDescriptionEditor").then((mod) => ({
      default: mod.ProjectDescriptionEditor,
    })),
  {
    loading: () => <EditorLoadingState />,
    ssr: false, // Tiptap doesn't work well with SSR
  }
)

// Re-export the type for convenience
export type { ProjectDescriptionEditorProps } from "./ProjectDescriptionEditor"
