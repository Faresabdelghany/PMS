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
  - `auth/callback/` - OAuth callback handler
  - `onboarding/` - Organization onboarding
  - `projects/`, `tasks/`, `clients/` - Main app routes
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

**Mock Data (legacy):** Still in `lib/data/` - being migrated to Supabase queries.

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

## Implementation Status

See `docs/plans/2026-01-22-backend-implementation-plan.md` for detailed progress.

**Completed:**
- Phase 1: Foundation (Auth, Database, Supabase setup)

**In Progress:**
- Phase 2: Core Data Layer (Organizations, Clients, Projects)

**Pending:**
- Phase 3: Tasks & Workstreams
- Phase 4: Files, Notes & AI
- Phase 5: Real-time & Deployment
