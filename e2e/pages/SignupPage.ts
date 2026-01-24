import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Signup page (/signup)
 * Maps to test cases S-001 through S-019 in Auth-Test-Plan.md
 */
export class SignupPage extends BasePage {
  // Form elements
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly passwordToggle: Locator;

  // Error elements
  readonly formError: Locator;

  // Help text
  readonly passwordHint: Locator;

  // Navigation links
  readonly signInLink: Locator;
  readonly googleButton: Locator;

  // Page elements
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Form inputs - using robust locators
    this.fullNameInput = page.locator('input[autocomplete="name"]');
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[autocomplete="new-password"]');
    this.passwordToggle = page.getByRole('button', { name: /show password|hide password/i });

    // Submit button
    this.submitButton = page.locator('button[type="submit"]');

    // Google OAuth button
    this.googleButton = page.getByRole('button', { name: /continue with google/i });

    // Navigation links
    this.signInLink = page.getByRole('link', { name: /sign in/i });

    // Error messages
    this.formError = page.locator('.bg-destructive\\/10');

    // Password hint
    this.passwordHint = page.getByText('Must be at least 8 characters');

    // Page headers
    this.cardTitle = page.getByRole('heading', { name: 'Create an account' });
    this.cardDescription = page.getByText('Enter your details below to create your account');
  }

  /**
   * Navigate to signup page
   */
  async goTo(): Promise<this> {
    await this.navigate('/signup');
    await this.cardTitle.waitFor({ state: 'visible' });
    return this;
  }

  /**
   * Fill full name field
   */
  async fillFullName(name: string): Promise<this> {
    await this.fullNameInput.clear();
    await this.fullNameInput.fill(name);
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
   * Fill password field
   */
  async fillPassword(password: string): Promise<this> {
    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
    return this;
  }

  /**
   * Click create account button
   */
  async clickCreateAccount(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Perform complete signup flow
   */
  async signup(fullName: string, email: string, password: string): Promise<void> {
    await this.fillFullName(fullName);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickCreateAccount();
  }

  /**
   * Signup and wait for successful redirect
   * Test case: S-009
   */
  async signupAndWaitForRedirect(fullName: string, email: string, password: string): Promise<void> {
    await this.signup(fullName, email, password);
    await this.page.waitForURL((url) => !url.pathname.includes('/signup'), {
      timeout: 30000,
    });
  }

  /**
   * Signup expecting an error
   * Test case: S-012
   */
  async signupExpectingError(fullName: string, email: string, password: string): Promise<string> {
    await this.signup(fullName, email, password);
    await this.formError.waitFor({ state: 'visible', timeout: 10000 });
    return await this.getFormError();
  }

  /**
   * Get form-level error message
   */
  async getFormError(): Promise<string> {
    if (await this.formError.isVisible()) {
      return (await this.formError.textContent()) ?? '';
    }
    return '';
  }

  /**
   * Get full name field validation error
   */
  async getFullNameError(): Promise<string> {
    const errorElements = this.page.locator('[id$="-form-item-message"]');
    if (await errorElements.first().isVisible()) {
      return (await errorElements.first().textContent()) ?? '';
    }
    return '';
  }

  /**
   * Get email field validation error
   */
  async getEmailError(): Promise<string> {
    const errorElements = this.page.locator('[id$="-form-item-message"]');
    const count = await errorElements.count();
    if (count > 1 && await errorElements.nth(1).isVisible()) {
      return (await errorElements.nth(1).textContent()) ?? '';
    }
    return '';
  }

  /**
   * Get password field validation error
   */
  async getPasswordError(): Promise<string> {
    const errorElements = this.page.locator('[id$="-form-item-message"]');
    const count = await errorElements.count();
    if (count > 2 && await errorElements.nth(2).isVisible()) {
      return (await errorElements.nth(2).textContent()) ?? '';
    }
    return '';
  }

  /**
   * Check if submit button is enabled
   */
  async isSubmitEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  /**
   * Check if form is in loading state
   * Test case: S-016
   */
  async isLoading(): Promise<boolean> {
    const text = await this.submitButton.textContent();
    return text?.includes('Creating account') ?? false;
  }

  /**
   * Check if Google button is disabled
   * Test case: S-017
   */
  async isGoogleButtonDisabled(): Promise<boolean> {
    return !(await this.googleButton.isEnabled());
  }

  /**
   * Check if password hint is displayed
   * Test case: S-007
   */
  async isPasswordHintVisible(): Promise<boolean> {
    return await this.passwordHint.isVisible();
  }

  /**
   * Click Google sign in
   */
  async clickGoogleSignIn(): Promise<void> {
    await this.googleButton.click();
  }

  /**
   * Navigate to sign in
   * Test case: S-018
   */
  async clickSignIn(): Promise<void> {
    await this.signInLink.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click();
  }

  /**
   * Assert page is properly loaded
   */
  async assertPageLoaded(): Promise<void> {
    await expect(this.cardTitle).toBeVisible();
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.googleButton).toBeVisible();
    await expect(this.signInLink).toBeVisible();
  }
}
