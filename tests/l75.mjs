import './_exit.mjs';
/* שכבה 24א: גרירות, מגז פתוח, מחיקת פרויקט, עריכה מתקדמת */
import { chromium } from 'playwright';
import { BOX, addBox, setup } from './mk.mjs';
let fail = 0;
const ok = (n, c, g = '') => { if (c) console.log('PASS ', n); else { fail++; console.log('FAIL ', n, g); } };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', (e) => { fail++; console.log('PAGEERROR', e.message); });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await setup(page);
await addBox(page, BOX.hob, { edit: true });

/* --- לוח העריכה נגרר שוב --- */
const sep = page.getByRole('separator', { name: 'גובה לוח העריכה' });
ok('the editor panel is draggable again', (await sep.count()) === 1);
const before = (await page.locator('.rounded-t-3xl').first().boundingBox())?.height ?? 0;
await sep.focus();
await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
await page.waitForTimeout(500);
const after = (await page.locator('.rounded-t-3xl').first().boundingBox())?.height ?? 0;
ok('dragging it grows the panel', after > before + 20, `${Math.round(before)} -> ${Math.round(after)}`);
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);

/* --- עריכה מתקדמת: בלי דופן --- */
const adv = page.getByRole('button', { name: 'עריכה מתקדמת' });
ok('advanced edit is there', (await adv.count()) === 1);
await adv.click(); await page.waitForTimeout(500);
ok('it holds the omit row', (await page.getByText('בלי דופן', { exact: true }).count()) > 0);
/* האי אינו מתג בעריכה אלא תבנית בספרייה — ראו שכבה 22 */
ok('the island row is gone', (await page.getByText('אי', { exact: true }).count()) === 0);
/* צד שלא נבנה יורד מהניסור — נבדק ישירות על פירוק הלוחות */
const parts = await page.evaluate(async () => {
  const b = await import('/src/costing/boards.ts?v=' + Date.now());
  const u = {
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c', name: 'x', glyph: 'base',
    level: 'base', xMm: 0, yMm: 0, widthMm: 800, heightMm: 900, depthMm: 580,
    createdAt: 0, updatedAt: 0, backKind: 'thin', doors: 2, shelves: 2,
  };
  const s = { carcassThicknessMm: 18, backGrooveMm: 8 };
  const count = (unit) =>
    b.unitParts(unit, s)
      .filter((p) => p.label === 'צד' || p.label === 'תחתית ותקרה')
      .reduce((n, p) => n + p.qty, 0);
  return {
    full: count(u),
    noSides: count({ ...u, omit: { start: true, end: true } }),
    noTop: count({ ...u, omit: { top: true } }),
  };
});
ok('a full box cuts two sides and two decks', parts.full === 4, JSON.stringify(parts));
ok('dropping both sides drops two boards', parts.noSides === 2, JSON.stringify(parts));
ok('dropping the top drops one board', parts.noTop === 3, JSON.stringify(parts));

await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
await page.waitForTimeout(500);

/* --- כפתור ארגז חופשי אינו קיים --- */
ok('the free-box toggle is gone', (await page.getByRole('button', { name: 'ארגז חופשי' }).count()) === 0);

/* --- המחוונים אינם נגררים --- */
await page.getByRole('button', { name: 'הצגת הנתונים' }).first().click().catch(() => {});
await page.waitForTimeout(700);
const tile = page.locator('[data-stat]').first();
ok('stat tiles are on screen', (await tile.count()) > 0);
if (await tile.count()) {
  const cls = (await tile.getAttribute('class')) ?? '';
  ok('stat tiles are not draggable', !/cursor-grab|touch-none/.test(cls), cls);
}

/* --- מגז פתוח: בלי דלתות ובלי מגירות אין חזית --- */
await page.locator('[data-unit-id]').first().click(); await page.waitForTimeout(800);
const shot = async (tag) => {
  const svg = page.locator('svg').filter({ has: page.locator('[data-unit-id]') }).first();
  await svg.screenshot({ path: `L75-${tag}.png` });
  return svg.innerHTML();
};
const closed = await shot('1-hob-drawers');
await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const tx = dbh.transaction('units', 'readwrite');
  const st = tx.objectStore('units');
  const all = await new Promise((r) => { const g = st.getAll(); g.onsuccess = () => r(g.result); });
  for (const u of all) st.put({ ...u, doors: 0, drawers: 0, shelves: 0 });
  await new Promise((r) => (tx.oncomplete = r));
  dbh.close();
});
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1800);
await btn(/בדיקה/).click().catch(() => {}); await page.waitForTimeout(700);
await page.getByRole('button', { name: /מטבח/ }).first().click().catch(() => {}); await page.waitForTimeout(1600);
const open = await shot('2-hob-open');
ok('an open hob draws fewer lines than one with drawers',
   (open.match(/<rect|<line/g) ?? []).length < (closed.match(/<rect|<line/g) ?? []).length,
   `${(open.match(/<rect|<line/g) ?? []).length} vs ${(closed.match(/<rect|<line/g) ?? []).length}`);

await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASS');
