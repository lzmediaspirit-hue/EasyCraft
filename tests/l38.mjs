import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'סרגל' });
await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
await addUnit(page, 1);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);

await btn(/^סרגל/).click(); await page.waitForTimeout(600);
ok(await page.getByRole('button', { name: 'רוחב', exact: true }).count() === 1, 'בחירת ציר רוחב מוצגת');
ok(await page.getByRole('button', { name: 'גובה', exact: true }).count() >= 1, 'בחירת ציר גובה מוצגת');
await page.screenshot({ path: SP + '/L38-0-ruler.png' });

/* רוחב: ארגז ופינה */
const ids = await page.locator('svg g[data-unit-id]').evaluateAll((g) => g.map((e) => e.getAttribute('data-unit-id')));
await page.locator(`svg g[data-unit-id="${ids[0]}"]`).click(); await page.waitForTimeout(400);
await page.locator('svg rect[data-corner="corner:end"]').click(); await page.waitForTimeout(600);
const label = () => page.locator('svg text[fill="#0f766e"]').evaluateAll((e) => e.map((t) => t.textContent));
const wTxt = await label();
ok(wTxt.length === 1, 'מידת רוחב מוצגת', wTxt.join(','));
await page.screenshot({ path: SP + '/L38-1-width.png' });

/* גובה: ארגז ותקרה */
await page.getByRole('button', { name: 'גובה', exact: true }).first().click(); await page.waitForTimeout(500);
ok((await label()).length === 0, 'החלפת ציר מנקה את הבחירה');
ok(await page.locator('svg rect[data-corner="edge:ceiling"]').count() === 1, 'יעד התקרה מוצג במצב גובה');
ok(await page.locator('svg rect[data-corner="corner:end"]').count() === 0, 'יעדי הפינות מוסתרים במצב גובה');
await page.locator(`svg g[data-unit-id="${ids[0]}"]`).click(); await page.waitForTimeout(400);
await page.locator('svg rect[data-corner="edge:ceiling"]').click(); await page.waitForTimeout(600);
const hTxt = await label();
ok(hTxt.length === 1, 'מידת גובה מוצגת', hTxt.join(','));
/* הארגז 88 גובה, קיר 260 → 172 */
ok(hTxt[0].includes('172'), 'המידה היא המרווח עד התקרה', hTxt.join(','));
await page.screenshot({ path: SP + '/L38-2-height.png' });

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
