import { test, expect, testData, generateUniqueOrgName } from './fixtures';

/**
 * Onboarding Tests
 * Test cases OB-001 through OB-012 from Auth-Test-Plan.md
 */
test.describe('Onboarding Page', () => {
  test.describe('6.1 Access Control Tests', () => {
    test('OB-001: Unauthenticated user is redirected to login', async ({ page, baseURL }) => {
      // Clear any existing auth state
      await page.context().clearCookies();

      await page.goto(`${baseURL}/onboarding`);

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test.skip('OB-002: User with org can access onboarding', async () => {
      // Requires authenticated user with org
    });

    test.skip('OB-003: User without org is redirected to onboarding', async () => {
      // Requires authenticated user without org
    });
  });

  test.describe('6.2 Form Validation Tests', () => {
    // These tests require authenticated state without organization
    test.skip('OB-004: Empty org name shows HTML5 validation', async ({ onboardingPage }) => {
      await onboardingPage.goTo();
      await onboardingPage.clickCreateOrganization();

      const validationMessage = await onboardingPage.getOrgNameValidationMessage();
      expect(validationMessage).toBeTruthy();
    });

    test.skip('OB-005: Org name too short (1 char) shows error', async ({ onboardingPage }) => {
      await onboardingPage.goTo();
      await onboardingPage.fillOrgName(testData.orgNames.tooShort);
      await onboardingPage.clickCreateOrganization();

      // Should show minLength validation
      const validationMessage = await onboardingPage.getOrgNameValidationMessage();
      expect(validationMessage).toBeTruthy();
    });

    test.skip('OB-006: Valid org name is accepted', async ({ onboardingPage }) => {
      await onboardingPage.goTo();
      await onboardingPage.fillOrgName(testData.orgNames.valid);

      const isEnabled = await onboardingPage.isSubmitEnabled();
      expect(isEnabled).toBe(true);
    });
  });

  test.describe('6.3 Organization Creation Tests', () => {
    test.skip('OB-007: Organization is created successfully', async ({ onboardingPage }) => {
      const orgName = generateUniqueOrgName();

      await onboardingPage.goTo();
      await onboardingPage.createOrganizationAndWaitForRedirect(orgName);

      const currentPath = await onboardingPage.getCurrentPath();
      expect(currentPath).not.toContain('/onboarding');
    });

    test.skip('OB-008: Slug is generated from name', async () => {
      // Requires database verification
    });

    test.skip('OB-009: Duplicate org names get unique slugs', async () => {
      // Requires database verification
    });

    test.skip('OB-010: User becomes admin of org', async () => {
      // Requires database verification
    });

    test.skip('OB-011: Special chars in name are handled', async ({ onboardingPage }) => {
      await onboardingPage.goTo();
      await onboardingPage.fillOrgName(testData.orgNames.withSpecialChars);

      const isEnabled = await onboardingPage.isSubmitEnabled();
      expect(isEnabled).toBe(true);
    });

    test.skip('OB-012: Redirects to dashboard after creation', async ({ onboardingPage }) => {
      const orgName = generateUniqueOrgName();

      await onboardingPage.goTo();
      await onboardingPage.createOrganizationAndWaitForRedirect(orgName);

      const currentPath = await onboardingPage.getCurrentPath();
      expect(currentPath).toBe('/');
    });
  });

  test.describe('Page Load (requires auth)', () => {
    test.skip('Onboarding page displays all required elements', async ({ onboardingPage }) => {
      await onboardingPage.goTo();
      await onboardingPage.assertPageLoaded();
    });

    test.skip('Onboarding page has correct title', async ({ onboardingPage }) => {
      await onboardingPage.goTo();
      await expect(onboardingPage.cardTitle).toHaveText('Welcome to PMS');
    });
  });
});
