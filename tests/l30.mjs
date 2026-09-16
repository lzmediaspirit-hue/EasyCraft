import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L30-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const drawH = async () => (await page.locator('svg[viewBox]').filter({ has: page.locator('g[data-unit-id]') }).first().boundingBox()).height;

await setup(page, { name: 'הדמיה בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);

/* --- הסתרת נתונים --- */
/* הנתונים מתחילים סגורים; פותחים, מודדים, ואז מסתירים שוב */
ok('show stats button', await page.getByRole('button', { name: /הצגת הנתונים/ }).count() === 1);
await page.getByRole('button', { name: /הצגת הנתונים/ }).click(); await page.waitForTimeout(700);
const before = await drawH();
ok('hide stats button', await page.getByRole('button', { name: /הסתרת הנתונים/ }).count() === 1);
await page.getByRole('button', { name: /הסתרת הנתונים/ }).click(); await page.waitForTimeout(700);
const after = await drawH();
ok('drawing grows when stats hide', after > before + 40, `${Math.round(before)} → ${Math.round(after)}`);
ok('stats gone', !(await page.innerText('body')).includes('שטח הקיר'));
await full('1-stats-hidden');
await page.getByRole('button', { name: /הצגת הנתונים/ }).click(); await page.waitForTimeout(500);

/* --- גוון לכל הארגזים --- */
await btn(/גוון לכולם/).click(); await page.waitForTimeout(800);
const t = await dlg().innerText();
ok('project finishes sheet', t.includes('חזיתות') && t.includes('גוף'), t.split('\n').slice(0, 3).join(' / '));
await full('2-finishes');
/* הסעיף השני הוא חזיתות; הראשון הוא הגוף */
await dlg().getByRole('button', { name: 'אלון טבעי' }).nth(1).click(); await page.waitForTimeout(900);
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(700);
ok('applied to the cabinet', (await page.innerText('body')).includes('אלון טבעי'), '');
await full('3-applied');

/* --- שכפול על הציור --- */
ok('duplicate on the drawing', await page.getByRole('button', { name: 'שכפול הארגז' }).count() === 1);
ok('duplicate not in the toolbar', await page.getByRole('button', { name: /^שכפול$/ }).count() === 0);
const n = await page.locator('g[data-unit-id]').count();
await page.getByRole('button', { name: 'שכפול הארגז' }).click(); await page.waitForTimeout(800);
ok('duplicate works', (await page.locator('g[data-unit-id]').count()) === n + 1);
await full('4-duplicated');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
