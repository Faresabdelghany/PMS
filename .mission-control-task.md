# Mission: Build Full Mission Control Integration in PMS

## Context
PMS is a Next.js 15 + Supabase project at `C:\Users\Fares\Downloads\PMS`.
It's deployed at pms-nine-gold.vercel.app. Auth via Supabase. UI: shadcn/ui + Phosphor icons + dark mode + Tailwind.

Reference project: `C:\Users\Fares\Downloads\openclaw-mission-control`
- Frontend at `frontend/src/app/` — React/Next.js pages to reference for UI/feature patterns
- Backend at `backend/app/api/` — FastAPI endpoints to understand data models

OpenClaw Gateway: runs at `http://localhost:18789`

## Goal
Integrate ALL Mission Control features into PMS so Fares can use PMS as his single mission control dashboard — seeing all agents, tasks, boards, approvals, gateways, and skills from one place.

## What's Already Built in PMS
- `/` Dashboard — KPI cards + recharts charts + agent activity timeline (using Supabase)
- `/agents` — Sortable table with search/squad/status filters
- `/agents/[agentId]` — Agent detail page (check current state)
- `/activity` — May or may not exist, check
- `/skills` — Skills overview + per-agent breakdown
- Supabase tables: `agents`, `agent_activities`, `ai_models`, `agent_decisions`

## What You Need to Build

### 1. Database Migrations (Supabase)
Run the following SQL migrations via the Supabase MCP. Check what's already in the DB first.

Tables needed (if not already existing):
```sql
-- Approvals (HITL approval flows)
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  board_id uuid,
  title text not null,
  description text,
  payload jsonb,
  status text not null default 'pending', -- pending, approved, rejected
  decision_reason text,
  decided_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table approvals enable row level security;
create policy "Org members can access approvals" on approvals for all using (
  org_id in (select org_id from memberships where user_id = auth.uid())
);

-- Gateways
create table if not exists gateways (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  url text not null default 'http://localhost:18789',
  status text default 'unknown', -- online, offline, unknown
  last_seen_at timestamptz,
  workspace_root text,
  auth_mode text default 'none',
  auth_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table gateways enable row level security;
create policy "Org members can access gateways" on gateways for all using (
  org_id in (select org_id from memberships where user_id = auth.uid())
);

-- Skills (skill packs/marketplace entries)
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  category text,
  version text,
  author text,
  installed boolean default false,
  enabled boolean default true,
  config jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table skills enable row level security;
create policy "Org members can access skills" on skills for all using (
  org_id in (select org_id from memberships where user_id = auth.uid())
);

-- Boards (agent task boards, separate from projects)
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  gateway_id uuid references gateways(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table boards enable row level security;
create policy "Org members can access boards" on boards for all using (
  org_id in (select org_id from memberships where user_id = auth.uid())
);
```

If the `agents` table is missing columns, add: `squad text, status text, model text, last_active_at timestamptz`

### 2. Server Actions
Create files in `lib/actions/`:

**`lib/actions/approvals.ts`**
- `getApprovals(orgId)` — list all approvals for org
- `getApproval(id)` — get single approval
- `createApproval(data)` — create new approval
- `updateApproval(id, { status, decision_reason })` — approve/reject
- `getPendingApprovalsCount(orgId)` — count for badge

**`lib/actions/gateways.ts`**
- `getGateways(orgId)` — list gateways
- `createGateway(data)` — add new gateway
- `updateGateway(id, data)` — update gateway
- `deleteGateway(id)` — remove gateway
- `checkGatewayHealth(url)` — ping gateway, return status

**`lib/actions/boards.ts`**
- `getBoards(orgId)` — list all boards
- `getBoard(id)` — get board with tasks
- `createBoard(data)` — create board
- `updateBoard(id, data)` — update board
- `deleteBoard(id)` — delete board

**`lib/actions/skills.ts`**
- `getSkills(orgId)` — list all skills
- `installSkill(orgId, skillData)` — add skill
- `updateSkill(id, data)` — update skill
- `uninstallSkill(id)` — remove skill

Update **`lib/actions/agents.ts`** (if exists, create if not):
- `getAgents(orgId)` — list agents
- `getAgent(id)` — agent detail with recent activities
- `createAgent(data)` — create agent
- `updateAgent(id, data)` — update agent
- `deleteAgent(id)` — delete agent

### 3. Gateway Proxy API Route
Create `app/api/gateway/route.ts`:
```typescript
// Proxies requests to the local OpenClaw gateway
// GET /api/gateway?path=/api/v1/sessions&url=http://localhost:18789
// Returns gateway data or error if unavailable
```
This should:
- Accept a `url` param (gateway URL, default localhost:18789)
- Accept a `path` param (endpoint to call)
- Forward the request and return the response
- On failure, return `{ error: "Gateway offline", status: "offline" }`

### 4. Pages to Build

#### A. `/activity` page — if not already built
`app/(dashboard)/activity/page.tsx`
- Timeline of all agent activities from `agent_activities` table
- Filter by agent, date range, action type
- Use shadcn/ui + Phosphor icons
- Match the style of the reference: `openclaw-mission-control/frontend/src/app/activity/page.tsx`

#### B. Agent Detail Page — update if incomplete
`app/(dashboard)/agents/[agentId]/page.tsx`
- Show agent info (name, squad, model, status, description)
- Show recent activities from `agent_activities` for this agent
- Show decisions from `agent_decisions`
- Show pending approvals for this agent
- Button: Edit agent

#### C. Agent New/Edit Pages
`app/(dashboard)/agents/new/page.tsx`
`app/(dashboard)/agents/[agentId]/edit/page.tsx`
- Form: name, role, squad (Engineering/Marketing), model (claude-opus-4-6, claude-sonnet-4-6, gemini-2.5-flash), description, prompt
- Use shadcn/ui Form + react-hook-form if already in project, else simple controlled form
- On save: redirect to `/agents/[id]`

#### D. Approvals Page
`app/(dashboard)/approvals/page.tsx`
- List all approvals (pending, approved, rejected)
- Filter by status (default: pending)
- Show: agent name, title, description, payload preview, created_at
- Actions: Approve / Reject buttons with optional reason input
- Badge on sidebar nav showing pending count
- Auto-refresh every 15 seconds
- Reference: `openclaw-mission-control/frontend/src/app/approvals/page.tsx`

#### E. Gateways Page
`app/(dashboard)/gateways/page.tsx`
`app/(dashboard)/gateways/new/page.tsx`
`app/(dashboard)/gateways/[gatewayId]/page.tsx`
`app/(dashboard)/gateways/[gatewayId]/edit/page.tsx`
- List gateways with status indicator (online/offline/unknown)
- For each gateway: ping it using the gateway proxy API route to show live status
- Create form: name, URL (default: http://localhost:18789), auth mode (none/token)
- Reference: `openclaw-mission-control/frontend/src/app/gateways/page.tsx`

#### F. Boards Page
`app/(dashboard)/boards/page.tsx`
`app/(dashboard)/boards/new/page.tsx`
`app/(dashboard)/boards/[boardId]/page.tsx`
- List boards with task counts
- Board detail: Kanban view using existing PMS task components (tasks already have status columns)
- Connect boards to gateways and agents
- Board tasks = tasks from `tasks` table where board_id matches (add `board_id` column to tasks if needed)

#### G. Skills Pages
`app/(dashboard)/skills/page.tsx` — update existing
`app/(dashboard)/skills/marketplace/page.tsx`
`app/(dashboard)/skills/packs/page.tsx`

Marketplace page:
- List available skills (from a hardcoded list of OpenClaw skills OR from Supabase)
- Show installed/available status toggle
- Hardcode the 20+ skills from the OpenClaw ecosystem:
  - coding-agent, gh-issues, github, weather, healthcheck, nano-banana-pro
  - summarize, skill-creator, ab-test-setup, ad-creative, ai-seo, analytics-tracking
  - brainstorming, churn-prevention, cold-email, copywriting, email-sequence
  - frontend-design, ui-ux-pro-max, vercel-react-best-practices, web-design-guidelines
  - content-strategy, seo-audit, programmatic-seo, social-content, pricing-strategy

Packs page:
- Group skills by category (Engineering, Marketing, Design, Analytics)
- Install/uninstall entire packs

#### H. Tags Management
`app/(dashboard)/tags/page.tsx`
- Simple CRUD for tags (name, color)
- `tags` table: `id, org_id, name, color, created_at`
- Used by tasks for filtering

#### I. Custom Fields
Add custom fields to tasks:
- `custom_field_definitions` table: `id, org_id, name, type (text/number/date/select), options jsonb`
- `task_custom_fields` table: `id, task_id, field_id, value text`
- Add UI to task detail to show/edit custom fields

### 5. Sidebar Navigation Updates
Update `components/layout/sidebar.tsx` (or wherever the sidebar is):

Add navigation items:
```
Dashboard (/)
Activity (/activity)
Projects (/projects)
Tasks (/tasks)
Boards (/boards)           ← NEW
Agents (/agents)
Approvals (/approvals)     ← NEW (with pending badge)
Gateways (/gateways)       ← NEW
Skills (/skills)
  - Overview (/skills)
  - Marketplace (/skills/marketplace)   ← NEW
  - Packs (/skills/packs)               ← NEW
Tags (/tags)               ← NEW
Clients (/clients)
Inbox (/inbox)
Settings (/settings)
```

### 6. Dashboard Updates
Update `app/(dashboard)/page.tsx`:
- Add gateway status card (ping localhost:18789, show online/offline)
- Add pending approvals card (count + link)
- Add active boards card
- Keep existing KPI cards

### 7. Style Guidelines
- Use PMS design system (shadcn/ui, Phosphor icons, dark mode compatible)
- DO NOT use Clerk auth patterns from mission-control
- DO NOT use TanStack Query (PMS uses Next.js server actions)
- Use `async/await` server components where possible, client components only for interactive parts
- Keep existing patterns from the codebase (look at existing pages for examples)
- All new pages must be responsive

## Implementation Order
1. Run database migrations first
2. Build server actions
3. Build gateway proxy API route
4. Build pages in this order: Activity → Agents (new/edit) → Approvals → Gateways → Boards → Skills Marketplace → Tags
5. Update sidebar navigation
6. Update dashboard

## Key Files to Reference in PMS
- `lib/actions/dashboard.ts` — pattern for server actions
- `lib/actions/activity.ts` — activity data pattern
- `app/(dashboard)/agents/page.tsx` — agents list pattern
- `app/(dashboard)/layout.tsx` — layout pattern
- `components/` — UI component library already available

## After Each Feature
Test by running `pnpm build` to check for TypeScript errors. Fix any errors before moving to next feature.

## When Done
Write a summary report to `C:\Users\Fares\Downloads\PMS\docs\mission-control-build-report.md` with:
- What was built
- What Supabase migrations were run
- Any issues encountered
- What still needs testing

Then run:
`openclaw system event --text "Done: Full Mission Control integration built in PMS — agents, approvals, gateways, boards, skills marketplace, tags all complete" --mode now`
