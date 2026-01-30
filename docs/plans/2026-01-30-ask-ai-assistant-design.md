# Ask AI Assistant Feature

**Date:** 2026-01-30
**Status:** Approved for Implementation

## Overview

Add a contextual AI chat assistant accessible via the "Ask AI" button on Projects and Tasks pages. Users can ask questions, get insights, perform actions, and attach files for analysis through natural conversation.

## Goals

1. Wire up existing "Ask AI" button to open chat panel
2. Build contextual chat interface with full data access
3. Enable file attachments for document analysis
4. Support write actions with confirmation flow

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI pattern | Right-side sheet | Standard assistant pattern, doesn't block main content |
| Conversation persistence | Session only | Keeps things simple and focused |
| Interaction style | Free-form chat | Natural language, AI interprets intent |
| Data access | **Full application access** | Everything: projects, tasks, clients, teams, settings, inbox, org data |
| Write capabilities | Full CRUD | Create/update any entity (tasks, projects, clients, workstreams, notes, etc.) |
| Write confirmation | Always confirm | User reviews before any data changes |
| File attachments | All file types | Text extraction client-side, supports PDFs, docs, images, code |
| File storage | Temporary only | Processed in-memory, deleted after session |
| Context scope | Application-wide | Access to all user data, plus current page context |

## Full Data Access

The AI assistant has **complete read access** to all application data:

### Core Data
| Data Type | Access | Details |
|-----------|--------|---------|
| Projects | Full | All projects, members, status, dates, description, deliverables, metrics |
| Workstreams | Full | All workstreams across projects with tasks |
| Tasks | Full | All tasks with subtasks, comments, assignments, history |
| Notes | Full | All project notes content |
| Files | Metadata | File names, types, sizes (not binary content) |

### Organization Data
| Data Type | Access | Details |
|-----------|--------|---------|
| Organization | Full | Name, settings, subscription info |
| Members | Full | All org members, roles, profiles |
| Teams | Full | Team structure, members |
| Invitations | Full | Pending invitations |

### Client Data
| Data Type | Access | Details |
|-----------|--------|---------|
| Clients | Full | All clients with contacts, projects, status |

### User Data
| Data Type | Access | Details |
|-----------|--------|---------|
| Profile | Full | User's profile, preferences |
| Settings | Full | AI settings, notification preferences |
| Inbox | Full | All inbox items, notifications |

### Write Capabilities (with confirmation)
| Action | Scope |
|--------|-------|
| Create/update tasks | Any project user has access to |
| Create/update workstreams | Any project |
| Create/update projects | Within organization |
| Create/update clients | Within organization |
| Create/update notes | Any project |
| Update project status | Any project |
| Manage team assignments | Within organization |

## Architecture

### New Components

#### `hooks/use-ai-chat.ts`
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  action?: PendingAction;
  timestamp: Date;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  extractedText?: string;
  previewUrl?: string;
}

interface PendingAction {
  type:
    | 'create_task' | 'update_task' | 'delete_task'
    | 'create_project' | 'update_project'
    | 'create_workstream' | 'update_workstream'
    | 'create_client' | 'update_client'
    | 'create_note' | 'update_note'
    | 'assign_task' | 'update_task_status'
    | 'add_project_member' | 'add_team_member';
  data: Record<string, unknown>;
  confirmed: boolean;
}

interface ChatContext {
  pageType: 'projects_list' | 'project_detail' | 'my_tasks' | 'clients' | 'settings' | 'inbox' | 'other';
  projectId?: string;
  clientId?: string;
  filters?: Record<string, unknown>;
  // Full application data - fetched server-side
  appData: {
    organization: { id: string; name: string };
    projects: ProjectSummary[];
    clients: ClientSummary[];
    teams: TeamSummary[];
    members: MemberSummary[];
    currentProject?: ProjectDetail;  // When on project detail page
    currentClient?: ClientDetail;    // When on client detail page
    userTasks?: TaskSummary[];       // User's assigned tasks
    inbox?: InboxItem[];             // User's notifications
    userSettings?: UserSettings;     // User preferences
  };
}

export function useAIChat(context: ChatContext): {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  confirmAction: (messageId: string) => Promise<void>;
  editAction: (messageId: string) => void;
  clearChat: () => void;
}
```

#### `components/ai/ai-chat-sheet.tsx`
Main container with:
- Sheet component from shadcn/ui
- Header with title and close button
- Message list with auto-scroll
- Input area with attachment support
- Uses `useAIChat` hook for state

#### `components/ai/ai-chat-message.tsx`
Individual message display:
- User messages aligned right with muted background
- Assistant messages aligned left with border
- File attachment previews
- Action confirmation UI (Confirm/Edit buttons)
- Markdown rendering for AI responses

#### `components/ai/ai-chat-input.tsx`
Input area with:
- Textarea for message input
- Attachment button with file picker
- Send button
- Attached files preview with remove option
- Keyboard shortcut (Enter to send, Shift+Enter for newline)

#### `components/ai/ai-action-confirmation.tsx`
Inline confirmation for write actions:
- Shows proposed action details
- Confirm button to execute
- Edit button to modify before confirming
- Cancel/dismiss option

#### `lib/actions/ai-chat.ts`
Server action for chat:
```typescript
interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: ChatContext;
  attachmentTexts?: { name: string; content: string }[];
}

interface ChatResponse {
  content: string;
  action?: PendingAction;
}

export async function sendChatMessage(request: ChatRequest): Promise<ActionResult<ChatResponse>>
```

### Files to Modify

| File | Changes |
|------|---------|
| `components/project-header.tsx` | Add onClick to "Ask AI" button, render AIChatSheet |
| `components/tasks/MyTasksPage.tsx` | Add onClick to "Ask AI" button, render AIChatSheet |
| `components/projects/ProjectPageHeader.tsx` | Add "Ask AI" button for project detail pages |
| `components/clients/ClientsPageHeader.tsx` | Add "Ask AI" button for clients page |
| `components/clients/ClientDetailsHeader.tsx` | Add "Ask AI" button for client detail |
| `lib/actions/ai.ts` | Add chat completion function |
| `lib/actions/ai-context.ts` | NEW: Fetch full application context for AI |

### New Server Action: `lib/actions/ai-context.ts`

Fetches all application data for AI context:
```typescript
export async function getAIContext(pageType: string, options?: {
  projectId?: string;
  clientId?: string;
}): Promise<ActionResult<ChatContext['appData']>> {
  // Fetch organization, projects, clients, teams, members, tasks, inbox
  // Fetch additional detail if on project/client detail page
  // Return structured data for AI prompt
}
```

## UI Design

### Chat Sheet Layout
```
┌──────────────────────────────────┐
│ ✦ AI Assistant              [✕] │
├──────────────────────────────────┤
│                                  │
│ ┌────────────────────────────┐   │
│ │ 👤 What tasks are overdue? │   │
│ └────────────────────────────┘   │
│                                  │
│ ┌────────────────────────────┐   │
│ │ ✦ Found 3 overdue tasks:   │   │
│ │   • Task A - 2 days        │   │
│ │   • Task B - 5 days        │   │
│ │   • Task C - 1 week        │   │
│ └────────────────────────────┘   │
│                                  │
│ ┌────────────────────────────┐   │
│ │ 👤 Create a follow-up task │   │
│ └────────────────────────────┘   │
│                                  │
│ ┌────────────────────────────┐   │
│ │ ✦ I'll create this task:   │   │
│ │                            │   │
│ │ ┌──────────────────────┐   │   │
│ │ │ Title: Review overdue│   │   │
│ │ │ Priority: High       │   │   │
│ │ │ Assignee: You        │   │   │
│ │ └──────────────────────┘   │   │
│ │                            │   │
│ │ [Confirm]  [Edit]          │   │
│ └────────────────────────────┘   │
│                                  │
├──────────────────────────────────┤
│ ┌────────┐                       │
│ │ 📄 doc │  [✕]                  │
│ └────────┘                       │
│ [📎] Type a message...      [↵] │
└──────────────────────────────────┘
```

### Action Confirmation States
```
Pending:    [Confirm]  [Edit]
Processing: [⟳ Creating...]
Success:    [✓ Created] - Task "Review overdue" created
Error:      [✗ Failed] - Could not create task. [Retry]
```

## Data Flow

### Chat Message Flow
```
1. User clicks "Ask AI" button
2. Sheet opens, system builds context:
   - Current page type
   - Active filters
   - Visible items (summarized)
   - For project detail: full project data
3. User types message (optionally attaches files)
4. Client extracts text from attachments:
   - PDF → PDF.js
   - DOCX → mammoth.js
   - Text/code → direct read
   - Images → base64 for vision models
5. sendChatMessage server action called with:
   - Message history
   - Context
   - Extracted attachment text
6. Server builds AI prompt with context
7. AI responds (may include proposed action)
8. If action proposed:
   - Show confirmation UI
   - User clicks Confirm
   - Execute corresponding server action
   - Show success/error
```

### Context by Page Type

**Base context (always included):**
- Organization info (name, members, teams)
- All projects summary (id, name, status, client)
- All clients summary (id, name, status)
- User's tasks across all projects
- User's inbox items

**Additional context per page:**

| Page | Additional Context |
|------|-------------------|
| Projects list | Current filters, visible projects |
| Project detail | Full project data: workstreams, all tasks, notes, files, members |
| My Tasks | Current filters, task grouping |
| Clients list | Current filters, visible clients |
| Client detail | Full client data: projects, contacts, history |
| Settings | User settings, AI configuration |
| Inbox | All notifications, read/unread status |

### System Prompt Structure
```
You are a project management AI assistant with full access to the user's application data.

## Current Context
- Page: {pageType}
- Filters: {filters}

## Organization
{organizationData}

## Projects ({count})
{projectsSummary}

## Clients ({count})
{clientsSummary}

## Teams & Members
{teamsAndMembers}

## User's Tasks ({count})
{userTasks}

## Inbox ({unreadCount} unread)
{inboxSummary}

{additionalPageContext}

## Attached Documents
{attachedFiles}

---

You can:
1. Answer questions about ANY data in the application
2. Provide insights, summaries, and analysis
3. Help find information across projects, tasks, clients
4. Propose actions (create/update tasks, projects, clients, workstreams, notes)

When proposing an action, include at the END of your response:
ACTION_JSON: {"type": "...", "data": {...}}

Available actions:
- create_task, update_task, delete_task, assign_task, update_task_status
- create_project, update_project
- create_workstream, update_workstream
- create_client, update_client
- create_note, update_note
- add_project_member, add_team_member

Keep responses concise and helpful.
```

## File Processing

### Client-Side Text Extraction
```typescript
async function extractText(file: File): Promise<string> {
  const type = file.type;

  if (type === 'application/pdf') {
    return extractPdfText(file); // PDF.js
  }
  if (type.includes('word') || file.name.endsWith('.docx')) {
    return extractDocxText(file); // mammoth.js
  }
  if (type.startsWith('text/') || isCodeFile(file.name)) {
    return file.text(); // Direct read
  }
  if (type.startsWith('image/')) {
    return `[Image: ${file.name}]`; // Mark for vision processing
  }

  return `[Unsupported file type: ${file.name}]`;
}
```

### Libraries Needed
- `pdfjs-dist` - PDF text extraction
- `mammoth` - DOCX text extraction

## Implementation Phases

### Phase 1: Core Infrastructure
- Create `hooks/use-ai-chat.ts`
- Create `lib/actions/ai-chat.ts`
- Add chat completion to AI actions

### Phase 2: UI Components
- Create `components/ai/ai-chat-sheet.tsx`
- Create `components/ai/ai-chat-message.tsx`
- Create `components/ai/ai-chat-input.tsx`

### Phase 3: Integration
- Wire up "Ask AI" in `project-header.tsx`
- Wire up "Ask AI" in `MyTasksPage.tsx`
- Add context building logic

### Phase 4: Actions
- Create `components/ai/ai-action-confirmation.tsx`
- Implement action parsing and execution
- Add confirmation flow

### Phase 5: File Attachments
- Install PDF.js and mammoth
- Implement text extraction utilities
- Add attachment UI to chat input
- Include extracted text in messages

### Phase 6: Project Detail
- Add "Ask AI" to project detail header
- Build full project context
- Test with complex projects

## Technical Notes

- Uses existing AI infrastructure (rate limiting, providers, encryption)
- Chat messages not persisted to database (session only)
- File attachments processed client-side, never stored
- Context is rebuilt fresh each time sheet opens
- Action execution uses existing server actions (createTask, etc.)
- Markdown rendering for AI responses (use react-markdown)

## Rate Limiting

Same limits as other AI features:
- 50 requests per day per user
- 3 concurrent requests max
- Uses existing `rateLimiters.ai` and `rateLimiters.aiConcurrent`
