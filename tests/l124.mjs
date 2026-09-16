/*
 * שכבה 124 — לחיצה ארוכה, ותנועה בציר אחד.
 *
 * מה שנבדק כאן הוא ההבטחה עצמה: אחרי שננעל ציר, שני הצירים האחרים
 * אינם משתנים — גם כשההצמדה פעילה, גם כשיש שכן שמושך, וגם כשהיעד
 * תפוס. ארגז על קיר אינו הופך לאי בשקט, ונעילה אינה מעבירה אותו
 * לקיר השכן. ולמי שאינו גורר — מקשי החצים, באותם צירים בדיוק.
 */
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';

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
/* המחווה: מתי היא נדלקת, ואיזה ציר היא בוחרת                          */
/* ------------------------------------------------------------------ */

const gest = await page.evaluate(async () => {
  const A = await import('/src/features/design/axisLock.ts?v=' + Date.now());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* נדלקת כשהאצבע עומדת */
  let fired = 0;
  const p1 = A.longPress(60, 10);
  p1.start(100, 100, () => fired++);
  p1.move(104, 103);
  await wait(120);
  const held = fired;

  /* מתבטלת כשהאצבע יוצאת מהסבילות */
  let fired2 = 0;
  const p2 = A.longPress(60, 10);
  p2.start(100, 100, () => fired2++);
  const within = p2.move(140, 100);
  await wait(120);

  const FLAT = { yawDeg: 0, rise: 0 };
  const ISO = { yawDeg: 0, rise: 0.5 };
  const dir = (a, view, h) => A.axisOnScreen(a, view, h);
  const xs = dir('x', ISO);
  const zs = dir('z', ISO);

  const unit = { id: 'u', xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580 };
  const island = { ...unit, free: { xMm: 0, zMm: 0 } };

  return {
    ms: A.LONG_PRESS_MS,
    slop: A.LONG_PRESS_SLOP_PX,
    held,
    movedOut: !within,
    firedAfterMove: fired2,
    tooEarly: A.pickAxis(4, 3, ['along', 'y'], FLAT),
    flatSide: A.pickAxis(60, 4, ['along', 'y'], FLAT),
    flatUp: A.pickAxis(3, -70, ['along', 'y'], FLAT),
    isoX: A.pickAxis(xs[0] * 90, xs[1] * 90, ['x', 'z', 'y'], ISO),
    isoZ: A.pickAxis(zs[0] * 90, zs[1] * 90, ['x', 'z', 'y'], ISO),
    isoY: A.pickAxis(0, -90, ['x', 'z', 'y'], ISO),
    wallAxes: A.axesFor(unit, true),
    islandAxes: A.axesFor(island, true),
    labelAlongX: A.axisLabel('along', 0),
    labelAlongZ: A.axisLabel('along', 90),
    labelY: A.axisLabel('y'),
    labelZ: A.axisLabel('z'),
  };
});

ok('the long press threshold is in the 450–600 band', gest.ms >= 450 && gest.ms <= 600, String(gest.ms));
ok('a small movement does not cancel it', gest.held === 1, String(gest.held));
ok('a large movement does', gest.movedOut && gest.firedAfterMove === 0, `${gest.movedOut} / ${gest.firedAfterMove}`);
ok('a tiny drag picks no axis yet', gest.tooEarly === null, String(gest.tooEarly));
ok('a sideways drag picks the wall axis', gest.flatSide === 'along', String(gest.flatSide));
ok('an upward drag picks height', gest.flatUp === 'y', String(gest.flatUp));
ok('in 3D the X direction picks X', gest.isoX === 'x', String(gest.isoX));
ok('and the Z direction picks Z', gest.isoZ === 'z', String(gest.isoZ));
ok('and straight up picks Y', gest.isoY === 'y', String(gest.isoY));
ok('a wall cabinet is never offered a floor axis', gest.wallAxes.join() === 'along,y', gest.wallAxes.join());
ok('an island gets both floor axes and height', gest.islandAxes.join() === 'x,z,y', gest.islandAxes.join());
ok('the wall axis names the world axis it runs on', /X/.test(gest.labelAlongX) && /Z/.test(gest.labelAlongZ), `${gest.labelAlongX} / ${gest.labelAlongZ}`);
ok('height is named Y, and depth Z', /Y/.test(gest.labelY) && /Z/.test(gest.labelZ), `${gest.labelY} / ${gest.labelZ}`);

/* ------------------------------------------------------------------ */
/* החשבון: מה זז, ובעיקר מה לא                                         */
/* ------------------------------------------------------------------ */

const math = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const D = await import('/src/features/design/dragSolve.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);

  const walls = [
    { id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 },
    { id: 'w2', projectId: 'p', index: 1, lengthMm: 4000, heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 },
  ];
  const base = {
    projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'ארגז', glyph: 'doors',
    level: 'floor', xMm: 1000, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    createdAt: 0, updatedAt: 0,
  };
  const held = { ...base, id: 'a' };
  /* שכן שגובהו 900 — יעד הצמדה מפתה לגובה, ופינה מפתה להנחה */
  const mate = { ...base, id: 'b', xMm: 1700, yMm: 900, level: 'wall', depthMm: 320, heightMm: 700 };
  const units = [held, mate];
  const plan = P.buildPlan(walls, units);
  const view = { yawDeg: 0, rise: 0.5 };
  const go = (from, over) =>
    D.solveDrag({ from, dxMm: 0, dyMm: 0, view, plan, walls, units, pxPerUnit: 0.2, snap: true, ...over });

  /* לאורך הקיר, אל מול שכן שגובהו אחר: הגובה אינו זז */
  const along = go(held, { axis: 'along', dxMm: 520, dyMm: -160 });
  /* לגובה, כשיש שכן לצד: המרחק מהפינה אינו זז */
  const up = go(held, { axis: 'y', dxMm: 300, dyMm: -220 });
  /* בלי נעילה אותה תנועה בדיוק מזיזה את שניהם */
  const free = go(held, { dxMm: -520, dyMm: -1300 });
  const lockedSame = go(held, { axis: 'along', dxMm: -520, dyMm: -1300 });
  /* נעילה אינה מעבירה לקיר השכן, גם בגרירה שיוצאת מהקיר */
  const far = go(held, { axis: 'along', dxMm: 9000, dyMm: 0 });
  const farFree = go(held, { dxMm: 9000, dyMm: 0 });
  /* נעול לרצפה: ציר הגובה אינו מרים אותו */
  const pinned = go({ ...held, floorLocked: true }, { axis: 'y', dxMm: 0, dyMm: -400 });

  /* יעד תפוס בנעילה: הארגז נשאר, ושום ציר אחר אינו זז במקומו */
  const wall2 = [{ ...base, id: 'c1', xMm: 0, widthMm: 900 }, { ...base, id: 'c2', xMm: 900, widthMm: 900 }];
  const plan2 = P.buildPlan(walls, wall2);
  const stuck = D.solveDrag({
    from: wall2[0], dxMm: 300, dyMm: 0, view, plan: plan2, walls, units: wall2,
    pxPerUnit: 0.2, snap: true, axis: 'along',
  });

  /* אי: כל ציר לבדו */
  const island = { ...base, id: 'i', free: { xMm: 500, zMm: 500 }, wallId: 'w1' };
  const iUnits = [island];
  const iPlan = P.buildPlan(walls, iUnits);
  const iGo = (over) =>
    D.solveDrag({ from: island, dxMm: 0, dyMm: 0, view, plan: iPlan, walls, units: iUnits, pxPerUnit: 0.2, ...over });
  const iX = iGo({ axis: 'x', dxMm: 200, dyMm: 90 });
  const iZ = iGo({ axis: 'z', dxMm: 200, dyMm: 90 });
  const iY = iGo({ axis: 'y', dxMm: 200, dyMm: -300 });

  /* מקשי החצים — אותם צירים, במידה ידועה */
  const ctx = { plan, walls, units };
  const key = D.nudge(held, 'along', 100, ctx);
  const keyUp = D.nudge(held, 'y', 100, ctx);
  const keyPinned = D.nudge({ ...held, floorLocked: true }, 'y', 100, ctx);
  const edge = D.nudge({ ...held, xMm: 3390 }, 'along', 100, ctx);
  const keyBlocked = D.nudge(wall2[0], 'along', 100, { plan: iPlan, walls, units: wall2 });
  const keyIsland = D.nudge(island, 'z', 100, { plan: iPlan, walls, units: iUnits });

  return {
    along: along?.patch ?? null,
    up: up?.patch ?? null,
    free: free?.patch ?? null,
    lockedSame: lockedSame?.patch ?? null,
    far: far?.patch ?? null,
    farFree: farFree?.patch ?? null,
    pinned: pinned?.patch ?? null,
    stuck: stuck?.patch ?? null,
    iX: iX?.patch ?? null,
    iZ: iZ?.patch ?? null,
    iY: iY?.patch ?? null,
    key, keyUp, keyPinned, edge, keyBlocked, keyIsland,
    start: { x: held.xMm, y: held.yMm },
  };
});

ok('locked along the wall, the distance changes', math.along && math.along.xMm !== math.start.x, JSON.stringify(math.along));
ok('and the height does not — not even to a neighbour', math.along?.yMm === math.start.y, JSON.stringify(math.along));
ok('locked to height, the height changes', math.up && math.up.yMm !== math.start.y, JSON.stringify(math.up));
ok('and the distance from the corner does not', math.up?.xMm === math.start.x, JSON.stringify(math.up));
ok('without the lock the same drag moves both', math.free && math.free.xMm !== math.start.x && math.free.yMm !== math.start.y, JSON.stringify(math.free));
ok('and with it, only the one axis', math.lockedSame?.xMm === math.free?.xMm && math.lockedSame?.yMm === math.start.y, JSON.stringify(math.lockedSame));
ok('a locked drag never hands the cabinet to the next wall', math.far?.wallId === 'w1', JSON.stringify(math.far));
ok('while an open drag still does', math.farFree?.wallId === 'w2', JSON.stringify(math.farFree));
ok('floor lock still refuses to lift', math.pinned?.yMm === 0, JSON.stringify(math.pinned));
ok('a taken target leaves the cabinet where it is', math.stuck?.xMm === 0 && math.stuck?.yMm === 0, JSON.stringify(math.stuck));

ok('an island on X keeps its Z', math.iX?.free?.zMm === 500 && math.iX?.free?.xMm !== 500, JSON.stringify(math.iX));
ok('an island on Z keeps its X', math.iZ?.free?.xMm === 500 && math.iZ?.free?.zMm !== 500, JSON.stringify(math.iZ));
ok('an island on Y keeps the floor and moves up', math.iY?.yMm > 0 && !math.iY?.free, JSON.stringify(math.iY));

ok('an arrow key moves exactly the amount asked', math.key?.xMm === 1100, JSON.stringify(math.key));
ok('and up by the same amount', math.keyUp?.yMm === 100, JSON.stringify(math.keyUp));
ok('a floor-locked cabinet does not rise by key either', math.keyPinned === null, JSON.stringify(math.keyPinned));
ok('the wall end stops it instead of swallowing it', math.edge?.xMm === 3400, JSON.stringify(math.edge));
ok('a blocked neighbour stops the key, it does not slide past', math.keyBlocked === null, JSON.stringify(math.keyBlocked));
ok('an island key moves one floor axis', math.keyIsland?.free?.zMm === 600 && math.keyIsland?.free?.xMm === 500, JSON.stringify(math.keyIsland));

/* ------------------------------------------------------------------ */
/* המסך                                                                */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'ציר בע״מ' });
await addNamed(page, /^ארגז/);
await page.waitForTimeout(900);

const state = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts?v=' + Date.now());
    const u = (await db.units.toArray())[0];
    return { id: u.id, x: u.xMm, y: u.yMm, locked: !!u.floorLocked };
  });

/* הארגז מונח על הרצפה ונעול אליה — לבדיקת הציר צריך אותו חופשי */
const seed = await state();
await page.evaluate(async (id) => {
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts?v=' + Date.now());
  await unitsRepo.update(id, { xMm: 1000, yMm: 400, floorLocked: false });
}, seed.id);
await page.waitForTimeout(900);
const before = await state();
ok('the cabinet starts where the test put it', before.x === 1000 && before.y === 400, JSON.stringify(before));

const shape = page.locator(`svg g[data-unit-id="${before.id}"]`).first();
const bb = await shape.boundingBox();
ok('the cabinet is drawn on the wall', !!bb, JSON.stringify(bb));

/* לחיצה ארוכה, ואז גרירה אלכסונית: רק ציר אחד אמור לזוז */
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.waitForTimeout(700);
const badge = await page.locator('svg text').allTextContents();
ok('the lock announces itself before any movement', badge.some((t) => /נעילת ציר/.test(t)), JSON.stringify(badge.filter((t) => /ציר/.test(t))));

await page.mouse.move(bb.x + bb.width / 2 - 90, bb.y + bb.height / 2 - 30, { steps: 10 });
await page.waitForTimeout(300);
const named = await page.locator('svg text').allTextContents();
ok('and then names the axis it locked', named.some((t) => /נעול ל/.test(t)), JSON.stringify(named.filter((t) => /נעול/.test(t))));
await page.mouse.up();
await page.waitForTimeout(900);

const dragged = await state();
ok('the locked axis moved', dragged.x !== before.x, JSON.stringify(dragged));
ok('the other one did not, though the drag was diagonal', dragged.y === before.y, JSON.stringify(dragged));

/* תנועה אחת = צעד אחד */
await btn(/^ביטול פעולה|בטל/).click();
await page.waitForTimeout(1000);
const undone = await state();
ok('one locked drag is one undo step', undone.x === before.x && undone.y === before.y, JSON.stringify(undone));

/* ------------------------------------------------------------------ */
/* המקלדת                                                              */
/* ------------------------------------------------------------------ */

await page.locator(`svg g[data-unit-id="${before.id}"]`).first().click();
await page.waitForTimeout(600);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(700);
const oneStep = await state();
ok('an arrow key moves the selected cabinet a centimetre', Math.abs(oneStep.x - before.x) === 10, JSON.stringify(oneStep));

await page.keyboard.press('Shift+ArrowRight');
await page.waitForTimeout(700);
const bigStep = await state();
ok('with shift, ten', Math.abs(bigStep.x - oneStep.x) === 100, JSON.stringify(bigStep));

await page.keyboard.press('ArrowUp');
await page.waitForTimeout(700);
const raised = await state();
ok('the up arrow works on the height', raised.y === before.y + 10, JSON.stringify(raised));
ok('and the width is untouched by it', raised.x === bigStep.x, JSON.stringify(raised));

const say = await page.innerText('body');
ok('the screen says which axis the key moved', /ציר Y|לאורך הקיר/.test(say));

/* ------------------------------------------------------------------ */
/* התלת־ממד: אותה מחווה, על החדר כולו                                  */
/* ------------------------------------------------------------------ */

await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1400);
const solid = page.locator('svg [data-unit]').first();
const sb = await solid.boundingBox();
ok('the cabinet is drawn in 3D', !!sb, JSON.stringify(sb));
const at3d = await state();

await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
await page.mouse.down();
await page.waitForTimeout(700);
const iso = await page.innerText('body');
ok('a long press in 3D locks an axis too', /נעילת ציר/.test(iso));

await page.mouse.move(sb.x + sb.width / 2 - 70, sb.y + sb.height / 2 - 26, { steps: 10 });
await page.waitForTimeout(350);
const isoNamed = await page.innerText('body');
ok('and names it', /נעול ל/.test(isoNamed));
await page.mouse.up();
await page.waitForTimeout(900);
const after3d = await state();
ok('the 3D lock moves one axis and leaves the height', after3d.y === at3d.y, `${JSON.stringify(at3d)} → ${JSON.stringify(after3d)}`);

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
