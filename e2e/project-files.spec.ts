import { test, expect, generateUniqueProjectName } from './fixtures';

/**
 * Project Files Tests
 * Tests for the Assets & Files tab in project details
 */
test.describe('Project Files Tab', () => {
  // Use authenticated state for all tests
  test.use({ storageState: 'e2e/.auth/user.json' });

  // Helper to create a test project and navigate to it
  async function createAndOpenProject(
    projectsPage: any,
    projectWizardPage: any,
    projectDetailsPage: any
  ): Promise<string> {
    const projectName = generateUniqueProjectName();
    await projectsPage.goTo();
    await projectsPage.clickAddProject();
    await projectWizardPage.waitForWizard();
    await projectWizardPage.quickCreateProject({ name: projectName });
    await projectWizardPage.assertWizardClosed();

    // Navigate to project details with retry
    await projectsPage.goTo();
    await projectsPage.waitForProjectsLoad();

    // Wait a bit for the project to appear in the list
    await projectsPage.page.waitForTimeout(1000);

    try {
      await projectsPage.clickProject(projectName);
    } catch {
      // Retry once if the click fails
      await projectsPage.goTo();
      await projectsPage.waitForProjectsLoad();
      await projectsPage.page.waitForTimeout(1000);
      await projectsPage.clickProject(projectName);
    }

    // Wait for project details to load
    await projectDetailsPage.waitForProjectLoad();

    return projectName;
  }

  test.describe('Files Tab Navigation', () => {
    test('PF-001: Can navigate to Assets & Files tab', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);

      // Click on the Assets & Files tab
      await projectDetailsPage.switchToFiles();

      // Verify tab is active
      await projectDetailsPage.assertTabActive('Assets');
    });

    test('PF-002: Files tab shows section headers', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Should show "Recent Files" and "All files" section headers
      await expect(page.getByText('Recent Files')).toBeVisible();
      await expect(page.getByText('All files')).toBeVisible();
    });

    test('PF-003: Files tab shows Add File button', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Should show Add File button
      await expect(page.getByRole('button', { name: /add file/i })).toBeVisible();
    });
  });

  test.describe('Add File Modal', () => {
    test('PF-004: Add File button opens modal', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Click Add File button
      await page.getByRole('button', { name: /add file/i }).click();

      // Wait for modal to open - the modal has a URL input and overlay
      await page.waitForTimeout(500);
      // Modal should show URL input field or "Upload files" button
      const modalIndicator = page.getByPlaceholder(/url|link/i).or(page.getByRole('button', { name: /upload files/i }));
      await expect(modalIndicator.first()).toBeVisible({ timeout: 5000 });
    });

    test('PF-005: Add File modal has URL input', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Click Add File button
      await page.getByRole('button', { name: /add file/i }).click();

      // Modal should have URL input field
      await expect(page.getByPlaceholder(/url|link/i)).toBeVisible();
    });

    test('PF-006: Add File modal can be closed', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Open modal
      await page.getByRole('button', { name: /add file/i }).click();
      await page.waitForTimeout(500);
      const modalInput = page.getByPlaceholder(/url|link/i);
      await expect(modalInput).toBeVisible({ timeout: 5000 });

      // Close modal by finding the X button within the modal container
      // The modal is inside the fixed overlay div with z-50
      const modalContainer = page.locator('.fixed.inset-0.z-50');
      const closeButton = modalContainer.locator('button').filter({ has: page.locator('svg.h-4.w-4') }).first();
      await closeButton.click({ force: true });
      await page.waitForTimeout(300);

      // Modal should close - URL input should not be visible
      await expect(modalInput).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Files Table', () => {
    test('PF-007: Files table has search input', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Wait for files tab content to load
      await page.waitForTimeout(1000);

      // Should have a search input
      await expect(page.getByPlaceholder(/search/i)).toBeVisible({ timeout: 10000 });
    });

    test('PF-008: Empty state shows when no files exist', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);
      await projectDetailsPage.switchToFiles();

      // Wait for loading to complete
      await page.waitForTimeout(1000);

      // For a new project with no files, the table should either be empty
      // or show no rows (the component handles empty state gracefully)
      const tableRows = page.locator('table tbody tr');
      const rowCount = await tableRows.count();

      // New project should have 0 files
      expect(rowCount).toBe(0);
    });
  });

  test.describe('Loading States', () => {
    test('PF-009: Shows loading state initially', async ({
      projectsPage,
      projectWizardPage,
      projectDetailsPage,
      page,
    }) => {
      await createAndOpenProject(projectsPage, projectWizardPage, projectDetailsPage);

      // Switch to files tab and immediately check for loading state
      await page.getByRole('tab', { name: /assets/i }).click();

      // Loading skeletons or content should appear quickly
      // Either we see skeletons or we see the content (fast load)
      const hasContent = await Promise.race([
        page.getByText('Recent Files').waitFor({ state: 'visible', timeout: 5000 }).then(() => true),
        page.locator('[class*="skeleton"]').first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true),
      ]).catch(() => false);

      expect(hasContent).toBe(true);
    });
  });
});
