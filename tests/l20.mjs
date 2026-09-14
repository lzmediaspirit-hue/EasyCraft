import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L20-${n}.png`, fullPage: true });
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const dims = async () => (await page.locator('button[aria-pressed]').filter({ hasText: /רוחב|גובה|עומק/ }).allInnerTexts()).join('|').replace(/\n/g, ' ');

await setup(page, { name: 'באגים בע״מ' });

/* --- באג: מידה דולפת בין ארגזים --- */
await addUnit(page, 0);
await page.getByRole('button', { name: /הקלדת רוחב מדויק/ }).click(); await page.waitForTimeout(400);
const f = page.locator('input[aria-label="רוחב מדויק"]');
await f.fill('92'); await page.waitForTimeout(600);
const first = await dims();
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);
await addUnit(page, 1);
const second = await dims();
ok('width does not leak to the next cabinet', !second.includes('92'), `${first} → ${second}`);
await full('1-second-unit');

/* --- באג: ביטול נעילה משחרר מהרצפה --- */
const floorY = () => page.locator('input[aria-label="גובה מהרצפה"]').inputValue();
await page.getByRole('button', { name: 'הצמדה לרצפה' }).click(); await page.waitForTimeout(500);
ok('unlocking reveals a height field', (await floorY()) === '0');
/* גוררים את הארגז הנבחר כלפי מעלה */
/* מהארגז עצמו: המסגרת של הקבוצה כוללת גם את כפתורי הארגז הנבחר */
const r = await page.locator('g[data-unit-id]').last().locator('rect').first().boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2 - i * 6);
await page.mouse.up(); await page.waitForTimeout(700);
ok('unlocked cabinet leaves the floor', Number(await floorY()) > 5, `y=${await floorY()}`);
await full('2-raised');

/* --- מחשבון בלי מקלדת --- */
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.getByRole('button', { name: /מחשבון/ }).first().click(); await page.waitForTimeout(700);
ok('calculator has no text field', await page.getByRole('dialog').locator('input').count() === 0);
const d = page.getByRole('dialog').last();
for (const k of ['9', '×', '3', '=']) { await d.getByRole('button', { name: k, exact: true }).click(); await page.waitForTimeout(120); }
ok('calculator still computes', (await d.innerText()).includes('27'), (await d.innerText()).split('\n')[0]);
await full('3-calc');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
