"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Spinner,
  Plus,
  DotsThree,
  Pencil,
  Trash,
  CheckCircle,
  Circle,
  Lock,
} from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SettingsPaneHeader } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import { getLabels, createLabel, updateLabel, deleteLabel } from "@/lib/actions/labels"
import { TAG_COLORS } from "@/lib/constants/tag-colors"
import { ColorPicker } from "@/components/ui/color-picker"
import type { OrganizationLabel, LabelCategory } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

const typeNav = [
  { id: "task" as const, label: "Task", icon: "☑" },
  { id: "project" as const, label: "Project", icon: "▲" },
  { id: "workstream" as const, label: "Workstream", icon: "★" },
]

const workflowGroups = [
  {
    id: "unstarted",
    label: "Unstarted",
    steps: [
      { id: "todo", label: "To-do", description: "Tasks that are not started yet", state: "todo", locked: true },
    ],
  },
  {
    id: "started",
    label: "Started",
    steps: [
      { id: "doing", label: "Doing", description: "Tasks that are in progress", state: "doing", locked: false },
    ],
  },
  {
    id: "finished",
    label: "Finished",
    steps: [
      { id: "done", label: "Done", description: "Tasks that are done", state: "done", locked: true },
    ],
  },
  { id: "canceled", label: "Canceled", steps: [] },
] as const

export function TypesPane() {
  const [activeType, setActiveType] = useState<"task" | "project" | "workstream">("task")

  const stepIcon = (state?: string) => {
    switch (state) {
      case "doing":
        return { Icon: Circle, className: "text-blue-500" }
      case "done":
        return { Icon: CheckCircle, className: "text-green-500" }
      default:
        return { Icon: Circle, className: "text-muted-foreground" }
    }
  }

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Types"
        description="Configure workflow statuses and properties for your tasks, projects, and workstreams."
      />

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="border-b border-border/60 bg-card/70 lg:border-b-0 lg:border-r">
            <div className="px-4 py-3 border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Types
            </div>
            <div>
              {typeNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveType(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-3 text-sm transition",
                    activeType === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 bg-background/40 p-6">
            <div>
              <p className="text-sm font-semibold text-foreground">Edit type</p>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={typeNav.find((t) => t.id === activeType)?.label}
                  readOnly
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <Separator className="bg-border/80" />

            <div className="space-y-4 pt-2">
              <p className="text-sm font-semibold text-foreground">Workflow</p>
              <div className="space-y-6">
                {workflowGroups.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{group.label}</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {group.steps.length > 0 && (
                      <div className="space-y-2">
                        {group.steps.map((step) => {
                          const { Icon, className } = stepIcon(step.state)
                          return (
                            <div
                              key={step.id}
                              className="flex items-center gap-4 rounded-2xl bg-muted/20 px-4 py-3"
                            >
                              <span className={cn("flex h-6 w-6 items-center justify-center", className)}>
                                <Icon
                                  className="h-4 w-4"
                                  weight={step.state === "done" ? "fill" : "regular"}
                                />
                              </span>
                              <div className="flex flex-1 items-center gap-4 text-sm text-foreground">
                                <span className="font-medium">{step.label}</span>
                                <span className="flex-1 text-left text-muted-foreground">
                                  {step.description}
                                </span>
                              </div>
                              <div className="text-muted-foreground">
                                {step.locked ? (
                                  <Lock className="h-4 w-4" />
                                ) : step.id === "doing" ? null : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
