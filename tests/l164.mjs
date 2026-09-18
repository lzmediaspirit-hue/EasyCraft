import './_exit.mjs';
/*
 * שכבה 164 — שבעת הממצאים של ביקורת 18.9, וכפתור משטח העבודה.
 *
 * B01 — שינוי מידה מספרי שמר חפיפה שהגרירה הייתה פוסלת.
 * B02 — משטח העבודה לא נספר בהתנגשות ולא בסרגל האנכי.
 * B03 — התכנון האוטומטי נכשל בפינת הסגירה של חדר מלבני.
 * B04 — המידה הפנימית לא תאמה את הלוחות שנבנו בפועל.
 * B05 — הסרגל ניפח חפיפה כשקטע אחד מוכל בשני.
 * B06 — חדר מצויר שחוצה את עצמו נשמר בלי שאלה.
 * B07 — זכוכית התנור נצבעה מתחת לדלת המתכת.
 *
 * ובנוסף: "משטח עבודה" נערך על ארגז מונח, ולא רק בספרייה.
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
const btn = (re) => page.getByRole('button', { name: re }).first();
const near = (a, b, tol = 0.6) => Math.abs(a - b) < tol;

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* B02 · B04 · B05 · B06 · B07 — המודל                                 */
/* ------------------------------------------------------------------ */

const m = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const I = await import('/src/features/design/interior.ts' + v);
  const S = await import('/src/features/design/isoScene.ts' + v);
  const C = await import('/src/features/design/collision.ts' + v);
  const P = await import('/src/features/design/placement.ts' + v);
  const PL = await import('/src/features/design/plan.ts' + v);
  const R = await import('/src/features/design/wallRuler.tsx' + v);
  const E = await import('/src/features/projects/RoomShapeEditor.tsx' + v);

  const wall = {
    id: 'w', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0,
  };
  const u = (o = {}) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c', name: 'ארגז',
    glyph: 'doors', doors: 2, level: 'floor', socleMm: 0, counterMm: 0,
    xMm: 0, yMm: 0, widthMm: 800, heightMm: 800, depthMm: 580,
    createdAt: 0, updatedAt: 0, ...o,
  });

  /* --- B04: התווית מול הפאות שנבנו --- */
  const view = { yawDeg: 0, rise: 0.5, zoom: 1 };
  const panelsOf = (unit) =>
    S.buildScene({
      walls: [wall], units: [unit], activeWallId: 'w', selectedId: null,
      inside: true, finishHex: {}, present: false, view,
    })
      .solids.filter((sd) => /sh-|-b$|-t$/.test(String(sd.key)))
      .map((sd) => [sd.lo[1], sd.hi[1]])
      .sort((a, b) => a[0] - b[0]);
  const interior = [0, 1, 2, 3].map((shelves) => {
    const unit = u({ glyph: 'shelves', shelves });
    return { shelves, cells: I.interiorCells(unit), panels: panelsOf(unit) };
  });

  /* --- B02: ארון מעל משטח עבודה --- */
  const base = u({ id: 'base', counterMm: 40 });
  const bare = u({ id: 'base', counterMm: 0 });
  const upper = u({ id: 'upper', yMm: 810, heightMm: 600, level: 'wall', depthMm: 320 });
  const hit = (below) => {
    const plan = PL.buildPlan([wall], [below, upper]);
    const box = P.solidBox(upper, plan);
    return box ? C.blocked(upper, box, [below], plan) : null;
  };

  /* --- B05: חיתוך קטעים --- */
  const wide = u({ id: 'wide', xMm: 0, widthMm: 1000 });
  const small = u({ id: 'small', xMm: 100, widthMm: 200, yMm: 900, level: 'wall' });
  const sameStart = u({ id: 'same', xMm: 0, widthMm: 200, yMm: 900, level: 'wall' });
  const apart = u({ id: 'far', xMm: 1200, widthMm: 300, yMm: 900, level: 'wall' });
  const partial = u({ id: 'part', xMm: 900, widthMm: 300, yMm: 900, level: 'wall' });
  const span = (a, b, ids, axis) => R.rulerSpan(wall, [a, b], ids, axis);

  /* --- B06: טופולוגיה --- */
  const pts = (list) => list.map(([x, y]) => ({ x, y }));

  /* --- B07: סדר הציור של המכשירים --- */
  const paint = {};
  for (const type of ['oven', 'micro', 'ovenMicro']) {
    paint[type] = [0, 35, 75].map((yawDeg) => {
      const app = u({
        glyph: type, applianceType: type, doors: 0,
        xMm: 1000, widthMm: 600, heightMm: 900,
      });
      const keys = S.buildScene({
        walls: [wall], units: [app], activeWallId: 'w', selectedId: null,
        inside: false, finishHex: {}, present: false, view: { yawDeg, rise: 0.5, zoom: 1 },
      }).faces.map((f) => String(f.key ?? ''));
      return {
        glass: keys.findIndex((k) => k.includes('glass')),
        door: keys.findIndex((k) => k.includes('door')),
      };
    });
  }

  return {
    interior,
    counterBlocks: hit(base),
    bareAllows: hit(bare),
    counterRuler: span(base, upper, ['base', 'upper'], 'h'),
    contains: span(wide, small, ['wide', 'small'], 'w'),
    reversed: span(wide, small, ['small', 'wide'], 'w'),
    sameStart: span(wide, sameStart, ['wide', 'same'], 'w'),
    apart: span(wide, apart, ['wide', 'far'], 'w'),
    partial: span(wide, partial, ['wide', 'part'], 'w'),
    bowTie: E.shapeCrossing(pts([[500,500],[4500,4500],[500,4500],[4500,500],[500,500]])),
    rect: E.shapeCrossing(pts([[0,0],[4000,0],[4000,3000],[0,3000],[0,0]])),
    rectBack: E.shapeCrossing(pts([[0,0],[0,3000],[4000,3000],[4000,0],[0,0]])),
    concave: E.shapeCrossing(pts([[0,0],[4000,0],[4000,2000],[2000,2000],[2000,3000],[0,3000],[0,0]])),
    open: E.shapeCrossing(pts([[0,0],[4000,0],[4000,3000]])),
    retraced: E.shapeCrossing(pts([[0,0],[4000,0],[2000,0],[2000,3000]])),
    paint,
  };
});

/* --- B04 --- */
const noShelf = m.interior[0];
ok('B04 ארגז 800 עם לוח 18 מצהיר על 764 נקי',
  noShelf.cells.length === 1 && near(noShelf.cells[0].heightMm, 764),
  String(noShelf.cells[0]?.heightMm));
ok('B04 והתא מתחיל מעל התחתית ולא מהרצפה', near(noShelf.cells[0].yMm, 18),
  String(noShelf.cells[0]?.yMm));
for (const { shelves, cells, panels } of m.interior) {
  /* בין כל שני לוחות עוקבים יושב בדיוק תא אחד, באותה מידה */
  const gaps = panels.slice(0, -1).map((p, i) => [p[1], panels[i + 1][0]]);
  const same =
    gaps.length === cells.length &&
    gaps.every(([from, to], i) => near(cells[i].yMm, from) && near(cells[i].heightMm, to - from));
  ok(`B04 ${shelves} מדפים: התווית היא המרחק בין הלוחות`, same,
    `תוויות ${cells.map((c) => Math.round(c.heightMm * 10) / 10).join()} מול ${gaps.map(([a, b]) => Math.round((b - a) * 10) / 10).join()}`);
}
ok('B04 ושלושה מדפים הם ארבעה מרווחים שווים',
  m.interior[3].cells.length === 4 && m.interior[3].cells.every((c) => near(c.heightMm, 177.5)),
  m.interior[3].cells.map((c) => c.heightMm).join());

/* --- B02 --- */
ok('B02 ארון שנכנס לתוך משטח העבודה נחסם', m.counterBlocks === true, String(m.counterBlocks));
ok('B02 ובלי משטח אותו מקום פנוי', m.bareAllows === false, String(m.bareAllows));
ok('B02 והסרגל אומר חפיפה ולא רווח',
  m.counterRuler.kind === 'overlap' && near(m.counterRuler.overlapMm, 30),
  `${m.counterRuler.kind} ${m.counterRuler.overlapMm}`);

/* --- B05 --- */
ok('B05 קטע שמוכל בשני נמדד כחיתוך', near(m.contains.overlapMm, 200), String(m.contains.overlapMm));
ok('B05 והתשובה אינה תלויה בסדר הבחירה', near(m.reversed.overlapMm, 200), String(m.reversed.overlapMm));
ok('B05 גם בהתחלה משותפת', near(m.sameStart.overlapMm, 200), String(m.sameStart.overlapMm));
ok('B05 רווח רגיל נשאר רווח', m.apart.kind === 'gap' && near(m.apart.gap, 200),
  `${m.apart.kind} ${m.apart.gap}`);
ok('B05 וחפיפה חלקית נשארת נכונה', near(m.partial.overlapMm, 100), String(m.partial.overlapMm));

/* --- B06 --- */
ok('B06 צורת עניבה נתפסת', Array.isArray(m.bowTie), JSON.stringify(m.bowTie));
ok('B06 מלבן מתקבל בשני כיווני הסיבוב', m.rect === null && m.rectBack === null,
  `${JSON.stringify(m.rect)} / ${JSON.stringify(m.rectBack)}`);
ok('B06 חדר קעור מתקבל', m.concave === null, JSON.stringify(m.concave));
ok('B06 תכנית פתוחה מתקבלת', m.open === null, JSON.stringify(m.open));
ok('B06 וקו שחוזר על עצמו נדחה', Array.isArray(m.retraced), JSON.stringify(m.retraced));

/* --- B07 --- */
for (const [type, angles] of Object.entries(m.paint)) {
  ok(`B07 ${type}: הזכוכית נצבעת אחרי הדלת בכל הזוויות`,
    angles.every((a) => a.glass > a.door && a.door >= 0),
    angles.map((a) => `${a.glass}>${a.door}`).join(' '));
}

/* ------------------------------------------------------------------ */
/* B01 + משטח עבודה — במסך                                             */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'ביקורת 18.9' });
await addUnit(page, 0);
await page.waitForTimeout(700);

/* משטח עבודה נערך על ארגז מונח */
/*
 * הגובה נקרא לפני העריכה ולא נכתב כמספר: הוא בא מהספרייה, והיא
 * מוחלפת. מה שנבדק הוא שהמשטח אינו נוגע בו, ולא כמה הוא.
 */
const bodyBefore = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray())[0]?.heightMm;
});
const counter = page.getByLabel('משטח עבודה');
ok('משטח עבודה נערך בעורך הארגז', (await counter.count()) === 1);
await counter.fill('4');
await page.waitForTimeout(900);
const withCounter = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const u = (await db.units.toArray())[0];
  return { counterMm: u.counterMm, heightMm: u.heightMm };
});
ok('והמשטח נשמר', withCounter.counterMm === 40, JSON.stringify(withCounter));
ok('בלי להרים את גוף הארון', withCounter.heightMm === bodyBefore,
  `${bodyBefore} → ${withCounter.heightMm}`);
await counter.fill('0');
await page.waitForTimeout(700);

/* B01 — שני ארגזי 600, ב-0 וב-700 */
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(500);
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, { xMm: 0, widthMm: 600, counterMm: 0 });
  const { id: _id, ...rest } = u;
  await db.units.add({ ...rest, id: 'u-two', name: 'שכן', xMm: 700, widthMm: 600, counterMm: 0 });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await btn(/ביקורת 18/).click().catch(() => {});
await page.waitForTimeout(900);
await btn(/^מטבח/).click().catch(() => {});
await page.waitForTimeout(1500);

await page.locator('svg g[data-unit-id]').first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /^100$/ }).first().click();
await page.waitForTimeout(1100);
await page.screenshot({ path: SP + 'L164-refused.png' });

ok('B01 המסך אומר למה המידה לא נשמרה',
  /נכנס לתוך מה שכבר עומד/.test(await page.innerText('body')));
const after = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).map((u) => ({ x: u.xMm, w: u.widthMm })).sort((a, b) => a.x - b.x);
});
ok('B01 ושום חפיפה לא נשמרה', after[0].w === 600 && after[1].x === 700,
  JSON.stringify(after));
ok('B01 והשכן לא הוזז בשקט', after[1].w === 600, JSON.stringify(after));

/* ומידה חוקית עדיין נשמרת */
await page.getByRole('button', { name: /^70$/ }).first().click();
await page.waitForTimeout(1100);
const valid = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).map((u) => u.widthMm).sort((a, b) => a - b);
});
ok('B01 ומידה חוקית כן נשמרת', valid.includes(700), JSON.stringify(valid));

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
if (bad.length) process.exitCode = 1;
