# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern project & task management dashboard UI built with Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4. This is a UI-first demo with mocked data—no backend or authentication.

**Live demo:** https://v0-project-workspace.vercel.app

## Development Commands

```bash
pnpm install          # Install dependencies (Node.js 18+ required)
pnpm dev              # Start development server at localhost:3000
pnpm build            # Production build
pnpm start            # Run production server
pnpm lint             # Run ESLint
```

## Architecture

### Directory Structure

- **`app/`** - Next.js App Router pages and layouts
- **`components/`** - React components organized by feature
  - `ui/` - shadcn/ui design system primitives (buttons, dialogs, forms, etc.)
  - `projects/` - Project-related components
  - `tasks/` - Task management components
  - `clients/` - Client management components
  - `project-wizard/` - Multi-step project creation wizard
- **`lib/`** - Utilities and data
  - `data/` - Mock data (projects, clients, sidebar navigation)
  - `utils.ts` - Utility helpers including `cn()` for class merging
- **`hooks/`** - Custom React hooks

### Key Patterns

**Path aliases:** Use `@/` for imports (e.g., `@/components/ui/button`)

**Component organization:** UI primitives in `components/ui/`, feature components in `components/{feature}/`, mock data in `lib/data/`

**Styling:** Tailwind CSS with CSS custom properties for theming. Light/dark mode via `next-themes`. Component variants use `class-variance-authority`.

**shadcn/ui:** Uses "new-york" style with Lucide icons. Add new components via `npx shadcn@latest add <component>`.

**Dynamic routes:** Uses Next.js 16 async params pattern:
```typescript
type PageProps = { params: Promise<{ id: string }> }
export default async function Page({ params }: PageProps) {
  const { id } = await params
}
```

**State management:** React Context for sidebar state (`SidebarProvider`), URL parameters for filters via `useSearchParams`.

### Data Layer

All data is mocked in `lib/data/`. To integrate a real backend, replace the mock data exports while keeping the same type signatures:
- `lib/data/projects.ts` - Project data and `Project` type
- `lib/data/clients.ts` - Client data
- `lib/data/sidebar.ts` - Navigation structure

## Tech Stack

- Next.js 16 (App Router, React Server Components)
- React 19 + TypeScript (strict mode)
- Tailwind CSS 4.1 + PostCSS
- shadcn/ui + Radix UI primitives
- Forms: React Hook Form + Zod validation
- Rich text: Tiptap editor
- Drag/drop: @dnd-kit
- Charts: Recharts
- Icons: Lucide, Phosphor Icons
