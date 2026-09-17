import './_exit.mjs';
/* שכבה 22 — האי: תבנית בספרייה, ומיקום ברצפת החדר ולא לאורך קיר */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();

const all = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readonly');
    const rows = await new Promise((res) => {
      const g = tx.objectStore('units').getAll();
      g.onsuccess = () => res(g.result);
    });
    dbh.close();
    return rows;
  });

/** האיים שבפרויקט, לפי סדר ההוספה */
const islands = async () => (await all()).filter((u) => u.free);
const first = async () => (await all())[0];

async function toDesign() {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await btn(/בדיקה/).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /מטבח/ }).first().click();
  await page.waitForTimeout(1400);
}

async function dragBy(from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + (dx * i) / 8, from.y + (dy * i) / 8);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
}

await setup(page, { walls: 2 });
await addUnit(page, 0);
await page.waitForTimeout(700);
await toDesign();

/* --- אין יותר מתג "אי" בעריכה המתקדמת --- */
const before = await first();
await page.locator('[data-unit-id]').first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'עריכה מתקדמת' }).click();
await page.waitForTimeout(600);
ok('the island switch is gone from advanced editing', (await page.getByRole('button', { name: 'אי בחדר' }).count()) === 0);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(600);

/**
 * מוסיף פריט לפי שם מדויק, דרך החיפוש שבספרייה.
 *
 * `pick` הוא השם ואחריו הרוחב, כפי שהכפתור נקרא: "אי" לבדו הוא
 * גם תחילתו של "אי מגירות לחדר ארונות", והחיפוש חוצה חדרים.
 */
async function addFromLibrary(name, pick = new RegExp('^' + name)) {
  await btn(/סיום עריכה/).click().catch(() => {});
  await page.waitForTimeout(400);
  await btn(/הוספת ארגז/).click();
  await page.waitForTimeout(700);
  const dlg = page.getByRole('dialog').last();
  await dlg.getByLabel('חיפוש ארגז לפי שם').fill(name);
  await page.waitForTimeout(600);
  await dlg.getByRole('button', { name: pick }).first().click();
  await page.waitForTimeout(1000);
  await btn(/סיום עריכה/).click().catch(() => {});
  await page.waitForTimeout(500);
}

/* --- האי מגיע מהספרייה, כתבנית --- */
await addFromLibrary('אי', /^אי\s*\d/);
let onFloor = await islands();
ok('adding the island template lands it in the room', onFloor.length === 1, JSON.stringify(onFloor[0]?.free));
ok('and it did not take a place on the wall', onFloor[0]?.free?.zMm !== undefined);

/* --- אפשר להוסיף עוד מופע, והתבנית אינה משתכפלת --- */
await addFromLibrary('אי', /^אי\s*\d/);
onFloor = await islands();
ok('a second instance can be added', onFloor.length === 2, String(onFloor.length));
const templates = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return (await db.catalog.toArray()).filter((i) => i.island).length;
});
ok('and the library still holds one template', templates === 1, String(templates));

/* --- כל מופע נערך בנפרד --- */
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const two = (await db.units.toArray()).filter((u) => u.free);
  await db.units.update(two[0].id, { widthMm: 1500 });
});
await page.waitForTimeout(600);
onFloor = await islands();
ok('each instance keeps its own size', onFloor[0].widthMm !== onFloor[1].widthMm,
  `${onFloor[0].widthMm} / ${onFloor[1].widthMm}`);

/* המשך הבדיקה על האי הראשון */
const island = onFloor[0];
await page.screenshot({ path: SP + 'L62-1-island.png' });

/* --- גרירה בתלת־ממד מזיזה אותו על הרצפה, בשני הצירים --- */
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1100);
await btn(/נעילת סיבוב החדר|שחרור סיבוב החדר/).click();
await page.waitForTimeout(400);
const box = await page.locator('[data-unit]').last().boundingBox();
await dragBy({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0, 60);
const moved = (await islands()).find((u) => u.id === island.id) ?? (await islands())[0];
ok(
  'dragging an island moves it across the floor',
  Math.hypot(moved.free.xMm - island.free.xMm, moved.free.zMm - island.free.zMm) > 100,
  `${JSON.stringify(island.free)} -> ${JSON.stringify(moved.free)}`,
);
ok('and it stays on the floor', moved.yMm === before.yMm, String(moved.yMm));
await page.screenshot({ path: SP + 'L62-2-dragged.png' });

/* --- החצים מסובבים את האי ביחס לחדר --- */
await page.locator('[data-unit]').last().click({ force: true });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'סיבוב ימינה' }).click();
await page.waitForTimeout(800);
const turned = (await islands()).find((u) => u.id === moved.id) ?? (await islands())[0];
ok(
  'the arrows turn the island itself',
  ((turned.free.headingDeg - moved.free.headingDeg + 360) % 360) === 90,
  `${moved.free.headingDeg} -> ${turned.free.headingDeg}`,
);
await page.screenshot({ path: SP + 'L62-3-turned.png' });

/* --- בחזית הוא מסומן כאי ולא מתחזה לארגז על הקיר --- */
await btn(/^דו־ממד/).click();
await page.waitForTimeout(1100);
const flat = await page.locator('svg:has([data-unit-id])').first().innerHTML();
ok('the elevation marks it as an island', /אי ·/.test(flat), (flat.match(/>[^<]*אי[^<]*</) ?? [''])[0]);
await page.screenshot({ path: SP + 'L62-4-elevation.png' });

/* --- האיים שרדו רענון --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
ok('both islands survive a reload', (await islands()).length === 2, String((await islands()).length));

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
