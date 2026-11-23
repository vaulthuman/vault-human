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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['notifications'] });
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
  if (!/^Good (morning|afternoon|evening), Test\. Chamber 1 · You Key \d+ · [BMH]\d{3}$/.test(hello)) throw new Error(`Unexpected greeting: ${hello}`);
  await shot('3-today');

  // Fill in today's Key's own boxes, whatever Key today is.
  const boxes = await page.$$('#form input[type=text], #form textarea');
  for (const b of boxes) await b.fill('Walked to the creek and let it settle.');
  for (const c of await page.$$('#form input[type=checkbox]')) await c.check();
  for (const name of await page.$$eval('#form input[type=radio]', (rs) => [...new Set(rs.map((r) => r.name))])) await page.check(`#form input[name="${name}"][value="7"]`);
  await page.click('#form button[type=submit]');
  await page.waitForURL('**/today?saved=*');
  const ok = (await page.textContent('#form .ok')).trim();
  console.log('after save:', ok, '|', (await page.textContent('.streak')).trim());
  if (!/^Saved\./.test(ok)) throw new Error(`Unexpected status: ${ok}`);
  await page.locator('#form').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, '4-today-logged.png'), fullPage: false });
  console.log('saved 4-today-logged');

  await page.goto(`${BASE}/keys`);
  await shot('5-my-keys');

  // Go back to an earlier Key and start it: any open Key can be filled in, in any order.
  await page.goto(`${BASE}/keys/b001`);
  await page.check('#form input[name="p_before"][value="4"]');
  await page.check('#form input[name="p_outside"]');
  await page.click('#form button[type=submit]');
  await page.waitForURL('**/keys/b001?saved=1*');
  await page.locator('#form').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, '5b-earlier-key.png'), fullPage: false });
  console.log('saved 5b-earlier-key');

  await page.goto(`${BASE}/progress`);
  const doneNum = (await page.textContent('.big b')).trim();
  console.log('progress done:', doneNum);
  if (doneNum !== '1') throw new Error(`Progress shows ${doneNum} done`);
  await shot('6-progress');
  await page.goto(`${BASE}/downloads`);
  if (!page.url().endsWith('/documents')) throw new Error(`Downloads did not move to Documents: ${page.url()}`);
  await shot('7-documents');
  await page.click('a[href="/documents/guide"]');
  await page.waitForFunction(() => { const i = document.querySelector('.page img'); return i && i.complete && i.naturalWidth > 0; });
  if (await page.locator('a[download], a[href$=".pdf"]').count()) throw new Error('Documents offers a download');
  const disp = await page.evaluate(async () => (await fetch(document.querySelector('.page img').src)).headers.get('content-disposition'));
  console.log('page served as:', disp);
  if (disp !== 'inline') throw new Error('Document page is not inline');
  await shot('7b-document-reader');

  await page.goto(`${BASE}/membership`);
  await shot('8-membership');
  await page.click('form[method=post]:not([action]) button');
  await shot('9-membership-stub');

  // Home-screen app: install steps, the manifest and the reminders control.
  await page.goto(`${BASE}/install`);
  await shot('10-install');
  const manifest = await (await page.request.get(`${BASE}/manifest.webmanifest`)).json();
  if (manifest.start_url !== '/today' || manifest.display !== 'standalone') throw new Error('Manifest is wrong');
  await page.goto(`${BASE}/today`);
  const sw = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active));
  console.log('service worker active:', sw);
  await page.locator('.remind').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, '11-today-reminders.png'), fullPage: false });
  console.log('saved 11-today-reminders');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
