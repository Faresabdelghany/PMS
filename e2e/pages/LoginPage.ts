import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Login page (/login)
 * Maps to test cases L-001 through L-019 in Auth-Test-Plan.md
 */
export class LoginPage extends BasePage {
  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly passwordToggle: Locator;

  // Error elements
  readonly formError: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;

  // Navigation links
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly googleButton: Locator;

  // Page elements
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Form inputs - using robust locators
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[autocomplete="current-password"]');
    this.passwordToggle = page.getByRole('button', { name: /show password|hide password/i });

    // Submit button - the Sign in button that's not for Google
    this.submitButton = page.locator('button[type="submit"]');

    // Google OAuth button
    this.googleButton = page.getByRole('button', { name: /continue with google/i });

    // Navigation links
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    this.signUpLink = page.getByRole('link', { name: /create one/i });

    // Error messages — use attribute selector because Tailwind's "/" in class names breaks CSS selectors
    this.formError = page.locator('[class*="bg-destructive"]').filter({ hasText: /.+/ });
    this.emailError = page.locator('[id$="-form-item-message"]').first();
    this.passwordError = page.locator('[id$="-form-item-message"]').nth(1);

    // Page headers
    this.cardTitle = page.getByRole('heading', { name: 'Sign in' });
    this.cardDescription = page.getByText('Welcome back. Enter your credentials to continue.');
  }

  /**
   * Navigate to login page
   */
  async goTo(): Promise<this> {
    await this.navigate('/login');
    await this.cardTitle.waitFor({ state: 'visible' });
    return this;
  }

  /**
   * Navigate to login page with error parameter
   * Test case: L-015
   */
  async goToWithError(errorMessage: string): Promise<this> {
    await this.navigate(`/login?error=${encodeURIComponent(errorMessage)}`);
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
   * Fill password field
   */
  async fillPassword(password: string): Promise<this> {
    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
    return this;
  }

  /**
   * Click sign in button
   */
  async clickSignIn(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Perform complete login flow
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  /**
   * Login and wait for successful redirect
   * Test case: L-007
   */
  async loginAndWaitForRedirect(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
  }

  /**
   * Login expecting an error
   * Test cases: L-008, L-009
   */
  async loginExpectingError(email: string, password: string): Promise<string> {
    await this.login(email, password);
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
   * Get email field validation error
   */
  async getEmailError(): Promise<string> {
    const errorElement = this.page.locator('[id$="-form-item-message"]').first();
    if (await errorElement.isVisible()) {
      return (await errorElement.textContent()) ?? '';
    }
    return '';
  }

  /**
   * Get password field validation error
   */
  async getPasswordError(): Promise<string> {
    const errorElements = this.page.locator('[id$="-form-item-message"]');
    const count = await errorElements.count();
    if (count > 1) {
      return (await errorElements.nth(1).textContent()) ?? '';
    }
    return '';
  }

  /**
   * Check if submit button is enabled
   * Test cases: L-012, L-013
   */
  async isSubmitEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  /**
   * Check if form is in loading state
   * Test case: L-014
   */
  async isLoading(): Promise<boolean> {
    const text = await this.submitButton.textContent();
    return text?.includes('Signing in') ?? false;
  }

  /**
   * Check if Google button is disabled
   * Test case: L-016
   */
  async isGoogleButtonDisabled(): Promise<boolean> {
    return !(await this.googleButton.isEnabled());
  }

  /**
   * Click Google sign in
   * Test case: O-001
   */
  async clickGoogleSignIn(): Promise<void> {
    await this.googleButton.click();
  }

  /**
   * Navigate to forgot password
   * Test case: L-017
   */
  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL('**/forgot-password');
  }

  /**
   * Navigate to sign up
   * Test case: L-018
   */
  async clickSignUp(): Promise<void> {
    await this.signUpLink.click();
    await this.page.waitForURL('**/signup');
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click();
  }

  /**
   * Check if password is visible (type="text")
   */
  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute('type');
    return type === 'text';
  }

  /**
   * Tab through form fields
   * Test case: A-001
   */
  async tabThroughForm(): Promise<string[]> {
    const focusOrder: string[] = [];

    await this.emailInput.focus();
    focusOrder.push('email');

    await this.pressTab();
    if (await this.passwordInput.evaluate(el => el === document.activeElement)) {
      focusOrder.push('password');
    }

    await this.pressTab();
    // Password toggle or forgot password link

    await this.pressTab();
    if (await this.submitButton.evaluate(el => el === document.activeElement)) {
      focusOrder.push('submit');
    }

    return focusOrder;
  }

  /**
   * Assert page is properly loaded
   */
  async assertPageLoaded(): Promise<void> {
    await expect(this.cardTitle).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.googleButton).toBeVisible();
    await expect(this.forgotPasswordLink).toBeVisible();
    await expect(this.signUpLink).toBeVisible();
  }
}
