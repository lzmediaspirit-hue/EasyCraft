/* שכבה 21 — עריכה בתלת־ממד: מתג צפייה/הזזה, גרירה, ומעבר בין קירות */
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

const placed = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readonly');
    const all = await new Promise((res) => {
      const g = tx.objectStore('units').getAll();
      g.onsuccess = () => res(g.result);
    });
    dbh.close();
    return { xMm: all[0].xMm, yMm: all[0].yMm, wallId: all[0].wallId };
  });

/** גרירה על הבד, נקודה לנקודה */
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

await setup(page, { walls: 'שני קירות' });
await addUnit(page, 0);
await page.waitForTimeout(700);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn(/בדיקה/).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /מטבח/ }).first().click();
await page.waitForTimeout(1400);
await btn(/שטוח/).click();
await page.waitForTimeout(1100);

/* --- המנעול קיים, והחדר מתחיל חופשי (שכבה 23) --- */
const toggle = page.getByRole('button', { name: /נעילת סיבוב החדר|שחרור סיבוב החדר/ });
ok('the room lock is there', (await toggle.count()) === 1);
ok('the room starts free', (await toggle.getAttribute('aria-pressed')) === 'false', await toggle.innerText());

/* --- כשהחדר חופשי, גרירה על ארון מסובבת את המבט ולא מזיזה אותו --- */
const before = await placed();
let box = await page.locator('[data-unit]').last().boundingBox();
await dragBy({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 70, 0);
const afterLook = await placed();
ok(
  'looking mode leaves the cabinet where it is',
  afterLook.xMm === before.xMm && afterLook.yMm === before.yMm,
  `${JSON.stringify(before)} -> ${JSON.stringify(afterLook)}`,
);
await page.screenshot({ path: 'L56-1-orbited.png' });

/* --- כשהחדר נעול, אותה גרירה מזיזה את הארון לאורך הקיר --- */
await btn(/זווית התחלתית/).click();
await page.waitForTimeout(700);
await toggle.click();
await page.waitForTimeout(400);
ok('the lock closes', (await toggle.getAttribute('aria-pressed')) === 'true', await toggle.innerText());

box = await page.locator('[data-unit]').last().boundingBox();
await dragBy({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 60, 0);
const moved = await placed();
ok('a locked room drags the cabinet along the wall', moved.xMm > before.xMm + 100, `${before.xMm} -> ${moved.xMm}`);
ok('it stays on the floor', moved.yMm === 0, String(moved.yMm));
await page.screenshot({ path: 'L56-2-moved.png' });
console.log('units:', await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('units', 'readonly');
  const all = await new Promise((res) => { const g = tx.objectStore('units').getAll(); g.onsuccess = () => res(g.result); });
  dbh.close();
  return all.map((u) => [u.name, u.xMm, u.yMm, u.widthMm, u.wallId.slice(0, 4)]);
}));

/* --- גרירה מעבר לקצה הקיר מעבירה לקיר השכן --- */
box = await page.locator('[data-unit]').last().boundingBox();
await dragBy({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 260, 0);
const hopped = await placed();
ok('dragging past the end moves it to the next wall', hopped.wallId !== before.wallId, `${before.wallId} -> ${hopped.wallId}`);
await page.screenshot({ path: 'L56-3-next-wall.png' });

/* --- נגיעה בוחרת גם כשהחדר נעול --- */
await page.locator('[data-unit]').last().click({ force: true });
await page.waitForTimeout(700);
ok('a tap still picks a cabinet', (await page.getByRole('button', { name: /^סיבוב/ }).count()) === 2);

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
