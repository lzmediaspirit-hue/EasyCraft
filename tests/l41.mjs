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
const dlg = () => page.getByRole('dialog').last();

await setup(page, { name: 'התראות' });
/* שקע על הקיר, ואז ארגז שמכסה אותו */
await btn(/הגדרות הקיר/).click(); await page.waitForTimeout(900);
await dlg().getByRole('button', { name: 'שקע חשמל' }).click(); await page.waitForTimeout(700);
await dlg().getByLabel('שקע חשמל — למרכז השקע').fill('20'); await page.waitForTimeout(500);
await dlg().getByLabel('שקע חשמל — מרכז').fill('40'); await page.waitForTimeout(500);
await page.keyboard.press('Escape'); await page.waitForTimeout(600);

await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(700);

const list = page.locator('ul.bg-amber-50');
await list.waitFor({ timeout: 8000 }).catch(() => {});
const texts = await list.locator('li').allInnerTexts();
console.log('warnings:', JSON.stringify(texts));
ok(texts.length > 0, 'יש התראה על הקיר', texts.join(' | '));

const alert = list.locator('button').first();
ok(await alert.count() === 1, 'ההתראה היא כפתור');
const before = await page.locator('svg g[data-unit-id]').evaluateAll((g) => g.map((e) => e.getAttribute('data-unit-id')));
await alert.click(); await page.waitForTimeout(900);
await page.screenshot({ path: SP + '/L41-1-selected.png' });

/* אחרי הלחיצה: הארגז נבחר — לוח העריכה נפתח והוא מסומן בציור */
ok(await page.getByRole('button', { name: 'סיום עריכה' }).count() === 1, 'הארגז נבחר ולוח העריכה נפתח');
const strokes = await page.locator(`svg g[data-unit-id="${before[0]}"] rect`).evaluateAll(
  (e) => e.map((r) => r.getAttribute('stroke')).filter(Boolean));
console.log('strokes:', JSON.stringify(strokes));
ok(strokes.some((s) => s === '#814c2e' || s === '#a06236'), 'הארגז מסומן בהדמיה', strokes.join(','));

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
