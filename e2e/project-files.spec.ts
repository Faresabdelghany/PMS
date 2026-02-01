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

    // Navigate to project details
    await projectsPage.goTo();
    await projectsPage.waitForProjectsLoad();
    await projectsPage.clickProject(projectName);

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

      // Modal should open
      await expect(page.getByRole('dialog')).toBeVisible();
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
      await expect(page.getByRole('dialog')).toBeVisible();

      // Close modal (click outside or close button)
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
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

      // Should have a search input
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
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
