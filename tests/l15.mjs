import './_exit.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const full = (n) => page.screenshot({ path: `${SP}/L15-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1200);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('מדידה בע״מ');
await dlg().getByLabel(/עיר/).fill('לוד');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/מדידה בע״מ/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(900);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(900);
await btn(/קיר נקי/).click(); await page.waitForTimeout(900);
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1600);

for (let i = 0; i < 3; i++) {
  await clear();
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
  await dlg().locator('div.relative > button').nth(i).click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}
await clear();

const svgTexts = async () => (await page.locator('svg text').evaluateAll((e) => e.map((x) => x.textContent))).join('|');
/* כפתור המדידה בלבד — "עומק אחיד" הוא כפתור אחר שגם מכיל "עומק" */
const label = async () =>
  (await page.getByRole('button', { name: /^(מדידה|רוחב|גובה|עומק)( —|$)/ }).first().innerText()).trim();

await full('1-plain');
const before = await svgTexts();
await page.getByRole('button', { name: /מדידה —/ }).click(); await page.waitForTimeout(700);
ok('measure on → width', (await label()) === 'רוחב', await label());
await full('2-width');
const w = await svgTexts();
ok('all three widths shown', (w.match(/\d/g) || []).length > (before.match(/\d/g) || []).length, w);

await page.getByRole('button', { name: /רוחב —/ }).click(); await page.waitForTimeout(600);
ok('second tap → height', (await label()) === 'גובה', await label());
await full('3-height');
await page.getByRole('button', { name: /גובה —/ }).click(); await page.waitForTimeout(600);
ok('third tap → depth', (await label()) === 'עומק', await label());
await full('4-depth');
await page.getByRole('button', { name: /עומק —/ }).click(); await page.waitForTimeout(600);
ok('fourth tap → off', (await label()) === 'מדידה', await label());

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
