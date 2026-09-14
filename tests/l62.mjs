/* שכבה 22 — אי חופשי בחדר: מיקום ברצפה ולא לאורך קיר */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

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

const first = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readonly');
    const rows = await new Promise((res) => {
      const g = tx.objectStore('units').getAll();
      g.onsuccess = () => res(g.result);
    });
    dbh.close();
    return rows[0];
  });

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

/* --- ההפיכה לאי חיה במגירת העריכה המתקדמת (שכבה 24) --- */
await page.locator('[data-unit-id]').first().click();
await page.waitForTimeout(800);
ok('no island row before opening advanced', (await page.getByRole('button', { name: 'אי בחדר' }).count()) === 0);
await page.getByRole('button', { name: 'עריכה מתקדמת' }).click();
await page.waitForTimeout(600);
ok('and appears inside it', (await page.getByRole('button', { name: 'אי בחדר' }).count()) === 1);

/* --- ההפיכה לא מזיזה את הארגז --- */
const before = await first();
await page.getByRole('button', { name: 'אי בחדר' }).click();
await page.waitForTimeout(900);
const island = await first();
ok('turning it into an island stores a room position', !!island.free, JSON.stringify(island.free));
await page.screenshot({ path: 'L62-1-island.png' });

/* --- גרירה בתלת־ממד מזיזה אותו על הרצפה, בשני הצירים --- */
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await btn(/שטוח/).click();
await page.waitForTimeout(1100);
await btn(/נעילת סיבוב החדר|שחרור סיבוב החדר/).click();
await page.waitForTimeout(400);
const box = await page.locator('[data-unit]').last().boundingBox();
await dragBy({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0, 60);
const moved = await first();
ok(
  'dragging an island moves it across the floor',
  Math.hypot(moved.free.xMm - island.free.xMm, moved.free.zMm - island.free.zMm) > 100,
  `${JSON.stringify(island.free)} -> ${JSON.stringify(moved.free)}`,
);
ok('and it stays on the floor', moved.yMm === before.yMm, String(moved.yMm));
await page.screenshot({ path: 'L62-2-dragged.png' });

/* --- החצים מסובבים את האי ביחס לחדר --- */
await page.locator('[data-unit]').last().click({ force: true });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'סיבוב ימינה' }).click();
await page.waitForTimeout(800);
const turned = await first();
ok(
  'the arrows turn the island itself',
  ((turned.free.headingDeg - moved.free.headingDeg + 360) % 360) === 90,
  `${moved.free.headingDeg} -> ${turned.free.headingDeg}`,
);
await page.screenshot({ path: 'L62-3-turned.png' });

/* --- בחזית הוא מסומן כאי ולא מתחזה לארגז על הקיר --- */
await btn(/^תלת/).click();
await page.waitForTimeout(1100);
const flat = await page.locator('svg:has([data-unit-id])').first().innerHTML();
ok('the elevation marks it as an island', /אי ·/.test(flat), (flat.match(/>[^<]*אי[^<]*</) ?? [''])[0]);
await page.screenshot({ path: 'L62-4-elevation.png' });

/* --- ובחזרה אל הקיר --- */
await page.locator('[data-unit-id]').first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'על הקיר', exact: true }).click();
await page.waitForTimeout(900);
const back = await first();
ok('it can come back to the wall', !back.free, JSON.stringify(back.free ?? null));

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
