/**
 * Lighthouse CI Puppeteer auth script.
 * Sets Supabase auth cookies before each authenticated page load.
 * Cookie file is written by the Playwright auth step in the workflow.
 */
const fs = require('fs');

module.exports = async (browser, { url }) => {
  const cookieFile = '/tmp/lh-cookies.json';
  if (!fs.existsSync(cookieFile)) return;

  const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
  if (!cookies.length) return;

  const page = await browser.newPage();
  await page.setCookie(...cookies);
  await page.close();
};
