import { test, expect, testData } from './fixtures';
import { LoginPage } from './pages';

/**
 * Session & Route Protection Tests
 * Test cases RP-001 through RP-011 from Auth-Test-Plan.md
 */
test.describe('Route Protection', () => {
  test.describe('7.1 Protected Routes', () => {
    test('RP-001: Dashboard access when logged out redirects to login', async ({ page, baseURL }) => {
      // Clear any existing auth
      await page.context().clearCookies();

      await page.goto(`${baseURL}/`);

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('RP-002: Projects page access when logged out redirects to login', async ({ page, baseURL }) => {
      await page.context().clearCookies();

      await page.goto(`${baseURL}/projects`);

      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('RP-003: Tasks page access when logged out redirects to login', async ({ page, baseURL }) => {
      await page.context().clearCookies();

      await page.goto(`${baseURL}/tasks`);

      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('RP-004: Clients page access when logged out redirects to login', async ({ page, baseURL }) => {
      await page.context().clearCookies();

      await page.goto(`${baseURL}/clients`);

      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('RP-005: Settings page access when logged out redirects to login', async ({ page, baseURL }) => {
      await page.context().clearCookies();

      await page.goto(`${baseURL}/settings`);

      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });
  });

  test.describe('7.2 Auth Pages When Logged In', () => {
    // These tests require authenticated state
    test.skip('RP-006: Login page when logged in redirects to dashboard', async ({ page, baseURL }) => {
      // Requires auth state
      await page.goto(`${baseURL}/login`);

      // Should redirect to dashboard
      await page.waitForURL((url) => !url.pathname.includes('/login'));
      expect(page.url()).not.toContain('/login');
    });

    test.skip('RP-007: Signup page when logged in redirects to dashboard', async ({ page, baseURL }) => {
      // Requires auth state
      await page.goto(`${baseURL}/signup`);

      // Should redirect to dashboard
      await page.waitForURL((url) => !url.pathname.includes('/signup'));
      expect(page.url()).not.toContain('/signup');
    });
  });

  test.describe('7.3 Session Management', () => {
    test.skip('RP-008: Sign out clears session and redirects', async ({ dashboardPage, page }) => {
      // Requires authenticated state
      await dashboardPage.goTo();
      await dashboardPage.waitForDashboardLoad();
      await dashboardPage.signOut();

      await expect(page).toHaveURL(/\/login/);
    });

    test.skip('RP-009: Session persists across browser close', async () => {
      // Complex test - requires browser context manipulation
      // Skip for automated testing
    });

    test.skip('RP-010: Multiple tabs logout together', async () => {
      // Complex test - requires multiple page contexts
      // Skip for automated testing
    });

    test.skip('RP-011: Expired session redirects to login', async () => {
      // Requires waiting for session expiry
      // Skip for automated testing
    });
  });

  test.describe('Direct URL Access', () => {
    test('Accessing non-existent protected route redirects to login', async ({ page, baseURL }) => {
      await page.context().clearCookies();

      await page.goto(`${baseURL}/nonexistent-protected-route`);

      // Should either 404 or redirect to login
      const url = page.url();
      expect(url.includes('/login') || url.includes('/404')).toBeTruthy();
    });

    test('Deep link to project redirects to login when not authenticated', async ({ page, baseURL }) => {
      await page.context().clearCookies();

      await page.goto(`${baseURL}/projects/some-project-id`);

      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });
  });
});

test.describe('Authenticated Routes', () => {
  // Tests that require authenticated state
  // Use storage state from auth.setup.ts

  test.describe.skip('With Authentication', () => {
    test.use({ storageState: 'e2e/.auth/user.json' });

    test('Can access dashboard when authenticated', async ({ dashboardPage }) => {
      await dashboardPage.goTo();
      await dashboardPage.assertDashboardLoaded();
    });

    test('Can access tasks page when authenticated', async ({ dashboardPage, page, baseURL }) => {
      await dashboardPage.goTo();
      await dashboardPage.waitForDashboardLoad();
      await dashboardPage.goToTasks();

      await expect(page).toHaveURL(/\/tasks/);
    });

    test('Can access clients page when authenticated', async ({ dashboardPage, page, baseURL }) => {
      await dashboardPage.goTo();
      await dashboardPage.waitForDashboardLoad();
      await dashboardPage.goToClients();

      await expect(page).toHaveURL(/\/clients/);
    });

    test('Sign out button is visible', async ({ dashboardPage }) => {
      await dashboardPage.goTo();
      await dashboardPage.waitForDashboardLoad();

      await expect(dashboardPage.signOutButton).toBeVisible();
    });
  });
});
