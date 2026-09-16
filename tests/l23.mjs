import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L23-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await setup(page, { name: 'עריכה בע״מ' });
await addUnit(page, 3); /* ארגז מגירות */
await page.waitForTimeout(400);
const front = await page.innerText('body');
ok('fronts view: no carcass finish row', !/גוף\n/.test(front) || !front.includes('גב\n'), '');
ok('fronts view has front finish', front.includes('חזיתות'), '');
await full('1-front-view');

/* מעבר לפנים */
await btn(/^חזית/).click(); await page.waitForTimeout(700);
const inside = await page.innerText('body');
ok('inside view has carcass + back finish', inside.includes('גוף') && inside.includes('גב'), '');
ok('drawer box choice', inside.includes('תיבת המגירה') && inside.includes('מגירת ברזל'), '');
ok('drawer depth shown', /עומק התיבה/.test(inside), inside.split('\n').find((l) => l.includes('עומק התיבה')) ?? '');
await full('2-inside-view');
await btn(/^פנים/).click(); await page.waitForTimeout(600);

/* גובה דלת — על ארגז דלתות */
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
await addUnit(page, 0);
await page.waitForTimeout(500);
/* "גובה הדלת" ירד: הדלת תמיד בגובה מה שהיא מכסה */
ok('no door height control', (await page.getByRole('button', { name: 'גובה הדלת' }).count()) === 0);
await full('3-no-door-height');

/* גובה רגליים 10 */
const socle = await page.getByLabel('גובה רגליים').inputValue();
ok('default socle is 10', socle === '10', socle);

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
