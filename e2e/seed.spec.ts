/**
 * seed.spec.ts — PMS Playwright Test Agents Seed Test
 *
 * This is the bootstrap test used by Playwright Test Agents.
 * - The planner uses this to understand environment setup and fixtures.
 * - The generator uses this as a template for generated test files.
 * - The healer re-runs this to verify environment health.
 *
 * Usage with agents:
 *   Planner:   "Generate a plan for [feature]. Use e2e/seed.spec.ts as the seed test."
 *   Generator: "Generate tests from specs/[plan].md using e2e/seed.spec.ts as seed."
 *   Healer:    "Heal failing test: e2e/[test].spec.ts"
 */
import { test, expect } from './fixtures';

test.describe('Seed — Environment Bootstrap', () => {
  test('seed: app loads and login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/PMS|Project|Dashboard/i);
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });
});
