# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern project & task management SaaS application built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and Supabase for the backend.

**GitHub:** https://github.com/Faresabdelghany/PMS
**Supabase Project:** lazhmdyajdqbnxxwyxun

## Development Commands

```bash
pnpm install          # Install dependencies (Node.js 20+ required)
pnpm dev              # Start development server at localhost:3000
pnpm build            # Production build
pnpm build:analyze    # Production build with bundle analyzer
pnpm start            # Run production server
pnpm lint             # Run ESLint
```

### E2E Testing (Playwright)

```bash
pnpm test:e2e              # Run all E2E tests (auto-starts dev server)
pnpm test:e2e --headed     # Run tests with visible browser
pnpm test:e2e --debug      # Debug mode with inspector
pnpm test:e2e --ui         # Interactive UI mode
pnpm test:e2e login.spec.ts              # Run a single test file
pnpm test:e2e --project=chromium         # Run on specific browser
pnpm test:e2e --grep "test name"         # Run specific test by name
pnpm test:e2e:report       # View HTML test report
pnpm test:e2e:codegen      # Generate tests via recording
```

Tests are in `e2e/` with Page Object Model pattern:
- `e2e/pages/BasePage.ts` - Base class with common page methods
- Page objects extend BasePage (LoginPage, DashboardPage, ProjectsPage, etc.)
- `e2e/fixtures.ts` - Custom test fixtures providing page objects and test data
- `e2e/auth.setup.ts` - Saves auth state to `e2e/.auth/user.json` for reuse
- Playwright auto-starts dev server; runs on chromium/firefox/webkit + mobile viewports

**E2E Test Environment:**
```bash
TEST_USER_EMAIL=<test-user-email>      # Must be an existing Supabase auth user
TEST_USER_PASSWORD=<test-user-password>
```
Note: The test user must already exist in Supabase auth—it is not created automatically by the test setup.

### Supabase Commands

```bash
npx supabase db push                    # Push migrations to remote database
npx supabase db reset --linked          # Reset remote database
npx supabase gen types typescript --project-id lazhmdyajdqbnxxwyxun > lib/supabase/database.types.ts
```

**Local Development (optional):**
```bash
npx supabase start                      # Start local Supabase stack
npx supabase stop                       # Stop local Supabase
npx supabase status                     # Check local services status
```

## Architecture

### Directory Structure

- **`app/`** - Next.js App Router pages and layouts
  - `(auth)/` - Authentication pages (login, signup)
  - `(dashboard)/` - Main app routes with shared layout (projects, clients, tasks, settings, chat)
  - `auth/callback/` - OAuth callback handler
  - `onboarding/` - Organization onboarding
  - `invite/` - Organization invitation acceptance flow
- **`components/`** - React components organized by feature
  - `ui/` - shadcn/ui design system primitives
  - `projects/`, `tasks/`, `clients/` - Feature components
  - `tasks/TaskDetailPanel.tsx` - Slide-over panel for task details with timeline
  - `tasks/TaskTimeline.tsx` - Combined comments and activity feed
  - `tasks/TaskCommentEditor.tsx` - Rich text comment input with @mentions
  - `project-wizard/` - Multi-step project creation wizard
  - `ai/` - AI chat components (chat view, input, history sidebar)
  - `dashboard/` - Cached dashboard stat cards and project lists
  - `skeletons/` - Loading skeleton components for all major views
- **`lib/`** - Utilities and data
  - `supabase/` - Supabase clients and types
  - `actions/` - Server Actions for data mutations
  - `request-cache.ts` - Core request-level caching (`cachedGetUser`, `getSupabaseClient`, and cached action wrappers)
  - `server-cache.ts` - Additional request-level cached functions (wraps actions with React `cache()`)
  - `cache-tags.ts` - Cache tag constants for granular revalidation
  - `cache/` - KV caching layer (Vercel KV/Redis) for cross-request caching
  - `rate-limit/` - Rate limiting with Upstash/Vercel KV
  - `data/` - Type definitions and interfaces
  - `utils.ts` - Utility helpers including `cn()` for class merging
  - `utils/activity-formatter.ts` - Activity message formatting helpers
- **`hooks/`** - Custom React hooks
- **`supabase/`** - Database migrations
- **`e2e/`** - Playwright E2E tests
  - `pages/` - Page Object Model classes
  - `auth.setup.ts` - Authentication setup for tests
  - `fixtures.ts` - Test fixtures with authenticated context

### Backend (Supabase)

**Clients:**
- `lib/supabase/client.ts` - Browser client (use in Client Components)
- `lib/supabase/server.ts` - Server client with cookies (use in Server Components/Actions)
- `lib/supabase/admin.ts` - Service role client (bypasses RLS, server-only)

**Server Actions:** All actions return `ActionResult<T>` type (`{ data?, error? }`) from `lib/actions/types.ts`.
- `lib/actions/auth.ts` - Authentication (signIn, signUp, signOut, OAuth)
- `lib/actions/auth-helpers.ts` - Authorization helpers (`requireAuth`, `requireOrgMember`, `requireProjectMember`, `requireProjectOwnerOrPIC`)
- `lib/actions/organizations.ts` - Organization CRUD and member management
- `lib/actions/projects.ts` - Project CRUD and member management
- `lib/actions/project-details.ts` - Project details fetching with relations
- `lib/actions/clients.ts` - Client CRUD
- `lib/actions/tasks.ts` - Task CRUD, reordering, status updates
- `lib/actions/task-comments.ts` - Task comments with reactions and attachments
- `lib/actions/task-activities.ts` - Task activity logging and timeline
- `lib/actions/workstreams.ts` - Workstream CRUD and reordering
- `lib/actions/files.ts` - File upload/download to Supabase Storage
- `lib/actions/notes.ts` - Notes CRUD with audio support
- `lib/actions/inbox.ts` - User inbox/notifications
- `lib/actions/invitations.ts` - Organization member invitations
- `lib/actions/teams.ts` - Team CRUD
- `lib/actions/tags.ts` - Organization tags CRUD
- `lib/actions/labels.ts` - Project labels CRUD
- `lib/actions/deliverables.ts` - Project deliverables CRUD
- `lib/actions/workflow-statuses.ts` - Custom workflow status management
- `lib/actions/ai.ts` - AI generation (OpenAI, Anthropic, Google)
- `lib/actions/ai-context.ts` - AI context helpers for project/task data
- `lib/actions/ai-types.ts` - AI action types and proposed action schemas
- `lib/actions/ai-helpers.ts` - AI prompt building and response parsing
- `lib/actions/execute-ai-action.ts` - Execute AI-proposed actions (create task, update project, etc.)
- `lib/actions/conversations.ts` - AI chat conversations and messages CRUD
- `lib/actions/user-settings.ts` - User preferences, AI settings, color theme
- `lib/actions/search.ts` - Global search across projects, tasks, and clients
- `lib/actions/notifications.ts` - Send notifications via inbox system
- `lib/actions/import.ts` - CSV import for tasks

**Database Schema:**
- 22 tables with full RLS policies
- Multi-tenant architecture (organization-based isolation)
- See `supabase/migrations/` for complete schema

### Key Patterns

**Path aliases:** Use `@/` for imports (e.g., `@/components/ui/button`)

**Server Actions:** All data mutations use Next.js Server Actions in `lib/actions/`. Actions return `ActionResult<T>` (`{ data?, error? }`) pattern. Use auth helpers for authorization:
```typescript
const { user, supabase } = await requireAuth()           // Basic auth
const ctx = await requireOrgMember(orgId)                // Org membership
const ctx = await requireProjectMember(projectId)       // Project membership
const ctx = await requireProjectOwnerOrPIC(projectId)   // Elevated access
```

**Request-Level Caching (two layers):**

1. `lib/request-cache.ts` — Core cached functions including auth and Supabase client:
```typescript
import { cachedGetUser, getSupabaseClient } from "@/lib/request-cache"

// Shared auth check — layout and pages share one call per request
const { user, supabase } = await cachedGetUser()

// cachedGetUser uses getSession() (fast local cookie read, ~0ms)
// instead of getUser() (~300-500ms network call) because middleware refreshes the token
```

2. `lib/server-cache.ts` — Cached data-fetching wrappers:
```typescript
import { getCachedProjects, getCachedTasks } from "@/lib/server-cache"

// Multiple components calling this in the same request share one DB query
const projects = await getCachedProjects(orgId)
```
Available cached functions: `getCachedProjects`, `getCachedProject`, `getCachedTasks`, `getCachedClients`, `getCachedOrganizationMembers`, `getCachedProjectCount`, `getCachedTaskStats`, etc.

**Cache Tags:** Use `lib/cache-tags.ts` for granular cache invalidation:
```typescript
import { CacheTags, revalidateTag } from "@/lib/cache-tags"

// Invalidate specific cached data after mutations
revalidateTag(CacheTags.projects(orgId))
revalidateTag(CacheTags.project(projectId))
```

**KV Caching (Cross-Request):** Use `lib/cache/` for persistent caching with Vercel KV/Redis:
```typescript
import { CacheKeys, CacheTTL, cacheGet } from "@/lib/cache"

// TTL tiers: USER (10min), PROJECTS (2min), TASKS (30sec)
const projects = await cacheGet(CacheKeys.projects(orgId), fetchProjects, CacheTTL.PROJECTS)
```
Gracefully degrades when KV is unavailable (local dev).

**Next.js Cache Profiles (`next.config.mjs`):** Custom `cacheLife` profiles defined for future use:
- `realtimeBacked` (stale: 5min) — data with real-time subscriptions (projects, tasks)
- `semiStatic` (stale: 15min) — infrequently changing data (members, tags)
- `static` (stale: 30min) — rarely changing data (organization details)
- `user` (stale: 1hr) — user profile and preferences

Note: PPR (`cacheComponents`) is disabled because the app is fully auth-protected. Performance is achieved through request-level dedup, KV caching, tag-based invalidation, and Suspense streaming.

**Skeleton Components:** Use `components/skeletons/` for loading states:
```typescript
import { ProjectsListSkeleton, TaskListSkeleton } from "@/components/skeletons"

// Use in Suspense boundaries
<Suspense fallback={<ProjectsListSkeleton />}>
  <ProjectsList />
</Suspense>
```

**Streaming with loading.tsx:** Most dashboard routes have `loading.tsx` files that show skeleton UIs instantly while the page data loads. These use the same skeleton components and enable streaming via App Router.

**Authentication Flow:**
1. User signs up/in via `/login` or `/signup`
2. OAuth callback at `/auth/callback` handles session exchange
3. OAuth callback auto-creates personal organization for new users
4. `middleware.ts` runs on every request:
   - Fast-path: No auth cookie + protected route → redirect to `/login?redirect=<path>` (saves ~300-500ms by skipping `getUser()`)
   - Auth cookie exists → refreshes token via `getUser()`, making `getSession()` safe for downstream Server Components
   - Redirects authenticated users away from `/login` and `/signup`
5. Dashboard layout (`app/(dashboard)/layout.tsx`) checks auth via `cachedGetUser()`:
   - Redirects unauthenticated users to `/login`
   - Redirects users without organization to `/onboarding`

**Styling:** Tailwind CSS with CSS custom properties for theming. Light/dark mode via `next-themes`. Color themes via `ColorThemeProvider`. Component variants use `class-variance-authority`.

**Color Themes:** 12 color themes available (default, forest, ocean, sunset, rose, supabase, chatgpt, midnight, lavender, ember, mint, slate). Managed by `ColorThemeProvider` in dashboard layout. Use `useColorTheme()` hook to access/set theme.

**shadcn/ui:** Uses "new-york" style with Lucide icons. Add new components via `npx shadcn@latest add <component>`.

**Dynamic routes:** Uses Next.js 16 async params pattern:
```typescript
type PageProps = { params: Promise<{ id: string }> }
export default async function Page({ params }: PageProps) {
  const { id } = await params
}
```

**Dashboard Layout Pattern:** All main app pages are under `app/(dashboard)/` route group which:
- Provides shared layout with sidebar, header, and providers
- Provider nesting order (outermost first): `UserProvider` → `OrganizationProvider` → `RealtimeProvider` → `SettingsDialogProvider` → `CommandPaletteProvider` → `ColorThemeSyncer` → `NotificationToastProviderLazy` → `SidebarProvider`
- Fetches orgs, profile, active projects, and color theme in parallel (no waterfall)
- Server Components fetch Supabase data and pass to Client Components as props

**Command Palette:** Global search and actions via Cmd+K (Mac) / Ctrl+K (Windows):
- Search projects, tasks, and clients globally
- Quick create project or task
- Managed by `CommandPaletteProvider` in dashboard layout

**Task Detail Panel:** URL-driven slide-over panel for viewing and editing tasks:
- Opens via `?task=<taskId>` URL parameter (enables deep linking and browser back)
- Shows task header, fields, description, and combined activity/comments timeline
- Real-time updates via `useTaskTimelineRealtime` hook
- Comment editor with @mentions and emoji reactions
- Click task title in any task list to open panel

**Rate Limiting:** Production uses Upstash + Vercel KV for rate limiting in `lib/rate-limit/`:
- `rateLimiters.auth` - 5 requests per 15 min (brute force protection)
- `rateLimiters.ai` - 50 requests per 24h (cost control)
- `rateLimiters.aiConcurrent` - 3 requests per min
- `rateLimiters.fileUpload` - 50 requests per hour
- `rateLimiters.invite` - 20 requests per hour (email spam protection)
- Gracefully degrades when KV is unavailable (local dev)

### Data Layer

**Supabase Tables:**
- `profiles` - User profiles (synced from auth.users)
- `organizations` - Multi-tenant organizations
- `organization_members` - Org membership with roles (admin/member)
- `organization_tags` - Organization-level tags
- `teams` - Teams within organizations
- `clients` - Client management
- `projects` - Project management with extended fields
- `project_members` - Project membership with roles (owner/pic/member/viewer)
- `organization_labels` - Organization-level labels (type, duration, group, badge categories)
- `tasks` - Task management
- `task_comments` - Task comments with rich text content
- `task_comment_reactions` - Emoji reactions on comments
- `task_comment_attachments` - File attachments on comments
- `task_activities` - Activity log for task changes (status, assignee, etc.)
- `workstreams` - Task grouping within projects
- `project_files`, `project_notes` - Project assets
- `inbox_items` - User notifications/inbox
- `user_settings` - User preferences and AI settings (includes color_theme)
- `chat_conversations` - AI chat conversation threads
- `chat_messages` - AI chat messages with action data

**Real-time Hooks:** Two realtime systems available:
- `hooks/use-realtime.ts` - Individual hooks: `useTasksRealtime`, `useWorkstreamsRealtime`, `useProjectsRealtime`, etc.
- `hooks/use-task-timeline-realtime.ts` - Real-time updates for task comments, activities, and reactions
- `hooks/use-project-files-realtime.ts` - Real-time updates for project files
- `hooks/realtime-context.tsx` - Pooled subscriptions via `RealtimeProvider`:
  - Multiple components share subscriptions through context
  - Auto-pauses when browser tab is hidden to reduce connection overhead
  - Use `usePooledRealtime`, `usePooledTasksRealtime`, `usePooledProjectsRealtime`, etc.

**AI Chat Hooks:**
- `hooks/use-ai-chat.ts` - Core AI chat hook for streaming responses
- `hooks/use-persisted-ai-chat.ts` - AI chat with Supabase persistence
- `hooks/use-ai-status.ts` - Track AI request status and loading states

**Data Types:** `lib/data/` contains UI type definitions only (interfaces and helper functions like `computeFilterCounts`). All data is fetched from Supabase.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://lazhmdyajdqbnxxwyxun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Required for AI API key encryption (AES-256-GCM)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=<64-hex-character-key>

# Optional: Rate limiting (production only)
KV_REST_API_URL=<vercel-kv-url>
KV_REST_API_TOKEN=<vercel-kv-token>
```

## Tech Stack

- Next.js 16.1 (App Router, React Server Components)
- React 19 + TypeScript (strict mode enabled)
- Tailwind CSS 4.1 + PostCSS
- Supabase (PostgreSQL, Auth, Realtime, Storage)
- shadcn/ui + Radix UI primitives
- Forms: React Hook Form + Zod validation
- Rich text: Tiptap editor
- Drag/drop: @dnd-kit
- Charts: Recharts
- Icons: Lucide, Phosphor Icons
- E2E Testing: Playwright with Page Object Model
- Rate Limiting: Upstash + Vercel KV

## Deployment

**Production URL:** https://pms-nine-gold.vercel.app

- Hosted on Vercel with auto-deploy from `main` branch
- Supabase project: `lazhmdyajdqbnxxwyxun`
- Google OAuth configured for production
