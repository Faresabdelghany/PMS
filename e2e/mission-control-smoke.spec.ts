import { test, expect } from "@playwright/test"

test.describe("mission control smoke", () => {
  test.use({ storageState: "e2e/.auth/user.json" })

  test("live ops tab loads", async ({ page }) => {
    await page.goto("/mission-control", { waitUntil: "domcontentloaded" })

    if (page.url().includes("/login")) {
      test.skip(true, "No authenticated E2E user configured")
    }

    await expect(page.getByRole("heading", { name: "Mission Control" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Live Ops" })).toBeVisible()
    await expect(page.locator('[data-testid="mc-live-ops"]')).toBeVisible()
    await expect(page.getByText("Now Playing")).toBeVisible()
  })

  test("calendar tab shows week view", async ({ page }) => {
    await page.goto("/mission-control", { waitUntil: "domcontentloaded" })

    if (page.url().includes("/login")) {
      test.skip(true, "No authenticated E2E user configured")
    }

    await page.getByRole("tab", { name: "Calendar" }).click()
    await expect(page.locator('[data-testid="mc-calendar"]')).toBeVisible()
    await expect(page.getByText("Week Schedule")).toBeVisible()
  })
})

