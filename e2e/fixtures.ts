import { test as base, Page } from '@playwright/test';
import {
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  OnboardingPage,
  DashboardPage,
  ProjectsPage,
  ProjectWizardPage,
  ProjectDetailsPage,
} from './pages';

/**
 * Custom test fixtures for E2E tests
 * Provides page objects and test data for all tests
 */
type AppFixtures = {
  // Auth pages
  loginPage: LoginPage;
  signupPage: SignupPage;
  forgotPasswordPage: ForgotPasswordPage;
  onboardingPage: OnboardingPage;
  dashboardPage: DashboardPage;
  // Project pages
  projectsPage: ProjectsPage;
  projectWizardPage: ProjectWizardPage;
  projectDetailsPage: ProjectDetailsPage;
  // Authenticated context
  authenticatedPage: Page;
};

export const test = base.extend<AppFixtures>({
  loginPage: async ({ page, baseURL }, use) => {
    const loginPage = new LoginPage(page, baseURL!);
    await use(loginPage);
  },

  signupPage: async ({ page, baseURL }, use) => {
    const signupPage = new SignupPage(page, baseURL!);
    await use(signupPage);
  },

  forgotPasswordPage: async ({ page, baseURL }, use) => {
    const forgotPasswordPage = new ForgotPasswordPage(page, baseURL!);
    await use(forgotPasswordPage);
  },

  onboardingPage: async ({ page, baseURL }, use) => {
    const onboardingPage = new OnboardingPage(page, baseURL!);
    await use(onboardingPage);
  },

  dashboardPage: async ({ page, baseURL }, use) => {
    const dashboardPage = new DashboardPage(page, baseURL!);
    await use(dashboardPage);
  },

  projectsPage: async ({ page, baseURL }, use) => {
    const projectsPage = new ProjectsPage(page, baseURL!);
    await use(projectsPage);
  },

  projectWizardPage: async ({ page, baseURL }, use) => {
    const projectWizardPage = new ProjectWizardPage(page, baseURL!);
    await use(projectWizardPage);
  },

  projectDetailsPage: async ({ page, baseURL }, use) => {
    const projectDetailsPage = new ProjectDetailsPage(page, baseURL!);
    await use(projectDetailsPage);
  },

  authenticatedPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    await page.goto(baseURL!);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';

/**
 * Test data matching Auth-Test-Plan.md Appendix A
 */
export const testData = {
  // Valid test user (configure via environment variables or use test credentials)
  validUser: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPass123!',
    fullName: 'Test User',
  },

  // New user for signup tests (use unique email)
  newUser: {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPass123!',
    fullName: 'New Test User',
  },

  // Invalid credentials for negative tests
  invalidUser: {
    email: 'nonexistent@example.com',
    password: 'WrongPassword123!',
  },

  // Email validation test cases
  emails: {
    valid: 'valid@example.com',
    empty: '',
    invalid: 'invalid-email',
    noAt: 'nodomain.com',
    noDomain: 'test@',
    withSpaces: ' test@example.com ',
  },

  // Password validation test cases
  passwords: {
    valid: 'ValidPass123!',
    empty: '',
    tooShort: '1234567',      // 7 chars
    exactlyMin: '12345678',   // 8 chars (minimum)
    spaces: '        ',       // 8 spaces
  },

  // Full name validation test cases
  fullNames: {
    valid: 'John Doe',
    empty: '',
    tooShort: 'A',            // 1 char
    exactlyMin: 'Jo',         // 2 chars (minimum)
    withSpecialChars: "John O'Brien-Smith",
    unicode: '田中太郎',
    veryLong: 'A'.repeat(201), // 201 chars
  },

  // Organization name test cases
  orgNames: {
    valid: 'My Company',
    empty: '',
    tooShort: 'A',            // 1 char (needs 2 min)
    withSpecialChars: 'Acme & Co.',
  },

  // Security test payloads
  security: {
    sqlInjection: "'; DROP TABLE users; --",
    xss: '<script>alert("xss")</script>',
    longInput: 'A'.repeat(10000),
  },
};

/**
 * Generate a unique email for signup tests
 */
export function generateUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate a unique organization name
 */
export function generateUniqueOrgName(): string {
  return `Test Org ${Date.now()}`;
}

/**
 * Project test data matching Project-Test-Plan.md
 */
export const projectTestData = {
  // Valid project data
  validProject: {
    name: 'Test Project',
    description: 'This is a test project for E2E testing',
    status: 'active',
    priority: 'high',
  },

  // Project names for validation testing
  projectNames: {
    valid: 'Test Project',
    empty: '',
    tooShort: 'A',
    withSpecialChars: "Project & Co's Launch",
    unicode: '日本語プロジェクト',
    veryLong: 'A'.repeat(201),
  },

  // Status values
  statuses: ['backlog', 'planned', 'active', 'cancelled', 'completed'] as const,

  // Priority values
  priorities: ['urgent', 'high', 'medium', 'low'] as const,

  // Project member roles
  memberRoles: ['owner', 'pic', 'member', 'viewer'] as const,

  // Progress values for testing
  progressValues: {
    min: 0,
    mid: 50,
    max: 100,
    invalid: {
      negative: -1,
      overMax: 101,
    },
  },

  // Wizard test data
  wizard: {
    intent: 0, // First intent option
    successType: 0, // First success type
    deliverables: ['Deliverable 1', 'Deliverable 2'],
    metrics: ['Metric 1', 'Metric 2'],
    description: 'Project description for wizard test',
    owner: 'Test User',
    deadlineType: 'fixed' as const,
  },

  // Security test payloads
  security: {
    sqlInjection: "'; DROP TABLE projects; --",
    xss: '<script>alert("xss")</script>',
    longInput: 'A'.repeat(10000),
  },
};

/**
 * Generate a unique project name
 */
export function generateUniqueProjectName(): string {
  return `Test Project ${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
