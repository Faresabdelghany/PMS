import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Dashboard page (/)
 * Used for verifying successful authentication and sign out
 */
export class DashboardPage extends BasePage {
  // Sidebar elements
  readonly sidebar: Locator;
  readonly workspaceName: Locator;
  readonly signOutButton: Locator;

  // Navigation items
  readonly projectsNavItem: Locator;
  readonly tasksNavItem: Locator;
  readonly clientsNavItem: Locator;

  // User profile
  readonly userAvatar: Locator;
  readonly userName: Locator;

  // Search
  readonly searchInput: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Sidebar
    this.sidebar = page.locator('[data-slot="sidebar"]');
    this.workspaceName = page.locator('.text-sm.font-semibold').first();
    this.signOutButton = page.getByRole('button', { name: /sign out/i });

    // Navigation items
    this.projectsNavItem = page.getByRole('link', { name: /projects/i }).first();
    this.tasksNavItem = page.getByRole('link', { name: /my tasks/i });
    this.clientsNavItem = page.getByRole('link', { name: /clients/i });

    // User profile section
    this.userAvatar = this.sidebar.locator('[data-slot="avatar"]').last();
    this.userName = this.sidebar.locator('.text-sm.font-medium').last();

    // Search
    this.searchInput = page.getByPlaceholder('Search');
  }

  /**
   * Navigate to dashboard
   */
  async goTo(): Promise<this> {
    await this.navigate('/');
    await this.waitForDOMReady();
    return this;
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForDashboardLoad(): Promise<void> {
    await this.sidebar.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Check if user is logged in (sidebar visible)
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.sidebar.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get workspace name
   */
  async getWorkspaceName(): Promise<string> {
    return (await this.workspaceName.textContent()) ?? '';
  }

  /**
   * Get user name from sidebar
   */
  async getUserName(): Promise<string> {
    return (await this.userName.textContent()) ?? '';
  }

  /**
   * Sign out
   * Test case: RP-008
   */
  async signOut(): Promise<void> {
    await this.signOutButton.click();
    await this.page.waitForURL('**/login', { timeout: 10000 });
  }

  /**
   * Navigate to projects page
   */
  async goToProjects(): Promise<void> {
    await this.projectsNavItem.click();
    await this.page.waitForURL('/');
  }

  /**
   * Navigate to tasks page
   */
  async goToTasks(): Promise<void> {
    await this.tasksNavItem.click();
    await this.page.waitForURL('**/tasks');
  }

  /**
   * Navigate to clients page
   */
  async goToClients(): Promise<void> {
    await this.clientsNavItem.click();
    await this.page.waitForURL('**/clients');
  }

  /**
   * Assert dashboard is loaded
   */
  async assertDashboardLoaded(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }

  /**
   * Assert user is displayed in sidebar
   */
  async assertUserDisplayed(): Promise<void> {
    await expect(this.userAvatar).toBeVisible();
    await expect(this.userName).toBeVisible();
  }
}
