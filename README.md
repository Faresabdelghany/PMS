<h1 align="center">Project Dashboard · Next.js + Supabase</h1>

<p align="center">
  A modern project & task management SaaS application built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase.
</p>

<p align="center">
  <a href="https://pms-nine-gold.vercel.app"><strong>Live demo</strong></a>
  ·
  <a href="#getting-started"><strong>Run locally</strong></a>
  ·
  <a href="#architecture"><strong>Explore the architecture</strong></a>
</p>

---

## Overview

A full-featured **project management SaaS** with:

- **Next.js 16 App Router** with React Server Components
- **TypeScript** (strict mode)
- **Tailwind CSS 4** with CSS custom properties for theming
- **Supabase** for PostgreSQL, Auth, Realtime, and Storage
- **shadcn/ui** + Radix UI primitives

## Live Demo

The application is deployed on Vercel:

- **Production**: https://pms-nine-gold.vercel.app

## Features

- **Authentication & Multi-tenancy**
  - Email/password and Google OAuth authentication
  - Organization-based multi-tenant architecture
  - Role-based access control (admin/member for orgs, owner/pic/member/viewer for projects)

- **Project Management**
  - Project creation wizard with multi-step flow
  - Project scope, outcomes, and features tracking
  - Workstreams for task grouping
  - File uploads and notes with audio support

- **Task Management**
  - Drag-and-drop task reordering
  - Status updates and assignments
  - Real-time updates via Supabase Realtime

- **Client Management**
  - Client CRUD with project associations
  - Client details and project counts

- **Real-time Updates**
  - Instant updates across all connected clients
  - Automatic subscription pausing when tab is hidden

- **UI/UX**
  - Responsive sidebar with keyboard shortcuts
  - Light/dark mode theming
  - Rich text editing with Tiptap
  - Charts and visualizations with Recharts

## Architecture

High-level structure:

- `app/` - Next.js App Router
  - `(auth)/` - Authentication pages (login, signup)
  - `(dashboard)/` - Main app routes with shared layout
  - `auth/callback/` - OAuth callback handler
  - `onboarding/` - Organization onboarding flow

- `components/` - React components
  - `ui/` - shadcn/ui design system primitives
  - `projects/`, `tasks/`, `clients/` - Feature components
  - `project-wizard/` - Multi-step project creation

- `lib/` - Utilities and services
  - `supabase/` - Supabase clients (browser, server, admin)
  - `actions/` - Next.js Server Actions for data mutations
  - `data/` - Type definitions and interfaces

- `hooks/` - Custom React hooks including real-time subscriptions

- `supabase/migrations/` - Database schema migrations

- `e2e/` - Playwright E2E tests with Page Object Model

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4.1 + PostCSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **UI Library**: shadcn/ui, Radix UI primitives
- **Forms**: React Hook Form + Zod validation
- **Rich Text**: Tiptap editor
- **Drag & Drop**: @dnd-kit
- **Charts**: Recharts
- **Icons**: Lucide, Phosphor Icons
- **Testing**: Playwright E2E

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Install & Run

```bash
pnpm install
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
pnpm build
pnpm start
```

### Run E2E Tests

```bash
pnpm test:e2e              # Run all tests
pnpm test:e2e --headed     # Run with visible browser
pnpm test:e2e --ui         # Interactive UI mode
```

## Database

The application uses Supabase with:

- 17 tables with full Row Level Security (RLS) policies
- Multi-tenant architecture with organization-based isolation
- Real-time subscriptions for instant updates

Push migrations to your Supabase project:

```bash
npx supabase db push
```

Generate TypeScript types:

```bash
npx supabase gen types typescript --project-id <project-id> > lib/supabase/database.types.ts
```
