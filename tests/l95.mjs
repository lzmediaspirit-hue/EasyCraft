import './_exit.mjs';
/** משימה 95: שלוש הדמיות בכרטיסים, וניצול כל הקירות. */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
};

await setup(page, { name: 'שכבה 95', walls: 'שלושה קירות' });
await page.waitForTimeout(900);

await btn(/תכנון אוטומטי/).click();
await page.waitForTimeout(600);
await dlg().getByRole('button', { name: /הצגת הצעות/ }).click();
await page.waitForTimeout(1400);
await page.screenshot({ path: SP + 'L95-1-cards.png', fullPage: true });

/* ---------- שלוש קטגוריות, שלוש תמונות ---------- */
const cards = dlg().locator('button').filter({ hasText: /נוח לעבודה|חסכוני|מקסימום אחסון/ });
ok('שלושה כרטיסים', (await cards.count()) === 3, String(await cards.count()));
for (const title of ['נוח לעבודה', 'מקסימום אחסון', 'חסכוני']) {
  ok(`כרטיס ${title}`, await dlg().getByText(title, { exact: true }).first().isVisible());
}
const thumbs = await dlg().locator('svg').filter({ has: page.locator('polygon') }).count();
ok('לכל כרטיס תמונה', thumbs >= 3, String(thumbs));
const polys = await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] svg')]
    .map((s) => s.querySelectorAll('polygon').length)
    .filter((n) => n > 0),
);
ok('התמונות מציירות ארגזים', polys.length === 3 && polys.every((n) => n > 20), JSON.stringify(polys));

/* ---------- כל הקירות מנוצלים ---------- */
const plans = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const A = await import('/src/features/design/autoPlan.ts' + v);
  const walls = (await db.walls.toArray()).sort((a, b) => a.index - b.index);
  const plan = P.buildPlan(walls, []);
  const props = A.planKitchen({
    walls, plan,
    appliances: { fridge: true, oven: true, hob: true, microwave: false, dishwasher: true, hood: true },
    seating: false, finish: 'standard',
  });
  return {
    layout: A.layoutFor(plan),
    walls: walls.length,
    perProposal: props.map((p) => ({
      title: p.title,
      layoutName: p.layoutName,
      wallsUsed: new Set(p.units.filter((u) => !u.free).map((u) => u.wallId)).size,
      boxes: p.units.length,
    })),
  };
});
ok('שלושה קירות → פרסה', plans.layout === 'u', String(plans.layout));
ok('שלוש הצעות מהמנוע', plans.perProposal.length === 3, JSON.stringify(plans.perProposal));
for (const p of plans.perProposal) {
  ok(`${p.title} מנצלת את כל שלושת הקירות`, p.wallsUsed === plans.walls, JSON.stringify(p));
}

/* ---------- בחירה מניחה בפועל ---------- */
await cards.first().click();
await page.waitForTimeout(1500);
const placed = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const us = await db.units.toArray();
  return { count: us.length, walls: new Set(us.map((u) => u.wallId)).size };
});
ok('ההצעה הונחה', placed.count > 0, JSON.stringify(placed));
ok('הארגזים על כל הקירות', placed.walls === 3, JSON.stringify(placed));
await page.screenshot({ path: SP + 'L95-2-applied.png' });

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();
