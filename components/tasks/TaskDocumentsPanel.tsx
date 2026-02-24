"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FileText, FlaskConical, ScrollText, NotebookPen, ClipboardList } from "lucide-react"
import { getDocuments, getDocument, type AgentDocument } from "@/lib/actions/agent-documents"

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  deliverable: <FileText className="h-4 w-4 text-blue-500" />,
  research: <FlaskConical className="h-4 w-4 text-purple-500" />,
  protocol: <ScrollText className="h-4 w-4 text-amber-500" />,
  draft: <NotebookPen className="h-4 w-4 text-muted-foreground" />,
  report: <ClipboardList className="h-4 w-4 text-emerald-500" />,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface TaskDocumentsPanelProps {
  taskId: string
}

export function TaskDocumentsPanel({ taskId }: TaskDocumentsPanelProps) {
  const [documents, setDocuments] = useState<AgentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [viewDoc, setViewDoc] = useState<AgentDocument | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  useEffect(() => {
    getDocuments(taskId).then((result) => {
      if (result.data) setDocuments(result.data)
      setLoading(false)
    })
  }, [taskId])

  const handleView = useCallback(async (docId: string) => {
    setViewLoading(true)
    const result = await getDocument(docId)
    if (result.data) setViewDoc(result.data)
    setViewLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 bg-accent/40 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <FileText className="h-4 w-4" />
        Deliverables
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/60 rounded-lg bg-muted/30">
          <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No deliverables yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0">
                {DOC_TYPE_ICONS[doc.doc_type] ?? DOC_TYPE_ICONS.deliverable}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {doc.agent?.name ?? "Unknown"} · {formatDate(doc.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => handleView(doc.id)}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Document viewer sheet */}
      <Sheet open={viewDoc !== null} onOpenChange={(open) => !open && setViewDoc(null)}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewDoc?.title ?? "Document"}</SheetTitle>
          </SheetHeader>
          {viewLoading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-accent/40 rounded animate-pulse" />
              ))}
            </div>
          ) : viewDoc ? (
            <div className="mt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-foreground">
              {viewDoc.content}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
