import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L21-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const xs = async () =>
  (await page.locator('g[data-unit-id]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('transform')))).join(' ');

await setup(page, { name: 'כלים בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);
await addUnit(page, 1);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);
await full('1-two-units');

/* --- שכפול --- */
await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(500);
const before = await page.locator('g[data-unit-id]').count();
await btn(/שכפול/).click(); await page.waitForTimeout(800);
ok('duplicate adds a cabinet', (await page.locator('g[data-unit-id]').count()) === before + 1);
await full('2-duplicated');

/* --- undo / redo --- */
await btn(/^בטל/).click(); await page.waitForTimeout(800);
ok('undo removes it', (await page.locator('g[data-unit-id]').count()) === before);
await btn(/^חזור/).click(); await page.waitForTimeout(800);
ok('redo brings it back', (await page.locator('g[data-unit-id]').count()) === before + 1);
await btn(/^בטל/).click(); await page.waitForTimeout(800);

/* --- מרכוז --- */
const posBefore = await xs();
await btn(/מרכוז/).click(); await page.waitForTimeout(800);
ok('centering moves the cabinets', (await xs()) !== posBefore, '');
await full('3-centered');

/* --- סרגל --- */
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
await btn(/^סרגל/).click(); await page.waitForTimeout(500);
const gs = page.locator('g[data-unit-id]');
await gs.nth(0).click(); await page.waitForTimeout(300);
await gs.nth(1).click(); await page.waitForTimeout(500);
const texts = await page.locator('svg text').evaluateAll((e) => e.map((x) => x.textContent));
ok('ruler draws a span', await page.locator('line[stroke="#0f766e"]').count() >= 3, texts.join(','));
await full('4-ruler');
await btn(/^סרגל/).click(); await page.waitForTimeout(400);

/* --- מגירת הקיר: מידות ותצוגה --- */
await btn(/הגדרות הקיר/).click(); await page.waitForTimeout(700);
const wt = await dlg().innerText();
ok('wall sheet has dims + view options', wt.includes('מידות הקיר') && wt.includes('מה מוצג'), '');
await full('5-wall-tools');
await dlg().getByLabel('אורך הקיר').fill('420'); await page.waitForTimeout(600);
await dlg().getByRole('button', { name: 'שטח הקיר', exact: true }).click(); await page.waitForTimeout(400);
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
const main = await page.innerText('main');
ok('wall length changed', main.includes('420') || (await page.innerText('body')).includes('420'), '');
ok('wall area hidden', !main.includes('שטח הקיר'), main.split('\n').slice(0, 8).join(' / '));
await full('6-after-wall-tools');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
