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

const readUnits = () => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => {
    const tx = db.transaction('units').objectStore('units').getAll();
    tx.onsuccess = () => res(tx.result.map((u) => ({ x: u.xMm, y: u.yMm, w: u.widthMm, h: u.heightMm, d: u.depthMm, wall: u.wallId, lvl: u.level })));
  });
});
const dragById = async (id, dx, dy) => {
  const g = page.locator(`svg g[data-unit-id="${id}"]`);
  const box = await g.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(500);
};
const ids = () => page.locator('svg g[data-unit-id]').evaluateAll((g) => g.map((e) => e.getAttribute('data-unit-id')));

await setup(page, { name: 'התנגשויות', walls: 'שני קירות' });
await page.waitForTimeout(600);

/* ---- א. שני ארגזים על אותו קיר לא עומדים אחד על השני ---- */
await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);
let u = await readUnits();
ok(u.length === 2, 'שני ארגזים נוספו');
const idList = await ids();
/* גוררים את הימני ביותר הרבה שמאלה, לתוך השני */
const rightIdx = u[0].x > u[1].x ? 0 : 1;
await dragById(idList[rightIdx], -900, 0);
u = await readUnits();
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
ok(!overlap(u[0], u[1]), 'ארגז שנגרר לתוך שכנו נעצר לידו', JSON.stringify(u.map((z) => [z.x, z.w])));
await page.screenshot({ path: SP + '/L33-1-no-overlap.png' });

/* ---- ב. ארגז לא נערם על ארגז אחר בגובה ---- */
const lowIdx = u[0].x < u[1].x ? 0 : 1;
await dragById(idList[lowIdx], 0, -260);
u = await readUnits();
ok(!overlap(u[0], u[1]), 'גרירה לגובה לא מעמידה ארגז על ארגז', JSON.stringify(u.map((z) => [z.x, z.y])));

/* ---- ג. פינה תפוסה חוסמת את הקיר השכן ---- */
/* דוחפים את הימני עד קצה הקיר, אל הפינה עם קיר ב׳ */
await dragById(idList[rightIdx], 900, 0);
u = await readUnits();
const cornerUnit = u.find((z) => z.x + z.w >= 2999);
ok(!!cornerUnit, 'ארגז עומד בפינה של קיר א׳', JSON.stringify(u.map((z) => [z.x, z.w])));
const depth = cornerUnit?.d ?? 0;

await btn(/קיר ב׳/).click(); await page.waitForTimeout(800);
await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);
u = await readUnits();
const onB = u.filter((z) => z.wall !== cornerUnit.wall);
ok(onB.length === 1 && onB[0].x >= depth - 1, 'ארגז חדש בקיר ב׳ לא נוחת בפינה התפוסה', `x=${onB[0]?.x} עומק פינה=${depth}`);
const bIds = await ids();
await dragById(bIds[0], -900, 0);
u = await readUnits();
const moved = u.filter((z) => z.wall !== cornerUnit.wall)[0];
ok(moved.x >= depth - 1, 'גרירה אל הפינה התפוסה נעצרת בגבול', `x=${moved.x} עומק פינה=${depth}`);
await page.screenshot({ path: SP + '/L33-2-corner.png' });

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
