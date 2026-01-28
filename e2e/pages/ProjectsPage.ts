import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Projects List page
 * Test cases: PL-001 through PL-010, PV-001 through PV-019, PF-001 through PF-021
 */
export class ProjectsPage extends BasePage {
  // Header elements
  readonly header: Locator;
  readonly addProjectButton: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly viewToggle: Locator;

  // View toggle buttons
  readonly listViewButton: Locator;
  readonly gridViewButton: Locator;
  readonly boardViewButton: Locator;
  readonly timelineViewButton: Locator;

  // Filter elements
  readonly filterPanel: Locator;
  readonly statusFilter: Locator;
  readonly priorityFilter: Locator;
  readonly clientFilter: Locator;
  readonly showClosedToggle: Locator;
  readonly clearFiltersButton: Locator;
  readonly filterChips: Locator;

  // Project list/grid
  readonly projectsContainer: Locator;
  readonly projectCards: Locator;
  readonly projectRows: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // Board view columns
  readonly boardColumns: Locator;
  readonly backlogColumn: Locator;
  readonly plannedColumn: Locator;
  readonly activeColumn: Locator;
  readonly completedColumn: Locator;

  // Command Palette (global search via Cmd+K)
  readonly commandPaletteDialog: Locator;
  readonly commandPaletteInput: Locator;
  readonly commandPaletteResults: Locator;
  readonly commandPaletteProjectResults: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Header - use more specific locators to avoid matching empty state buttons
    this.header = page.locator('[data-testid="projects-header"]').or(page.locator('header').first());
    // Target "Add Project" button in header (contains icon + text "Add Project")
    // Use text matcher that allows for whitespace variations with icons
    this.addProjectButton = page.locator('header').getByRole('button', { name: /Add Project/i });
    // Search is inside the filter popover, not directly visible
    this.searchInput = page.getByPlaceholder(/search/i);
    // Filter button contains icon + "Filter" text
    this.filterButton = page.getByRole('button', { name: /Filter/i });

    // View toggle - the app uses a "View" button that opens a popover
    this.viewToggle = page.getByRole('button', { name: /View/i });
    // View type buttons are inside the popover, they're plain buttons not menuitemradio
    this.listViewButton = page.locator('button').filter({ hasText: 'List' });
    this.gridViewButton = page.locator('button').filter({ hasText: 'Board' }); // App uses "Board" not "Grid"
    this.boardViewButton = page.locator('button').filter({ hasText: 'Board' });
    this.timelineViewButton = page.locator('button').filter({ hasText: 'Timeline' });

    // Filter panel
    this.filterPanel = page.locator('[data-testid="filter-panel"]').or(page.locator('[role="dialog"]').filter({ hasText: /filter/i }));
    this.statusFilter = page.locator('[data-testid="status-filter"]').or(page.getByLabel(/status/i));
    this.priorityFilter = page.locator('[data-testid="priority-filter"]').or(page.getByLabel(/priority/i));
    this.clientFilter = page.locator('[data-testid="client-filter"]').or(page.getByLabel(/client/i));
    this.showClosedToggle = page.locator('[data-testid="show-closed"]').or(page.getByLabel(/show closed|show completed/i));
    this.clearFiltersButton = page.getByRole('button', { name: /clear|reset/i });
    this.filterChips = page.locator('[data-testid="filter-chip"]').or(page.locator('.inline-flex.items-center.rounded-full'));

    // Projects container
    this.projectsContainer = page.locator('[data-testid="projects-container"]').or(page.locator('main'));
    // Project cards are buttons with "Open project" in the accessible name
    this.projectCards = page.locator('[data-testid="project-card"]')
      .or(page.getByRole('button', { name: /^Open project/ }));
    this.projectRows = page.locator('[data-testid="project-row"]').or(page.locator('tr[data-project-id]'));
    // Empty state - target the heading specifically
    this.emptyState = page.getByRole('heading', { name: 'No projects yet' });
    this.loadingSpinner = page.locator('[data-testid="loading"]').or(page.locator('[class*="animate-spin"]'));

    // Board view columns
    this.boardColumns = page.locator('[data-testid="board-column"]').or(page.locator('[class*="kanban-column"]'));
    this.backlogColumn = page.locator('[data-status="backlog"]').or(page.locator('[data-testid="column-backlog"]'));
    this.plannedColumn = page.locator('[data-status="planned"]').or(page.locator('[data-testid="column-planned"]'));
    this.activeColumn = page.locator('[data-status="active"]').or(page.locator('[data-testid="column-active"]'));
    this.completedColumn = page.locator('[data-status="completed"]').or(page.locator('[data-testid="column-completed"]'));

    // Command Palette (global search via Cmd+K / Ctrl+K)
    // Uses Radix Dialog + cmdk Command component
    this.commandPaletteDialog = page.locator('[role="dialog"]').filter({
      has: page.locator('[data-slot="command"]')
    });
    this.commandPaletteInput = page.getByPlaceholder(/search projects, tasks, clients/i);
    this.commandPaletteResults = page.locator('[data-slot="command-list"]');
    this.commandPaletteProjectResults = page.locator('[data-slot="command-group"]').filter({ hasText: 'Projects' });
  }

  /**
   * Navigate to projects page
   */
  async goTo(): Promise<this> {
    await this.navigate('/');
    await this.waitForDOMReady();
    return this;
  }

  /**
   * Wait for projects to load
   */
  async waitForProjectsLoad(): Promise<void> {
    // Wait for either projects to appear or empty state
    await Promise.race([
      this.projectCards.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {}),
    ]);
  }

  /**
   * Get count of visible projects
   */
  async getProjectCount(): Promise<number> {
    await this.waitForProjectsLoad();
    return await this.projectCards.count();
  }

  /**
   * Click add project button to open wizard
   * Test case: PL-007
   */
  async clickAddProject(): Promise<void> {
    // Wait for button to be visible and clickable
    await this.addProjectButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.addProjectButton.click();
  }

  /**
   * Open Command Palette with keyboard shortcut
   */
  async openCommandPalette(): Promise<void> {
    // Use Meta+k for Mac, Control+k for others
    const isMac = process.platform === 'darwin';
    await this.page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');
    await this.commandPaletteDialog.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Close Command Palette
   */
  async closeCommandPalette(): Promise<void> {
    if (await this.commandPaletteDialog.isVisible()) {
      await this.page.keyboard.press('Escape');
      await this.commandPaletteDialog.waitFor({ state: 'hidden', timeout: 3000 });
    }
  }

  /**
   * Search for projects via Command Palette (Cmd+K / Ctrl+K)
   * Test cases: PF-001 through PF-005
   */
  async searchProjects(query: string): Promise<void> {
    // Open Command Palette if not already open
    if (!await this.commandPaletteDialog.isVisible()) {
      await this.openCommandPalette();
    }

    // Type search query
    await this.commandPaletteInput.fill(query);
    await this.page.waitForTimeout(500); // Wait for search results (debounced)
  }

  /**
   * Get search results from Command Palette
   */
  async getSearchResultCount(): Promise<number> {
    const items = this.commandPaletteResults.locator('[data-slot="command-item"]');
    return await items.count();
  }

  /**
   * Click on a search result in Command Palette
   */
  async clickSearchResult(name: string): Promise<void> {
    const result = this.commandPaletteResults.locator('[data-slot="command-item"]').filter({ hasText: name });
    await result.first().click();
  }

  /**
   * Check if project appears in search results
   */
  async isProjectInSearchResults(name: string): Promise<boolean> {
    const result = this.commandPaletteProjectResults.locator('[data-slot="command-item"]').filter({ hasText: name });
    return await result.isVisible();
  }

  /**
   * Clear search input in Command Palette
   */
  async clearSearch(): Promise<void> {
    if (await this.commandPaletteDialog.isVisible()) {
      await this.commandPaletteInput.clear();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Switch to list view
   * Test case: PV-001
   */
  async switchToListView(): Promise<void> {
    // Open the View dropdown first
    await this.viewToggle.click();
    await this.page.waitForTimeout(200);
    await this.listViewButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to grid view
   * Test case: PV-007
   */
  async switchToGridView(): Promise<void> {
    // Open the View dropdown first
    await this.viewToggle.click();
    await this.page.waitForTimeout(200);
    await this.gridViewButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to board view
   * Test case: PV-013
   */
  async switchToBoardView(): Promise<void> {
    // Open the View dropdown first
    await this.viewToggle.click();
    await this.page.waitForTimeout(200);
    await this.boardViewButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to timeline view
   */
  async switchToTimelineView(): Promise<void> {
    // Open the View dropdown first
    await this.viewToggle.click();
    await this.page.waitForTimeout(200);
    await this.timelineViewButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Open filter panel
   */
  async openFilters(): Promise<void> {
    await this.filterButton.click();
    await this.filterPanel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  /**
   * Filter by status
   * Test cases: PF-006 through PF-009
   */
  async filterByStatus(status: string): Promise<void> {
    await this.openFilters();
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by priority
   * Test cases: PF-010 through PF-012
   */
  async filterByPriority(priority: string): Promise<void> {
    await this.openFilters();
    await this.priorityFilter.click();
    await this.page.getByRole('option', { name: new RegExp(priority, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by client
   * Test cases: PF-013, PF-014
   */
  async filterByClient(clientName: string): Promise<void> {
    await this.openFilters();
    await this.clientFilter.click();
    await this.page.getByRole('option', { name: new RegExp(clientName, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle show closed projects
   * Test cases: PF-020, PF-021
   */
  async toggleShowClosed(): Promise<void> {
    await this.showClosedToggle.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear all filters
   */
  async clearAllFilters(): Promise<void> {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Remove a specific filter chip
   */
  async removeFilterChip(filterText: string): Promise<void> {
    const chip = this.filterChips.filter({ hasText: filterText });
    await chip.locator('button, [role="button"]').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get project by name
   */
  getProjectByName(name: string): Locator {
    return this.projectCards.filter({ hasText: name }).or(
      this.projectRows.filter({ hasText: name })
    );
  }

  /**
   * Click on a project to open details
   * Test cases: PV-006, PV-011
   */
  async clickProject(name: string): Promise<void> {
    const project = this.getProjectByName(name);
    await project.click();
    await this.page.waitForURL(/\/projects\//, { timeout: 10000 });
  }

  /**
   * Get project card details
   */
  async getProjectCardDetails(name: string): Promise<{
    name: string;
    status: string;
    priority: string;
    memberCount: number;
  }> {
    const card = this.getProjectByName(name);
    const cardName = await card.locator('[data-testid="project-name"], h3, .font-semibold').first().textContent();
    const status = await card.locator('[data-testid="project-status"], [class*="badge"]').first().textContent();
    const priority = await card.locator('[data-testid="project-priority"]').textContent().catch(() => '');
    const members = await card.locator('[data-testid="member-avatar"], [data-slot="avatar"]').count();

    return {
      name: cardName || '',
      status: status || '',
      priority: priority || '',
      memberCount: members,
    };
  }

  /**
   * Drag project to different column (board view)
   * Test case: PV-016
   */
  async dragProjectToColumn(projectName: string, targetStatus: string): Promise<void> {
    const project = this.getProjectByName(projectName);
    const targetColumn = this.page.locator(`[data-status="${targetStatus}"]`);

    await project.dragTo(targetColumn);
    await this.page.waitForTimeout(500);
  }

  /**
   * Get column project count (board view)
   * Test case: PV-017
   */
  async getColumnProjectCount(status: string): Promise<number> {
    const column = this.page.locator(`[data-status="${status}"], [data-testid="column-${status}"]`);
    const cards = column.locator('[data-testid="project-card"], [class*="project-card"]');
    return await cards.count();
  }

  /**
   * Check if empty state is shown
   * Test case: PL-003
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Assert projects page is loaded
   * Test case: PL-001
   */
  async assertPageLoaded(): Promise<void> {
    // Wait for either the Add Project button in header OR projects to load OR empty state
    await Promise.race([
      expect(this.addProjectButton).toBeVisible(),
      expect(this.projectCards.first()).toBeVisible(),
      expect(this.emptyState).toBeVisible(),
    ]);
  }

  /**
   * Assert project is visible in list
   */
  async assertProjectVisible(name: string): Promise<void> {
    await expect(this.getProjectByName(name)).toBeVisible();
  }

  /**
   * Assert project is not visible in list
   */
  async assertProjectNotVisible(name: string): Promise<void> {
    await expect(this.getProjectByName(name)).not.toBeVisible();
  }

  /**
   * Get current URL filter parameters
   * Test case: PF-018
   */
  async getFilterParams(): Promise<URLSearchParams> {
    const url = new URL(this.page.url());
    return url.searchParams;
  }

  /**
   * Navigate with filter params
   * Test case: PF-019
   */
  async goToWithFilters(filters: Record<string, string>): Promise<void> {
    const params = new URLSearchParams(filters);
    await this.navigate(`/?${params.toString()}`);
    await this.waitForProjectsLoad();
  }
}
