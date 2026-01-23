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
pnpm test:e2e:report       # View HTML test report
pnpm test:e2e:codegen      # Generate tests via recording
```

Tests are in `e2e/` with Page Object Model pattern (`e2e/pages/`). Auth setup runs first via `e2e/auth.setup.ts`.

### Supabase Commands

```bash
npx supabase db push                    # Push migrations to remote database
npx supabase db reset --linked          # Reset remote database
npx supabase gen types typescript       # Generate TypeScript types
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
  - `data/` - Mock data (being migrated to Supabase)
  - `utils.ts` - Utility helpers including `cn()` for class merging
- **`hooks/`** - Custom React hooks
- **`supabase/`** - Database migrations

### Backend (Supabase)

**Clients:**
- `lib/supabase/client.ts` - Browser client (use in Client Components)
- `lib/supabase/server.ts` - Server client with cookies (use in Server Components/Actions)
- `lib/supabase/admin.ts` - Service role client (bypasses RLS, server-only)

**Server Actions:**
- `lib/actions/auth.ts` - Authentication (signIn, signUp, signOut, OAuth)
- `lib/actions/organizations.ts` - Organization CRUD and member management
- `lib/actions/projects.ts` - Project CRUD and member management
- `lib/actions/clients.ts` - Client CRUD
- `lib/actions/tasks.ts` - Task CRUD, reordering, status updates
- `lib/actions/workstreams.ts` - Workstream CRUD and reordering
- `lib/actions/files.ts` - File upload/download to Supabase Storage
- `lib/actions/notes.ts` - Notes CRUD with audio support
- `lib/actions/ai.ts` - AI generation (OpenAI, Anthropic, Google)
- `lib/actions/user-settings.ts` - AI settings and API key management

**Database Schema:**
- 17 tables with full RLS policies
- Multi-tenant architecture (organization-based isolation)
- See `supabase/migrations/` for complete schema

### Key Patterns

**Path aliases:** Use `@/` for imports (e.g., `@/components/ui/button`)

**Server Actions:** All data mutations use Next.js Server Actions in `lib/actions/`. Actions return `{ data?, error? }` pattern.

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

**Supabase Integration Status:**
- **Sidebar:** Displays real active projects and user profile from Supabase
- **Projects list:** Fetches from Supabase with real-time updates
- **Project details:** Fetches project name, status, priority, progress from Supabase (other details use mock structure)
- **Clients list:** Fetches from Supabase with project counts
- **Client details:** Fetches from Supabase at `/clients/[id]`

**Legacy Mock Data:** `lib/data/` contains mock data files used as fallback structure for project details (scope, outcomes, features, timeline).

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://lazhmdyajdqbnxxwyxun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Tech Stack

- Next.js 16 (App Router, React Server Components)
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

## Features

- **Authentication:** Email/password + Google OAuth with organization onboarding
- **Multi-tenant:** Organization-based data isolation via RLS
- **Projects:** Full CRUD with wizard, scope, outcomes, features
- **Tasks:** Kanban boards, drag-drop reordering, workstream grouping
- **Clients:** Client management with project associations
- **Files:** Upload to Supabase Storage (up to 100MB)
- **Notes:** Rich text notes with audio support
- **AI:** User-provided API keys for OpenAI, Anthropic, Google Gemini
- **Real-time:** Instant updates via Supabase Realtime (~50ms latency)
