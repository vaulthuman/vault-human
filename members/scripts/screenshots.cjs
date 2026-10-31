// Walks the app like a member at phone width and saves screenshots to docs/screenshots.
// Needs `npm run dev` running with DEV_LOG_LINKS=1, its output in a log file, and the seeded test member:
//   npm run dev > dev.log 2>&1 &
//   DEV_LOG=dev.log node scripts/screenshots.cjs
// LOCAL_SITE=1 serves https://www.vaulthuman.com/ files (videos, posters) from the repo's public/ folder,
// for sandboxes that can't reach the live site. It reads those files; it never changes them.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const LOG = process.env.DEV_LOG || 'dev.log';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const EMAIL = 'test@example.com';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (process.env.LOCAL_SITE) {
    const root = path.join(__dirname, '..', '..', 'public');
    await page.route('https://www.vaulthuman.com/**', (route) => {
      const file = path.join(root, decodeURIComponent(new URL(route.request().url()).pathname));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404 });
      route.fulfill({ path: file });
    });
  }
  const shot = async (name) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log('saved', name);
  };

  await page.goto(`${BASE}/signin`);
  await shot('1-sign-in');
  const logStart = fs.readFileSync(LOG, 'utf8').length;
  await page.fill('#email', EMAIL);
  await page.click('button[type=submit]');
  await shot('2-sign-in-sent');

  let link;
  for (let i = 0; i < 50 && !link; i++) {
    const m = fs.readFileSync(LOG, 'utf8').slice(logStart).match(/https?:\/\/\S+\/auth\/verify\?token=\S+/);
    if (m) link = m[0];
    else await new Promise((r) => setTimeout(r, 100));
  }
  if (!link) throw new Error('No sign-in link in the dev log');
  await page.goto(link);
  await page.waitForSelector('video');
  if (!page.url().endsWith('/today')) throw new Error(`Expected /today, got ${page.url()}`);
  const hello = (await page.textContent('.hello')).replace(/\s+/g, ' ').trim();
  console.log('greeting:', hello);
  if (!/^Good (morning|afternoon|evening), Test\. Chamber 1 · You Key 5 · B003$/.test(hello)) throw new Error(`Unexpected greeting: ${hello}`);
  await shot('3-today');

  await page.fill('#line', 'Wrote the list and the sentence. Felt lighter, and slept better.');
  await page.click('#log button[type=submit]');
  await page.waitForURL('**/today?saved=1');
  const status = (await page.textContent('.done')).replace(/\s+/g, ' ').trim();
  console.log('after save:', status);
  if (!/Logged\. Streak: 1 day in a row/.test(status)) throw new Error(`Unexpected status: ${status}`);
  await shot('4-today-logged');

  await page.goto(`${BASE}/keys`);
  await shot('5-my-keys');
  await page.goto(`${BASE}/progress`);
  const streakNum = (await page.textContent('.stat b')).trim();
  if (streakNum !== '1') throw new Error(`Progress streak shows ${streakNum}`);
  await shot('6-progress');
  await page.goto(`${BASE}/downloads`);
  await shot('7-downloads');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('a[href^="/files/guide"]')]);
  const saved = await download.path();
  const head = fs.readFileSync(saved).subarray(0, 5).toString();
  console.log('downloaded:', download.suggestedFilename(), fs.statSync(saved).size, 'bytes');
  if (head !== '%PDF-') throw new Error('Downloaded guide is not a PDF');

  await page.goto(`${BASE}/membership`);
  await shot('8-membership');
  await page.click('form[method=post]:not([action]) button');
  await shot('9-membership-stub');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
