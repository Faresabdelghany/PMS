"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Plus, FileText, X } from "@phosphor-icons/react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createDocument,
  type AgentDocument,
  type DocType,
  type TaskSelectorOption,
} from "@/lib/actions/agent-documents"

// ── Schema ────────────────────────────────────────────────────────────

const newDocSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  doc_type: z.enum(["deliverable", "research", "protocol", "draft", "report"] as const),
  task_id: z.string().optional(),
  content: z.string().min(1, "Content is required"),
})

type NewDocFormValues = z.infer<typeof newDocSchema>

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

  const form = useForm<NewDocFormValues>({
    resolver: zodResolver(newDocSchema),
    defaultValues: {
      title: "",
      doc_type: "deliverable",
      task_id: undefined,
      content: "",
    },
  })

  function handleRowClick(doc: AgentDocument) {
    setSelectedDoc(doc)
    setDetailOpen(true)
  }

  function handleNewDocOpen() {
    form.reset()
    setNewDocOpen(true)
  }

  async function onSubmit(values: NewDocFormValues) {
    setIsSubmitting(true)
    try {
      const result = await createDocument(organizationId, {
        title: values.title,
        docType: values.doc_type as DocType,
        taskId: values.task_id && values.task_id !== "__none__" ? values.task_id : null,
        content: values.content,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        // Find task info for optimistic update
        const linkedTask = tasks.find((t) => t.id === values.task_id)
        const newDoc: AgentDocument = {
          ...result.data,
          task: linkedTask
            ? { id: linkedTask.id, name: linkedTask.title }
            : null,
        }
        setDocuments((prev) => [newDoc, ...prev])
        toast.success("Document created successfully")
        setNewDocOpen(false)
        form.reset()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

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

      {/* ── New Document Sheet ────────────────────────────────────────── */}
      <Sheet open={newDocOpen} onOpenChange={setNewDocOpen}>
        <SheetContent side="right" className="w-full max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle>New Document</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Document title…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Type */}
                  <FormField
                    control={form.control}
                    name="doc_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="deliverable">Deliverable</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                            <SelectItem value="protocol">Protocol</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="report">Report</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Task selector */}
                  <FormField
                    control={form.control}
                    name="task_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Linked Task (optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "__none__"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a task…" />
                            </SelectTrigger>
                          </FormControl>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Content */}
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Write document content (markdown supported)…"
                            className="min-h-[200px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit */}
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      {isSubmitting ? "Creating…" : "Create Document"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewDocOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
