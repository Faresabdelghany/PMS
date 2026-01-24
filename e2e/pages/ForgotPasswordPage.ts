import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Forgot Password page (/forgot-password)
 * Maps to test cases FP-001 through FP-008 in Auth-Test-Plan.md
 */
export class ForgotPasswordPage extends BasePage {
  // Form elements
  readonly emailInput: Locator;
  readonly submitButton: Locator;

  // Error elements
  readonly formError: Locator;

  // Success state elements
  readonly successTitle: Locator;
  readonly successDescription: Locator;
  readonly successBackButton: Locator;

  // Navigation links
  readonly backToLoginLink: Locator;

  // Page elements
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Form inputs
    this.emailInput = page.getByLabel('Email');

    // Submit button
    this.submitButton = page.getByRole('button', { name: /send reset link/i });

    // Navigation links
    this.backToLoginLink = page.getByRole('link', { name: /back to sign in/i });

    // Error messages
    this.formError = page.locator('.bg-destructive\\/10');

    // Page headers - initial state
    this.cardTitle = page.getByRole('heading', { name: 'Forgot password' });
    this.cardDescription = page.getByText("Enter your email address and we'll send you a link");

    // Success state elements
    this.successTitle = page.getByRole('heading', { name: 'Check your email' });
    this.successDescription = page.getByText('Check your email for a password reset link');
    this.successBackButton = page.getByRole('button', { name: /back to sign in/i });
  }

  /**
   * Navigate to forgot password page
   */
  async goTo(): Promise<this> {
    await this.navigate('/forgot-password');
    await this.cardTitle.waitFor({ state: 'visible' });
    return this;
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<this> {
    await this.emailInput.clear();
    await this.emailInput.fill(email);
    return this;
  }

  /**
   * Click send reset link button
   */
  async clickSendResetLink(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Request password reset
   */
  async requestReset(email: string): Promise<void> {
    await this.fillEmail(email);
    await this.clickSendResetLink();
  }

  /**
   * Request reset and wait for success state
   * Test case: FP-003
   */
  async requestResetAndWaitForSuccess(email: string): Promise<void> {
    await this.requestReset(email);
    await this.successTitle.waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Request reset expecting error
   */
  async requestResetExpectingError(email: string): Promise<string> {
    await this.requestReset(email);
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
   * Check if success state is displayed
   * Test case: FP-006
   */
  async isSuccessDisplayed(): Promise<boolean> {
    return await this.successTitle.isVisible();
  }

  /**
   * Check if form is in loading state
   * Test case: FP-005
   */
  async isLoading(): Promise<boolean> {
    const text = await this.submitButton.textContent();
    return text?.includes('Sending reset link') ?? false;
  }

  /**
   * Check if submit button is enabled
   */
  async isSubmitEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  /**
   * Navigate back to login from initial state
   * Test case: FP-007
   */
  async clickBackToLogin(): Promise<void> {
    await this.backToLoginLink.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * Navigate back to login from success state
   * Test case: FP-008
   */
  async clickBackToLoginFromSuccess(): Promise<void> {
    await this.successBackButton.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * Assert page is properly loaded
   */
  async assertPageLoaded(): Promise<void> {
    await expect(this.cardTitle).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.backToLoginLink).toBeVisible();
  }

  /**
   * Assert success state is displayed
   */
  async assertSuccessDisplayed(): Promise<void> {
    await expect(this.successTitle).toBeVisible();
    await expect(this.successDescription).toBeVisible();
    await expect(this.successBackButton).toBeVisible();
  }
}
