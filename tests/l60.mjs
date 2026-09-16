import './_exit.mjs';
/* שכבה 21 — האשף: קיר יחיד, כמה קירות, חדר מורכב */
import { chromium } from 'playwright';
import { pickFinishes } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click();
await page.waitForTimeout(1400);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click();
await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('בדיקה');
await dlg().getByLabel(/עיר/).fill('תל אביב');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click();
await page.waitForTimeout(900);
await btn(/בדיקה/).click();
await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click();
await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click();
await page.waitForTimeout(800);

/* --- שלוש בחירות, לא ארבע --- */
const labels = ['קיר יחיד', 'כמה קירות', 'חדר מורכב'];
for (const l of labels) {
  ok(`the wizard offers ${l}`, (await dlg().getByRole('button', { name: new RegExp(`^${l}`) }).count()) === 1);
}
ok('and no longer a button per wall count', (await dlg().getByRole('button', { name: /^שלושה קירות/ }).count()) === 0);
await page.screenshot({ path: SP + 'L60-1-layouts.png' });

/* --- "כמה קירות" שואל את המספר מיד מתחתיה --- */
ok('the count is not asked before it is chosen', (await dlg().getByRole('button', { name: '4 קירות' }).count()) === 0);
await btn(/כמה קירות/).click();
await page.waitForTimeout(500);
ok('and appears once it is', (await dlg().getByRole('button', { name: '4 קירות' }).count()) === 1);
await page.screenshot({ path: SP + 'L60-2-count.png' });

await page.getByRole('button', { name: '4 קירות' }).click();
await page.waitForTimeout(700);
await btn(/קיר נקי/).click();
await page.waitForTimeout(700);
const dims = await dlg().innerText();
ok('four walls are asked for', (dims.match(/קיר [אבגד]׳/g) ?? []).length >= 4, (dims.match(/קיר [אבגד]׳/g) ?? []).join(','));
await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click();
await page.waitForTimeout(1800);
await pickFinishes(page);

/* --- חדר של ארבעה קירות נפתח בתלת־ממד --- */
/* בורר המצב מסמן את הפעיל, ולכן זו השאלה: האם התלת־ממד לחוץ */
ok(
  'a complex room opens in 3D',
  (await page.getByRole('button', { name: /^תלת־ממד/ }).getAttribute('aria-pressed')) === 'true',
  (await page.getByRole('button').allInnerTexts()).filter((t) => /ממד|מבט על/.test(t)).join(','),
);
ok('and the room floor is there', (await page.locator('[data-room-floor]').count()) === 1);
await page.screenshot({ path: SP + 'L60-3-opens-in-3d.png' });

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
