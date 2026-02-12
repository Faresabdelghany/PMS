/**
 * Lighthouse CI Puppeteer auth script.
 * Logs in via the login form before each authenticated page audit.
 * Runs before each URL - handles already-authenticated state gracefully.
 */
module.exports = async (browser, { url }) => {
  const page = await browser.newPage();
  const origin = new URL(url).origin;

  await page.goto(`${origin}/login`, { waitUntil: 'networkidle0', timeout: 30000 });

  // If redirected away from login, we're already authenticated
  if (!page.url().includes('/login')) {
    await page.close();
    return;
  }

  // Wait for form elements and log in
  await page.waitForSelector('input[type="email"]', { visible: true, timeout: 15000 });
  await page.type('input[type="email"]', process.env.TEST_USER_EMAIL);
  await page.type('input[autocomplete="current-password"]', process.env.TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect away from login
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login'),
    { timeout: 30000 }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.close();
};
