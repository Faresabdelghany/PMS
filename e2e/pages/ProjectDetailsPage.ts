import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Project Details page
 * Test cases: PC-001 through PC-018, PD-001 through PD-015, PM-001 through PM-014
 */
export class ProjectDetailsPage extends BasePage {
  // Header
  readonly header: Locator;
  readonly projectName: Locator;
  readonly projectStatus: Locator;
  readonly projectPriority: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly backButton: Locator;

  // Tabs
  readonly tabsContainer: Locator;
  readonly overviewTab: Locator;
  readonly tasksTab: Locator;
  readonly workstreamsTab: Locator;
  readonly filesTab: Locator;
  readonly notesTab: Locator;

  // Overview tab content
  readonly descriptionSection: Locator;
  readonly scopeSection: Locator;
  readonly outcomesSection: Locator;
  readonly metaPanel: Locator;
  readonly membersPanel: Locator;
  readonly progressBar: Locator;
  readonly progressValue: Locator;

  // Status/Priority dropdowns
  readonly statusDropdown: Locator;
  readonly priorityDropdown: Locator;

  // Members management
  readonly addMemberButton: Locator;
  readonly membersList: Locator;
  readonly memberRoleSelect: Locator;
  readonly removeMemberButton: Locator;

  // Edit dialog
  readonly editDialog: Locator;
  readonly editNameInput: Locator;
  readonly editDescriptionInput: Locator;
  readonly editSaveButton: Locator;
  readonly editCancelButton: Locator;

  // Delete dialog
  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  // Loading/Error states
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;
  readonly notFoundMessage: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Header
    this.header = page.locator('[data-testid="project-header"]').or(page.locator('header'));
    this.projectName = page.locator('[data-testid="project-name"]').or(page.locator('h1'));
    this.projectStatus = page.locator('[data-testid="project-status"]').or(page.locator('[class*="badge"]').first());
    this.projectPriority = page.locator('[data-testid="project-priority"]');
    this.editButton = page.getByRole('button', { name: 'Edit project' });
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    this.backButton = page.getByRole('button', { name: /back/i }).or(page.locator('[data-testid="back-button"]'));

    // Tabs - using Radix UI Tabs component
    this.tabsContainer = page.locator('[role="tablist"]');
    this.overviewTab = page.getByRole('tab', { name: /overview/i });
    this.tasksTab = page.getByRole('tab', { name: /tasks/i });
    this.workstreamsTab = page.getByRole('tab', { name: /workstream/i }); // singular, not "workstreams"
    this.filesTab = page.getByRole('tab', { name: /assets.*files|assets/i });
    this.notesTab = page.getByRole('tab', { name: /notes/i });

    // Overview content
    this.descriptionSection = page.locator('[data-testid="description-section"]').or(page.locator('[class*="description"]'));
    this.scopeSection = page.locator('[data-testid="scope-section"]');
    this.outcomesSection = page.locator('[data-testid="outcomes-section"]');
    this.metaPanel = page.locator('[data-testid="meta-panel"]').or(page.locator('[class*="meta"]'));
    this.membersPanel = page.locator('[data-testid="members-panel"]');
    this.progressBar = page.locator('[data-testid="progress-bar"]').or(page.locator('[role="progressbar"]'));
    this.progressValue = page.locator('[data-testid="progress-value"]');

    // Status/Priority
    this.statusDropdown = page.locator('[data-testid="status-dropdown"]').or(page.getByLabel(/status/i));
    this.priorityDropdown = page.locator('[data-testid="priority-dropdown"]').or(page.getByLabel(/priority/i));

    // Members
    this.addMemberButton = page.getByRole('button', { name: /add member/i });
    this.membersList = page.locator('[data-testid="members-list"]');
    this.memberRoleSelect = page.locator('[data-testid="member-role"]');
    this.removeMemberButton = page.locator('[data-testid="remove-member"]');

    // Edit dialog
    this.editDialog = page.locator('[role="dialog"]').filter({ hasText: /edit project/i });
    this.editNameInput = this.editDialog.locator('input[name="name"]');
    this.editDescriptionInput = this.editDialog.locator('textarea[name="description"]');
    this.editSaveButton = this.editDialog.getByRole('button', { name: /save/i });
    this.editCancelButton = this.editDialog.getByRole('button', { name: /cancel/i });

    // Delete dialog
    this.deleteDialog = page.locator('[role="alertdialog"], [role="dialog"]').filter({ hasText: /delete/i });
    this.deleteConfirmButton = this.deleteDialog.getByRole('button', { name: /delete|confirm/i });
    this.deleteCancelButton = this.deleteDialog.getByRole('button', { name: /cancel/i });

    // States
    this.loadingSpinner = page.locator('[data-testid="loading"]').or(page.locator('[class*="animate-spin"]'));
    this.errorMessage = page.locator('[data-testid="error"]').or(page.locator('[role="alert"]'));
    this.notFoundMessage = page.getByText(/not found|404/i);
  }

  /**
   * Navigate to a specific project
   * Test case: PC-002
   */
  async goTo(projectId: string): Promise<this> {
    await this.navigate(`/projects/${projectId}`);
    await this.waitForDOMReady();
    return this;
  }

  /**
   * Wait for project to load
   */
  async waitForProjectLoad(): Promise<void> {
    await Promise.race([
      this.projectName.waitFor({ state: 'visible', timeout: 10000 }),
      this.notFoundMessage.waitFor({ state: 'visible', timeout: 10000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});
  }

  /**
   * Get project name
   */
  async getProjectName(): Promise<string> {
    return (await this.projectName.textContent()) || '';
  }

  /**
   * Get project status
   */
  async getProjectStatus(): Promise<string> {
    return (await this.projectStatus.textContent()) || '';
  }

  // ==================== Tab Navigation ====================

  /**
   * Switch to overview tab
   * Test case: PD-004
   */
  async switchToOverview(): Promise<void> {
    await this.overviewTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to tasks tab
   * Test case: PD-010
   */
  async switchToTasks(): Promise<void> {
    await this.tasksTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to workstreams tab
   * Test case: PD-011
   */
  async switchToWorkstreams(): Promise<void> {
    await this.workstreamsTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to files tab
   * Test case: PD-012
   */
  async switchToFiles(): Promise<void> {
    await this.filesTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to notes tab
   * Test case: PD-013
   */
  async switchToNotes(): Promise<void> {
    await this.notesTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get current active tab
   */
  async getCurrentTab(): Promise<string> {
    const activeTab = this.tabsContainer.locator('[aria-selected="true"], [data-state="active"]');
    return (await activeTab.textContent()) || '';
  }

  // ==================== Project Update ====================

  /**
   * Open edit dialog
   */
  async openEditDialog(): Promise<void> {
    await this.editButton.click();
    await this.editDialog.waitFor({ state: 'visible' });
  }

  /**
   * Update project name
   * Test case: PC-005
   */
  async updateName(newName: string): Promise<void> {
    await this.openEditDialog();
    await this.editNameInput.clear();
    await this.editNameInput.fill(newName);
    await this.editSaveButton.click();
    await this.editDialog.waitFor({ state: 'hidden' });
  }

  /**
   * Update project description
   * Test case: PC-006
   */
  async updateDescription(newDescription: string): Promise<void> {
    await this.openEditDialog();
    await this.editDescriptionInput.clear();
    await this.editDescriptionInput.fill(newDescription);
    await this.editSaveButton.click();
    await this.editDialog.waitFor({ state: 'hidden' });
  }

  /**
   * Update project status
   * Test case: PC-007
   */
  async updateStatus(status: string): Promise<void> {
    await this.statusDropdown.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Update project priority
   * Test case: PC-008
   */
  async updatePriority(priority: string): Promise<void> {
    await this.priorityDropdown.click();
    await this.page.getByRole('option', { name: new RegExp(priority, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Update project progress
   * Test cases: PC-009 through PC-013
   */
  async updateProgress(value: number): Promise<void> {
    const slider = this.page.locator('input[type="range"]').or(this.progressBar);
    await slider.fill(value.toString());
    await this.page.waitForTimeout(500);
  }

  // ==================== Project Delete ====================

  /**
   * Delete project
   * Test cases: PC-014 through PC-018
   */
  async deleteProject(): Promise<void> {
    await this.deleteButton.click();
    await this.deleteDialog.waitFor({ state: 'visible' });
    await this.deleteConfirmButton.click();
    await this.page.waitForURL('/');
  }

  /**
   * Cancel delete
   * Test case: PC-016
   */
  async cancelDelete(): Promise<void> {
    await this.deleteButton.click();
    await this.deleteDialog.waitFor({ state: 'visible' });
    await this.deleteCancelButton.click();
    await this.deleteDialog.waitFor({ state: 'hidden' });
  }

  // ==================== Member Management ====================

  /**
   * Add project member
   * Test cases: PM-001 through PM-006
   */
  async addMember(userName: string, role: 'owner' | 'pic' | 'member' | 'viewer' = 'member'): Promise<void> {
    await this.addMemberButton.click();

    // Select user
    const userSelect = this.page.locator('[data-testid="user-select"]').or(this.page.getByLabel(/user|member/i));
    await userSelect.click();
    await this.page.getByRole('option', { name: new RegExp(userName, 'i') }).click();

    // Select role
    const roleSelect = this.page.locator('[data-testid="role-select"]').or(this.page.getByLabel(/role/i));
    await roleSelect.click();
    await this.page.getByRole('option', { name: new RegExp(role, 'i') }).click();

    // Confirm
    await this.page.getByRole('button', { name: /add|confirm/i }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Update member role
   * Test cases: PM-007 through PM-009
   */
  async updateMemberRole(userName: string, newRole: string): Promise<void> {
    const memberRow = this.membersList.locator(`[data-testid="member-row"]`).filter({ hasText: userName });
    const roleSelect = memberRow.locator('[data-testid="member-role"]');
    await roleSelect.click();
    await this.page.getByRole('option', { name: new RegExp(newRole, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Remove project member
   * Test cases: PM-010 through PM-012
   */
  async removeMember(userName: string): Promise<void> {
    const memberRow = this.membersList.locator(`[data-testid="member-row"]`).filter({ hasText: userName });
    const removeButton = memberRow.locator('[data-testid="remove-member"], button').filter({ hasText: /remove/i });
    await removeButton.click();

    // Confirm if dialog appears
    const confirmButton = this.page.getByRole('button', { name: /confirm|remove/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Get member list
   */
  async getMembers(): Promise<Array<{ name: string; role: string }>> {
    const members: Array<{ name: string; role: string }> = [];
    const rows = await this.membersList.locator('[data-testid="member-row"]').all();

    for (const row of rows) {
      const name = await row.locator('[data-testid="member-name"]').textContent();
      const role = await row.locator('[data-testid="member-role"]').textContent();
      members.push({ name: name || '', role: role || '' });
    }

    return members;
  }

  /**
   * Check if user is a member
   */
  async isMember(userName: string): Promise<boolean> {
    const member = this.membersList.locator('[data-testid="member-row"]').filter({ hasText: userName });
    return await member.isVisible();
  }

  // ==================== Assertions ====================

  /**
   * Assert project details page is loaded
   * Test case: PD-001
   */
  async assertPageLoaded(): Promise<void> {
    await expect(this.projectName).toBeVisible();
    await expect(this.tabsContainer).toBeVisible();
  }

  /**
   * Assert project not found
   * Test case: PC-004
   */
  async assertNotFound(): Promise<void> {
    await expect(this.notFoundMessage).toBeVisible();
  }

  /**
   * Assert project name
   */
  async assertProjectName(name: string): Promise<void> {
    await expect(this.projectName).toHaveText(name);
  }

  /**
   * Assert project status
   */
  async assertProjectStatus(status: string): Promise<void> {
    await expect(this.projectStatus).toContainText(new RegExp(status, 'i'));
  }

  /**
   * Assert tab is active
   */
  async assertTabActive(tabName: string): Promise<void> {
    const tab = this.page.getByRole('tab', { name: new RegExp(tabName, 'i') });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * Assert member exists
   */
  async assertMemberExists(userName: string, role?: string): Promise<void> {
    const memberRow = this.membersList.locator('[data-testid="member-row"]').filter({ hasText: userName });
    await expect(memberRow).toBeVisible();
    if (role) {
      await expect(memberRow.locator('[data-testid="member-role"]')).toContainText(new RegExp(role, 'i'));
    }
  }

  /**
   * Assert member does not exist
   */
  async assertMemberNotExists(userName: string): Promise<void> {
    const memberRow = this.membersList.locator('[data-testid="member-row"]').filter({ hasText: userName });
    await expect(memberRow).not.toBeVisible();
  }
}
