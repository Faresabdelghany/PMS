/**
 * Lighthouse CI Puppeteer auth script.
 * Logs in via the login form before each authenticated page audit.
 * Credentials come from environment variables.
 */
module.exports = async (browser, { url }) => {
  const page = await browser.newPage();

  // Navigate to login page (same origin as the target URL)
  const origin = new URL(url).origin;
  await page.goto(`${origin}/login`, { waitUntil: 'networkidle0' });

  // Fill in credentials and submit
  await page.type('input[type="email"]', process.env.TEST_USER_EMAIL);
  await page.type('input[autocomplete="current-password"]', process.env.TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect away from login
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

  await page.close();
};
