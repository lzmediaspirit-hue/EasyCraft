import './_exit.mjs';
/*
 * שכבה 129 — R11/R12/R14: ציר מדויק, ביטול שאינו אישור, ושכפול אי.
 *
 * R11 — אי שעמד ב-Z=1707 קיבל Z=1710 בגרירת X. הציר הנעול לא זז,
 *       אבל עבר את אותו עיגול לסנטימטר שלם — והמידה שנמדדה בשטח
 *       השתנתה בדרך.
 * R12 — `pointercancel` הפעיל את אותו סיום כמו הרפיה, ולכן תנועה
 *       שבוטלה נשמרה: ב-2D (500,1000)→(970,1270), ובתלת־ממד
 *       (970,1270)→(2200,1900).
 * R14 — שכפול אי עדכן את המיקום על הקיר — שדה שלאי אין בו שימוש —
 *       והעתיק את המקום ברצפה כפי שהוא. שני גופים באותו מקום בדיוק.
 */
import { chromium } from 'playwright';
import { BOX, addNamed, setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* R11 — הציר שלא זז                                                   */
/* ------------------------------------------------------------------ */

const axes = await page.evaluate(async () => {
  const D = await import('/src/features/design/dragSolve.ts');
  const P = await import('/src/features/design/plan.ts');

  const walls = [
    { id: 'w1', projectId: 'p', index: 0, lengthMm: 6000, heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 },
  ];
  /* נקודת מוצא שאינה כפולה של 10 — בדיוק מה שהבדיקות הישנות פספסו */
  const island = {
    id: 'i', projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'אי', glyph: 'doors',
    level: 'floor', xMm: 0, yMm: 0, widthMm: 1200, heightMm: 880, depthMm: 900,
    free: { xMm: 1503, zMm: 1707, headingDeg: 0 }, createdAt: 0, updatedAt: 0,
  };
  const units = [island];
  const plan = P.buildPlan(walls, units);
  const view = { yawDeg: 0, rise: 0.5 };
  const go = (over) =>
    D.solveDrag({ from: island, dxMm: 0, dyMm: 0, view, plan, walls, units, pxPerUnit: 0.2, ...over });

  const onX = go({ axis: 'x', dxMm: 300, dyMm: 40 });
  const onZ = go({ axis: 'z', dxMm: 300, dyMm: 40 });
  const onXNoSnap = go({ axis: 'x', dxMm: 300, dyMm: 40, snap: false });
  const negative = D.solveDrag({
    from: { ...island, free: { xMm: -403, zMm: -207, headingDeg: 0 } },
    dxMm: 300, dyMm: 40, view, plan, walls, units, pxPerUnit: 0.2, axis: 'x',
  });
  const onY = go({ axis: 'y', dxMm: 0, dyMm: -300 });

  /* ובמקלדת, אותו כלל */
  const keyX = D.nudge(island, 'x', 100, { plan, walls, units });
  const keyZ = D.nudge(island, 'z', 100, { plan, walls, units });

  return {
    xKeepsZ: onX?.patch?.free ?? null,
    zKeepsX: onZ?.patch?.free ?? null,
    noSnapKeepsZ: onXNoSnap?.patch?.free ?? null,
    negativeKeepsZ: negative?.patch?.free ?? null,
    yKeepsFloor: onY?.patch ?? null,
    keyX, keyZ,
  };
});

ok('moving on X leaves Z exactly where it was', axes.xKeepsZ?.zMm === 1707, JSON.stringify(axes.xKeepsZ));
ok('and X really did move', axes.xKeepsZ?.xMm !== 1503, JSON.stringify(axes.xKeepsZ));
ok('moving on Z leaves X exactly where it was', axes.zKeepsX?.xMm === 1503, JSON.stringify(axes.zKeepsX));
ok('with snapping off, the still axis is still exact', axes.noSnapKeepsZ?.zMm === 1707, JSON.stringify(axes.noSnapKeepsZ));
ok('negative coordinates behave the same', axes.negativeKeepsZ?.zMm === -207, JSON.stringify(axes.negativeKeepsZ));
ok('moving on height touches neither floor axis', !axes.yKeepsFloor?.free && axes.yKeepsFloor?.yMm > 0, JSON.stringify(axes.yKeepsFloor));
ok('an arrow key on X keeps Z exact', axes.keyX?.free?.zMm === 1707 && axes.keyX?.free?.xMm === 1603, JSON.stringify(axes.keyX));
ok('and on Z keeps X exact', axes.keyZ?.free?.xMm === 1503 && axes.keyZ?.free?.zMm === 1807, JSON.stringify(axes.keyZ));

/* ------------------------------------------------------------------ */
/* R12 — ביטול אינו אישור                                              */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'ביטול בע״מ' });
await addNamed(page, BOX.any);
await page.waitForTimeout(900);

const at = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    const u = (await db.units.toArray())[0];
    return { id: u.id, x: u.xMm, y: u.yMm };
  });

const seed = await at();
await page.evaluate(async (id) => {
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  await unitsRepo.update(id, { xMm: 500, yMm: 1000, floorLocked: false });
}, seed.id);
await page.waitForTimeout(800);

const shape = page.locator(`svg g[data-unit-id="${seed.id}"]`).first();
const bb = await shape.boundingBox();
ok('the cabinet is on the wall', !!bb, JSON.stringify(bb));

const before2d = await at();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 - 40, { steps: 8 });
await page.waitForTimeout(250);
const during = await at();
ok('nothing is written while the finger is down', during.x === before2d.x && during.y === before2d.y, JSON.stringify(during));

/* ביטול של המערכת, בדיוק כמו שיחה נכנסת */
/*
 * האירוע נשלח לציור עצמו ולא ל-svg הראשון בדף: רוב ה-svg במסך הם
 * אייקונים בסרגל, והם אינם בעץ של מטפל המחווה.
 */
await page.evaluate(() => {
  const svg = [...document.querySelectorAll('svg')].find(
    (s) => s.querySelectorAll('[data-unit-id]').length,
  );
  svg?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
});
await page.waitForTimeout(900);
await page.mouse.up();
await page.waitForTimeout(700);

const after2d = await at();
ok('a cancelled drag writes nothing in 2D', after2d.x === before2d.x && after2d.y === before2d.y, `${JSON.stringify(before2d)} → ${JSON.stringify(after2d)}`);

const undoState = await page.evaluate(async (pid) => {
  const { history } = await import('/src/features/design/history.ts');
  const { preview } = await import('/src/features/design/preview.ts');
  return { canUndo: history.state(pid).canUndo, held: preview.active() };
}, await page.evaluate(async () => (await (await import('/src/db/db.ts')).db.units.toArray())[0].projectId));
ok('and leaves no undo step behind', !undoState.canUndo, JSON.stringify(undoState));
ok('and nothing is left in hand', !undoState.held, JSON.stringify(undoState));

/* ובקרה חיובית: אותה תנועה שמסתיימת בהרפיה כן נשמרת */
const bb2 = await page.locator(`svg g[data-unit-id="${seed.id}"]`).first().boundingBox();
await page.mouse.move(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2);
await page.mouse.down();
await page.mouse.move(bb2.x + bb2.width / 2 + 60, bb2.y + bb2.height / 2 - 40, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(900);
const committed = await at();
ok('a released drag does write', committed.x !== before2d.x || committed.y !== before2d.y, `${JSON.stringify(before2d)} → ${JSON.stringify(committed)}`);

/* ובתלת־ממד — אותו כלל */
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1400);
await btn(/נעילת סיבוב החדר/).click();
await page.waitForTimeout(500);
const before3d = await at();
const sb = await page.locator('svg [data-unit]').first().boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
await page.mouse.down();
await page.mouse.move(sb.x + sb.width / 2 + 70, sb.y + sb.height / 2 + 20, { steps: 8 });
await page.waitForTimeout(250);
await page.evaluate(() => {
  const svg = [...document.querySelectorAll('svg')].find(
    (s) => s.querySelectorAll('[data-unit]').length,
  );
  svg?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
});
await page.waitForTimeout(800);
await page.mouse.up();
await page.waitForTimeout(700);
const after3d = await at();
ok('a cancelled drag writes nothing in 3D either', after3d.x === before3d.x && after3d.y === before3d.y, `${JSON.stringify(before3d)} → ${JSON.stringify(after3d)}`);

/* ------------------------------------------------------------------ */
/* R14 — שכפול אי                                                      */
/* ------------------------------------------------------------------ */

const dup = await page.evaluate(async (id) => {
  const { db } = await import('/src/db/db.ts');
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  const { buildPlan } = await import('/src/features/design/plan.ts');
  const { unitBox } = await import('/src/features/design/placement.ts');
  const { blocked } = await import('/src/features/design/collision.ts');

  await unitsRepo.update(id, { free: { xMm: 1500, zMm: 1500, headingDeg: 0 } });
  const source = await db.units.get(id);
  const copy = await unitsRepo.duplicate(id, 0);

  const walls = await db.walls.where('projectId').equals(source.projectId).toArray();
  const units = await db.units.where('projectId').equals(source.projectId).toArray();
  const plan = buildPlan(walls, units);
  const box = unitBox(copy, plan);
  const overlaps = !!box && blocked(copy, box, units.filter((u) => u.id !== copy.id), plan);

  await db.units.delete(copy.id);
  return {
    from: source.free,
    to: copy.free,
    overlaps,
    apart: Math.abs((copy.free?.xMm ?? 0) - (source.free?.xMm ?? 0)),
    width: source.widthMm,
  };
}, seed.id);

ok('the copy is not in the same place', dup.to?.xMm !== dup.from?.xMm, `${JSON.stringify(dup.from)} → ${JSON.stringify(dup.to)}`);
ok('its other floor coordinate is kept', dup.to?.zMm === dup.from?.zMm, JSON.stringify(dup.to));
ok('it is pushed clear of its own width', dup.apart > dup.width, `${dup.apart} > ${dup.width}`);
ok('and the collision engine agrees they are apart', !dup.overlaps, String(dup.overlaps));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();
