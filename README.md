# Project Management System (PMS)

A modern project and task management SaaS application built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4.1 + PostCSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **UI Components**: shadcn/ui + Radix UI primitives
- **Forms**: React Hook Form + Zod validation
- **Rich Text**: Tiptap editor
- **Drag & Drop**: @dnd-kit
- **Charts**: Recharts
- **Icons**: Lucide, Phosphor Icons

## Features

- **Multi-tenant Architecture**: Organization-based data isolation with role-based access control
- **Authentication**: Email/password and OAuth (Google, GitHub) via Supabase Auth
- **Project Management**: Full CRUD with status tracking, priorities, and progress visualization
- **Task Management**: Kanban-style task boards with drag-and-drop reordering
- **Team Collaboration**: Organization members, teams, and project-level roles
- **Client Management**: Track clients with projects and contact information
- **Workstreams**: Organize tasks within projects into logical groups

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended)

### Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Production Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
app/                    # Next.js App Router pages
  (auth)/              # Authentication pages (login, signup)
  (dashboard)/         # Protected dashboard routes
  auth/callback/       # OAuth callback handler
  onboarding/          # Organization onboarding

components/            # React components
  ui/                  # shadcn/ui design system primitives
  projects/            # Project-related components
  tasks/               # Task-related components
  clients/             # Client-related components
  project-wizard/      # Multi-step project creation

lib/                   # Utilities and data
  supabase/            # Supabase clients and types
  actions/             # Server Actions for data mutations

hooks/                 # Custom React hooks

supabase/             # Database migrations
```

## Database Schema

The application uses a PostgreSQL database with Row Level Security (RLS) policies:

- `profiles` - User profiles (synced from auth.users)
- `organizations` - Multi-tenant organizations
- `organization_members` - Org membership with roles
- `teams` - Teams within organizations
- `clients` - Client management
- `projects` - Project management
- `project_members` - Project membership with roles
- `tasks` - Task management
- `workstreams` - Task grouping within projects
- `invitations` - Organization invitations

## Development Commands

```bash
pnpm dev              # Start development server
pnpm build            # Production build
pnpm start            # Run production server
pnpm lint             # Run ESLint
```

### Supabase Commands

```bash
npx supabase db push                    # Push migrations to remote
npx supabase db reset --linked          # Reset remote database
npx supabase gen types typescript       # Generate TypeScript types
```
