import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L48-${n}.png`, fullPage: true });
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const units = () => page.locator('g[data-unit-id]').count();

await setup(page, { name: 'ארגזים בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(500);

/* אין ארגז נבחר — אין כפתורים על הציור */
ok('no buttons without a selection', (await page.getByRole('button', { name: 'שכפול הארגז' }).count()) === 0);

await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(600);
ok('duplicate button shown', (await page.getByRole('button', { name: 'שכפול הארגז' }).count()) === 1);
ok('delete button shown', (await page.getByRole('button', { name: 'מחיקת הארגז' }).count()) === 1);
ok('one duplicate button in total', (await page.getByRole('button', { name: 'שכפול הארגז' }).count()) === 1);
await full('1-selected');

/*
  הכפתורים יושבים על הגבול שבין הציור ללוח העריכה: מתחת לציור,
  מעל הלוח, ובגודל שנוח לאצבע.
*/
const svg = page.locator('svg').filter({ has: page.locator('g[data-unit-id]') }).first();
const box = await svg.boundingBox();
const panel = await page.getByRole('button', { name: 'סיום עריכה' }).first().boundingBox();
for (const t of ['שכפול הארגז', 'מחיקת הארגז']) {
  const r = await page.getByRole('button', { name: t }).boundingBox();
  ok(`${t} below the drawing`, r.y >= box.y + box.height - 2, `${Math.round(r.y)} vs ${Math.round(box.y + box.height)}`);
  ok(`${t} above the panel`, r.y < panel.y, `${Math.round(r.y)} vs ${Math.round(panel.y)}`);
  ok(`${t} big enough for a finger`, r.width >= 34, `${Math.round(r.width)}px`);
}

const n = await units();
await page.getByRole('button', { name: 'שכפול הארגז' }).click(); await page.waitForTimeout(900);
ok('duplicate adds a cabinet', (await units()) === n + 1, `${n} → ${await units()}`);
await full('2-duplicated');

/* המחיקה נשאלת, מוחקת את הנבחר, וסוגרת את לוח העריכה */
await page.getByRole('button', { name: 'מחיקת הארגז' }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name: 'כן, למחוק' }).first().click(); await page.waitForTimeout(900);
ok('delete removes it', (await units()) === n, `${await units()}`);
ok('selection cleared', (await page.getByRole('button', { name: 'מחיקת הארגז' }).count()) === 0);
ok('editor closed', (await page.getByRole('button', { name: 'סיום עריכה' }).count()) === 0);
await full('3-deleted');

/* "בטל" מחזיר את המחיקה — היא נרשמה בהיסטוריה */
await page.getByRole('button', { name: /^ביטול|בטל/ }).first().click().catch(() => {});
await page.waitForTimeout(1000);
ok('undo brings it back', (await units()) === n + 1, `${await units()}`);
await full('4-undone');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
