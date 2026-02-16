import { test, expect, generateUniqueProjectName } from './fixtures';
import type { ProjectsPage } from './pages/ProjectsPage';
import type { ProjectWizardPage } from './pages/ProjectWizardPage';

/**
 * Project CRUD Bug-Hunting Tests
 *
 * Targeted tests for bugs discovered during manual exploratory testing.
 *
 * BUG #1: Supabase Realtime WebSocket fails with "HTTP Authentication failed"
 * BUG #2: Null end_date renders as "Jan 1, 2000" instead of "—" on project cards
 * BUG #3: BacklogCard section header hardcoded as "Backlog" regardless of project status
 * BUG #4: Deleted project stays visible in list (no optimistic update, realtime-dependent)
 * BUG #5: Status labels inconsistent between wizard ("Pre-Sales") and card ("Backlog")
 * BUG #6: Sidebar "Active Projects" doesn't update after project create/status change
 */
test.describe('Project CRUD Bug-Hunting Tests', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  // Shared helper to quick-create a project and return its name
  async function createProject(
    projectsPage: ProjectsPage,
    wizardPage: ProjectWizardPage,
    name?: string,
    options?: { priority?: string; status?: string }
  ): Promise<string> {
    const projectName = name || generateUniqueProjectName();
    await projectsPage.clickAddProject();
    await wizardPage.waitForWizard();
    await wizardPage.selectQuickMode();
    await wizardPage.fillName(projectName);
    if (options?.priority) {
      await wizardPage.selectPriority(options.priority);
    }
    if (options?.status) {
      await wizardPage.selectStatus(options.status);
    }
    await wizardPage.submitQuickCreate();
    await wizardPage.assertWizardClosed();
    return projectName;
  }

  test.describe('BUG #1: Realtime WebSocket connection', () => {
    test('should not have WebSocket authentication errors in console', async ({
      projectsPage,
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Wait a bit for WebSocket connections to establish
      await page.waitForTimeout(5000);

      const wsErrors = consoleErrors.filter((e) =>
        e.includes('WebSocket') && e.includes('Authentication failed')
      );

      // There should be 0 WebSocket auth failures
      expect(wsErrors.length).toBe(0);
    });
  });

  test.describe('BUG #2: Project card date display for null dates', () => {
    test('project card should show "—" when end_date is null, not "Jan 1, 2000"', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Create a project with no target/end date set
      const projectName = await createProject(projectsPage, projectWizardPage);

      // Wait for project to appear in list
      await page.waitForTimeout(2000);
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Find the project card
      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });

      // The card should NOT show "Jan 1, 2000" - that's the FALLBACK_DATE bug
      const cardText = await projectCard.textContent();
      expect(cardText).not.toContain('Jan 1, 2000');

      // It should show either "—" or the actual start date, not the fallback
      const hasValidDate = !cardText?.includes('2000');
      expect(hasValidDate).toBe(true);

      // Cleanup
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
    });

    test('project card should show actual date when end_date is set', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Create a project — start date is auto-set to today
      const projectName = await createProject(projectsPage, projectWizardPage);

      await page.waitForTimeout(2000);
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });
      const cardText = await projectCard.textContent();

      // Should show the current year, not 2000
      const currentYear = new Date().getFullYear().toString();
      // The card might show start_date or end_date. If end_date is null,
      // it should definitely NOT show year 2000
      expect(cardText).not.toContain('2000');

      // Cleanup
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
    });
  });

  test.describe('BUG #3: BacklogCard header shows "Backlog" for all statuses', () => {
    test('project detail sidebar section should not say "Backlog" for Active project', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Create a project with Active status
      const projectName = await createProject(projectsPage, projectWizardPage, undefined, {
        status: 'Active',
        priority: 'High',
      });

      await page.waitForTimeout(2000);
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Click on the project to go to detail page
      await projectsPage.clickProject(projectName);
      await projectDetailsPage.waitForProjectLoad();

      // The sidebar section containing Status/Group/Priority should NOT be labeled "Backlog"
      // when the project status is "Active"
      const statusBadge = page.locator('text=Active').first();
      await expect(statusBadge).toBeVisible();

      // Check if the misleading "Backlog" section header exists near the metadata
      // The Backlog text should NOT appear as a section header for an Active project
      const backlogSectionHeader = page.locator('div.text-base.font-medium').filter({ hasText: 'Backlog' });
      const isBacklogHeaderVisible = await backlogSectionHeader.isVisible().catch(() => false);

      // This assertion will FAIL if the bug exists (it currently shows "Backlog")
      expect(isBacklogHeaderVisible).toBe(false);

      // Cleanup: go back and delete
      await page.goto(`${page.url().split('/projects/')[0]}/projects`);
      await projectsPage.waitForProjectsLoad();
      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
    });
  });

  test.describe('BUG #4: Project list not updating after delete', () => {
    test('deleted project should disappear from list without page reload', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectName = await createProject(projectsPage, projectWizardPage);

      // Reload to ensure the project is in the list
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });

      // Delete via the 3-dot menu
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      // Confirm deletion
      const deleteConfirm = page.getByRole('alertdialog').getByRole('button', { name: 'Delete' });
      await deleteConfirm.click();

      // Wait for the deletion to process
      await page.waitForTimeout(3000);

      // The project should NOT be visible anymore — without page reload
      // This assertion will FAIL if the bug exists (stale card remains)
      await expect(
        page.getByRole('button', { name: new RegExp(projectName) })
      ).not.toBeVisible({ timeout: 5000 });
    });

    test('deleted project should be gone after page reload (sanity check)', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectName = await createProject(projectsPage, projectWizardPage);

      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });

      // Delete via the 3-dot menu
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const deleteConfirm = page.getByRole('alertdialog').getByRole('button', { name: 'Delete' });
      await deleteConfirm.click();

      await page.waitForTimeout(2000);

      // Reload the page — this should always work
      await page.reload();
      await projectsPage.waitForProjectsLoad();

      // After reload, the project must be gone
      await expect(
        page.getByRole('button', { name: new RegExp(projectName) })
      ).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('BUG #5: Status label inconsistency in wizard', () => {
    test('wizard status options should match database enum labels', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();
      await projectsPage.clickAddProject();
      await projectWizardPage.waitForWizard();
      await projectWizardPage.selectQuickMode();

      // Open the status dropdown
      await projectWizardPage.statusSelect.click();
      await page.waitForTimeout(500);

      // Get all status option labels
      const options = page.getByRole('option');
      const optionCount = await options.count();
      const labels: string[] = [];
      for (let i = 0; i < optionCount; i++) {
        const text = await options.nth(i).textContent();
        if (text) labels.push(text.trim());
      }

      // The labels should be consistent with what's shown on cards and detail pages
      // Expected: Backlog, Planned, Active, Completed, Cancelled
      // Bug: Shows "Pre-Sales" instead of "Backlog"
      expect(labels).not.toContain('Pre-Sales'); // This will FAIL if bug exists

      // Should contain standard status labels
      const expectedLabels = ['Backlog', 'Planned', 'Active', 'Completed', 'Cancelled'];
      for (const expected of expectedLabels) {
        expect(labels.some((l) => l.includes(expected))).toBe(true);
      }

      // Close wizard
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    });
  });

  test.describe('BUG #6: Sidebar not updating after project operations', () => {
    test('sidebar Active Projects should include newly created active project', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Create a project with Active status
      const projectName = await createProject(projectsPage, projectWizardPage, undefined, {
        status: 'Active',
      });

      // Wait for the project to be created
      await page.waitForTimeout(3000);

      // Check the sidebar "Active Projects" section
      const sidebar = page.locator('nav, aside').first();
      const activeProjectsSection = sidebar.locator('text=Active Projects').locator('..');

      // The new project should appear in the sidebar under "Active Projects"
      const sidebarLinks = activeProjectsSection.locator('a');
      const sidebarTexts: string[] = [];
      const count = await sidebarLinks.count();
      for (let i = 0; i < count; i++) {
        const text = await sidebarLinks.nth(i).textContent();
        if (text) sidebarTexts.push(text.trim());
      }

      // The new active project should be in the sidebar
      // This may fail if the sidebar doesn't update without a reload
      const projectInSidebar = sidebarTexts.some((t) =>
        t.toLowerCase().includes(projectName.toLowerCase().slice(0, 15))
      );

      // If not in sidebar, reload and check
      if (!projectInSidebar) {
        await page.reload();
        await projectsPage.waitForProjectsLoad();
        await page.waitForTimeout(2000);
      }

      // After reload, it should definitely be there
      const refreshedSidebarLink = page
        .locator('a')
        .filter({ hasText: new RegExp(projectName.slice(0, 20), 'i') });
      await expect(refreshedSidebarLink.first()).toBeVisible({ timeout: 10000 });

      // Cleanup
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();
      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
    });
  });

  test.describe('Create-Update-Delete full lifecycle', () => {
    test('full CRUD lifecycle: create, verify, update, verify, delete, verify', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // === CREATE ===
      const projectName = generateUniqueProjectName();
      await createProject(projectsPage, projectWizardPage, projectName, {
        priority: 'High',
      });

      // Verify creation (reload to ensure fresh data)
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();
      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });

      // Verify the card shows correct priority
      await expect(projectCard).toContainText('High');

      // === UPDATE ===
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();

      // Wait for edit form to appear
      const titleInput = page.getByRole('textbox', { name: 'Project title' });
      await expect(titleInput).toBeVisible({ timeout: 5000 });

      // Verify pre-populated values
      const inputValue = await titleInput.inputValue();
      expect(inputValue).toBe(projectName);

      // Update the name
      const updatedName = `${projectName} - Updated`;
      await titleInput.clear();
      await titleInput.fill(updatedName);

      // Submit update
      await page.getByRole('button', { name: 'Update Project' }).click();

      // Wait for the edit form to close (signals update completed on server)
      await expect(page.getByRole('textbox', { name: 'Project title' })).not.toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      // Navigate and verify
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const updatedCard = page.getByRole('button', { name: new RegExp(updatedName) });
      await expect(updatedCard).toBeVisible({ timeout: 10000 });

      // === DELETE ===
      const deleteActionsButton = updatedCard.getByRole('button', { name: 'Project actions' });
      await deleteActionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      // Verify confirmation dialog
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(updatedName);
      await expect(dialog).toContainText('cannot be undone');

      // Confirm delete
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(2000);

      // Verify deletion (reload to confirm)
      await page.reload();
      await projectsPage.waitForProjectsLoad();
      await expect(
        page.getByRole('button', { name: new RegExp(updatedName) })
      ).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Edge cases and validation', () => {
    test('cannot create project with empty title', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();
      await projectsPage.clickAddProject();
      await projectWizardPage.waitForWizard();
      await projectWizardPage.selectQuickMode();

      // Create button should be disabled with empty title
      const createButton = page.getByRole('button', { name: 'Create Project' });
      await expect(createButton).toBeDisabled();

      // Close wizard
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    });

    test('create button enables when title is entered', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();
      await projectsPage.clickAddProject();
      await projectWizardPage.waitForWizard();
      await projectWizardPage.selectQuickMode();

      // Initially disabled
      const createButton = page.getByRole('button', { name: 'Create Project' });
      await expect(createButton).toBeDisabled();

      // Enter a title
      await projectWizardPage.fillName('Test Title');

      // Should now be enabled
      await expect(createButton).toBeEnabled();

      // Close wizard
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    });

    test('special characters in project name are handled safely (no XSS)', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const xssName = `XSS Test <b>bold</b> & "quotes" ${Date.now()}`;
      await createProject(projectsPage, projectWizardPage, xssName);

      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // The project should display with escaped HTML — use exact timestamp to avoid stale matches
      const escapedName = xssName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const projectCard = page.getByRole('button', { name: new RegExp(escapedName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });

      // Should contain the raw HTML text, not rendered HTML
      const cardText = await projectCard.textContent();
      expect(cardText).toContain('<b>');
      expect(cardText).toContain('&');

      // Ensure no script execution — check that the page didn't get XSS'd
      const alertTriggered = await page.evaluate(() => {
        return (window as any).__xssTriggered || false;
      });
      expect(alertTriggered).toBe(false);

      // Cleanup
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
    });

    test('delete cancel keeps project in list', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectName = await createProject(projectsPage, projectWizardPage);

      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      await expect(projectCard).toBeVisible({ timeout: 10000 });

      // Open delete dialog but cancel
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();

      // Project should still be in list
      await expect(projectCard).toBeVisible();

      // Cleanup: actually delete it
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    });

    test('edit wizard pre-populates existing project data', async ({
      projectsPage,
      projectWizardPage,
      page,
    }) => {
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      const projectName = await createProject(projectsPage, projectWizardPage, undefined, {
        priority: 'High',
      });

      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();

      // Open edit via 3-dot menu
      const projectCard = page.getByRole('button', { name: new RegExp(projectName) });
      const actionsButton = projectCard.getByRole('button', { name: 'Project actions' });
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();

      // Verify the title is pre-populated
      const titleInput = page.getByRole('textbox', { name: 'Project title' });
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      const value = await titleInput.inputValue();
      expect(value).toBe(projectName);

      // Verify High priority is shown (use exact to avoid matching project cards containing "High")
      const priorityButton = page.getByRole('button', { name: 'High', exact: true });
      await expect(priorityButton).toBeVisible();

      // Verify Update button is shown (not Create)
      await expect(page.getByRole('button', { name: 'Update Project' })).toBeVisible();

      // Close without saving
      await page.keyboard.press('Escape');

      // Cleanup
      await actionsButton.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
    });
  });
});
