# AI-Enhanced Project Creation Wizard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered description generation, workstream suggestions, and task generation to the project creation wizard.

**Architecture:** Create shared AI components (useAIStatus hook, AIGenerateButton, AISetupPrompt), then integrate them into ProjectDescriptionEditor and StepStructure. All AI calls use existing rate-limited infrastructure in lib/actions/ai.ts.

**Tech Stack:** React 19, TypeScript, Next.js Server Actions, Tailwind CSS, Phosphor Icons, existing AI action functions

---

## Task 1: Create useAIStatus Hook

**Files:**
- Create: `hooks/use-ai-status.ts`

**Step 1: Create the hook file**

```typescript
"use client"

import { useEffect, useState, useCallback } from "react"
import { hasAIConfigured, getAISettings } from "@/lib/actions/user-settings"

export type AIStatusResult = {
  isConfigured: boolean
  isLoading: boolean
  provider: string | null
  model: string | null
  refetch: () => Promise<void>
}

export function useAIStatus(): AIStatusResult {
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [provider, setProvider] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const [configResult, settingsResult] = await Promise.all([
        hasAIConfigured(),
        getAISettings(),
      ])

      setIsConfigured(configResult.data ?? false)
      if (settingsResult.data) {
        setProvider(settingsResult.data.ai_provider)
        setModel(settingsResult.data.ai_model_preference)
      }
    } catch {
      setIsConfigured(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
    isConfigured,
    isLoading,
    provider,
    model,
    refetch: fetchStatus,
  }
}
```

**Step 2: Verify the hook compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors related to use-ai-status.ts

**Step 3: Commit**

```bash
git add hooks/use-ai-status.ts
git commit -m "feat(ai): add useAIStatus hook for checking AI configuration"
```

---

## Task 2: Create AIGenerateButton Component

**Files:**
- Create: `components/ai/ai-generate-button.tsx`

**Step 1: Create the component**

```typescript
"use client"

import { cn } from "@/lib/utils"
import { StarFour, CircleNotch } from "@phosphor-icons/react/dist/ssr"

interface AIGenerateButtonProps {
  onClick: () => void
  isLoading?: boolean
  disabled?: boolean
  label?: string
  loadingLabel?: string
  size?: "sm" | "md"
  className?: string
}

export function AIGenerateButton({
  onClick,
  isLoading = false,
  disabled = false,
  label = "Generate with AI",
  loadingLabel = "Generating...",
  size = "md",
  className,
}: AIGenerateButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full transition-colors",
        "bg-muted-foreground/8 hover:bg-violet-500/20",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm"
          ? "h-7 px-3 py-0.5"
          : "h-8 px-4 py-1",
        className
      )}
    >
      <div className={size === "sm" ? "size-3.5" : "size-4"}>
        {isLoading ? (
          <CircleNotch
            weight="bold"
            className={cn(
              "animate-spin text-violet-500",
              size === "sm" ? "size-3.5" : "size-4"
            )}
          />
        ) : (
          <StarFour
            weight="fill"
            className={cn(
              "text-violet-500",
              size === "sm" ? "size-3.5" : "size-4"
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "font-medium text-foreground tracking-wide",
          size === "sm" ? "text-xs" : "text-sm"
        )}
      >
        {isLoading ? loadingLabel : label}
      </span>
    </button>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add components/ai/ai-generate-button.tsx
git commit -m "feat(ai): add AIGenerateButton component with loading states"
```

---

## Task 3: Create AISetupPrompt Component

**Files:**
- Create: `components/ai/ai-setup-prompt.tsx`

**Step 1: Create the component**

```typescript
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { StarFour, Eye, EyeSlash, CheckCircle, XCircle, CircleNotch } from "@phosphor-icons/react/dist/ssr"
import { AI_MODELS, type AIProvider } from "@/lib/constants/ai"
import { saveAISettings, saveAIApiKey } from "@/lib/actions/user-settings"
import { testAIConnection } from "@/lib/actions/ai"

interface AISetupPromptProps {
  children: React.ReactNode
  onSetupComplete?: () => void
  className?: string
}

export function AISetupPrompt({ children, onSetupComplete, className }: AISetupPromptProps) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<AIProvider>("openai")
  const [model, setModel] = useState<string>("gpt-4o-mini")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  const models = provider ? AI_MODELS[provider] || [] : []

  const handleProviderChange = (value: string) => {
    const newProvider = value as AIProvider
    setProvider(newProvider)
    // Reset model to first option for new provider
    const newModels = AI_MODELS[value] || []
    setModel(newModels[0]?.value || "")
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    if (!provider || !apiKey) return

    setIsTesting(true)
    setTestResult(null)

    try {
      // First save settings temporarily for test
      await saveAISettings({ ai_provider: provider, ai_model_preference: model })
      await saveAIApiKey(apiKey)

      const result = await testAIConnection()
      setTestResult(result.data?.success ? "success" : "error")
    } catch {
      setTestResult("error")
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveAndContinue = async () => {
    if (!provider || !apiKey) return

    setIsSaving(true)
    try {
      await saveAISettings({ ai_provider: provider, ai_model_preference: model })
      await saveAIApiKey(apiKey)
      setOpen(false)
      onSetupComplete?.()
    } catch {
      // Error handling
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className={className}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StarFour weight="fill" className="size-4 text-violet-500" />
            <span className="font-medium text-sm">Set up AI to unlock this feature</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={provider || ""} onValueChange={handleProviderChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <Select value={model} onValueChange={setModel} disabled={!provider}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="sk-..."
                  className="h-8 pr-8 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!provider || !apiKey || isTesting}
              className="h-7 text-xs"
            >
              {isTesting ? (
                <>
                  <CircleNotch className="size-3 animate-spin mr-1" />
                  Testing...
                </>
              ) : testResult === "success" ? (
                <>
                  <CheckCircle className="size-3 text-green-500 mr-1" />
                  Connected
                </>
              ) : testResult === "error" ? (
                <>
                  <XCircle className="size-3 text-red-500 mr-1" />
                  Failed
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAndContinue}
              disabled={!provider || !apiKey || isSaving}
              className="h-7 text-xs"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add components/ai/ai-setup-prompt.tsx
git commit -m "feat(ai): add AISetupPrompt component for inline AI configuration"
```

---

## Task 4: Update ProjectData Types

**Files:**
- Modify: `components/project-wizard/types.ts`

**Step 1: Add new types for generated tasks and workstreams**

In `components/project-wizard/types.ts`, add after line 28 (after `OwnershipEntry` interface):

```typescript
export interface GeneratedTask {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  workstream?: string;
  included: boolean;
}
```

**Step 2: Update ProjectData interface**

Replace the `addStarterTasks: boolean;` line (line 49) with:

```typescript
  workstreams: string[];
  generatedTasks: GeneratedTask[];
```

**Step 3: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: TypeScript errors about missing properties (expected - we'll fix in next tasks)

**Step 4: Commit**

```bash
git add components/project-wizard/types.ts
git commit -m "feat(ai): update ProjectData types for workstreams and generated tasks"
```

---

## Task 5: Update ProjectWizard Default Data

**Files:**
- Modify: `components/project-wizard/ProjectWizard.tsx`

**Step 1: Update DEFAULT_PROJECT_DATA**

In `components/project-wizard/ProjectWizard.tsx`, replace lines 30-40:

```typescript
const DEFAULT_PROJECT_DATA: ProjectData = {
  mode: undefined,
  successType: 'undefined',
  deliverables: [],
  metrics: [],
  description: '',
  deadlineType: 'none',
  contributorIds: [],
  stakeholderIds: [],
  workstreams: [],
  generatedTasks: [],
};
```

**Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No errors related to DEFAULT_PROJECT_DATA

**Step 3: Commit**

```bash
git add components/project-wizard/ProjectWizard.tsx
git commit -m "feat(ai): update ProjectWizard default data for AI features"
```

---

## Task 6: Wire Up "Write with AI" Button in ProjectDescriptionEditor

**Files:**
- Modify: `components/project-wizard/ProjectDescriptionEditor.tsx`

**Step 1: Add imports**

At the top of the file (after line 9), add:

```typescript
import { useAIStatus } from "@/hooks/use-ai-status";
import { AIGenerateButton } from "@/components/ai/ai-generate-button";
import { AISetupPrompt } from "@/components/ai/ai-setup-prompt";
import { generateProjectDescription, type ProjectContext } from "@/lib/actions/ai";
```

**Step 2: Update props interface**

Replace the `ProjectDescriptionEditorProps` interface (lines 13-21) with:

```typescript
export interface ProjectDescriptionEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onExpandChange?: (isExpanded: boolean) => void;
  onFocusChange?: (isFocused: boolean) => void;
  placeholder?: string;
  className?: string;
  showTemplates?: boolean;
  // AI generation context
  projectContext?: {
    name?: string;
    intent?: string;
    deliverables?: { title: string }[];
    metrics?: { name: string; target?: string }[];
  };
}
```

**Step 3: Add AI state and handlers inside the component**

After line 41 (after `existingSections` state), add:

```typescript
  const { isConfigured, refetch: refetchAIStatus } = useAIStatus();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateWithAI = async () => {
    if (!editor) return;

    setIsGenerating(true);
    try {
      const context: ProjectContext = {
        name: projectContext?.name || "Untitled Project",
        description: projectContext?.intent
          ? `Project intent: ${projectContext.intent}`
          : undefined,
      };

      // Add deliverables context if available
      if (projectContext?.deliverables?.length) {
        context.description = `${context.description || ''}\nDeliverables: ${projectContext.deliverables.map(d => d.title).join(', ')}`;
      }

      // Add metrics context if available
      if (projectContext?.metrics?.length) {
        context.description = `${context.description || ''}\nMetrics: ${projectContext.metrics.map(m => `${m.name}${m.target ? `: ${m.target}` : ''}`).join(', ')}`;
      }

      const result = await generateProjectDescription(context);

      if (result.error) {
        console.error("AI generation error:", result.error);
        return;
      }

      if (result.data) {
        // Convert plain text to HTML paragraphs
        const htmlContent = result.data
          .split('\n\n')
          .map(para => `<p>${para}</p>`)
          .join('');
        editor.commands.setContent(htmlContent);
        onChange?.(editor.getHTML());
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAISetupComplete = () => {
    refetchAIStatus();
    // Automatically trigger generation after setup
    setTimeout(() => {
      handleGenerateWithAI();
    }, 100);
  };
```

**Step 4: Replace the AI button (lines 411-426)**

Replace the existing button with:

```typescript
              {isConfigured ? (
                <AIGenerateButton
                  onClick={handleGenerateWithAI}
                  isLoading={isGenerating}
                  label="Write with AI"
                  loadingLabel="Writing..."
                  size="sm"
                />
              ) : (
                <AISetupPrompt onSetupComplete={handleAISetupComplete}>
                  <AIGenerateButton
                    onClick={() => {}}
                    label="Write with AI"
                    size="sm"
                  />
                </AISetupPrompt>
              )}
```

**Step 5: Update the function signature to include projectContext**

Update line 23 to destructure `projectContext`:

```typescript
export function ProjectDescriptionEditor({
  value,
  onChange,
  onExpandChange,
  onFocusChange,
  placeholder,
  className,
  showTemplates = true,
  projectContext,
}: ProjectDescriptionEditorProps) {
```

**Step 6: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add components/project-wizard/ProjectDescriptionEditor.tsx
git commit -m "feat(ai): wire up Write with AI button in ProjectDescriptionEditor"
```

---

## Task 7: Pass Project Context to ProjectDescriptionEditor

**Files:**
- Modify: `components/project-wizard/steps/StepOutcome.tsx`

**Step 1: Find and update the ProjectDescriptionEditor usage**

First, read the file to find the exact location:

Run: `grep -n "ProjectDescriptionEditor" components/project-wizard/steps/StepOutcome.tsx`

Then update the ProjectDescriptionEditor component to pass the context prop. Add the `projectContext` prop:

```typescript
<ProjectDescriptionEditor
  value={data.description}
  onChange={(html) => updateData({ description: html })}
  projectContext={{
    name: data.name,
    intent: data.intent,
    deliverables: data.deliverables,
    metrics: data.metrics,
  }}
/>
```

**Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add components/project-wizard/steps/StepOutcome.tsx
git commit -m "feat(ai): pass project context to description editor for AI generation"
```

---

## Task 8: Create AITaskPreview Component

**Files:**
- Create: `components/ai/ai-task-preview.tsx`

**Step 1: Create the component**

```typescript
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr"
import type { GeneratedTask } from "@/components/project-wizard/types"

interface AITaskPreviewProps {
  tasks: GeneratedTask[]
  workstreams: string[]
  onTasksChange: (tasks: GeneratedTask[]) => void
  onRegenerate?: () => void
  isRegenerating?: boolean
  className?: string
}

export function AITaskPreview({
  tasks,
  workstreams,
  onTasksChange,
  onRegenerate,
  isRegenerating = false,
  className,
}: AITaskPreviewProps) {
  const updateTask = (id: string, updates: Partial<GeneratedTask>) => {
    onTasksChange(
      tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
  }

  const removeTask = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id))
  }

  const addTask = () => {
    const newTask: GeneratedTask = {
      id: `custom-${Date.now()}`,
      title: "",
      priority: "medium",
      workstream: workstreams[0] || undefined,
      included: true,
    }
    onTasksChange([...tasks, newTask])
  }

  const includedCount = tasks.filter((t) => t.included).length

  return (
    <div className={cn("rounded-lg border border-border bg-background", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm text-muted-foreground">
          {includedCount} task{includedCount !== 1 ? "s" : ""} selected
        </span>
        {onRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 text-xs"
          >
            <ArrowsClockwise className={cn("size-3 mr-1", isRegenerating && "animate-spin")} />
            Regenerate
          </Button>
        )}
      </div>

      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              !task.included && "opacity-50"
            )}
          >
            <Checkbox
              checked={task.included}
              onCheckedChange={(checked) =>
                updateTask(task.id, { included: checked === true })
              }
            />

            <Input
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              placeholder="Task title"
              className="flex-1 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
            />

            {workstreams.length > 0 && (
              <Select
                value={task.workstream || ""}
                onValueChange={(value) => updateTask(task.id, { workstream: value })}
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue placeholder="Stream" />
                </SelectTrigger>
                <SelectContent>
                  {workstreams.map((ws) => (
                    <SelectItem key={ws} value={ws}>
                      {ws}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={task.priority}
              onValueChange={(value: "low" | "medium" | "high") =>
                updateTask(task.id, { priority: value })
              }
            >
              <SelectTrigger className="w-20 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeTask(task.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={addTask}
          className="h-7 text-xs text-muted-foreground"
        >
          <Plus className="size-3 mr-1" />
          Add custom task
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add components/ai/ai-task-preview.tsx
git commit -m "feat(ai): add AITaskPreview component for editable task list"
```

---

## Task 9: Enhance StepStructure with Workstreams and AI Task Generation

**Files:**
- Modify: `components/project-wizard/steps/StepStructure.tsx`

**Step 1: Add imports**

At the top of the file (after line 5), add:

```typescript
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, StarFour, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { useAIStatus } from "@/hooks/use-ai-status";
import { AIGenerateButton } from "@/components/ai/ai-generate-button";
import { AISetupPrompt } from "@/components/ai/ai-setup-prompt";
import { AITaskPreview } from "@/components/ai/ai-task-preview";
import { generateWorkstreams, generateTasks, type ProjectContext } from "@/lib/actions/ai";
import type { GeneratedTask } from "../types";
```

**Step 2: Replace the entire component**

Replace the `StepStructure` function (from line 33 to end of file) with:

```typescript
export function StepStructure({ data, updateData }: StepStructureProps) {
  const { isConfigured, refetch: refetchAIStatus } = useAIStatus();
  const [isGeneratingWorkstreams, setIsGeneratingWorkstreams] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [newWorkstream, setNewWorkstream] = useState("");
  const [showTaskToggle, setShowTaskToggle] = useState(data.generatedTasks.length > 0);

  const structures: { id: WorkStructure; title: string; desc: string; icon: React.ReactNode; visual: React.ReactNode }[] = [
    {
      id: 'linear',
      title: 'Linear',
      desc: 'Sequential phases (e.g. Waterfall). One thing after another.',
      icon: <ArrowRight className="h-5 w-5" />,
      visual: (
        <div className="flex items-center gap-2 opacity-50">
          <div className="h-2 w-8 rounded bg-current"></div>
          <ArrowRight className="h-3 w-3" />
          <div className="h-2 w-8 rounded bg-current"></div>
          <ArrowRight className="h-3 w-3" />
          <div className="h-2 w-8 rounded bg-current"></div>
        </div>
      )
    },
    {
      id: 'milestones',
      title: 'Milestones',
      desc: 'Key checkpoints or deadlines to hit along the way.',
      icon: <Flag className="h-5 w-5" />,
      visual: (
        <div className="flex items-center justify-between gap-1 opacity-50">
          <div className="h-2 w-2 rounded-full bg-current"></div>
          <div className="h-0.5 flex-1 bg-current"></div>
          <Flag className="h-3 w-3" />
          <div className="h-0.5 flex-1 bg-current"></div>
          <div className="h-2 w-2 rounded-full bg-current"></div>
        </div>
      )
    },
    {
      id: 'multistream',
      title: 'Multi-stream',
      desc: 'Parallel tracks of work happening simultaneously.',
      icon: <GitMerge className="h-5 w-5" />,
      visual: (
        <div className="flex flex-col gap-1 opacity-50">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-current"></div>
            <div className="h-1.5 w-6 rounded bg-current"></div>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-current"></div>
            <div className="h-1.5 w-6 rounded bg-current"></div>
          </div>
        </div>
      )
    }
  ];

  const handleGenerateWorkstreams = async () => {
    setIsGeneratingWorkstreams(true);
    try {
      const context: ProjectContext = {
        name: data.name || "Untitled Project",
        description: data.description,
      };

      const result = await generateWorkstreams(context, 4);

      if (result.error) {
        console.error("Workstream generation error:", result.error);
        return;
      }

      if (result.data) {
        const workstreamNames = result.data.map((ws) => ws.name);
        updateData({ workstreams: workstreamNames });
      }
    } catch (error) {
      console.error("Workstream generation failed:", error);
    } finally {
      setIsGeneratingWorkstreams(false);
    }
  };

  const handleGenerateTasks = async () => {
    setIsGeneratingTasks(true);
    setShowTaskToggle(true);
    try {
      const context: ProjectContext = {
        name: data.name || "Untitled Project",
        description: data.description,
        existingWorkstreams: data.workstreams,
      };

      const result = await generateTasks(context, 5);

      if (result.error) {
        console.error("Task generation error:", result.error);
        return;
      }

      if (result.data) {
        const generatedTasks: GeneratedTask[] = result.data.map((task, index) => ({
          id: `gen-${Date.now()}-${index}`,
          title: task.title,
          description: task.description,
          priority: task.priority as "low" | "medium" | "high",
          workstream: data.workstreams[index % data.workstreams.length] || undefined,
          included: true,
        }));
        updateData({ generatedTasks });
      }
    } catch (error) {
      console.error("Task generation failed:", error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleAISetupComplete = (action: "workstreams" | "tasks") => {
    refetchAIStatus();
    setTimeout(() => {
      if (action === "workstreams") {
        handleGenerateWorkstreams();
      } else {
        handleGenerateTasks();
      }
    }, 100);
  };

  const addWorkstream = () => {
    if (!newWorkstream.trim()) return;
    updateData({ workstreams: [...data.workstreams, newWorkstream.trim()] });
    setNewWorkstream("");
  };

  const removeWorkstream = (ws: string) => {
    updateData({ workstreams: data.workstreams.filter((w) => w !== ws) });
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Work Structure Selection */}
      <div className="space-y-4 bg-muted p-2 rounded-3xl">
        <p className="text-sm text-muted-foreground px-4 pt-2">Choose the workflow that fits your team best.</p>

        <div className="grid gap-1">
          {structures.map((option) => (
            <div
              key={option.id}
              onClick={() => updateData({ structure: option.id })}
              className={cn(
                "relative flex cursor-pointer items-center space-x-4 rounded-3xl border-2 p-4 transition-all bg-background",
                data.structure === option.id
                  ? "border-primary ring-1 ring-primary/20"
                  : "border-muted"
              )}
            >
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                data.structure === option.id ? "bg-background border border-border text-primary" : "bg-background border border-border text-muted-foreground"
              )}>
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between space-y-1">
                  <h3 className="font-medium">{option.title}</h3>
                  <div className="text-muted-foreground/50">{option.visual}</div>
                </div>
                <p className="text-sm text-muted-foreground">{option.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workstreams Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Workstreams</Label>
            <p className="text-sm text-muted-foreground">Organize work into parallel tracks.</p>
          </div>
          {isConfigured ? (
            <AIGenerateButton
              onClick={handleGenerateWorkstreams}
              isLoading={isGeneratingWorkstreams}
              label="Suggest"
              loadingLabel="Suggesting..."
              size="sm"
            />
          ) : (
            <AISetupPrompt onSetupComplete={() => handleAISetupComplete("workstreams")}>
              <AIGenerateButton onClick={() => {}} label="Suggest" size="sm" />
            </AISetupPrompt>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {data.workstreams.map((ws) => (
            <div
              key={ws}
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"
            >
              <span className="text-sm">{ws}</span>
              <button
                type="button"
                onClick={() => removeWorkstream(ws)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-1">
            <Input
              value={newWorkstream}
              onChange={(e) => setNewWorkstream(e.target.value)}
              placeholder="Add workstream"
              className="h-8 w-32 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addWorkstream();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={addWorkstream}
              disabled={!newWorkstream.trim()}
              className="h-8 w-8"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Starter Tasks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Starter Tasks</Label>
            <p className="text-sm text-muted-foreground">
              Generate initial tasks to get started quickly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SimpleToggle
              checked={showTaskToggle}
              onCheckedChange={(c) => {
                setShowTaskToggle(c);
                if (!c) {
                  updateData({ generatedTasks: [] });
                }
              }}
            />
            {showTaskToggle && (
              isConfigured ? (
                <AIGenerateButton
                  onClick={handleGenerateTasks}
                  isLoading={isGeneratingTasks}
                  label="Generate"
                  loadingLabel="Generating..."
                  size="sm"
                />
              ) : (
                <AISetupPrompt onSetupComplete={() => handleAISetupComplete("tasks")}>
                  <AIGenerateButton onClick={() => {}} label="Generate" size="sm" />
                </AISetupPrompt>
              )
            )}
          </div>
        </div>

        {showTaskToggle && data.generatedTasks.length > 0 && (
          <AITaskPreview
            tasks={data.generatedTasks}
            workstreams={data.workstreams}
            onTasksChange={(tasks) => updateData({ generatedTasks: tasks })}
            onRegenerate={handleGenerateTasks}
            isRegenerating={isGeneratingTasks}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add components/project-wizard/steps/StepStructure.tsx
git commit -m "feat(ai): add workstream suggestions and task generation to StepStructure"
```

---

## Task 10: Update StepReview to Show Workstreams and Tasks

**Files:**
- Modify: `components/project-wizard/steps/StepReview.tsx`

**Step 1: Add new review sections**

After the Structure review section (around line 226), before the closing `</div>` of the review container, add:

```typescript
          {/* Workstreams */}
          {data.workstreams && data.workstreams.length > 0 && (
            <>
              <Separator className="opacity-0" />
              <div className="flex items-center gap-4 rounded-3xl bg-background p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground">
                  <GitMerge className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground pb-1">Workstreams</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.workstreams.map((ws) => (
                      <span
                        key={ws}
                        className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                      >
                        {ws}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  type="button"
                  onClick={() => onEditStep?.(4)}
                >
                  <PencilSimpleLine className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* Generated Tasks */}
          {data.generatedTasks && data.generatedTasks.filter(t => t.included).length > 0 && (
            <>
              <Separator className="opacity-0" />
              <div className="flex items-center gap-4 rounded-3xl bg-background p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground pb-1">Starter Tasks</p>
                  <p className="text-sm font-semibold">
                    {data.generatedTasks.filter(t => t.included).length} tasks will be created
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  type="button"
                  onClick={() => onEditStep?.(4)}
                >
                  <PencilSimpleLine className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
```

**Step 2: Add GitMerge import**

Update the imports (line 9) to include GitMerge:

```typescript
import { Rocket, Flask, Briefcase, User, Users, Layout, Target, CheckCircle, Question, PencilSimpleLine, FolderSimple, GitMerge } from "@phosphor-icons/react/dist/ssr";
```

**Step 3: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add components/project-wizard/steps/StepReview.tsx
git commit -m "feat(ai): show workstreams and tasks in StepReview"
```

---

## Task 11: Update createProject Action to Handle Workstreams and Tasks

**Files:**
- Modify: `lib/actions/projects.ts`

**Step 1: Read the file to understand current structure**

Run: `grep -n "createProject" lib/actions/projects.ts | head -20`

**Step 2: Update the createProject function parameters**

Find the `CreateProjectInput` type and add:

```typescript
  workstreams?: string[];
  starter_tasks?: {
    title: string;
    description?: string;
    priority: string;
    workstream?: string;
  }[];
```

**Step 3: Update the createProject function body**

After the project is created, add logic to:
1. Create workstreams from the array
2. Create tasks from starter_tasks

```typescript
// After project creation succeeds, create workstreams
if (input.workstreams && input.workstreams.length > 0) {
  for (let i = 0; i < input.workstreams.length; i++) {
    await supabase.from("workstreams").insert({
      project_id: project.id,
      name: input.workstreams[i],
      position: i,
    });
  }
}

// Create starter tasks
if (input.starter_tasks && input.starter_tasks.length > 0) {
  // Get workstream IDs if we created any
  let workstreamMap: Record<string, string> = {};
  if (input.workstreams && input.workstreams.length > 0) {
    const { data: workstreams } = await supabase
      .from("workstreams")
      .select("id, name")
      .eq("project_id", project.id);

    if (workstreams) {
      workstreamMap = Object.fromEntries(
        workstreams.map((ws) => [ws.name, ws.id])
      );
    }
  }

  for (let i = 0; i < input.starter_tasks.length; i++) {
    const task = input.starter_tasks[i];
    await supabase.from("tasks").insert({
      project_id: project.id,
      title: task.title,
      description: task.description || null,
      priority: task.priority,
      status: "todo",
      position: i,
      workstream_id: task.workstream ? workstreamMap[task.workstream] : null,
    });
  }
}
```

**Step 4: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add lib/actions/projects.ts
git commit -m "feat(ai): update createProject to handle workstreams and starter tasks"
```

---

## Task 12: Update ProjectWizard to Pass New Data to createProject

**Files:**
- Modify: `components/project-wizard/ProjectWizard.tsx`

**Step 1: Update the createProject call in guided mode**

Find the `createProject` call around line 322 and add the new fields:

```typescript
workstreams: data.workstreams,
starter_tasks: data.generatedTasks
  .filter((t) => t.included)
  .map((t) => ({
    title: t.title,
    description: t.description,
    priority: t.priority,
    workstream: t.workstream,
  })),
```

**Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add components/project-wizard/ProjectWizard.tsx
git commit -m "feat(ai): pass workstreams and tasks to createProject from wizard"
```

---

## Task 13: Final Testing and Cleanup

**Step 1: Run the build**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 2: Run linting**

Run: `pnpm lint`
Expected: No linting errors (or only pre-existing ones)

**Step 3: Manual testing checklist**

1. Open project creation wizard
2. Go through guided flow to StepOutcome
3. Click "Write with AI" - should either generate or show setup prompt
4. Continue to StepStructure
5. Click "Suggest" for workstreams - should generate workstreams
6. Enable starter tasks and click "Generate"
7. Edit generated tasks (change title, priority, workstream)
8. Continue to Review - should show workstreams and task count
9. Create project - should create with workstreams and tasks

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(ai): complete AI-enhanced project wizard implementation"
```

---

## Summary

This plan creates:
1. **useAIStatus hook** - Check if AI is configured
2. **AIGenerateButton** - Consistent AI trigger button
3. **AISetupPrompt** - Inline configuration popover
4. **AITaskPreview** - Editable task list component
5. **Updated types** - GeneratedTask, workstreams array
6. **Wired ProjectDescriptionEditor** - "Write with AI" works
7. **Enhanced StepStructure** - Workstreams + Task generation
8. **Updated StepReview** - Shows new data
9. **Updated createProject** - Persists workstreams and tasks

All components use existing AI infrastructure (rate limiting, encryption, multi-provider support).
