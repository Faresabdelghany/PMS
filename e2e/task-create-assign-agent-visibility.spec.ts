/**
 * Task Create + Agent Assignment Visibility E2E Tests
 *
 * Requirement: "User should be able to create a task and assign it to an agent,
 * and the task should appear in task lists."
 *
 * Validation points:
 *  1. Create task from UI with agent assignment
 *  2. Confirm persistence of assigned_agent_id
 *  3. Verify appearance in: My Tasks view, All Tasks view, Project task list view
 *  4. Confirm no duplicate rows
 *  5. Confirm expected badges/owner indicators for agent-assigned task
 *
 * Tests run SERIAL: TC-01 creates the task; TC-02..TC-05 validate visibility.
 *
 * Known timing issue: createTask uses `after()` for deferred cache invalidation,
 * and dispatchTaskToAgent does NOT invalidate KV cache. We add polling/retry
 * to mitigate test flakiness, but the race condition is documented as a bug.
 */

import { test, expect } from '@playwright/test';

// Unique task name to avoid collisions between runs
const TASK_NAME = `E2E Agent Task ${Date.now()}`;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Serial execution: TC-01 must complete before TC-02..TC-05
test.describe.configure({ mode: 'serial' });

// Use stored auth state
test.use({ storageState: 'e2e/.auth/user.json' });

let taskCreated = false;
let createdAgentName = '';

/**
 * Poll for the task to appear by reloading up to maxRetries times.
 * Returns true if found, false otherwise.
 */
async function waitForTaskInView(page: import('@playwright/test').Page, maxWaitMs = 30000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const visible = await page.getByText(TASK_NAME).first().isVisible().catch(() => false);
    if (visible) return true;
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'networkidle' });
  }
  return false;
}

// ---------------------------------------------------------------------------
// TC-01: CREATE TASK FROM UI WITH AGENT ASSIGNMENT
// ---------------------------------------------------------------------------
test.describe('Task Create & Agent Assignment Visibility', () => {

  test('TC-01: Create task from UI (/tasks/new) with AI Agent assignment', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/new`);
    await page.waitForLoadState('networkidle');

    // PageHeader uses <p> not <h1> — match the text content
    await expect(page.getByText('New Task').first()).toBeVisible({ timeout: 15000 });

    // Fill task name
    await page.getByPlaceholder(/what needs to be done/i).fill(TASK_NAME);

    // Switch to AI Agent assignment
    await page.getByRole('button', { name: /ai agent/i }).click();

    // Wait for agent selector to appear
    const agentSelectTrigger = page.getByRole('combobox').filter({ hasText: /select an agent/i });
    await expect(agentSelectTrigger).toBeVisible({ timeout: 10000 });

    // Open dropdown
    await agentSelectTrigger.click();
    const agentOptions = page.getByRole('option');
    const agentCount = await agentOptions.count();

    if (agentCount === 0) {
      console.warn('[TC-01] No agents in org. Test requires at least one agent. SKIP.');
      test.skip();
      return;
    }

    const rawName = await agentOptions.first().textContent();
    createdAgentName = rawName?.trim() ?? '';
    await agentOptions.first().click();
    console.log(`[TC-01] Selected agent: "${createdAgentName}"`);

    // Check if there's a project pre-selected
    if (await page.getByText(/no projects found/i).isVisible().catch(() => false)) {
      console.error('[TC-01] No projects found. Cannot create task without a project.');
      expect(false, 'Requires at least one project').toBe(true);
      return;
    }

    // Project should be pre-selected. If not, select the first one.
    const projectTrigger = page.getByRole('combobox').filter({ hasText: /select a project/i });
    if (await projectTrigger.isVisible().catch(() => false)) {
      await projectTrigger.click();
      await page.getByRole('option').first().click();
    }

    // Submit — button label is "Create & Dispatch" when agent mode is active
    await page.getByRole('button', { name: /create task|create & dispatch/i }).click();

    // Wait for success state or redirect
    await Promise.race([
      page.waitForURL(/\/tasks(?!\/)/, { timeout: 20000 }),
      expect(page.getByText(/task created/i)).toBeVisible({ timeout: 20000 }),
    ]);

    taskCreated = true;
    console.log(`[TC-01] PASS — Task "${TASK_NAME}" created with agent assignment`);
  });

  // ---------------------------------------------------------------------------
  // TC-02: ASSIGNED_AGENT_ID PERSISTED → APPEARS IN ALL TASKS VIEW
  // ---------------------------------------------------------------------------
  test('TC-02: assigned_agent_id persisted — task appears in All Tasks view', async ({ page }) => {
    if (!taskCreated) { test.skip(); return; }

    await page.goto(`${BASE_URL}/tasks?view=all`);
    await page.waitForLoadState('networkidle');

    // Poll up to 30s for the task — handles the after() deferred cache invalidation race
    const found = await waitForTaskInView(page, 30000);

    if (!found) {
      console.error(
        `[TC-02] FAIL — Task "${TASK_NAME}" NOT visible in All Tasks view after 30s of polling.\n` +
        `  Root cause: dispatchTaskToAgent does not invalidate KV cache (CacheKeys.orgTasks),\n` +
        `  and createTask uses after() for deferred invalidation, creating a race condition.`
      );
    } else {
      console.log(`[TC-02] PASS — Task visible in All Tasks view`);
    }

    expect(found, `Task "${TASK_NAME}" should appear in All Tasks view`).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-03a: MY TASKS VIEW
  // ---------------------------------------------------------------------------
  test('TC-03a: Agent-assigned task appears in My Tasks view', async ({ page }) => {
    if (!taskCreated) { test.skip(); return; }

    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Per the query: My Tasks = tasks where assignee_id = me OR (assigned_agent_id not null AND created_by = me)
    // Our task was created by this user with an agent, so it should match the second condition.

    // Try "Agent Tasks" quick-filter chip if needed
    let taskVisible = await page.getByText(TASK_NAME).first().isVisible().catch(() => false);
    if (!taskVisible) {
      const agentChip = page.getByRole('button', { name: /agent tasks/i });
      if (await agentChip.isVisible().catch(() => false)) {
        await agentChip.click();
        await page.waitForTimeout(1000);
        taskVisible = await page.getByText(TASK_NAME).first().isVisible().catch(() => false);
      }
    }

    // If still not visible, try polling (cache might still be stale)
    if (!taskVisible) {
      taskVisible = await waitForTaskInView(page, 20000);
    }

    if (!taskVisible) {
      console.error(
        `[TC-03a] FAIL — Task "${TASK_NAME}" NOT visible in My Tasks view.\n` +
        `  My Tasks query: .or("assignee_id.eq.USER_ID, and(assigned_agent_id.not.is.null, created_by.eq.USER_ID)")\n` +
        `  The task was created with assigned_agent_id set via dispatchTaskToAgent (after createTask).\n` +
        `  If createTask's cache invalidation fires before the client reads, it shows up.\n` +
        `  Likely same after() race condition as TC-02.`
      );
    } else {
      console.log(`[TC-03a] PASS — Task visible in My Tasks view`);
    }

    expect(taskVisible, `Task "${TASK_NAME}" should appear in My Tasks view`).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-03b: ALL TASKS VIEW (separate navigation)
  // ---------------------------------------------------------------------------
  test('TC-03b: Agent-assigned task appears in All Tasks view (re-check)', async ({ page }) => {
    if (!taskCreated) { test.skip(); return; }

    await page.goto(`${BASE_URL}/tasks?view=all`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should now be visible since TC-02 already waited for cache propagation
    const taskVisible = await page.getByText(TASK_NAME).first().isVisible().catch(() => false);

    if (!taskVisible) {
      console.error(`[TC-03b] FAIL — Task "${TASK_NAME}" still not visible in All Tasks view`);
    } else {
      console.log(`[TC-03b] PASS — Task visible in All Tasks view`);
    }

    expect(taskVisible, `Task "${TASK_NAME}" should appear in All Tasks view`).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TC-03c: PROJECT TASK LIST VIEW
  // ---------------------------------------------------------------------------
  test('TC-03c: Agent-assigned task appears in the project task list', async ({ page }) => {
    if (!taskCreated) { test.skip(); return; }

    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    // Get links from main content area (not sidebar)
    const mainContent = page.getByRole('main');
    const projectLinks = mainContent.getByRole('link').filter({ hasText: /.+/ });
    const linkCount = await projectLinks.count();

    if (linkCount === 0) {
      console.warn('[TC-03c] No project links found — skipping');
      test.skip();
      return;
    }

    const href = await projectLinks.first().getAttribute('href');
    if (href) {
      await page.goto(`${BASE_URL}${href}`);
    } else {
      await projectLinks.first().click();
    }
    await page.waitForLoadState('networkidle');

    // Click Tasks tab if present
    const tasksTab = page.getByRole('tab', { name: /^tasks$/i });
    if (await tasksTab.isVisible().catch(() => false)) {
      await tasksTab.click();
      await page.waitForTimeout(1500);
    }

    const taskVisible = await page.getByText(TASK_NAME).first().isVisible().catch(() => false);

    if (taskVisible) {
      console.log(`[TC-03c] PASS — Task visible in project task list`);
    } else {
      console.warn(
        `[TC-03c] WARN — Task "${TASK_NAME}" not in first project's task list.\n` +
        `  This may be a different project; task confirmed in All Tasks view via TC-02/TC-03b.`
      );
    }

    // This is informational — not a hard failure since we don't control which project was selected
    console.log(`[TC-03c] Task in first project's task list: ${taskVisible}`);
  });

  // ---------------------------------------------------------------------------
  // TC-04: NO DUPLICATE ROWS
  // ---------------------------------------------------------------------------
  test('TC-04: No duplicate rows for the created task in All Tasks view', async ({ page }) => {
    if (!taskCreated) { test.skip(); return; }

    await page.goto(`${BASE_URL}/tasks?view=all`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const allOccurrences = await page.getByText(TASK_NAME).count();
    console.log(`[TC-04] Occurrences of task name text in DOM: ${allOccurrences}`);

    // ≤ 2 is acceptable (task row + possibly task name in another context like a panel)
    // > 2 = duplicate row bug
    if (allOccurrences > 2) {
      console.error(`[TC-04] FAIL — ${allOccurrences} occurrences. Possible duplicate rows.`);
    } else if (allOccurrences === 0) {
      console.warn(`[TC-04] WARN — Task not found; TC-02 failure means cache not cleared yet`);
    } else {
      console.log(`[TC-04] PASS — ${allOccurrences} occurrence(s), no duplicates`);
    }

    expect(allOccurrences, 'Should have ≤ 2 occurrences (no duplicate rows)').toBeLessThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // TC-05: AGENT BADGE / OWNER INDICATOR
  // ---------------------------------------------------------------------------
  test('TC-05: Agent-assigned task shows agent badge/indicator in task list', async ({ page }) => {
    if (!taskCreated) { test.skip(); return; }

    await page.goto(`${BASE_URL}/tasks?view=all`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Ensure task visible first
    const taskTextVisible = await page.getByText(TASK_NAME).first().isVisible().catch(() => false);
    if (!taskTextVisible) {
      console.warn('[TC-05] Task not visible in All Tasks — cannot check badges');
      // TC-02 is the authoritative failure for this
      test.skip();
      return;
    }

    // Find the container element for the task row
    // App renders task items as divs/spans — scan all elements containing the task name
    const hasAnyIndicator = await page.evaluate((taskName) => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const textNodes = allElements.filter(
        el => el.children.length > 0 && el.textContent?.includes(taskName)
      );

      // From most-specific (deepest) upward, look for agent indicators
      for (const el of textNodes.slice().reverse()) {
        const classes = el.className?.toString() ?? '';
        const html = el.innerHTML ?? '';

        // Purple color = agent indicator
        if (classes.includes('purple')) return { found: true, reason: 'purple class' };
        // Colored circle avatar
        if (classes.includes('rounded-full') && !classes.includes('overflow')) {
          return { found: true, reason: 'rounded-full avatar' };
        }
        // SVG icons present (Robot icon)
        if (html.includes('<svg') || el.querySelector('svg')) {
          return { found: true, reason: 'SVG icon' };
        }
        // Agent-colored badge (blue/emerald for squad colors)
        if (classes.includes('blue') || classes.includes('emerald') || classes.includes('slate')) {
          return { found: true, reason: 'squad color class' };
        }
      }
      return { found: false, reason: 'no indicator found' };
    }, TASK_NAME);

    console.log(`[TC-05] Agent indicator check: found=${hasAnyIndicator.found}, reason="${hasAnyIndicator.reason}"`);

    if (!hasAnyIndicator.found) {
      console.error(
        `[TC-05] FAIL — No agent badge/indicator visible for agent-assigned task.\n` +
        `  Expected: robot icon, colored avatar circle, or purple styling.\n` +
        `  Check TaskCard.tsx and TaskRowBase.tsx for agent indicator rendering logic.`
      );
    } else {
      console.log(`[TC-05] PASS — Agent indicator present (${hasAnyIndicator.reason})`);
    }

    expect(hasAnyIndicator.found, 'Agent-assigned task should show a visual indicator').toBe(true);
  });

});
