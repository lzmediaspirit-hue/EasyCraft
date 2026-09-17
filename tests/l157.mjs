import './_exit.mjs';
/*
 * שכבה 157 — A04/A05/A12/A15/A16, S01, ומידות פנימיות.
 *
 * דרישה בסיסית שאין לה יחידה בספרייה נמחקה לפני הניקוד, ולכן
 * אמבטיה בלי ארגז כיור קיבלה 100. "אי מגירות" לא עשה דבר.
 * בחירת הרוחב הייתה חמדנית. משולש העבודה חיבר קואורדינטות
 * מקומיות משני קירות. מרכוז התעלם מסיבוב. והסרגל צייר קו של
 * 100 מ״מ וכתב עליו אפס.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { planRoom } = await import('/src/features/design/planRoom.ts' + v);
  const { buildPlan } = await import('/src/features/design/plan.ts' + v);
  const { rulerSpan, rulerLabel } = await import('/src/features/design/wallRuler.tsx' + v);
  const { interiorDims } = await import('/src/features/design/interior.ts' + v);
  const { alongWallMm } = await import('/src/db/types.ts' + v);

  const wall = (over = {}) => ({
    id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const item = (over) => ({
    id: 'i-' + Math.random(), name: 'ארגז', glyph: 'doors',
    rooms: ['bathroom'], group: 'base', level: 'floor',
    defaultWidthMm: 600, defaultHeightMm: 880, defaultDepthMm: 580, defaultYMm: 0,
    widthOptionsMm: [600], socleMm: 100, counterMm: 0,
    isBuiltin: false, sortOrder: 1, createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });

  /* A04 — אמבטיה בלי ארגז כיור בספרייה */
  const walls = [wall({ lengthMm: 6000 })];
  const plan = buildPlan(walls, []);
  const noSink = planRoom({
    room: 'bathroom', walls, plan,
    items: [item({ name: 'ארון תחתון', glyph: 'drawers' }), item({ name: 'ארון עליון', glyph: 'doors', level: 'wall' })],
    options: { mirror: false, column: false, laundry: false },
  });

  /* A12 — קיר 1,400: ארון מדפים 500/900 וארון תלייה 600 */
  const bedWall = [wall({ lengthMm: 1400 })];
  const bedPlan = buildPlan(bedWall, []);
  const shelves = item({
    rooms: ['bedroom'], name: 'ארון מדפים', glyph: 'shelves', level: 'tall',
    defaultWidthMm: 900, widthOptionsMm: [500, 900], defaultHeightMm: 2400, defaultDepthMm: 600,
  });
  const hang = item({
    rooms: ['bedroom'], name: 'ארון תלייה', glyph: 'hang', level: 'tall',
    defaultWidthMm: 600, widthOptionsMm: [600], defaultHeightMm: 2400, defaultDepthMm: 600,
  });
  const bedroom = planRoom({
    room: 'bedroom', walls: bedWall, plan: bedPlan,
    items: [shelves, hang],
    options: { double: false, shelves: true, dresser: false, upper: false },
  });

  /* A05 — אי מגירות בחדר ארונות */
  const closetWalls = [wall({ lengthMm: 5000 }), wall({ lengthMm: 5000, turnDeg: 90 }),
    wall({ lengthMm: 5000, turnDeg: 90 }), wall({ lengthMm: 5000, turnDeg: 90 })];
  const closetPlan = buildPlan(closetWalls, []);
  const closetItems = [
    item({ rooms: ['closet'], name: 'ארון תלייה', glyph: 'hang', level: 'tall', defaultHeightMm: 2400, defaultDepthMm: 600 }),
    item({ rooms: ['closet'], name: 'ארון מדפים', glyph: 'shelves', level: 'tall', defaultHeightMm: 2400, defaultDepthMm: 600 }),
    item({ rooms: ['closet'], name: 'אי', glyph: 'doors', island: true, level: 'floor',
      defaultWidthMm: 1200, defaultDepthMm: 900, defaultHeightMm: 880 }),
  ];
  const noIsland = planRoom({ room: 'closet', walls: closetWalls, plan: closetPlan, items: closetItems,
    options: { double: false, drawers: false, shoes: false, island: false } });
  const withIsland = planRoom({ room: 'closet', walls: closetWalls, plan: closetPlan, items: closetItems,
    options: { double: false, drawers: false, shoes: false, island: true } });

  /* S01 — הסרגל */
  const u = (over) => ({
    id: 'u', projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'a', glyph: 'doors',
    level: 'floor', xMm: 0, yMm: 0, widthMm: 600, heightMm: 900, depthMm: 580,
    createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const units = [u({ id: 'a', xMm: 0 }), u({ id: 'b', xMm: 500 })];
  const over = rulerSpan(wall(), units, ['a', 'b'], 'w');
  const touch = rulerSpan(wall(), [u({ id: 'a', xMm: 0 }), u({ id: 'b', xMm: 600 })], ['a', 'b'], 'w');
  const gap = rulerSpan(wall(), [u({ id: 'a', xMm: 0 }), u({ id: 'b', xMm: 800 })], ['a', 'b'], 'w');

  /* מידות פנימיות: 800 עם דפנות 18 → 764; עם מחיצה → 373 לכל תא */
  const plain = interiorDims(u({ widthMm: 800, heightMm: 720, socleMm: 0 }));
  const twoCells = interiorDims(u({
    widthMm: 800, heightMm: 720, socleMm: 0,
    zones: [{ id: 'z', heightMm: 720, kind: 'shelves',
      columns: [
        { id: 'c1', widthShare: 0.5, kind: 'shelves', shelves: 0 },
        { id: 'c2', widthShare: 0.5, kind: 'shelves', shelves: 0 },
      ] }],
  }));

  return {
    noSinkScore: noSink.map((p) => p.score.total),
    noSinkDropped: noSink[0]?.dropped ?? [],
    bedWidths: bedroom[0]?.units.map((x) => x.widthMm) ?? [],
    bedDropped: bedroom[0]?.dropped ?? [],
    islandOff: noIsland[0]?.units.filter((x) => x.free).length ?? 0,
    islandOn: withIsland[0]?.units.filter((x) => x.free).length ?? 0,
    over: { kind: over.kind, overlapMm: over.overlapMm, label: rulerLabel(over) },
    touch: { kind: touch.kind, label: rulerLabel(touch) },
    gap: { kind: gap.kind, gap: gap.gap },
    clearW: plain.find((d) => d.label.includes('רוחב נקי'))?.mm,
    cellW: twoCells.find((d) => d.label.includes('רוחב נקי לכל תא'))?.mm,
    rotated: alongWallMm({ widthMm: 1000, depthMm: 400, rotationDeg: 90 }),
  };
});

/* A04 */
ok('אמבטיה בלי ארגז כיור אינה מקבלת 100',
  r.noSinkScore.every((t) => t <= 50), r.noSinkScore.join());
ok('והחוסר נאמר בשמו',
  r.noSinkDropped.some((d) => d.includes('ארון כיור')), r.noSinkDropped.join(' · '));

/* A12 */
ok('500 ועוד 600 נכנסים במקום 900 לבד',
  r.bedWidths.includes(500) && r.bedWidths.includes(600), r.bedWidths.join());
ok('ולא מדווח שאין מקום לתלייה',
  !r.bedDropped.some((d) => d.includes('ארון תלייה')), r.bedDropped.join(' · '));

/* A05 */
ok('בלי הסימון אין אי', r.islandOff === 0, String(r.islandOff));
ok('ועם הסימון האי מונח', r.islandOn === 1, String(r.islandOn));

/* S01 */
ok('חפיפה נאמרת כחפיפה', r.over.kind === 'overlap' && r.over.overlapMm === 100,
  JSON.stringify(r.over));
ok('ולא כאפס', /חפיפה/.test(r.over.label), r.over.label);
ok('מגע נאמר כמגע', r.touch.kind === 'touch' && r.touch.label === 'צמוד', JSON.stringify(r.touch));
ok('ומרווח נשאר מרווח', r.gap.kind === 'gap' && r.gap.gap === 200, JSON.stringify(r.gap));

/* מידות פנימיות */
ok('רוחב נקי של 800 עם דפנות 18 הוא 764', r.clearW === 764, String(r.clearW));
ok('ועם מחיצה אחת — 373 לכל תא', r.cellW === 373, String(r.cellW));

/* A16 */
ok('ארגז מסובב תופס על הקיר את עומקו', r.rotated === 400, String(r.rotated));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
