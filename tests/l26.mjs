import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L26-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await setup(page, { name: 'באגים 15' });

/* --- מכשיר חשמלי לא נספר --- */
await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
await dlg().getByRole('button', { name: /^מטבח/ }).click().catch(() => {});
await page.waitForTimeout(500);
const tiles = dlg().locator('div.relative > button').filter({ hasText: /\S/ });
console.log('TILES:', (await tiles.allInnerTexts()).map((t) => t.split('\n')[0]).join(','));
const fridge = tiles.filter({ hasText: 'מדיח' });
ok('dishwasher tile exists', await fridge.count() > 0);
await fridge.first().click(); await page.waitForTimeout(900);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
await page.waitForTimeout(400);
await full('1-fridge');
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
const calc = await dlg().innerText();
ok('appliance not counted as sheets', calc.includes('אין עדיין ארגזים') || !/פלטות\n/.test(calc) || /סה״כ פלטות\s*\n?\s*0/.test(calc), calc.slice(0, 120).replace(/\n/g, ' / '));
await full('2-calc');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

/* --- גרירה בעכבר --- */
await addUnit(page, 0);
await page.waitForTimeout(400);
const g = page.locator('g[data-unit-id]').last();
const before = await g.getAttribute('transform');
/* המסגרת של הקבוצה כוללת גם את כפתורי הארגז הנבחר; גוררים מהארגז עצמו */
const r = await g.locator('rect').first().boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(r.x + r.width / 2 + i * 5, r.y + r.height / 2);
await page.mouse.up(); await page.waitForTimeout(600);
ok('mouse drag moves the cabinet', (await g.getAttribute('transform')) !== before, `${before} → ${await g.getAttribute('transform')}`);

/* --- עומק לפי מצב תצוגה --- */
const depth = async () =>
  (await page.locator('button[data-axis]').last().innerText()).replace(/\s+/g, ' ');
const frontDepth = await depth();
await btn(/^חזית/).click(); await page.waitForTimeout(700);
const insideDepth = await depth();
ok('depth differs between views', frontDepth !== insideDepth, `${frontDepth} | ${insideDepth}`);
await full('3-depth');
await btn(/^פנים/).click(); await page.waitForTimeout(500);

/* --- גובה רגליים רק כשצמוד --- */
ok('leg height while locked', await page.getByLabel('גובה רגליים').count() === 1);
await page.getByRole('button', { name: 'הצמדה לרצפה' }).click(); await page.waitForTimeout(500);
ok('no leg height when unlocked', await page.getByLabel('גובה רגליים').count() === 0);
await page.getByRole('button', { name: 'הצמדה לרצפה' }).click(); await page.waitForTimeout(400);

/* --- "גובה הדלת" הוסר מהעורך --- */
ok('no door height control', (await page.getByRole('button', { name: 'גובה הדלת' }).count()) === 0);
await full('4-no-door-grow');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
