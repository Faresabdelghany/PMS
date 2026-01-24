import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages';
import * as fs from 'fs';

const authFile = 'e2e/.auth/user.json';

/**
 * Authentication setup for E2E tests
 *
 * This setup authenticates a test user and saves the session state
 * for use in tests that require authenticated access.
 *
 * Configure test credentials via environment variables:
 * - TEST_USER_EMAIL
 * - TEST_USER_PASSWORD
 */
setup('authenticate', async ({ page, baseURL }) => {
  // Check if we have a valid existing auth state
  try {
    const existingAuth = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    if (existingAuth.cookies && existingAuth.cookies.length > 0) {
      // Check if Supabase auth token exists and is not expired
      const supabaseToken = existingAuth.cookies.find((c: { name: string }) =>
        c.name.includes('auth-token')
      );
      if (supabaseToken?.value) {
        // Decode the base64 token and check expiration
        const tokenData = supabaseToken.value.replace('base64-', '');
        try {
          const decoded = JSON.parse(Buffer.from(tokenData, 'base64').toString());
          const expiresAt = decoded.expires_at;
          const now = Math.floor(Date.now() / 1000);
          if (expiresAt && expiresAt > now + 300) { // 5 min buffer
            console.log('✅ Using existing authentication state from', authFile);
            return;
          } else {
            console.log('⚠️  Auth token expired, re-authenticating...');
          }
        } catch {
          console.log('⚠️  Could not parse auth token, re-authenticating...');
        }
      }
    }
  } catch {
    // File doesn't exist or is invalid, continue with auth
  }

  // Skip if no test credentials configured
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    console.log('⚠️  Test credentials not configured. Skipping authentication setup.');
    console.log('   Set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables.');

    // Create empty auth state file so tests can run (but will skip auth-required tests)
    await page.context().storageState({ path: authFile });
    return;
  }

  const loginPage = new LoginPage(page, baseURL!);

  // Navigate to login
  await loginPage.goTo();

  // Perform login
  await loginPage.loginAndWaitForRedirect(
    process.env.TEST_USER_EMAIL,
    process.env.TEST_USER_PASSWORD
  );

  // Verify we're logged in (not on login page)
  await expect(page).not.toHaveURL(/\/login/);

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication state saved to', authFile);
});
