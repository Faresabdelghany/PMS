# Mostafa Bug Fix Report

**Date:** 2026-02-23  
**Engineer:** Mostafa (Backend/Full-stack)  
**Status:** ✅ ALL 5 BUGS FIXED — Build passes (0 TypeScript errors)

---

## BUG 1 — TaskDetail stale agent selector ✅ FIXED

**File:** `components/tasks/TaskDetail.tsx`

**Problem:** When navigating between tasks, `selectedAgentId` state retained the previous task's agent selection.

**Fix:**
- Added `useEffect` import
- Added reset effect that fires whenever `task?.id` changes:
  ```tsx
  useEffect(() => {
    setSelectedAgentId(task?.assigned_agent_id ?? "")
  }, [task?.id])
  ```

---

## BUG 2 — Live Feed shows "System" instead of agent name ✅ FIXED

**File:** `components/tasks/LiveActivityFeed.tsx` + `components/tasks/TasksBoard.tsx`

**Problem:** Real-time events via Supabase `postgres_changes` arrive without joined agent data, so `event.agent?.name ?? "System"` fell back to "System".

**Fix:**
- Added `agents` prop to `LiveActivityFeedProps`
- In the real-time handler, look up agent by `agent_id` from the `agents` prop
- Changed fallback from `"System"` → `"Agent"`
- Updated `TasksBoard.tsx` to pass `agents={agents}` to `<LiveActivityFeed />`

---

## BUG 3 — Agent filter chips show only 6 of 24 agents ✅ FIXED

**File:** `components/tasks/TasksBoard.tsx`

**Problem:** Hard-coded `agents.slice(0, 6)` showed at most 6 agents from the full agents list, regardless of which agents had actual tasks.

**Fix:**
- Added `DropdownMenu` import from `@/components/ui/dropdown-menu`
- Added `CaretDown` icon import from phosphor-icons
- Added `activeAgents` useMemo: derives unique agents from tasks that have `assigned_agent_id` set
- Updated filter chips to use `activeAgents` instead of `agents`
- Added "More" dropdown: when > 8 agents, show first 7 + dropdown with remaining agents
- Dropdown items also respond to the agent filter (highlights active filter)

---

## BUG 4 — Delete service.ts duplicate ✅ FIXED

**Files modified:**
- `app/api/agent-events/route.ts` — `createServiceClient` → `createAdminClient` from `@/lib/supabase/admin`
- `lib/actions/agent-events.ts` — `createServiceClient` → `createAdminClient` from `@/lib/supabase/admin`
- `lib/supabase/service.ts` — **DELETED**

Both `service.ts` and `admin.ts` were identical service-role clients. All imports migrated to use `createAdminClient` from `admin.ts`.

---

## BUG 5 — New task form empty project warning ✅ FIXED

**File:** `components/tasks/NewTaskForm.tsx`

**Problem:** If `projects` array was empty, the Select dropdown was empty with no guidance.

**Fix:**
- Added `Link` import from `next/link`
- Added conditional: when `projects.length === 0`, shows message:
  ```tsx
  <p className="text-sm text-muted-foreground">
    No projects found. <Link href="/projects/new" className="text-primary underline">Create one first</Link>
  </p>
  ```
- Submit button disabled when `projects.length === 0` (added `|| projects.length === 0` to disabled condition)

---

## Build Verification

```
✓ Compiled successfully in 32.0s
✓ Running TypeScript — 0 errors
✓ Build exit code: 0
```
