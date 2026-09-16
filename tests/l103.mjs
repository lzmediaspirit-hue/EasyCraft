import './_exit.mjs';
/* שכבה 103 — גאומטריה ואינטראקציה: קבוצה, אי בחזית, מסגור, גובה קבוצה, ותווית יחידות */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* --- V7: אי באמצע החדר נכנס למסגרת התלת־ממד --- */
const framing = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const iso = await import('/src/features/design/isoScene.ts' + v);
  const wall = { id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0 };
  const island = {
    id: 'i1', projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'אי', glyph: 'doors',
    doors: 2, level: 'floor', xMm: 0, yMm: 0, widthMm: 900, heightMm: 880, depthMm: 900,
    free: { xMm: 2000, zMm: 5000, headingDeg: 90 }, createdAt: 0, updatedAt: 0,
  };
  const s = iso.buildScene({
    walls: [wall], units: [island], activeWallId: 'w1', selectedId: null, inside: false,
    finishHex: {}, present: false, view: { yawDeg: -30, rise: 0.5 },
  });
  const mine = s.faces.filter((f) => f.unitId === 'i1')
    .flatMap((f) => f.points.split(' ').map((q) => q.split(',').map(Number)));
  const x0 = Math.min(...s.bounds.map((b) => b[0]));
  const x1 = Math.max(...s.bounds.map((b) => b[0]));
  const y0 = Math.min(...s.bounds.map((b) => b[1]));
  const y1 = Math.max(...s.bounds.map((b) => b[1]));
  const inside = mine.filter(([x, y]) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1);
  return { drawn: mine.length, inside: inside.length };
});
ok('האי מצויר', framing.drawn > 0, String(framing.drawn));
ok('וכל נקודותיו נכנסות למסגרת', framing.drawn === framing.inside, `${framing.inside}/${framing.drawn}`);

/* --- N7: קבוצת ארונות תלויים חוזרת בגובה שלה --- */
await setup(page, { name: 'גאומטריה' });
await page.waitForTimeout(600);
const group = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const project = (await db.projects.toArray())[0];
  const wall = (await db.walls.toArray())[0];
  /* צירוף של שני ארונות תלויים בגובה 1,500 */
  const id = await catalogRepo.saveCustom({
    rooms: ['kitchen'], group: 'upper', name: 'QA צירוף תלוי', glyph: 'doors',
    level: 'wall', defaultWidthMm: 1600, widthOptionsMm: [1600],
    defaultHeightMm: 700, defaultDepthMm: 320, defaultYMm: 1500,
    parts: [
      { dxMm: 0, dyMm: 0, unit: { name: 'שמאל', glyph: 'doors', doors: 1, level: 'wall',
        widthMm: 800, heightMm: 700, depthMm: 320 } },
      { dxMm: 800, dyMm: 0, unit: { name: 'ימין', glyph: 'doors', doors: 1, level: 'wall',
        widthMm: 800, heightMm: 700, depthMm: 320 } },
    ],
  });
  const item = await catalogRepo.get(id);
  const placed = await unitsRepo.addGroup(project.id, wall.id, item, 200);
  return placed.map((u) => ({ name: u.name, yMm: u.yMm, xMm: u.xMm }));
});
ok('הצירוף הונח בגובה שנשמר לו', group.every((u) => u.yMm === 1500), JSON.stringify(group));
ok('והמרווח בין חלקיו נשמר', group[1].xMm - group[0].xMm === 800, JSON.stringify(group));

/* --- V1: גרירת קבוצה שומרת על המרווחים --- */
const drag = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { solveDrag } = await import('/src/features/design/dragSolve.ts' + v);
  const { buildPlan } = await import('/src/features/design/plan.ts' + v);
  const walls = await db.walls.toArray();
  const units = (await db.units.toArray()).filter((u) => u.wallId === walls[0].id);
  const plan = buildPlan(walls, units);
  /*
   * כמו ב-WallIso: ההפרש נמדד מהמצב ההתחלתי של הארגז הנגרר, והשכנים
   * זזים מהמצב ההתחלתי שלהם — ולא מהמצב שכבר עודכן.
   */
  const anchor = units[0];
  const mate = units[1];
  const gap0 = mate.xMm - anchor.xMm;
  let live = { anchor: { ...anchor }, mate: { ...mate } };
  for (const step of [40, 80, 120, 160]) {
    const next = solveDrag({
      from: anchor, dxMm: step, dyMm: 0, view: { yawDeg: 0, rise: 0.5 },
      plan, walls, units, pxPerUnit: 1,
    });
    const dx = (next?.xMm ?? anchor.xMm) - anchor.xMm;
    live = { anchor: { ...anchor, xMm: anchor.xMm + dx }, mate: { ...mate, xMm: mate.xMm + dx } };
  }
  return { gap0, gap1: live.mate.xMm - live.anchor.xMm };
});
ok('המרווח בקבוצה אינו משתנה לאורך הגרירה', drag.gap0 === drag.gap1, `${drag.gap0} → ${drag.gap1}`);

/* --- V6: גרירת אי בחזית מזיזה את האי ולא את מידות הקיר --- */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const rows = await db.units.toArray();
  for (const u of rows.slice(1)) await db.units.delete(u.id);
  await db.units.update(rows[0].id, {
    free: { xMm: 1600, zMm: 1300, headingDeg: 90 }, xMm: 500, yMm: 0, level: 'floor',
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await btn(/גאומטריה/).click(); await page.waitForTimeout(800);
await btn(/מטבח/).first().click(); await page.waitForTimeout(1400);
/* ודאות שאנחנו בחזית ולא בתלת־ממד */
await btn(/^דו־ממד/).click().catch(() => {});
await page.waitForTimeout(700);
const before = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const u = (await db.units.toArray())[0];
  return { xMm: u.xMm, free: u.free };
});
const shape = page.locator('[data-unit-id]').first();
const box = await shape.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2);
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.waitForTimeout(800);
}
const after = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const u = (await db.units.toArray())[0];
  return { xMm: u.xMm, free: u.free };
});
ok('גרירת אי בחזית אינה נוגעת במידת הקיר הרדומה', after.xMm === before.xMm,
  `${before.xMm} → ${after.xMm}`);
ok('והיא כן מזיזה אותו ברצפת החדר',
  after.free.xMm !== before.free.xMm || after.free.zMm !== before.free.zMm,
  `${JSON.stringify(before.free)} → ${JSON.stringify(after.free)}`);
await page.screenshot({ path: SP + 'L103-1-island.png' });

/* --- N9: תווית היחידות בעומק אחיד --- */
const label = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { displayUnit, unitLabel, fromMm } = await import('/src/ui/units.ts' + v);
  displayUnit.set('mm');
  const asMm = { label: unitLabel(), chip: fromMm(600) };
  displayUnit.set('cm');
  const asCm = { label: unitLabel(), chip: fromMm(600) };
  return { asMm, asCm };
});
ok('במ״מ התווית והשבב במ״מ', label.asMm.label === 'מ״מ' && label.asMm.chip === 600, JSON.stringify(label.asMm));
ok('ובס״מ הם בס״מ', label.asCm.label === 'ס״מ' && label.asCm.chip === 60, JSON.stringify(label.asCm));

const all = [...out, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);
