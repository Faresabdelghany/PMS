# Contributing Guide

This document covers development workflow, available scripts, and environment setup for the PMS project.

## Prerequisites

- **Node.js 20+** (required)
- **pnpm** (package manager)
- **Supabase account** for backend services

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/Faresabdelghany/PMS.git
cd PMS
pnpm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g., `https://your-project.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Site URL for OAuth redirects (e.g., `http://localhost:3000`) |
| `ENCRYPTION_KEY` | Yes | 64 hex characters for AES-256 encryption. Generate with: `openssl rand -hex 32` |
| `TEST_USER_EMAIL` | No | E2E test user email (must exist in Supabase auth) |
| `TEST_USER_PASSWORD` | No | E2E test user password |
| `KV_REST_API_URL` | No | Vercel KV URL (production rate limiting) |
| `KV_REST_API_TOKEN` | No | Vercel KV token (production rate limiting) |

### 3. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `pnpm dev` | Start development server at localhost:3000 |
| `build` | `pnpm build` | Create production build |
| `start` | `pnpm start` | Run production server |
| `lint` | `pnpm lint` | Run ESLint with zero warnings tolerance |
| `test:e2e` | `pnpm test:e2e` | Run all Playwright E2E tests |
| `test:e2e:headed` | `pnpm test:e2e:headed` | Run E2E tests with visible browser |
| `test:e2e:debug` | `pnpm test:e2e:debug` | Run E2E tests in debug mode |
| `test:e2e:ui` | `pnpm test:e2e:ui` | Run E2E tests with interactive UI |
| `test:e2e:report` | `pnpm test:e2e:report` | View HTML test report |
| `test:e2e:codegen` | `pnpm test:e2e:codegen` | Generate tests via recording |

## Development Workflow

### Branch Strategy

1. Create feature branch from `main`
2. Make changes with atomic commits
3. Run `pnpm lint` and `pnpm build` before pushing
4. Create PR for review

### Commit Convention

Use conventional commits format:

```
type(scope): description

Examples:
feat(auth): add OAuth support
fix(tasks): correct drag-drop ordering
refactor(api): simplify error handling
```

### Code Quality

Before committing:

```bash
pnpm lint          # Check for linting errors
pnpm build         # Verify production build
pnpm test:e2e      # Run E2E tests (if applicable)
```

## Testing

### E2E Tests (Playwright)

Tests are located in `e2e/` directory using Page Object Model pattern.

**Setup:**
1. Ensure `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are set in `.env.local`
2. Test user must exist in Supabase auth

**Run tests:**

```bash
pnpm test:e2e              # Run all tests
pnpm test:e2e --headed     # Watch tests run
pnpm test:e2e --debug      # Debug mode
pnpm test:e2e login.spec.ts  # Run single file
```

**Test Structure:**
- `e2e/pages/` - Page Object Model classes
- `e2e/fixtures.ts` - Test fixtures and helpers
- `e2e/auth.setup.ts` - Authentication setup

## Database

### Supabase Commands

```bash
npx supabase db push                    # Push migrations to remote
npx supabase db reset --linked          # Reset remote database
npx supabase gen types typescript --project-id lazhmdyajdqbnxxwyxun > lib/supabase/database.types.ts
```

### Local Development (Optional)

```bash
npx supabase start    # Start local Supabase
npx supabase stop     # Stop local Supabase
npx supabase status   # Check services status
```

## Project Structure

```
├── app/                 # Next.js App Router pages
│   ├── (auth)/         # Auth pages (login, signup)
│   ├── (dashboard)/    # Main app routes
│   └── api/            # API routes
├── components/         # React components
│   ├── ui/            # shadcn/ui primitives
│   └── [feature]/     # Feature components
├── lib/               # Utilities
│   ├── actions/       # Server Actions
│   ├── supabase/      # Supabase clients
│   └── validations/   # Zod schemas
├── hooks/             # Custom React hooks
├── supabase/          # Database migrations
└── e2e/               # Playwright tests
```

## Tech Stack

- **Framework:** Next.js 16 (App Router, RSC)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Forms:** React Hook Form + Zod
- **Testing:** Playwright
- **Deployment:** Vercel
