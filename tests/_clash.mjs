import './_exit.mjs';
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 420, height: 900 } });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
await setup(page, { name: 'clash', walls: 'שני קירות' });
await page.waitForTimeout(700);
await btn(/תכנון אוטומטי/).click(); await page.waitForTimeout(400);
await dlg().getByRole('switch', { name: 'מיקרוגל' }).click();
await dlg().getByRole('button', { name: /הצגת הצעות/ }).click(); await page.waitForTimeout(600);
await dlg().locator('button').filter({ hasText: /נוח לעבודה|חסכוני|מקסימום אחסון/ }).first().click();
await page.waitForTimeout(1400);
const info = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const PL = await import('/src/features/design/placement.ts' + v);
  const C = await import('/src/features/design/collision.ts' + v);
  const units = await db.units.toArray();
  /* כמו באפליקציה: סדר הקירות הוא index, ולא סדר המפתחות ב-Dexie */
  const walls = (await db.walls.toArray()).sort((a, b) => a.index - b.index);
  const plan = P.buildPlan(walls, units);
  const out = {
    walls: plan.map((p, i) => `#${i} ${p.wall.id.slice(0,4)} len=${p.wall.lengthMm} head=${p.headingDeg} start=(${Math.round(p.start.x)},${Math.round(p.start.y)}) end=(${Math.round(p.end.x)},${Math.round(p.end.y)})`),
    boxes: units.map((u) => {
      const bx = PL.unitBox(u, plan);
      return `${u.name} ${u.wallId.slice(0,4)}@${u.xMm} w${u.widthMm} d${u.depthMm} ${u.level} -> ${bx ? JSON.stringify(PL.boxCorners(bx).map((c) => [Math.round(c.x), Math.round(c.y)])) : 'null'}`;
    }),
    clashes: [],
  };
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = PL.unitBox(units[i], plan), bb = PL.unitBox(units[j], plan);
    if (a && bb && C.clash(a, bb)) out.clashes.push(`${units[i].name}(${units[i].wallId.slice(0,4)}@${units[i].xMm} d${units[i].depthMm}) X ${units[j].name}(${units[j].wallId.slice(0,4)}@${units[j].xMm} d${units[j].depthMm})`);
  }
  return out;
});
await b.close();
console.log(info.walls.join('\n')); console.log('---'); console.log(info.boxes.join('\n')); console.log('---'); console.log(info.clashes.join('\n'));
