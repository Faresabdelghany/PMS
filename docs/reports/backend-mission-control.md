# Backend Agent Report: Mission Control Integration
**Date:** 2026-02-23  
**Agent:** Backend Sub-Agent  
**Status:** ✅ Code complete — ⚠️ DB migration requires manual push

---

## Summary

All server-side code for the Mission Control integration has been created. The Supabase migration SQL file is ready but **requires manual application** (no Supabase CLI or DB password available in this environment).

---

## 1. Database Migration

**File:** `supabase/migrations/20260223000001_mission_control.sql`

### Tables Created
| Table | Description | RLS |
|-------|-------------|-----|
| `approvals` | Human-in-the-loop approval requests | org members read/write, admin delete |
| `gateways` | OpenClaw gateway connections | org members read/write, admin delete |
| `skills` | Agent skills/plugins registry | org members read/write, admin delete |
| `boards` | Mission control boards | org members read/write, admin delete |
| `mc_tags` | Mission control tags (distinct from org tags) | org members full access |

### Agents Table Patch
Adds `model TEXT` column if missing (other columns `squad`, `status`, `last_active_at`, `description`, `prompt`/`system_prompt` already exist from the `agents_system` migration).

### ⚠️ How to Apply the Migration

**Option A: Supabase Dashboard (easiest)**
1. Go to [https://supabase.com/dashboard/project/lazhmdyajdqbnxxwyxun/sql/new](https://supabase.com/dashboard/project/lazhmdyajdqbnxxwyxun/sql/new)
2. Paste contents of `supabase/migrations/20260223000001_mission_control.sql`
3. Click **Run**

**Option B: Supabase CLI**
```bash
# Install CLI (if not installed)
npm install -g supabase

# Link project and push
supabase login
supabase link --project-ref lazhmdyajdqbnxxwyxun
supabase db push
```

**Option C: Node.js Script (with DB password)**
```bash
SUPABASE_DB_PASSWORD=your_db_password node scripts/apply-mission-control-migration.mjs
```
Get DB password from: Supabase Dashboard → Settings → Database → Database password

---

## 2. Server Actions Created

### `lib/actions/approvals.ts`
| Function | Signature | Description |
|----------|-----------|-------------|
| `getApprovals` | `(orgId, status?)` | List approvals, optionally filtered by status |
| `getApproval` | `(id)` | Single approval by ID |
| `createApproval` | `(orgId, { title, description?, payload?, agent_id? })` | Create pending approval |
| `updateApproval` | `(id, updates)` | Update approval — auto-stamps `decided_by` on status change |
| `getPendingApprovalsCount` | `(orgId)` | Count of pending approvals for badge display |

### `lib/actions/gateways.ts`
| Function | Signature | Description |
|----------|-----------|-------------|
| `getGateways` | `(orgId)` | List all gateways for an org |
| `getGateway` | `(id)` | Single gateway by ID |
| `createGateway` | `(orgId, { name, url?, workspace_root?, auth_mode?, auth_token? })` | Create gateway |
| `updateGateway` | `(id, data)` | Update gateway fields |
| `deleteGateway` | `(id)` | Delete (admin only) |
| `checkGatewayHealth` | `(url)` | Fetch with 3s timeout → `{ status, latencyMs? }` |

### `lib/actions/boards.ts`
| Function | Signature | Description |
|----------|-----------|-------------|
| `getBoards` | `(orgId)` | List all boards |
| `getBoard` | `(id)` | Single board |
| `createBoard` | `(orgId, { name, description?, gateway_id?, agent_id?, status? })` | Create board |
| `updateBoard` | `(id, data)` | Update board |
| `deleteBoard` | `(id)` | Delete (admin only) |

### `lib/actions/skills.ts`
| Function | Signature | Description |
|----------|-----------|-------------|
| `getSkills` | `(orgId)` | List all skills, ordered by category+name |
| `upsertSkill` | `(orgId, skillData)` | Insert or update skill by name |
| `updateSkill` | `(id, data)` | Update specific skill |
| `deleteSkill` | `(id)` | Delete (admin only) |
| `seedDefaultSkills` | `(orgId)` | Seeds 8 default skills if org has none |

**Default skills seeded:**
- Web Search, Code Execution, File Management, Browser Control
- Slack Integration, GitHub Integration, Email, Database Query

### `lib/actions/mc-tags.ts`
| Function | Signature | Description |
|----------|-----------|-------------|
| `getMCTags` | `(orgId)` | List mission control tags |
| `createMCTag` | `(orgId, { name, color? })` | Create tag (hex color validated) |
| `updateMCTag` | `(id, data)` | Update tag |
| `deleteMCTag` | `(id)` | Delete tag |

> **Note:** `tags.ts` (existing) handles `organization_tags`. The new `mc-tags.ts` handles the `mc_tags` table — a separate Mission Control–specific tag namespace.

### `lib/actions/agents.ts` — Already existed ✅
Full CRUD + activities + decisions already implemented. No changes needed.

---

## 3. Gateway Proxy API Route

**File:** `app/api/gateway/route.ts`

```
GET /api/gateway?url=http://localhost:18789&path=/status
```

- Accepts `url` (default: `http://localhost:18789`) and `path` (default: `/`) query params
- Fetches with **3-second AbortController timeout**
- Returns gateway JSON response on success
- Returns `{ error: "Gateway offline", status: "offline", reason?: "timeout" }` with HTTP 503 on failure
- Handles both JSON and plain text responses from the gateway
- CORS enabled via `OPTIONS` handler for local dev tooling

---

## 4. Files Created

```
PMS/
├── supabase/
│   └── migrations/
│       └── 20260223000001_mission_control.sql   ← NEW: DB migration
├── lib/
│   └── actions/
│       ├── approvals.ts      ← NEW
│       ├── gateways.ts       ← NEW
│       ├── boards.ts         ← NEW
│       ├── skills.ts         ← NEW
│       ├── mc-tags.ts        ← NEW (Mission Control tags)
│       └── agents.ts         ← EXISTING (no changes needed)
├── app/
│   └── api/
│       └── gateway/
│           └── route.ts      ← NEW: proxy to OpenClaw gateway
├── scripts/
│   └── apply-mission-control-migration.mjs  ← NEW: migration runner
└── docs/
    └── reports/
        └── backend-mission-control.md  ← THIS FILE
```

---

## 5. Patterns & Notes

- All server actions follow the existing `dashboard.ts` / `agents.ts` pattern:
  - `"use server"` directive at top
  - Auth via `requireOrgMember()` / `requireAuth()` from `auth-helpers.ts`
  - Returns `ActionResult<T>` from `types.ts`
  - Cache invalidation via `revalidatePath()` wrapped in `after()` for non-blocking behavior
- RLS policies use the existing `organization_members` membership table pattern
- All tables use `gen_random_uuid()` PKs, `IF NOT EXISTS` for safe re-runs
- The `mc_tags` table uses name `mc_tags` (not `tags`) to avoid collision with existing `organization_tags`

---

## Next Steps

1. **Apply the migration** using one of the methods above
2. **Seed default skills** by calling `seedDefaultSkills(orgId)` once per new org
3. **Frontend Agent** can now build UI components against these actions
4. **Optional:** Add TypeScript types to `lib/supabase/types.ts` for the new tables (Approval, Gateway, Board, Skill, MCTag)
