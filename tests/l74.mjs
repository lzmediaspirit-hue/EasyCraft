/* שכבה 23: נעילת החדר, ביטול גרירת הלוח, צד זכוכית לוויטרינה, אייקון הסיבוב */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

let fail = 0;
const ok = (name, cond, got = '') => {
  if (cond) console.log('PASS ', name);
  else { fail++; console.log('FAIL ', name, got); }
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', (e) => { fail++; console.log('PAGEERROR', e.message); });
const btn = (re) => page.getByRole('button', { name: re }).first();

const dlg = () => page.getByRole('dialog').last();
/** הוספת ארגז מהספרייה, וסגירת לוח העריכה שנפתח אחריה */
async function add(name, tab) {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(600);
  if (tab) { await dlg().getByRole('button', { name: tab, exact: true }).click(); await page.waitForTimeout(500); }
  await dlg().getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
  await page.waitForTimeout(400);
}

await setup(page);
await add('ארגז דלת אחת');
await add('עליון ויטרינה', 'עליונים');

/* --- הלוח שמתחת להדמיה אינו נגרר --- */
ok('no panel drag handle', (await page.getByRole('separator', { name: /גובה לוח/ }).count()) === 0);

/* --- צד זכוכית: לא בארגז רגיל, כן בוויטרינה --- */
const glassRow = () => page.getByText('צד זכוכית', { exact: true });
await page.locator('[data-unit-id]').first().click(); await page.waitForTimeout(900);
ok('no glass side on a plain box', (await glassRow().count()) === 0);
await page.locator('[data-unit-id]').last().click(); await page.waitForTimeout(900);
ok('glass side on a vitrine', (await glassRow().count()) > 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
await page.waitForTimeout(500);

/* --- תלת־ממד: נעילת החדר --- */
await btn(/שטוח/).click(); await page.waitForTimeout(1300);
const lock = () => page.getByRole('button', { name: /נעילת סיבוב החדר|שחרור סיבוב החדר/ });
ok('lock button exists', (await lock().count()) > 0);

const svg = page.locator('svg').filter({ has: page.locator('[data-room-floor]') }).first();
const box = await svg.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const viewBox = () => svg.getAttribute('viewBox');

const orbit = async () => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 220, cy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
};

const before = await viewBox();
await orbit();
const afterFree = await viewBox();
ok('room turns when unlocked', before !== afterFree, `${before} -> ${afterFree}`);

await lock().click(); await page.waitForTimeout(400);
const locked0 = await viewBox();
await orbit();
const locked1 = await viewBox();
ok('room stays put when locked', locked0 === locked1, `${locked0} -> ${locked1}`);

await lock().click(); await page.waitForTimeout(400);
const free0 = await viewBox();
await orbit();
ok('room turns again after unlocking', free0 !== (await viewBox()));

/* --- אייקון הסיבוב: קשת וראש מלא --- */
await page.locator('[data-unit]').first().click({ force: true }); await page.waitForTimeout(800);
const spin = page.getByRole('button', { name: /סיבוב ימינה/ }).first();
ok('rotate button drawn', (await spin.count()) > 0);
if (await spin.count()) {
  const arc = await spin.locator('path').first().getAttribute('d');
  const head = await spin.locator('polygon').count();
  ok('rotate arc is a real arc', /A [\d.]+ [\d.]+ 0 1 [01]/.test(arc ?? ''), arc ?? '');
  ok('rotate head is a filled triangle', head === 1, String(head));
}
await page.locator('svg').filter({ has: page.locator('[data-room-floor]') }).first()
  .screenshot({ path: SP + 'L74-1-iso.png' });

await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASS');
