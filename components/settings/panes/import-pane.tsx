"use client"

import { useState, useTransition } from "react"
import {
  UploadSimple,
  CheckCircle,
  Circle,
  Info,
  X,
  Spinner,
  Check,
  Warning,
} from "@phosphor-icons/react/dist/ssr"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsPaneHeader } from "../setting-primitives"
import { cn } from "@/lib/utils"
import { previewCSV, importTasksFromCSV, type ColumnMapping, type ImportResult } from "@/lib/actions/import"
import { useOrganization } from "@/hooks/use-organization"
import { toast } from "sonner"

const steps = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Map columns" },
  { id: 3, label: "Import" },
] as const

const mappableFields = [
  { key: "title", name: "Title", required: true },
  { key: "description", name: "Description", required: false },
  { key: "status", name: "Status", required: false },
  { key: "priority", name: "Priority", required: false },
  { key: "assignee_email", name: "Assignee Email", required: false },
  { key: "tags", name: "Tags", required: false },
  { key: "start_date", name: "Start Date", required: false },
  { key: "end_date", name: "End Date", required: false },
] as const

type MappableFieldKey = typeof mappableFields[number]["key"]

export function ImportPane() {
  const { organization, projects } = useOrganization()
  const [currentStep, setCurrentStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  // File state
  const [csvContent, setCsvContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [totalRows, setTotalRows] = useState(0)

  // Mapping state
  const [columnMappings, setColumnMappings] = useState<Record<MappableFieldKey, number | undefined>>({
    title: undefined,
    description: undefined,
    status: undefined,
    priority: undefined,
    assignee_email: undefined,
    tags: undefined,
    start_date: undefined,
    end_date: undefined,
  })

  // Project selection
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Result state
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file")
      return
    }

    const content = await file.text()
    setCsvContent(content)
    setFileName(file.name)

    // Preview the CSV
    const result = await previewCSV(content)
    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.data) {
      setHeaders(result.data.headers)
      setPreviewRows(result.data.rows)
      setTotalRows(result.data.totalRows)

      // Auto-map columns based on header names
      const autoMappings: Record<MappableFieldKey, number | undefined> = {
        title: undefined,
        description: undefined,
        status: undefined,
        priority: undefined,
        assignee_email: undefined,
        tags: undefined,
        start_date: undefined,
        end_date: undefined,
      }

      result.data.headers.forEach((header, index) => {
        const normalized = header.toLowerCase().trim()
        if (normalized === "title" || normalized === "name" || normalized === "task") {
          autoMappings.title = index
        } else if (normalized === "description" || normalized === "desc") {
          autoMappings.description = index
        } else if (normalized === "status") {
          autoMappings.status = index
        } else if (normalized === "priority") {
          autoMappings.priority = index
        } else if (normalized === "assignee" || normalized === "assignee email" || normalized === "email") {
          autoMappings.assignee_email = index
        } else if (normalized === "tags" || normalized === "tag" || normalized === "labels") {
          autoMappings.tags = index
        } else if (normalized === "start date" || normalized === "start") {
          autoMappings.start_date = index
        } else if (normalized === "end date" || normalized === "end" || normalized === "due date" || normalized === "due") {
          autoMappings.end_date = index
        }
      })

      setColumnMappings(autoMappings)
      setCurrentStep(2)
    }
  }

  const handleMappingChange = (field: MappableFieldKey, value: string) => {
    setColumnMappings((prev) => ({
      ...prev,
      [field]: value === "none" ? undefined : parseInt(value, 10),
    }))
  }

  const handleImport = () => {
    if (!csvContent || !selectedProjectId || columnMappings.title === undefined) {
      toast.error("Please select a project and map the Title column")
      return
    }

    startTransition(async () => {
      const mapping: ColumnMapping = {
        title: columnMappings.title!,
        description: columnMappings.description,
        status: columnMappings.status,
        priority: columnMappings.priority,
        assignee_email: columnMappings.assignee_email,
        tags: columnMappings.tags,
        start_date: columnMappings.start_date,
        end_date: columnMappings.end_date,
      }

      const result = await importTasksFromCSV(selectedProjectId, csvContent, mapping, true)

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setImportResult(result.data)
        setCurrentStep(3)
        if (result.data.imported > 0) {
          toast.success(`Imported ${result.data.imported} tasks`)
        }
      }
    })
  }

  const handleReset = () => {
    setCsvContent(null)
    setFileName(null)
    setHeaders([])
    setPreviewRows([])
    setTotalRows(0)
    setColumnMappings({
      title: undefined,
      description: undefined,
      status: undefined,
      priority: undefined,
      assignee_email: undefined,
      tags: undefined,
      start_date: undefined,
      end_date: undefined,
    })
    setSelectedProjectId(null)
    setImportResult(null)
    setCurrentStep(1)
  }

  const canProceedToImport = columnMappings.title !== undefined && selectedProjectId

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Import"
        description="Bring your existing data into your workspace in just a few steps. Upload your file, map your columns, and import tasks seamlessly."
      />

      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep
            const isComplete = step.id < currentStep
            const isLast = index === steps.length - 1
            const StepIcon = isComplete ? CheckCircle : isActive ? Circle : Circle
            return (
              <div key={step.id} className="flex items-center gap-3 text-sm text-muted-foreground">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1",
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : isComplete
                      ? "border-green-500/50 bg-green-500/10 text-green-600"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <StepIcon className="h-4 w-4" weight={isComplete || isActive ? "fill" : "regular"} />
                  <span className="text-xs font-semibold">{step.id}.</span>
                  <span>{step.label}</span>
                </button>
                {!isLast && <span className="text-sm">›</span>}
              </div>
            )
          })}
        </div>

        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center transition hover:border-primary/50 hover:bg-primary/5">
              <input
                type="file"
                className="sr-only"
                accept=".csv"
                onChange={handleFileChange}
              />
              <UploadSimple className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium text-foreground">Browse or drag your file here</p>
              <p className="text-[11px] text-muted-foreground">CSV up to 10MB</p>
            </label>

            <div className="rounded-2xl border border-border/70 bg-card/70">
              <div className="grid grid-cols-[minmax(0,1fr)_100px] border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                <span>Expected column</span>
                <span className="text-right">Required</span>
              </div>
              <div className="divide-y divide-border/70">
                {mappableFields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 text-foreground">
                      <span>{field.name}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {field.required ? (
                        <CheckCircle className="h-4 w-4 text-primary" weight="fill" />
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* File info */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" weight="fill" />
                <div>
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{totalRows} rows found</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Project Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Import to Project</label>
              <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Column Mapping */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Map Columns</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {mappableFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="w-32 text-sm text-muted-foreground">
                      {field.name}
                      {field.required && <span className="text-destructive">*</span>}
                    </label>
                    <Select
                      value={columnMappings[field.key]?.toString() ?? "none"}
                      onValueChange={(value) => handleMappingChange(field.key, value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not mapped —</SelectItem>
                        {headers.map((header, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {header || `Column ${index + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {previewRows.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {headers.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">
                            {header || `Col ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 text-foreground">
                              {cell || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!canProceedToImport || isPending}>
                {isPending ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : null}
                Import {totalRows} Tasks
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {currentStep === 3 && importResult && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card/70 p-8 text-center">
              {importResult.imported > 0 ? (
                <CheckCircle className="h-12 w-12 text-green-500" weight="fill" />
              ) : (
                <Warning className="h-12 w-12 text-yellow-500" weight="fill" />
              )}
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {importResult.imported > 0 ? "Import Complete!" : "Import Finished"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {importResult.imported} of {importResult.total} tasks imported
                  {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Errors</h3>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                  {importResult.errors.map((error, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={handleReset}>Import Another File</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
