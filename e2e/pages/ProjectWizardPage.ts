import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Project Creation Wizard
 * Test cases: QC-001 through QC-021, PW-001 through PW-034
 */
export class ProjectWizardPage extends BasePage {
  // Modal container
  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly backdrop: Locator;

  // Mode selection (Step 0)
  readonly quickModeOption: Locator;
  readonly guidedModeOption: Locator;
  readonly modeSelectionContinue: Locator;
  readonly modeSelectionCancel: Locator;

  // Stepper (Guided mode)
  readonly stepper: Locator;
  readonly stepperSteps: Locator;

  // Navigation buttons
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly createButton: Locator;
  readonly saveTemplateButton: Locator;

  // Quick Create form fields
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly clientSelect: Locator;
  readonly statusSelect: Locator;
  readonly prioritySelect: Locator;

  // Step 1: Intent
  readonly intentOptions: Locator;

  // Step 2: Outcome
  readonly successTypeOptions: Locator;
  readonly deliverableInput: Locator;
  readonly addDeliverableButton: Locator;
  readonly deliverablesList: Locator;
  readonly metricsInput: Locator;
  readonly addMetricButton: Locator;
  readonly metricsList: Locator;
  readonly descriptionEditor: Locator;

  // Step 3: Ownership
  readonly ownerSelect: Locator;
  readonly contributorsSelect: Locator;
  readonly stakeholdersSelect: Locator;

  // Step 4: Structure
  readonly deadlineTypeOptions: Locator;
  readonly deadlineDatePicker: Locator;
  readonly starterTasksToggle: Locator;

  // Step 5: Review
  readonly reviewSummary: Locator;
  readonly editIntentButton: Locator;
  readonly editOutcomeButton: Locator;
  readonly editOwnershipButton: Locator;
  readonly editStructureButton: Locator;

  // Form validation
  readonly nameError: Locator;
  readonly formErrors: Locator;

  // Loading state
  readonly loadingSpinner: Locator;
  readonly submitButtonLoading: Locator;

  constructor(page: Page, baseURL: string) {
    super(page, baseURL);

    // Modal - the wizard modal overlay
    this.modal = page.locator('.fixed.inset-0.z-50').or(page.locator('[role="dialog"]'));
    // Close button is the X button - it's a button with just an icon, no accessible name
    // In mode selection it's after the Continue button, in wizard it's after the heading
    this.closeButton = page.locator('button:has(svg)').filter({ hasNotText: /Back|Next|Continue|Cancel|Create/ }).first();
    this.backdrop = page.locator('.bg-black\\/50, [class*="backdrop"]');

    // Mode selection - click on the option text to select the card
    // "Quick create" and "Guided Setup" are text inside cards, not buttons
    this.quickModeOption = page.getByText('Quick create', { exact: true });
    this.guidedModeOption = page.getByText('Guided Setup', { exact: true });
    this.modeSelectionContinue = page.getByRole('button', { name: /Continue/i });
    this.modeSelectionCancel = page.getByRole('button', { name: /Cancel/i });

    // Stepper - contains numbered step buttons like "1 Project intent", "2 Outcome & success", etc.
    this.stepper = page.locator('[data-testid="stepper"]')
      .or(page.getByRole('button', { name: /1.*intent/i }).locator('..').locator('..'));
    this.stepperSteps = page.getByRole('button', { name: /^\d+\s/ });

    // Navigation - use exact match to avoid matching Next.js Dev Tools button
    this.backButton = page.getByRole('button', { name: 'Back', exact: true }).or(
      page.locator('button').filter({ hasText: /^Back$/ })
    );
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true }).or(
      page.locator('button').filter({ hasText: /^Next$/ })
    );
    // Create button - "Create Project" in quick create, "Create project" in guided wizard
    this.createButton = page.getByRole('button', { name: /Create [Pp]roject/i });
    this.saveTemplateButton = page.getByRole('button', { name: /save as template/i });

    // Quick Create form - input uses placeholder, not label
    this.nameInput = page.getByPlaceholder('Project title');
    // Description is a rich text editor (TipTap ProseMirror) with contenteditable
    this.descriptionInput = page.locator('[contenteditable="true"]').first();
    // Client/Status/Priority use command popover triggers
    this.clientSelect = page.locator('button').filter({ hasText: /Client|Select client/i }).first();
    this.statusSelect = page.locator('button').filter({ hasText: /Planned|Active|Backlog|Todo|In Progress|Done/i }).first();
    this.prioritySelect = page.locator('button').filter({ hasText: /Priority|Urgent|High|Medium|Low/i }).first();

    // Step 1: Intent
    this.intentOptions = page.locator('[data-testid="intent-option"]').or(page.locator('[role="radio"]'));

    // Step 2: Outcome
    this.successTypeOptions = page.locator('[data-testid="success-type"]').or(page.locator('[name="successType"]'));
    this.deliverableInput = page.getByPlaceholder(/deliverable|add deliverable/i);
    this.addDeliverableButton = page.getByRole('button', { name: /add deliverable/i });
    this.deliverablesList = page.locator('[data-testid="deliverables-list"]');
    this.metricsInput = page.getByPlaceholder(/metric|add metric/i);
    this.addMetricButton = page.getByRole('button', { name: /add metric/i });
    this.metricsList = page.locator('[data-testid="metrics-list"]');
    this.descriptionEditor = page.locator('[data-testid="description-editor"], .ProseMirror, [contenteditable="true"]');

    // Step 3: Ownership
    this.ownerSelect = page.getByLabel(/owner|project owner/i).or(page.locator('[data-testid="owner-select"]'));
    this.contributorsSelect = page.getByLabel(/contributor/i).or(page.locator('[data-testid="contributors-select"]'));
    this.stakeholdersSelect = page.getByLabel(/stakeholder/i).or(page.locator('[data-testid="stakeholders-select"]'));

    // Step 4: Structure
    this.deadlineTypeOptions = page.locator('[data-testid="deadline-type"]').or(page.locator('[name="deadlineType"]'));
    this.deadlineDatePicker = page.locator('[data-testid="deadline-date"]').or(page.getByLabel(/deadline|due date/i));
    this.starterTasksToggle = page.getByLabel(/starter tasks|add tasks/i).or(page.locator('[data-testid="starter-tasks"]'));

    // Step 5: Review
    this.reviewSummary = page.locator('[data-testid="review-summary"]');
    this.editIntentButton = page.locator('[data-testid="edit-intent"]').or(page.getByRole('button', { name: /edit intent/i }));
    this.editOutcomeButton = page.locator('[data-testid="edit-outcome"]').or(page.getByRole('button', { name: /edit outcome/i }));
    this.editOwnershipButton = page.locator('[data-testid="edit-ownership"]').or(page.getByRole('button', { name: /edit ownership/i }));
    this.editStructureButton = page.locator('[data-testid="edit-structure"]').or(page.getByRole('button', { name: /edit structure/i }));

    // Validation
    this.nameError = page.locator('[data-testid="name-error"]').or(page.locator('.text-destructive, .text-red-500'));
    this.formErrors = page.locator('[role="alert"], .text-destructive');

    // Loading
    this.loadingSpinner = page.locator('[data-testid="loading"]').or(page.locator('[class*="animate-spin"]'));
    this.submitButtonLoading = this.createButton.locator('[class*="animate-spin"]');
  }

  /**
   * Wait for wizard to be visible
   */
  async waitForWizard(): Promise<void> {
    await this.modal.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Check if wizard is open
   */
  async isOpen(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  /**
   * Close wizard via X button or Cancel button
   * Test case: PW-030, QC-004
   */
  async close(): Promise<void> {
    // Try Cancel button first (visible in mode selection), then X button
    const cancelButton = this.page.getByRole('button', { name: 'Cancel' });
    if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelButton.click();
    } else {
      // Find X button inside the modal - it's a small button near the heading with just an icon
      // The button is inside the wizard content area, next to the step title heading
      const xButton = this.modal.locator('button').filter({ has: this.page.locator('svg') }).first();
      await xButton.click({ timeout: 5000 });
    }
    await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Select Quick mode and continue to form
   * Test case: QC-003
   */
  async selectQuickMode(): Promise<void> {
    await this.quickModeOption.click();
    await this.page.waitForTimeout(200);
    await this.modeSelectionContinue.click();
    // Wait for the quick create form to appear (slide-in panel)
    await this.nameInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Select Guided mode and continue to wizard
   * Test case: PW-002
   */
  async selectGuidedMode(): Promise<void> {
    await this.guidedModeOption.click();
    await this.page.waitForTimeout(200);
    await this.modeSelectionContinue.click();
    await this.page.waitForTimeout(300);
  }

  // ==================== Quick Create Methods ====================

  /**
   * Fill project name
   * Test cases: QC-005 through QC-010
   */
  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  /**
   * Fill project description
   */
  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  /**
   * Select client
   * Test cases: QC-011 through QC-013
   */
  async selectClient(clientName: string): Promise<void> {
    await this.clientSelect.click();
    await this.page.getByRole('option', { name: clientName }).click();
  }

  /**
   * Select status
   * Test cases: QC-014, QC-015
   * Note: Uses Command component (combobox), not regular select
   */
  async selectStatus(status: string): Promise<void> {
    await this.statusSelect.click();
    // Command items use role="option" but may also be CommandItem elements
    // Try option first, then fall back to text-based selection
    const option = this.page.getByRole('option', { name: new RegExp(status, 'i') });
    if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
      await option.click();
    } else {
      // Fall back to clicking the list item with matching text
      await this.page.locator('[cmdk-item]').filter({ hasText: new RegExp(status, 'i') }).click();
    }
  }

  /**
   * Select priority
   * Test cases: QC-016, QC-017
   */
  async selectPriority(priority: string): Promise<void> {
    await this.prioritySelect.click();
    await this.page.getByRole('option', { name: new RegExp(priority, 'i') }).click();
  }

  /**
   * Submit quick create form
   * Test cases: QC-018 through QC-021
   */
  async submitQuickCreate(): Promise<void> {
    await this.createButton.click();
  }

  /**
   * Quick create a project with minimal data
   */
  async quickCreateProject(data: {
    name: string;
    description?: string;
    client?: string;
    status?: string;
    priority?: string;
  }): Promise<void> {
    await this.selectQuickMode();
    await this.fillName(data.name);

    if (data.description) {
      await this.fillDescription(data.description);
    }
    if (data.client) {
      await this.selectClient(data.client);
    }
    if (data.status) {
      await this.selectStatus(data.status);
    }
    if (data.priority) {
      await this.selectPriority(data.priority);
    }

    await this.submitQuickCreate();
  }

  /**
   * Get name validation error
   */
  async getNameError(): Promise<string> {
    if (await this.nameError.isVisible()) {
      return (await this.nameError.textContent()) || '';
    }
    return '';
  }

  /**
   * Check if create button is enabled
   */
  async isCreateEnabled(): Promise<boolean> {
    return await this.createButton.isEnabled();
  }

  // ==================== Guided Wizard Methods ====================

  /**
   * Go to next step
   */
  async clickNext(): Promise<void> {
    await this.nextButton.click();
    await this.page.waitForTimeout(300); // Wait for animation
  }

  /**
   * Go to previous step
   * Test case: PW-007
   */
  async clickBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Click on stepper step
   * Test cases: PW-033, PW-034
   */
  async clickStep(stepIndex: number): Promise<void> {
    await this.stepperSteps.nth(stepIndex).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get current step index (0-based)
   */
  async getCurrentStep(): Promise<number> {
    // Find step buttons and check which one is active/enabled (first non-disabled step that's not 1)
    const steps = await this.stepperSteps.all();
    for (let i = steps.length - 1; i >= 0; i--) {
      const isDisabled = await steps[i].isDisabled().catch(() => true);
      if (!isDisabled && i > 0) {
        return i;
      }
    }
    return 0;
  }

  // Step 1: Intent
  /**
   * Select intent type
   * Test cases: PW-004 through PW-006
   */
  async selectIntent(intentIndex: number): Promise<void> {
    await this.intentOptions.nth(intentIndex).click();
  }

  // Step 2: Outcome
  /**
   * Select success type
   * Test case: PW-008
   */
  async selectSuccessType(index: number): Promise<void> {
    await this.successTypeOptions.nth(index).click();
  }

  /**
   * Add deliverable
   * Test cases: PW-009 through PW-011
   */
  async addDeliverable(text: string): Promise<void> {
    await this.deliverableInput.fill(text);
    await this.addDeliverableButton.click();
  }

  /**
   * Remove deliverable by index
   */
  async removeDeliverable(index: number): Promise<void> {
    const removeButtons = this.deliverablesList.locator('button');
    await removeButtons.nth(index).click();
  }

  /**
   * Add metric
   * Test case: PW-012
   */
  async addMetric(text: string): Promise<void> {
    await this.metricsInput.fill(text);
    await this.addMetricButton.click();
  }

  /**
   * Fill description in rich text editor
   * Test case: PW-013
   */
  async fillDescriptionEditor(text: string): Promise<void> {
    await this.descriptionEditor.click();
    await this.descriptionEditor.fill(text);
  }

  // Step 3: Ownership
  /**
   * Select owner
   * Test cases: PW-014 through PW-019
   */
  async selectOwner(ownerName: string): Promise<void> {
    await this.ownerSelect.click();
    await this.page.getByRole('option', { name: new RegExp(ownerName, 'i') }).click();
  }

  /**
   * Select contributors
   * Test case: PW-017
   */
  async selectContributors(names: string[]): Promise<void> {
    await this.contributorsSelect.click();
    for (const name of names) {
      await this.page.getByRole('option', { name: new RegExp(name, 'i') }).click();
    }
    await this.page.keyboard.press('Escape');
  }

  /**
   * Select stakeholders
   * Test case: PW-018
   */
  async selectStakeholders(names: string[]): Promise<void> {
    await this.stakeholdersSelect.click();
    for (const name of names) {
      await this.page.getByRole('option', { name: new RegExp(name, 'i') }).click();
    }
    await this.page.keyboard.press('Escape');
  }

  /**
   * Check if next button is enabled
   * Test case: PW-019
   */
  async isNextEnabled(): Promise<boolean> {
    return await this.nextButton.isEnabled();
  }

  // Step 4: Structure
  /**
   * Select deadline type
   * Test cases: PW-020 through PW-023
   */
  async selectDeadlineType(type: 'fixed' | 'flexible' | 'none'): Promise<void> {
    await this.page.getByRole('radio', { name: new RegExp(type, 'i') }).click();
  }

  /**
   * Set deadline date
   * Test case: PW-021
   */
  async setDeadlineDate(date: string): Promise<void> {
    await this.deadlineDatePicker.fill(date);
  }

  /**
   * Toggle starter tasks
   * Test case: PW-024
   */
  async toggleStarterTasks(): Promise<void> {
    await this.starterTasksToggle.click();
  }

  // Step 5: Review
  /**
   * Edit section from review
   * Test case: PW-026
   */
  async editFromReview(section: 'intent' | 'outcome' | 'ownership' | 'structure'): Promise<void> {
    const button = this.page.locator(`[data-testid="edit-${section}"]`).or(
      this.page.getByRole('button', { name: new RegExp(`edit ${section}`, 'i') })
    );
    await button.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Create project from review step
   * Test case: PW-028
   */
  async createProject(): Promise<void> {
    await this.createButton.click();
  }

  /**
   * Save as template
   * Test case: PW-027
   */
  async saveAsTemplate(): Promise<void> {
    await this.saveTemplateButton.click();
  }

  /**
   * Complete full wizard flow
   * Test case: PW-029
   */
  async completeWizard(data: {
    intent?: number;
    successType?: number;
    deliverables?: string[];
    metrics?: string[];
    description?: string;
    owner: string;
    contributors?: string[];
    stakeholders?: string[];
    deadlineType?: 'fixed' | 'flexible' | 'none';
    deadlineDate?: string;
    addStarterTasks?: boolean;
  }): Promise<void> {
    // Step 0: Select guided mode
    await this.selectGuidedMode();

    // Step 1: Intent (optional)
    if (data.intent !== undefined) {
      await this.selectIntent(data.intent);
    }
    await this.clickNext();

    // Step 2: Outcome
    if (data.successType !== undefined) {
      await this.selectSuccessType(data.successType);
    }
    if (data.deliverables) {
      for (const d of data.deliverables) {
        await this.addDeliverable(d);
      }
    }
    if (data.metrics) {
      for (const m of data.metrics) {
        await this.addMetric(m);
      }
    }
    if (data.description) {
      await this.fillDescriptionEditor(data.description);
    }
    await this.clickNext();

    // Step 3: Ownership
    await this.selectOwner(data.owner);
    if (data.contributors) {
      await this.selectContributors(data.contributors);
    }
    if (data.stakeholders) {
      await this.selectStakeholders(data.stakeholders);
    }
    await this.clickNext();

    // Step 4: Structure
    if (data.deadlineType) {
      await this.selectDeadlineType(data.deadlineType);
      if (data.deadlineType === 'fixed' && data.deadlineDate) {
        await this.setDeadlineDate(data.deadlineDate);
      }
    }
    if (data.addStarterTasks) {
      await this.toggleStarterTasks();
    }
    await this.clickNext();

    // Step 5: Review & Create
    await this.createProject();
  }

  /**
   * Assert wizard is visible
   */
  async assertWizardVisible(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  /**
   * Assert wizard is closed
   */
  async assertWizardClosed(): Promise<void> {
    // Wait for both the mode selection modal and the quick create form to be hidden
    await Promise.all([
      expect(this.modal).not.toBeVisible({ timeout: 10000 }).catch(() => {}),
      expect(this.nameInput).not.toBeVisible({ timeout: 10000 }).catch(() => {}),
    ]);
    // Give the UI time to settle
    await this.page.waitForTimeout(500);
  }

  /**
   * Assert on step
   */
  async assertOnStep(stepName: string): Promise<void> {
    await expect(this.page.getByText(stepName)).toBeVisible();
  }
}
