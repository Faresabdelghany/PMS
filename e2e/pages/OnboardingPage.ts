import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Onboarding page (/onboarding)
 * Maps to test cases OB-001 through OB-012 in Auth-Test-Plan.md
 */
export class OnboardingPage extends BasePage {
  // Form elements
  readonly orgNameInput: Locator;
  readonly submitButton: Locator;

  // Error elements
  readonly formError: Locator;

  // Help text
  readonly helpText: Locator;

  // Page elements
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Form inputs
    this.orgNameInput = page.getByLabel('Organization Name');

    // Submit button
    this.submitButton = page.getByRole('button', { name: /create organization/i });

    // Error messages
    this.formError = page.locator('.bg-destructive\\/10');

    // Help text
    this.helpText = page.getByText('This will be your workspace for managing projects');

    // Page headers
    this.cardTitle = page.getByRole('heading', { name: 'Welcome to PMS' });
    this.cardDescription = page.getByText("Let's get started by creating your organization");
  }

  /**
   * Navigate to onboarding page
   */
  async goTo(): Promise<this> {
    await this.navigate('/onboarding');
    await this.cardTitle.waitFor({ state: 'visible' });
    return this;
  }

  /**
   * Fill organization name field
   */
  async fillOrgName(name: string): Promise<this> {
    await this.orgNameInput.clear();
    await this.orgNameInput.fill(name);
    return this;
  }

  /**
   * Click create organization button
   */
  async clickCreateOrganization(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Create organization
   */
  async createOrganization(name: string): Promise<void> {
    await this.fillOrgName(name);
    await this.clickCreateOrganization();
  }

  /**
   * Create organization and wait for redirect
   * Test case: OB-012
   */
  async createOrganizationAndWaitForRedirect(name: string): Promise<void> {
    await this.createOrganization(name);
    await this.page.waitForURL((url) => !url.pathname.includes('/onboarding'), {
      timeout: 30000,
    });
  }

  /**
   * Create organization expecting error
   */
  async createOrganizationExpectingError(name: string): Promise<string> {
    await this.createOrganization(name);
    await this.formError.waitFor({ state: 'visible', timeout: 10000 });
    return await this.getFormError();
  }

  /**
   * Get form error message
   */
  async getFormError(): Promise<string> {
    if (await this.formError.isVisible()) {
      return (await this.formError.textContent()) ?? '';
    }
    return '';
  }

  /**
   * Check if form is in loading state
   */
  async isLoading(): Promise<boolean> {
    const text = await this.submitButton.textContent();
    return text?.includes('Creating') ?? false;
  }

  /**
   * Check if submit button is enabled
   */
  async isSubmitEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  /**
   * Get HTML5 validation message from org name input
   * Test case: OB-004
   */
  async getOrgNameValidationMessage(): Promise<string> {
    return await this.orgNameInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  /**
   * Assert page is properly loaded
   */
  async assertPageLoaded(): Promise<void> {
    await expect(this.cardTitle).toBeVisible();
    await expect(this.orgNameInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.helpText).toBeVisible();
  }
}
