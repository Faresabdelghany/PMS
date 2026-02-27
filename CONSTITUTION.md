# PMS Constitution — Project Governing Principles

## Product
PMS (Project Management System) is an AI-native project management SaaS for teams running AI agents. It's the mission control center where humans and AI agents collaborate on tasks, specs, and deliverables.

**Live at:** pms-nine-gold.vercel.app

## Tech Stack
- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Database:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Deployment:** Vercel (auto-deploy from main)
- **Package Manager:** pnpm

## Architecture Rules
1. **Server Components by default.** Only use `"use client"` when you need interactivity (state, effects, event handlers).
2. **Server Actions for mutations.** All database writes go through `lib/actions/*.ts` — never call Supabase directly from components.
3. **Supabase client via `createClient()` from `lib/supabase/server.ts`.** Never instantiate clients manually.
4. **No raw SQL.** Use the Supabase JS client for all queries.
5. **Validate all inputs** with Zod schemas before database operations.
6. **Revalidate paths** after mutations using `revalidatePath()`.
7. **Type everything.** Types live in `lib/supabase/types.ts` (generated from Supabase schema).

## Code Quality
1. **No over-engineering.** Solve the problem at hand. Don't build abstractions until you need them 3+ times.
2. **Consistent file structure:** `app/[route]/page.tsx` for pages, `components/[feature]/*.tsx` for components, `lib/actions/*.ts` for server actions.
3. **Component naming:** PascalCase for components, camelCase for functions and variables.
4. **No `any` types.** Use proper types or `unknown` with type guards.
5. **Error handling:** All server actions return `{ data?, error? }` — never throw.
6. **Imports:** Use `@/` path aliases. Group: React → Next → External → Internal → Types.

## UI/UX Principles
1. **Dark mode first.** All UI must look good in dark mode. Light mode is secondary.
2. **shadcn/ui components** are the foundation. Customize with Tailwind, don't reinvent.
3. **Responsive.** Mobile-friendly layouts using Tailwind breakpoints.
4. **Loading states.** Show skeletons or spinners during async operations.
5. **Toast notifications** via `sonner` for user feedback on actions.
6. **Consistent spacing** using Tailwind's spacing scale (multiples of 4px).

## Performance
1. **No unnecessary client-side JavaScript.** Prefer Server Components.
2. **Lazy load** heavy components with `dynamic()` or `React.lazy()`.
3. **Optimize images** with `next/image`.
4. **Minimize bundle size.** Check imports — use tree-shakeable packages.

## Security
1. **Auth required** on all routes except `/login` and `/signup`.
2. **RLS (Row Level Security)** enabled on all Supabase tables.
3. **Organization-scoped queries.** Always filter by `organization_id`.
4. **Sanitize user input.** Never render raw HTML from user data.

## Git & Deploy
1. **Single branch:** `main` — push triggers Vercel auto-deploy.
2. **Meaningful commit messages:** `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
3. **No breaking changes** without migration plan.
4. **Test locally** before pushing when possible.

## What NOT To Do
- Don't use Next.js 16+ (Turbopack crashes on Windows with PostCSS `nul` bug)
- Don't add new dependencies without justification
- Don't bypass Server Actions with direct API routes (unless needed for webhooks)
- Don't store secrets in code — use `.env.local`
- Don't create separate apps — all features go into PMS
