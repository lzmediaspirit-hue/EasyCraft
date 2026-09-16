import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L27-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await setup(page, { name: 'קושרות בע״מ' });
await addNamed(page, /^ארגז שתי דלתות/);
await page.waitForTimeout(400);

/* מרחיבים ל-240 ומגדירים 4 דלתות */
await page.getByRole('button', { name: /הקלדת רוחב מדויק/ }).click(); await page.waitForTimeout(300);
await page.locator('input[aria-label="רוחב מדויק"]').fill('240'); await page.waitForTimeout(600);
await page.getByRole('button', { name: '4', exact: true }).first().click(); await page.waitForTimeout(700);
await full('1-four-doors');
/* הקושרות מוגדרות בתצוגת הפנים — שם רואים אותן */
await page.getByRole('button', { name: /הסתרת חזיתות/ }).first().click(); await page.waitForTimeout(700);
const body = await page.innerText('body');
ok('cells row appears', body.includes('תאים בין הדלתות'), '');
const cellsRow = page.locator('div').filter({ hasText: /^תאים בין הדלתות/ }).last();
const active = await page.locator('button[aria-pressed="true"]').evaluateAll((e) => e.map((x) => x.textContent));
ok('default is 2 cells for 4 doors', active.filter((t) => t === '2').length >= 1, active.join(','));
ok('double divider option', body.includes('קושרת בעובי כפול'));

/* הקושרת נספרת */
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);
await btn(/^חישוב/).click(); await page.waitForTimeout(1800);
await full('2-calc');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
await btn(/ניסור/).click(); await page.waitForTimeout(1800);
const nest = await dlg().innerText();
ok('stretcher in the cut list', nest.includes('קושרת'), nest.split('\n').filter((l) => l.includes('קושרת')).join(' / '));
await full('3-nesting');
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }

/* עובי כפול מכפיל */
await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(700);
if (await page.getByRole('button', { name: /הסתרת חזיתות/ }).count())
  await page.getByRole('button', { name: /הסתרת חזיתות/ }).first().click();
await page.waitForTimeout(600);
console.log('BTNS:', (await page.getByRole('button').allInnerTexts()).join('|').slice(0, 300).replace(/\n/g, ' '));
await page.getByRole('button', { name: /קושרת בעובי כפול/ }).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);
await btn(/ניסור/).click(); await page.waitForTimeout(1800);
await full('4-double');
ok('no crash with double dividers', errs.length === 0, errs.join('|'));

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
