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
  - `(dashboard)/` - Main app routes with shared layout (projects, clients, tasks, settings)
  - `auth/callback/` - OAuth callback handler
  - `onboarding/` - Organization onboarding
- **`components/`** - React components organized by feature
  - `ui/` - shadcn/ui design system primitives
  - `projects/`, `tasks/`, `clients/` - Feature components
  - `project-wizard/` - Multi-step project creation wizard
- **`lib/`** - Utilities and data
  - `supabase/` - Supabase clients and types
  - `actions/` - Server Actions for data mutations
  - `data/` - Type definitions and interfaces (mock data fully migrated to Supabase)
  - `utils.ts` - Utility helpers including `cn()` for class merging
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
- `lib/actions/organizations.ts` - Organization CRUD and member management
- `lib/actions/projects.ts` - Project CRUD and member management
- `lib/actions/project-details.ts` - Project details fetching with relations
- `lib/actions/clients.ts` - Client CRUD
- `lib/actions/tasks.ts` - Task CRUD, reordering, status updates
- `lib/actions/workstreams.ts` - Workstream CRUD and reordering
- `lib/actions/files.ts` - File upload/download to Supabase Storage
- `lib/actions/notes.ts` - Notes CRUD with audio support
- `lib/actions/invitations.ts` - Organization member invitations
- `lib/actions/teams.ts` - Team CRUD
- `lib/actions/ai.ts` - AI generation (OpenAI, Anthropic, Google)
- `lib/actions/user-settings.ts` - AI settings and API key management

**Database Schema:**
- 17 tables with full RLS policies
- Multi-tenant architecture (organization-based isolation)
- See `supabase/migrations/` for complete schema

### Key Patterns

**Path aliases:** Use `@/` for imports (e.g., `@/components/ui/button`)

**Server Actions:** All data mutations use Next.js Server Actions in `lib/actions/`. Actions return `ActionResult<T>` (`{ data?, error? }`) pattern.

**Authentication Flow:**
1. User signs up/in via `/login` or `/signup`
2. OAuth callback at `/auth/callback` handles session
3. Middleware checks auth and redirects appropriately
4. First-time users go to `/onboarding` to create organization

**Middleware:** `middleware.ts` handles:
- Route protection (redirects unauthenticated users to `/login`)
- Auth page redirects (authenticated users go to `/`)
- Organization check (users without org go to `/onboarding`)

**Styling:** Tailwind CSS with CSS custom properties for theming. Light/dark mode via `next-themes`. Component variants use `class-variance-authority`.

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
- Wraps pages with `UserProvider` and `OrganizationProvider` for context
- Fetches active projects for sidebar display
- Server Components fetch Supabase data and pass to Client Components as props

### Data Layer

**Supabase Tables:**
- `profiles` - User profiles (synced from auth.users)
- `organizations` - Multi-tenant organizations
- `organization_members` - Org membership with roles (admin/member)
- `teams` - Teams within organizations
- `clients` - Client management
- `projects` - Project management with extended fields
- `project_members` - Project membership with roles (owner/pic/member/viewer)
- `tasks` - Task management
- `workstreams` - Task grouping within projects
- `project_files`, `project_notes` - Project assets

**Real-time Hooks:** `hooks/use-realtime.ts` provides instant updates via Supabase Realtime:
- `useTasksRealtime`, `useWorkstreamsRealtime`, `useProjectsRealtime`, `useClientsRealtime`
- `useFilesRealtime`, `useNotesRealtime`, `useOrganizationMembersRealtime`
- Hooks automatically pause subscriptions when browser tab is hidden to reduce connection overhead

**Supabase Integration Status:** All data is now fetched from Supabase:
- **Sidebar:** Real active projects and user profile
- **Projects list:** Supabase with real-time updates
- **Project details:** Full project data including scope, outcomes, features, workstreams, tasks
- **Tasks page:** User's assigned tasks from Supabase with CRUD operations
- **Clients list & details:** Full Supabase integration with project counts
- **Project creation wizard:** Real clients and organization members

**Data Types:** `lib/data/` contains UI type definitions only (interfaces and helper functions like `computeFilterCounts`). All data is fetched from Supabase - there is no mock data in the codebase.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://lazhmdyajdqbnxxwyxun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Tech Stack

- Next.js 16.1 (App Router, React Server Components)
- React 19 + TypeScript (strict mode)
- Tailwind CSS 4.1 + PostCSS
- Supabase (PostgreSQL, Auth, Realtime, Storage)
- shadcn/ui + Radix UI primitives
- Forms: React Hook Form + Zod validation
- Rich text: Tiptap editor
- Drag/drop: @dnd-kit
- Charts: Recharts
- Icons: Lucide, Phosphor Icons
- E2E Testing: Playwright with Page Object Model

## Deployment

**Production URL:** https://pms-nine-gold.vercel.app

- Hosted on Vercel with auto-deploy from `main` branch
- Supabase project: `lazhmdyajdqbnxxwyxun`
- Google OAuth configured for production

