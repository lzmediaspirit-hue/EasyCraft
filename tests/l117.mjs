import './_exit.mjs';
/*
 * שכבה 117 — מפרט ארגז אחד: מה שנשמר, מה שנחתך, ומה שמצויר.
 *
 * E01 — מספר המגירות בעריכה המהירה מגיע אל האזור עצמו.
 * E02 — גובה שאי אפשר לבנות בו אינו נשמר, ונאמר מהו המינימום.
 * E06 — עובי הלוח הוא מידה אחת: ציור, חיתוך והתנגשות מסכימים.
 * E07 — עובי החזית שנבחר הוא שלפיו הדלת מצוירת.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') =>
  out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const Z = await import('/src/catalog/zones.ts' + v);
  const F = await import('/src/catalog/feasible.ts' + v);
  const T = await import('/src/db/types.ts' + v);
  const B = await import('/src/costing/boards.ts' + v);
  const S = await import('/src/features/design/isoScene.ts' + v);
  const P = await import('/src/features/design/placement.ts' + v);
  const PL = await import('/src/features/design/plan.ts' + v);

  const unit = (over) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1',
    name: 'ארגז', glyph: 'drawers', level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 720, depthMm: 580,
    createdAt: 0, updatedAt: 0, ...over,
  });

  /* --- E01: שלוש מגירות שמתוארות באזור --- */
  const zoned = unit({
    drawers: 3,
    zones: [{ id: 'z1', kind: 'drawers', heightMm: 720, drawers: 3 }],
  });
  const rowsBefore = Z.drawerRows(zoned);
  const simple = Z.drawersAreSimple(zoned);
  const six = { ...zoned, drawers: 6, zones: Z.zonesWithDrawerRows(zoned, 6) };
  const rowsAfter = Z.drawerRows(six);
  /* מה שהיה קורה בלי עדכון האזור: השדה משתנה, הארון לא */
  const fieldOnly = Z.drawerRows({ ...zoned, drawers: 6 });
  /* שני אזורי מגירות — אי אפשר לתאר במספר אחד */
  const twoBanks = unit({
    zones: [
      { id: 'a', kind: 'drawers', heightMm: 360, drawers: 2 },
      { id: 'b', kind: 'drawers', heightMm: 360, drawers: 3 },
    ],
  });
  /* ארון בלי אזורים מפורשים — השדה הישן הוא שמתאר אותו */
  const legacy = unit({ drawers: 4 });

  /* --- E02: גובה מול רגליים --- */
  const t = 18;
  const tooShort = unit({ heightMm: 50, socleMm: 100 });
  const why = F.unitProblem(tooShort, t);
  const minH = F.minHeightMm(tooShort, t);
  const goodOne = F.unitProblem(unit({ heightMm: 720, socleMm: 100 }), t);
  /* חלקי החיתוך של ארגז כזה — כך נראה מה שהיה יוצא לניסור */
  const badParts = B.unitParts(tooShort, { sheetWidthMm: 2440, sheetHeightMm: 1220, carcassThicknessMm: t, backGrooveMm: 8, frontGapMm: 3 });
  const nonPositive = badParts.filter((p) => p.widthMm <= 0 || p.heightMm <= 0).length;
  /* לוח בודד אינו נבנה מלוחות סביב חלל, ולכן הכלל אינו חל עליו */
  const slabFine = F.unitProblem(unit({ glyph: 'slab', heightMm: 30, depthMm: 300 }), t);

  /* --- E06: עובי הלוח --- */
  const shelf = unit({ glyph: 'slab', heightMm: 30, depthMm: 300, widthMm: 800, yMm: 1200 });
  const thick = T.slabThicknessMm(shelf, 'horizontal');
  const wall = { id: 'w1', projectId: 'p1', index: 0, lengthMm: 3000, heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 };
  const box = P.unitBox(shelf, PL.buildPlan([wall], [shelf]));
  const scene = S.buildScene({
    walls: [wall],
    units: [shelf],
    activeWallId: 'w1',
    selectedId: null,
    inside: false,
    finishHex: {},
    present: false,
    view: { yawDeg: -45, riseDeg: 20 },
  });
  const mine = scene.solids.filter((q) => q.unitId === shelf.id);
  const drawnH = mine.length ? mine[0].hi[1] - mine[0].lo[1] : -1;
  /* הדלת: עובי החזית שנבחר הוא שלפיו היא מצוירת */
  const door = unit({ glyph: 'doors', doors: 2, frontMaterialId: 'm-thick' });
  const thickParts = { sheetWidthMm: 2440, sheetHeightMm: 1220, carcassThicknessMm: 18, backGrooveMm: 8, frontGapMm: 3, thicknessById: { 'm-thick': 30 } };
  const doorScene = S.buildScene({
    walls: [wall],
    units: [door],
    activeWallId: 'w1',
    selectedId: null,
    inside: false,
    finishHex: {},
    present: false,
    view: { yawDeg: -45, riseDeg: 20 },
    parts: thickParts,
  });
  const doorSolids = doorScene.solids.filter((q) => /-door-/.test(q.key));
  const doorThick = doorSolids.length ? doorSolids[0].hi[2] - doorSolids[0].lo[2] : -1;
  const doorThin = (() => {
    const thin = S.buildScene({
      walls: [wall],
      units: [unit({ glyph: 'doors', doors: 2 })],
      activeWallId: 'w1',
      selectedId: null,
      inside: false,
      finishHex: {},
      present: false,
      view: { yawDeg: -45, riseDeg: 20 },
      parts: { ...thickParts, thicknessById: {} },
    }).solids.filter((q) => /-door-/.test(q.key));
    return thin.length ? thin[0].hi[2] - thin[0].lo[2] : -1;
  })();

  return {
    rowsBefore, simple, rowsAfter, fieldOnly,
    twoBanks: Z.drawersAreSimple(twoBanks),
    legacySimple: Z.drawersAreSimple(legacy),
    legacyRows: Z.drawerRows(legacy),
    legacyZones: Z.zonesWithDrawerRows(legacy, 2) === undefined,
    why, minH, goodOne, nonPositive, slabFine,
    thick,
    boxH: box?.h ?? null,
    solids: mine.length,
    drawnH,
    doorThick,
    doorThin,
  };
});

ok('a zoned cabinet reports the rows it really has', r.rowsBefore === 3, String(r.rowsBefore));
ok('and a single drawer zone can be set from the quick form', r.simple);
ok('setting six rows reaches the zone', r.rowsAfter === 6, String(r.rowsAfter));
ok('writing the legacy field alone would not have', r.fieldOnly === 3, String(r.fieldOnly));
ok('two drawer banks are not one number', r.twoBanks === false);
ok('a cabinet without explicit zones still uses the old field', r.legacySimple && r.legacyRows === 4, String(r.legacyRows));
ok('and has no zones to update', r.legacyZones);

ok('a 50 mm cabinet on 100 mm legs is refused', !!r.why, String(r.why));
ok('the refusal names the minimum', /196/.test(r.why ?? ''), String(r.why));
ok('the minimum is legs plus two boards plus a usable gap', r.minH === 196, String(r.minH));
ok('an ordinary cabinet passes', r.goodOne === null, String(r.goodOne));
ok('that shape is what produced non-positive cut parts', r.nonPositive > 0, String(r.nonPositive));
ok('a single board is not held to the carcass rule', r.slabFine === null, String(r.slabFine));

ok('a lying shelf takes its thickness from its height', r.thick === 30, String(r.thick));
ok('the collision box is that same 30 mm', r.boxH === 30, String(r.boxH));
ok('and so is the drawn solid', Math.abs(r.drawnH - 30) < 1, String(r.drawnH));

ok('a 30 mm front board makes a 30 mm door', Math.abs(r.doorThick - 30) < 0.01, String(r.doorThick));
ok('and an ordinary board still makes an 18 mm door', Math.abs(r.doorThin - 18) < 0.01, String(r.doorThin));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log(out.join('\n'));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
