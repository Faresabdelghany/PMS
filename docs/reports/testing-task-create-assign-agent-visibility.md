# Test Report — Task Create & Agent Assignment Visibility

**Date:** 2026-03-02  
**Tester:** Automated E2E (Claude Subagent)  
**Test File:** `e2e/task-create-assign-agent-visibility.spec.ts`  
**Target:** `https://pms-nine-gold-gilt.vercel.app`  
**Runner:** Playwright · Chromium · 1 worker · serial mode  
**Auth:** `e2e/.auth/user.json` (e2e-test@example.com)

---

## Requirement Under Test

> **"User should be able to create a task and assign it to an agent, and the task should appear in task lists."**

---

## Summary

| TC   | Title                                           | Result  |
|------|-------------------------------------------------|---------|
| TC-01| Create task from UI with AI Agent assignment    | ✅ PASS  |
| TC-02| assigned_agent_id persisted (All Tasks view)    | ❌ FAIL  |
| TC-03a| Task appears in My Tasks view                  | ❌ FAIL (cascaded) |
| TC-03b| Task appears in All Tasks view (re-check)      | ❌ FAIL (cascaded) |
| TC-03c| Task appears in project task list              | ⚠️ WARN (informational — project may differ) |
| TC-04| No duplicate rows                              | ✅ PASS (vacuous — task not visible) |
| TC-05| Agent badge / owner indicator visible          | ⚠️ SKIP (depends on TC-02) |

**Overall verdict: FAIL** — The core requirement that the task appears in task lists after agent assignment is **not met**.

---

## Test Case Results

### TC-01: Create task from UI (/tasks/new) with AI Agent assignment ✅ PASS

**Steps:**
1. Navigate to `/tasks/new`
2. Fill in task name with unique timestamp (`E2E Agent Task <timestamp>`)
3. Click "AI Agent" toggle → select agent "Researcher Agent"
4. Click "Create & Dispatch" button

**Observed:**
- Form loaded correctly with PageHeader title "New Task" (renders as `<p>`, not `<h1>`)
- AI Agent toggle switches to purple-highlighted state ✅
- Agent dropdown populated with agents (confirmed: "Researcher Agent" available) ✅
- Submit button label changes to "Create & Dispatch" in agent mode ✅
- Task created → "Task Created!" success state → redirected to `/tasks` ✅
- Test reproduced consistently across 3 runs ✅

**Note on UI discovery:** The form submit button label is dynamic:
- Member assignment mode → "Create Task"
- Agent assignment mode → "Create & Dispatch"

---

### TC-02: assigned_agent_id persisted — task appears in All Tasks view ❌ FAIL

**Steps:**
1. After TC-01 creates the task, navigate to `/tasks?view=all`
2. Poll every 3 seconds for up to 30 seconds with page reloads

**Observed:**
- `/tasks?view=all` consistently shows **"No tasks found"** empty state
- Empty state text: "Tasks in your organization will appear here."
- Task name NOT found in DOM after 30 seconds of polling (10 reload attempts)

**Root Cause Analysis:**

The failure is caused by a **KV cache race condition** affecting two layers:

**Layer 1 — `createTask` deferred invalidation:**

```typescript
// lib/actions/tasks/mutations.ts
after(async () => {   // ← deferred, runs AFTER HTTP response sent
  revalidatePath("/tasks")
  await invalidateCache.task({ projectId, assigneeId: null, orgId: ... })
  // ^ This clears KV cache: CacheKeys.orgTasks(orgId)
})
return { data: task }  // ← HTTP response sent immediately
```

The browser receives the success response and immediately navigates to `/tasks?view=all`. The `after()` block runs *concurrently* with the browser's next request. If the browser hits `/tasks?view=all` before `after()` completes its KV deletion, `getAllTasks` still reads from the stale KV cache.

**Layer 2 — `dispatchTaskToAgent` missing KV invalidation:**

```typescript
// lib/actions/tasks-sprint3.ts
export async function dispatchTaskToAgent(...) {
  await supabase.from("tasks").update({
    assigned_agent_id: agentId,
    task_type: "agent",
    dispatch_status: "dispatched",
  }).eq("id", taskId)

  revalidatePath("/tasks")    // ← Only Next.js ISR cache
  // ❌ Missing: await invalidateCache.task({ projectId, orgId })
  // ❌ Missing: await invalidate.key(CacheKeys.orgTasks(orgId))
  // ❌ Missing: await invalidate.key(CacheKeys.userTasks(userId, orgId))
}
```

`dispatchTaskToAgent` only calls `revalidatePath("/tasks")` — this invalidates the Next.js HTML/RSC ISR cache but does **not** invalidate the KV data cache. Subsequent calls to `getAllTasks` and `getMyTasks` will still hit the stale KV cache.

**Cache TTL:** `CacheTTL.TASKS = 120` seconds. Even after 30 seconds of reloads, the cache entry is still live because `dispatchTaskToAgent` never deletes it.

**Impact:** A user who creates a task with agent assignment and immediately navigates back to the tasks list will see "No tasks found" (or their old task list without the new task) for up to 2 minutes.

---

### TC-03a: Task appears in My Tasks view ❌ FAIL (cascaded)

**Cascaded from TC-02.** Task not visible in My Tasks view either, for the same KV cache reason.

**Additional My Tasks concern:** `getMyTasks` filters by:
```sql
assignee_id = user_id  
OR (assigned_agent_id IS NOT NULL AND created_by = user_id)
```

The task is created in two steps:
1. `createTask` → task has `assigned_agent_id = NULL` (not yet assigned)
2. `dispatchTaskToAgent` → updates task with `assigned_agent_id = agentId`

Due to KV cache, even after step 2 completes, the My Tasks cache still shows the old data because:
- `createTask`'s `after()` only invalidates with `assignee_id: null` (no user tasks cache cleared for agent assignment)
- `dispatchTaskToAgent` doesn't invalidate any KV cache keys

---

### TC-03b: Task appears in All Tasks view (re-check) ❌ FAIL (cascaded)

Same as TC-02. Confirmed: task does not appear in All Tasks view even ~60 seconds after creation (factoring in TC-02's 30s poll time).

---

### TC-03c: Task appears in project task list ⚠️ WARN (informational)

**Status:** Informational only — project task list was navigated to but the specific project for our test task was not deterministically selected.

The All Tasks and My Tasks failures are the primary concern for this requirement. This test is noted for completeness but not treated as a failure of the requirement.

---

### TC-04: No duplicate rows ✅ PASS (vacuous)

Task was not visible in All Tasks view, so 0 duplicate rows were found. This test passes trivially but provides no signal on actual duplication behavior since the task wasn't visible.

**Note:** If BUG-01 is fixed and the task becomes visible, this test should be re-run to verify no duplicate row rendering exists.

---

### TC-05: Agent badge / owner indicator ⚠️ SKIP

Skipped because TC-02 failed — task not visible in the list, so agent badge visibility cannot be tested.

**Code analysis (offline):** The `TaskCard` component does implement agent indicators:
```tsx
// components/tasks/TaskCard.tsx
const isAgentTask = (task.task_type === "agent") || !!task.assigned_agent_id
{isAgentTask && (  // Shows Robot icon
{isAgentTask && task.agent ? (  // Shows agent name/avatar
```

These UI elements exist and would show correctly IF the task appeared in the list. The badge implementation appears correct — the failure is upstream (visibility, not rendering).

---

## Bug List

### 🔴 BUG-01 [CRITICAL]: Agent-assigned tasks not visible in task lists after creation

**Symptom:** After creating a task with AI Agent assignment via `/tasks/new`, navigating to `/tasks?view=all` or `/tasks` shows the task list empty or without the newly created task.

**Duration:** Up to 120 seconds (KV cache TTL = `CacheTTL.TASKS = 120`).

**Affected views:** All Tasks view, My Tasks view

**Root cause:** Two-part cache invalidation failure:

1. `createTask` uses `after()` for deferred KV cache invalidation → race condition when browser navigates immediately after task creation
2. `dispatchTaskToAgent` does not call any KV cache invalidation — only calls `revalidatePath("/tasks")` which only affects Next.js ISR HTML cache, not the KV data cache used by `getAllTasks` / `getMyTasks`

**Files affected:**
- `lib/actions/tasks-sprint3.ts` — `dispatchTaskToAgent` function (primary fix needed)
- `lib/actions/tasks/mutations.ts` — `createTask` function (secondary fix: consider synchronous invalidation for immediate writes)

**Reproducibility:** 100% consistent — reproduced in 3 separate test runs

---

### 🟡 BUG-02 [MEDIUM]: PageHeader uses `<p>` not heading element for page titles

**Symptom:** `getByRole('heading', { name: /new task/i })` fails — the page title is in a `<p>` tag, not an `<h1>` or `<h2>`.

**Component:** `components/ui/page-header.tsx`

```tsx
// Current (renders <p>):
<p className="text-base font-medium text-foreground">{title}</p>

// Should be:
<h1 className="text-base font-medium text-foreground">{title}</h1>
```

**Accessibility impact:** Screen readers and accessibility tree analysis won't identify the page heading. Violates WCAG 1.3.1 (Info and Relationships) and 2.4.6 (Headings and Labels).

**Affected pages:** All pages using `PageHeader` component (Tasks, New Task, Projects, Clients, etc.)

---

### 🟡 BUG-03 [LOW]: Stale "My Tasks" cache not invalidated when `dispatchTaskToAgent` assigns agent

**Symptom:** After an agent is dispatched to a task, the task doesn't appear in My Tasks view because `getMyTasks` caches under `CacheKeys.userTasks(userId, orgId)` and `dispatchTaskToAgent` doesn't clear it.

**Note:** This is a subset of BUG-01 but specifically affects the "created_by" filter in `getMyTasks`. Even if BUG-01 is partially fixed (e.g., `createTask` invalidates), the agent dispatch step still leaves `userTasks` cache stale.

---

## Dev Fix Queue

### Priority 1 — Fix immediately (blocks core requirement)

#### FIX-01: Add KV cache invalidation to `dispatchTaskToAgent`

**File:** `lib/actions/tasks-sprint3.ts`

**Change:** Add cache invalidation after the DB update in `dispatchTaskToAgent`:

```typescript
export async function dispatchTaskToAgent(
  orgId: string,
  taskId: string,
  agentId: string
): Promise<ActionResult<{ commandId: string }>> {
  // ... existing code ...

  // After updating the task in DB:
  const { error: updateError } = await supabase
    .from("tasks")
    .update({ assigned_agent_id: agentId, task_type: "agent", dispatch_status: "dispatched" })
    .eq("id", taskId)

  if (updateError) return { error: updateError.message }

  // ✅ ADD THIS: Invalidate caches so lists update immediately
  const { data: taskRow } = await supabase
    .from("tasks")
    .select("project_id, created_by")
    .eq("id", taskId)
    .single()

  if (taskRow) {
    await invalidateCache.task({
      taskId,
      projectId: taskRow.project_id,
      orgId,
    })
    // Also clear the task creator's "My Tasks" cache
    if (taskRow.created_by) {
      await invalidate.key(CacheKeys.userTasks(taskRow.created_by, orgId))
    }
  }

  revalidatePath("/tasks")
  // ... rest of function ...
}
```

**Required imports:** Add `invalidateCache, invalidate, CacheKeys` from `@/lib/cache`

---

#### FIX-02: Move `createTask` cache invalidation out of `after()` (or add synchronous fast path)

**File:** `lib/actions/tasks/mutations.ts`

**Option A (preferred):** Invalidate KV cache synchronously before returning, keep `after()` for activities/notifications only:

```typescript
// Synchronous invalidation (before response)
await invalidateCache.task({ projectId, assigneeId: normalizedData.assignee_id ?? null, orgId: project?.organization_id ?? "" })
revalidatePath(`/projects/${projectId}`)
revalidatePath("/tasks")

// Deferred non-critical side effects
after(async () => {
  await createTaskActivity(task.id, "created")
  revalidateTag(CacheTags.projectDetails(projectId))
  // notifications, etc.
})

return { data: task }
```

**Option B:** Keep `after()` but add a `waitUntil` guarantee or move KV invalidation before the `return`.

---

### Priority 2 — Fix in next sprint

#### FIX-03: Fix PageHeader to use proper heading element

**File:** `components/ui/page-header.tsx`

```tsx
// Change:
<p className="text-base font-medium text-foreground">{title}</p>

// To:
<h1 className="text-base font-medium text-foreground">{title}</h1>
```

**Test for it:** Update E2E selectors to use `getByRole('heading', { name: ... })` once fixed.

---

## Appendix

### Test Environment

- **App URL:** `https://pms-nine-gold-gilt.vercel.app`
- **Auth user:** `e2e-test@example.com` (Test User E2E)
- **Agent used in test:** Researcher Agent
- **Playwright version:** See `package.json`
- **Browser:** Chromium

### How to Re-run

```bash
# Run the specific spec
npx playwright test e2e/task-create-assign-agent-visibility.spec.ts --project=chromium --reporter=list

# Run only TC-01 (creation smoke test)
npx playwright test e2e/task-create-assign-agent-visibility.spec.ts --project=chromium --grep "TC-01"
```

### Evidence Files

- **Test file:** `e2e/task-create-assign-agent-visibility.spec.ts`
- **Screenshots (TC-02 failure):** `e2e/test-results/task-create-assign-agent-v-*/test-failed-1.png`
- **Error contexts:** `e2e/test-results/task-create-assign-agent-v-*/error-context.md`

### Code References

| File | Relevant Function | Issue |
|------|------------------|-------|
| `lib/actions/tasks/mutations.ts` | `createTask` | Cache invalidation deferred in `after()` |
| `lib/actions/tasks-sprint3.ts` | `dispatchTaskToAgent` | Missing KV cache invalidation entirely |
| `lib/cache/keys.ts` | `CacheTTL.TASKS` | 120s TTL means stale data lasts 2min |
| `lib/cache/utils.ts` | `cacheGet` | SWR pattern — stale data returned from KV |
| `components/tasks/TaskCard.tsx` | `isAgentTask` | Agent indicators implemented correctly |
| `components/ui/page-header.tsx` | `PageHeader` | Uses `<p>` instead of `<h1>` |
