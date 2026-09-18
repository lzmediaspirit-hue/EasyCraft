import './_exit.mjs';
/*
 * שכבה 166 — ביקורת 18.9: R01–R09.
 *
 * תשעה ממצאים, וחוט אחד עובר ברובם: המידה שנשמרה, המידה שנבדקה
 * והמידה שצוירה לא היו אותה מידה. ארגז חרג מהחדר כי איש לא שאל על
 * החדר; כיוון השרטוט הזיז את הרהיטים כי הפנים היה הנחה ולא חישוב;
 * משטח עבודה נכנס לארון עליון כי כל צד גדל אחרת; ועריכה מספרית
 * נדחתה על חזית שנספרה פעמיים ועברה על קיר שלא נבדק כלל.
 *
 * כאן זה נבדק על המודולים האמיתיים ועל המסך האמיתי.
 */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

await setup(page, { name: 'ביקורת 18.9' });
await addUnit(page, 0);
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* הגאומטריה, על המודולים                                              */
/* ------------------------------------------------------------------ */

const g = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { buildPlan } = await import('/src/features/design/plan.ts' + v);
  const { unitBox, solidBox, unitOnWall } =
    await import('/src/features/design/placement.ts' + v);
  const { blocked } = await import('/src/features/design/collision.ts' + v);
  const { boxOutside, roomPolygon, outOfWall, planCloses } =
    await import('/src/features/design/roomBounds.ts' + v);
  const { rulerSpan } = await import('/src/features/design/wallRuler.tsx' + v);
  const E = await import('/src/features/projects/RoomShapeEditor.tsx' + v);
  const U = await import('/src/ui/units.ts' + v);

  const wall = (id, lengthMm, turnDeg, features = []) => ({
    id, lengthMm, heightMm: 2500, turnDeg, features,
  });
  const unit = (o) => ({
    id: 'u1', projectId: 'p', catalogItemId: 'c', wallId: 'w1', name: 'x',
    glyph: 'base-2door', level: 'floor', xMm: 0, yMm: 0,
    widthMm: 800, heightMm: 800, depthMm: 580, doors: 2, ...o,
  });
  const pts = (list) => list.map(([x, y]) => ({ x, y }));

  /* --- R01: מצולע החדר --- */
  const tri = buildPlan(
    [wall('w1', 4000, 0), wall('w2', 2500, 143.1301), wall('w3', 2500, 73.7398)], []);
  const far = unit({ xMm: 3200 });
  const mid = unit({ xMm: 1600 });
  const open2 = buildPlan([wall('w1', 4000, 0), wall('w2', 3000, 90)], []);

  /* --- R02: אותו חדר, שני כיווני שרטוט --- */
  const rect = (t) => buildPlan(
    [wall('w1', 4000, 0), wall('w2', 3000, t), wall('w3', 4000, t), wall('w4', 3000, t)], []);
  const ccw = rect(90);
  const cw = rect(-90);
  const u = unit({ xMm: 500 });
  const bCcw = unitBox(u, ccw);
  const bCw = unitBox(u, cw);

  /* --- R03: משטח עבודה, בשני כיווני השאלה --- */
  const base = unit({ id: 'a', heightMm: 800, counterMm: 40, xMm: 1200 });
  const upper = unit({ id: 'b', yMm: 810, heightMm: 700, depthMm: 350, xMm: 1200, level: 'wall' });
  const pw = buildPlan([wall('w1', 4000, 0)], [base, upper]);
  const win = { id: 'f1', kind: 'window', xMm: 1100, yMm: 810, widthMm: 900, heightMm: 1000 };
  const pWin = buildPlan([wall('w1', 4000, 0, [win])], [base]);

  /*
   * R05: שני ארגזים זה מול זה, עם עשרה מ״מ אמיתיים בין החזיתות.
   * הגוף מגיע ל-580 ועוד 18 חזית; שכנגד מתחיל ב-626 פחות 18.
   */
  const facing = unit({ id: 'a', xMm: 500, widthMm: 600 });
  const across2 = unit({
    id: 'b', widthMm: 600, free: { xMm: 800, zMm: 916, headingDeg: 270 },
  });
  const pFace = buildPlan([wall('w1', 4000, 0)], [facing, across2]);
  const body = unitBox(facing, pFace);
  const solid = solidBox(facing, pFace);

  /* --- R06: היטל על הקיר --- */
  const one = buildPlan([wall('w1', 4000, 0)], []);
  const flat = unit({ widthMm: 1200, depthMm: 300 });
  const island = { ...flat, id: 'isl', free: { xMm: 1600, zMm: 1200, headingDeg: 0 } };
  const proj = (x) => unitOnWall(x, one, one[0]);

  /* --- R07: הסיומת נגזרת --- */
  U.displayUnit.set('mm');
  const inMm = U.cmWith(250);
  U.displayUnit.set('cm');
  const inCm = U.cmWith(250);

  return {
    /* R01 */
    triClosed: planCloses(tri),
    triPoly: !!roomPolygon(tri),
    triFar: blocked(far, unitBox(far, tri), [], tri),
    triMid: blocked(mid, unitBox(mid, tri), [], tri),
    triFarOutside: boxOutside(solidBox(far, tri), tri),
    openFree: boxOutside(solidBox(unit({ xMm: 3200 }), open2), open2),
    rectFits: blocked(u, unitBox(u, ccw), [], ccw),
    /* R02 */
    inward: [ccw[0].inward, cw[0].inward],
    sides: [Math.round(bCcw.cz), Math.round(bCw.cz)],
    bothInside: [!boxOutside(solidBox(u, ccw), ccw), !boxOutside(solidBox(u, cw), cw)],
    /* R03 */
    aOverB: blocked(base, unitBox(base, pw), [upper], pw),
    bOverA: blocked(upper, unitBox(upper, pw), [base], pw),
    bare: blocked({ ...base, counterMm: 0 }, unitBox({ ...base, counterMm: 0 }, pw),
      [upper], pw),
    counterWindow: blocked(base, unitBox(base, pWin), [], pWin),
    bareWindow: blocked({ ...base, counterMm: 0 },
      unitBox({ ...base, counterMm: 0 }, pWin), [], pWin),
    /* R04 */
    overrun: outOfWall(unit({ xMm: 300, widthMm: 1000 }), [wall('w1', 900, 0)]),
    exact: outOfWall(unit({ xMm: 300, widthMm: 600 }), [wall('w1', 900, 0)]),
    ceiling: outOfWall(unit({ yMm: 0, heightMm: 2400, counterMm: 200 }), [wall('w1', 4000, 0)]),
    /* R05 */
    depths: [Math.round(body.d), Math.round(solid.d)],
    /* מה שהחוזה מבטיח: תיבת הגוף נכנסת, והחזית מתווספת פעם אחת */
    clearBody: blocked(facing, body, [across2], pFace),
    /* ומה שקרה כשהזינו תיבה פיזית: אותה חזית נספרה שוב, והמרווח נעלם */
    clearSolid: blocked(facing, solid, [across2], pFace),
    /* וחדירה אמיתית עדיין נחסמת */
    deeper: blocked({ ...facing, depthMm: 620 },
      unitBox({ ...facing, depthMm: 620 }, pFace), [across2], pFace),
    /* R06 */
    straight: proj(flat),
    rotated: proj({ ...flat, rotationDeg: 90 }),
    island: proj(island),
    islandFront: proj({ ...island, free: { ...island.free, headingDeg: 90 } }),
    rulerProjected: rulerSpan(
      { id: 'w1', lengthMm: 4000, heightMm: 2500, features: [] },
      [island], ['corner:start', 'isl'], 'w', proj),
    rulerTouch: rulerSpan(
      { id: 'w1', lengthMm: 4000, heightMm: 2500, features: [] },
      [unit({ id: 'a', xMm: 0, widthMm: 600 }), unit({ id: 'b', xMm: 600, widthMm: 600 })],
      ['a', 'b'], 'w', proj),
    /* R07 */
    units: [inMm, inCm],
    /* R08 */
    retrace: E.shapeCrossing(pts([[500, 500], [4500, 500], [2500, 500]])),
    bowTie: E.shapeCrossing(pts([[500, 500], [4500, 4500], [500, 4500], [4500, 500], [500, 500]])),
    plainRect: E.shapeCrossing(pts([[0, 0], [4000, 0], [4000, 3000], [0, 3000], [0, 0]])),
    concave: E.shapeCrossing(
      pts([[0, 0], [4000, 0], [4000, 2000], [2000, 2000], [2000, 3000], [0, 3000], [0, 0]])),
    openL: E.shapeCrossing(pts([[0, 0], [4000, 0], [4000, 3000]])),
    straightOn: E.shapeCrossing(pts([[0, 0], [2000, 0], [4000, 0], [4000, 3000]])),
  };
});

/* --- R01 --- */
ok('R01 משולש משורטט נקרא חדר סגור', g.triClosed && g.triPoly);
ok('R01 ארגז שפינתו מעבר לקיר המשופע נחסם', g.triFar === true);
ok('R01 והוא באמת בחוץ, ולא רק "תפוס"', g.triFarOutside === true);
ok('R01 ארגז שנכנס במשולש עובר', g.triMid === false);
ok('R01 שרשרת פתוחה אינה מגבילה', g.openFree === false);
ok('R01 וחדר מלבני ממשיך לקבל ארגז רגיל', g.rectFits === false);

/* --- R02 --- */
ok('R02 כיוון השרטוט נקרא מהשטח', JSON.stringify(g.inward) === '[1,-1]',
  JSON.stringify(g.inward));
ok('R02 והארגז נכנס לחדר בשני הכיוונים',
  g.sides[0] === -g.sides[1] && g.sides[0] !== 0, JSON.stringify(g.sides));
ok('R02 בשניהם הוא בתוך המצולע', g.bothInside[0] && g.bothInside[1],
  JSON.stringify(g.bothInside));

/* --- R03 --- */
ok('R03 משטח העבודה נכנס לארון שמעליו — משני הכיוונים',
  g.aOverB === true && g.bOverA === true, `${g.aOverB} / ${g.bOverA}`);
ok('R03 ובלי משטח אותו מקום פנוי', g.bare === false);
ok('R03 והמשטח מגיע גם לחלון שמעליו', g.counterWindow === true);
ok('R03 ובלעדיו החלון פנוי', g.bareWindow === false);

/* --- R04 --- */
ok('R04 רוחב שחורג מקצה הקיר נדחה', /חורג מקצה הקיר/.test(g.overrun || ''), g.overrun);
ok('R04 ומידה שנכנסת בדיוק מתקבלת', g.exact === null, String(g.exact));
ok('R04 וגובה שעובר את התקרה נדחה', /גובה החדר/.test(g.ceiling || ''), g.ceiling);

/* --- R05 --- */
ok('R05 עשרה מ״מ אמיתיים בין החזיתות עוברים', g.clearBody === false);
ok('R05 והתיבה הפיזית היא בדיוק מה שהיה נדחה', g.clearSolid === true,
  'חזית כפולה: ' + JSON.stringify(g.depths));
ok('R05 וחדירה של ממש עדיין נחסמת', g.deeper === true);

/* --- R06 --- */
ok('R06 ארגז ישר: ההיטל הוא רוחבו', near(g.straight.xMm, 0) && near(g.straight.widthMm, 1200)
  && g.straight.frontOn === true, JSON.stringify(g.straight));
ok('R06 ארגז מסובב: ההיטל הוא עומקו, ואין חזית לצייר',
  near(g.rotated.widthMm, 300) && g.rotated.frontOn === false, JSON.stringify(g.rotated));
ok('R06 אי: ההיטל הוא איפה שהוא נופל באמת',
  near(g.island.xMm, 1450) && near(g.island.awayMm, 600), JSON.stringify(g.island));
ok('R06 אי שפונה אל הקיר הזה כן מראה חזית', g.islandFront.frontOn === true);
ok('R06 והסרגל מודד את המרחק, לא "צמוד"',
  g.rulerProjected?.kind === 'gap' && near(g.rulerProjected.gap, 1450),
  `${g.rulerProjected?.kind} ${g.rulerProjected?.gap}`);
ok('R06 ושני ארגזים צמודים נשארים צמודים', g.rulerTouch?.kind === 'touch',
  `${g.rulerTouch?.kind} ${g.rulerTouch?.gap}`);

/* --- R07 --- */
ok('R07 במ״מ הסיומת היא מ״מ', g.units[0] === '250 מ״מ', g.units[0]);
ok('R07 ובס״מ היא ס״מ', g.units[1] === '25 ס״מ', g.units[1]);

/* --- R08 --- */
ok('R08 קיר שחוזר על קודמו נדחה',
  Array.isArray(g.retrace) && g.retrace[2] === 'retrace', JSON.stringify(g.retrace));
ok('R08 עניבה עדיין נדחית', Array.isArray(g.bowTie) && g.bowTie[2] === 'cross',
  JSON.stringify(g.bowTie));
ok('R08 מלבן, חדר קעור וצורת ח מתקבלים',
  g.plainRect === null && g.concave === null && g.openL === null);
ok('R08 והמשך ישר של אותו קו אינו חזרה',
  g.straightOn === null, JSON.stringify(g.straightOn));

/* ------------------------------------------------------------------ */
/* R04 ו-R09 על המסך האמיתי                                            */
/* ------------------------------------------------------------------ */

/* קיר 900, ארגז 600 שנגמר בדיוק בקצה — ואז "רוחב 100 ס״מ" */
const before = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const w = (await db.walls.toArray())[0];
  await db.walls.update(w.id, { lengthMm: 900 });
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, { widthMm: 600, xMm: 300 });
  return { id: u.id, widthMm: 600 };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.getByRole('button', { name: /ביקורת 18.9/ }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^מטבח/ }).first().click().catch(() => {});
await page.waitForTimeout(1300);
await page.locator('svg g[data-unit-id]').first().click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /^100$/ }).first().click().catch(() => {});
await page.waitForTimeout(1100);
await page.screenshot({ path: SP + 'L166-bounds.png' });

const after = await page.evaluate(async (id) => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.get(id))?.widthMm;
}, before.id);
const said = await page.locator('body').innerText();
ok('R04 המסך אינו שומר חריגה מהקיר', after === 600, `${before.widthMm} → ${after}`);
ok('R04 והוא אומר למה', /חורג מקצה הקיר/.test(said),
  (said.split('\n').find((l) => /חורג/.test(l)) || '').slice(0, 80));

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
if (bad.length) process.exitCode = 1;
