"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { FileText } from "@phosphor-icons/react/dist/ssr/FileText"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QuickCreateModalLayout } from "@/components/QuickCreateModalLayout"
import { ProjectDescriptionEditorLazy as ProjectDescriptionEditor } from "@/components/project-wizard/ProjectDescriptionEditorLazy"
import {
  createDocument,
  type AgentDocument,
  type DocType,
  type TaskSelectorOption,
} from "@/lib/actions/agent-documents"

// ── Badge styles by type ───────────────────────────────────────────────

const docTypeBadgeClass: Record<DocType, string> = {
  deliverable: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  research:    "bg-purple-500/10 text-purple-600 border-purple-500/20",
  protocol:    "bg-orange-500/10 text-orange-600 border-orange-500/20",
  draft:       "bg-muted text-muted-foreground border-border",
  report:      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  deliverable: "Deliverable",
  research:    "Research",
  protocol:    "Protocol",
  draft:       "Draft",
  report:      "Report",
}

// ── Props ─────────────────────────────────────────────────────────────

interface DocumentsContentProps {
  initialDocuments: AgentDocument[]
  tasks: TaskSelectorOption[]
  organizationId: string
}

// ── Component ─────────────────────────────────────────────────────────

export function DocumentsContent({
  initialDocuments,
  tasks,
  organizationId,
}: DocumentsContentProps) {
  const [documents, setDocuments] = useState<AgentDocument[]>(initialDocuments)
  const [selectedDoc, setSelectedDoc] = useState<AgentDocument | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // ── New document form state (matches AddFileModal pattern) ──────────
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [docType, setDocType] = useState<DocType>("deliverable")
  const [taskId, setTaskId] = useState<string>("__none__")

  function handleRowClick(doc: AgentDocument) {
    setSelectedDoc(doc)
    setDetailOpen(true)
  }

  function handleNewDocOpen() {
    setTitle("")
    setDescription(undefined)
    setDocType("deliverable")
    setTaskId("__none__")
    setIsExpanded(false)
    setNewDocOpen(true)
  }

  const handleCreateDocument = useCallback(async () => {
    if (!title.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const result = await createDocument(organizationId, {
        title: title.trim(),
        docType,
        taskId: taskId !== "__none__" ? taskId : null,
        content: description || "",
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        const linkedTask = tasks.find((t) => t.id === taskId)
        const newDoc: AgentDocument = {
          ...result.data,
          task: linkedTask
            ? { id: linkedTask.id, name: linkedTask.title }
            : null,
        }
        setDocuments((prev) => [newDoc, ...prev])
        toast.success("Document created")
        setNewDocOpen(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [title, description, docType, taskId, organizationId, tasks, isSubmitting])

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      {/* Header */}
      <PageHeader
        title="Documents"
        actions={
          <Button size="sm" onClick={handleNewDocOpen}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Document
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">No documents yet. Create your first one.</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Preview</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => handleRowClick(doc)}
                    className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    {/* Title */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{doc.title}</span>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${docTypeBadgeClass[doc.doc_type] ?? ""}`}
                      >
                        {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                      </Badge>
                    </td>

                    {/* Linked task */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.task?.name ?? <span className="opacity-40">—</span>}
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.agent?.name ?? <span className="opacity-40">System</span>}
                    </td>

                    {/* Created at */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                    </td>

                    {/* Content preview */}
                    <td className="px-4 py-3 text-muted-foreground max-w-xs">
                      <span className="line-clamp-1">
                        {doc.content.slice(0, 120)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      {/* ── Detail Sheet ─────────────────────────────────────────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full max-w-2xl flex flex-col gap-0 p-0">
          {selectedDoc && (
            <>
              <SheetHeader className="px-6 py-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg font-semibold leading-tight">
                      {selectedDoc.title}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs ${docTypeBadgeClass[selectedDoc.doc_type] ?? ""}`}
                      >
                        {DOC_TYPE_LABELS[selectedDoc.doc_type] ?? selectedDoc.doc_type}
                      </Badge>
                      {selectedDoc.task && (
                        <span className="text-xs text-muted-foreground">
                          Task: {selectedDoc.task.name}
                        </span>
                      )}
                      {selectedDoc.agent && (
                        <span className="text-xs text-muted-foreground">
                          By: {selectedDoc.agent.name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(selectedDoc.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="px-6 py-4">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                    {selectedDoc.content}
                  </pre>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── New Document Modal (same style as AddFileModal) ──────────── */}
      <QuickCreateModalLayout
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        isDescriptionExpanded={isExpanded}
        onSubmitShortcut={handleCreateDocument}
      >
        {/* Title + close button */}
        <div className="flex items-center justify-between gap-2 w-full shrink-0 mt-1">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex gap-1 h-10 items-center w-full">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
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
            onClick={() => setNewDocOpen(false)}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Rich text editor for content */}
        <ProjectDescriptionEditor
          value={description}
          onChange={setDescription}
          onExpandChange={setIsExpanded}
          placeholder="Write document content..."
          showTemplates={false}
        />

        {/* Bottom bar: type + task selectors + create button */}
        <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
          <div className="flex items-center gap-2">
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deliverable">Deliverable</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="protocol">Protocol</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="report">Report</SelectItem>
              </SelectContent>
            </Select>

            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Link to task…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No task</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                    {task.projectName ? ` — ${task.projectName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" onClick={handleCreateDocument} disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create document"}
          </Button>
        </div>
      </QuickCreateModalLayout>
    </div>
  )
}
