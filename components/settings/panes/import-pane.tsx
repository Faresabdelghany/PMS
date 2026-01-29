"use client"

import { UploadSimple, CheckCircle, Circle, Info } from "@phosphor-icons/react/dist/ssr"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader } from "../setting-primitives"
import { cn } from "@/lib/utils"

const steps = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Select header" },
  { id: 3, label: "Map columns" },
] as const

const columns = [
  { name: "ID", required: false },
  { name: "Title", required: true },
  { name: "Project", required: false },
  { name: "Status", required: false },
  { name: "Description", required: false },
  { name: "Parent ID", required: false },
  { name: "Assignee emails", required: false },
  { name: "Tags", required: false },
  { name: "Priority", required: false },
] as const

export function ImportPane() {
  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Import"
        description="Bring your existing data into your workspace in just a few steps. Upload your file, map your properties, and import tasks seamlessly."
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {steps.map((step, index) => {
            const isActive = step.id === 1
            const isLast = index === steps.length - 1
            const StepIcon = isActive ? CheckCircle : Circle
            return (
              <div key={step.id} className="flex items-center gap-3 text-sm text-muted-foreground">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1",
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <StepIcon className="h-4 w-4" weight={isActive ? "fill" : "regular"} />
                  <span className="text-xs font-semibold">{step.id}.</span>
                  <span>{step.label}</span>
                </button>
                {!isLast && <span className="text-sm">›</span>}
              </div>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center transition hover:border-primary/50 hover:bg-primary/5">
            <input type="file" className="sr-only" accept=".csv,.xlsx" />
            <UploadSimple className="h-6 w-6 text-primary" />
            <p className="text-sm font-medium text-foreground">Browse or drag your file here</p>
            <p className="text-[11px] text-muted-foreground">CSV or XLSX up to 10MB</p>
          </label>

          <div className="rounded-2xl border border-border/70 bg-card/70">
            <div className="grid grid-cols-[minmax(0,1fr)_100px] border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
              <span>Expected column</span>
              <span className="text-right">Required</span>
            </div>
            <div className="divide-y divide-border/70">
              {columns.map((column) => (
                <div key={column.name} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <span>{column.name}</span>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-muted-foreground">
                    {column.required ? (
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
      </div>
    </div>
  )
}
