# AI-Enhanced Project Creation Wizard

**Date:** 2026-01-30
**Status:** Approved for Implementation

## Overview

Enhance the project creation wizard with AI-powered features for generating project descriptions, suggesting workstreams, and creating starter tasks.

## Goals

1. Wire up existing "Write with AI" button for project descriptions
2. Add AI-powered workstream suggestions to guided wizard
3. Replace simple "Add starter tasks" toggle with AI task generation and editable preview
4. Provide seamless inline AI setup when not configured

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI trigger flow | Context-aware + optional prompt | Uses existing project data, allows user guidance |
| Task generation timing | At StepStructure | Natural point after structure selection |
| Task preview style | Editable list | Full user control before creation |
| Workstream placement | Enhanced StepStructure | Keeps related concepts together |
| No AI config handling | Inline setup prompt | Reduces friction vs redirect to settings |
| API key scope | User level | Matches existing architecture |
| Visual style | Subtle sparkle accents | Recognizable but not overwhelming |
| Description replacement | Always replace | Simpler UX |
| Task editing | Inline | Faster workflow |
| Task workstream assignment | AI assigns automatically | Reduces manual work |

## Architecture

### New Components

#### `hooks/use-ai-status.ts`
```typescript
export function useAIStatus(): {
  isConfigured: boolean;
  isLoading: boolean;
  provider: string | null;
  model: string | null;
}
```
- Calls `hasAIConfigured()` from user-settings actions
- Caches result to avoid repeated calls

#### `components/ai/ai-generate-button.tsx`
Reusable button with:
- Sparkle icon (StarFour from Phosphor)
- Violet/purple gradient on hover
- Loading state with spinner
- Configurable label text

#### `components/ai/ai-setup-prompt.tsx`
Inline AI configuration popover:
- Provider selection dropdown
- Model selection (dynamic based on provider)
- API key input with visibility toggle
- Test connection button
- Save & Continue action
- Appears in popover when clicking AI button without config

#### `components/ai/ai-task-preview.tsx`
Editable task list:
- Checkbox to include/exclude each task
- Inline editable title
- Priority badge (editable dropdown)
- Workstream badge (editable dropdown)
- Delete button per task
- Regenerate button
- Add custom task button

### State Changes

#### `types.ts` Additions
```typescript
interface GeneratedTask {
  id: string;           // temp ID for UI
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  workstream?: string;  // workstream label
  included: boolean;    // checkbox state
}

interface ProjectData {
  // ... existing fields ...
  workstreams: string[];           // NEW
  generatedTasks: GeneratedTask[]; // NEW (replaces addStarterTasks boolean)
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `components/project-wizard/types.ts` | Add `workstreams`, `generatedTasks` |
| `components/project-wizard/ProjectDescriptionEditor.tsx` | Wire up "Write with AI" |
| `components/project-wizard/steps/StepStructure.tsx` | Add workstream + task sections |
| `components/project-wizard/steps/StepReview.tsx` | Show workstreams and tasks |
| `components/project-wizard/ProjectWizard.tsx` | Update createProject call |
| `lib/actions/projects.ts` | Create workstreams and tasks on project creation |
| `lib/actions/ai.ts` | Ensure `generateWorkstreams()` is complete |

## UI Designs

### StepStructure Enhanced Layout
```
┌─────────────────────────────────────────────────────────────┐
│ How do you want to structure the work?                      │
│                                                             │
│  ○ Linear        ○ Milestones       ○ Multistream          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Workstreams                                    [✦ Suggest] │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ ✕ Frontend  │ │ ✕ Backend   │ │ ✕ Design    │  [+ Add]  │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Starter Tasks                                               │
│                                                             │
│  ☑ Add starter tasks                         [✦ Generate] │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Generated 5 tasks                        [Regenerate] │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ ☑ │ Set up project repository  │ Backend │ High   │ ✕ │ │
│  │ ☑ │ Create wireframes          │ Design  │ Medium │ ✕ │ │
│  │ ☑ │ Set up CI/CD pipeline      │ Backend │ Medium │ ✕ │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │                              [+ Add custom task]      │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### AI Setup Prompt (Popover)
```
┌──────────────────────────────────────────────┐
│ ✦ Set up AI to unlock this feature          │
│                                              │
│ Provider: [OpenAI ▼]  Model: [GPT-4o ▼]     │
│ API Key:  [••••••••••••••••••]  👁          │
│                                              │
│ [Test Connection]         [Save & Continue] │
└──────────────────────────────────────────────┘
```

## Data Flow

### Project Creation
1. Create project record (existing)
2. Create workstreams from `data.workstreams` array (NEW)
3. Create tasks from `data.generatedTasks.filter(t => t.included)` (NEW)
4. Assign tasks to their workstreams (NEW)

### AI Context for Generation

**Description Generation:**
- Project name
- Project intent (delivery/experiment/internal)
- Deliverables list
- Metrics list
- User's optional prompt

**Workstream Suggestion:**
- Project name
- Project intent
- Deliverables

**Task Generation:**
- Project name, intent, description
- Deliverables and due dates
- Selected workstreams
- Work structure type

## Implementation Phases

### Phase 1: Foundation
- Create `hooks/use-ai-status.ts`
- Create `components/ai/ai-generate-button.tsx`
- Create `components/ai/ai-setup-prompt.tsx`

### Phase 2: Description Generation
- Wire up "Write with AI" in `ProjectDescriptionEditor.tsx`
- Add optional prompt input
- Integrate with `generateProjectDescription()`

### Phase 3: Workstreams
- Add workstream section to `StepStructure.tsx`
- Create workstream chips UI with add/remove
- Integrate with `generateWorkstreams()`

### Phase 4: Task Generation
- Create `components/ai/ai-task-preview.tsx`
- Replace toggle with full task generation UI in `StepStructure.tsx`
- Update `types.ts` with new state
- Integrate with `generateTasks()`

### Phase 5: Integration
- Update `StepReview.tsx` to show workstreams and tasks
- Update `ProjectWizard.tsx` createProject call
- Update `lib/actions/projects.ts` to persist workstreams and tasks

## Technical Notes

- All AI calls use existing rate-limited infrastructure (50/day, 3 concurrent)
- API keys are AES-256-GCM encrypted
- Existing functions in `lib/actions/ai.ts`: `generateProjectDescription`, `generateTasks`, `generateWorkstreams`
- Visual style: Phosphor StarFour icon, violet accents on AI buttons
