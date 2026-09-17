import './_exit.mjs';
/*
 * שכבה 156 — A01/A02/A06/A07/A08: גאומטריה אמיתית.
 *
 * הפתירה בדקה כל יחידה לעצמה, ולכן הצעה שלמה עברה גם כשהארגזים
 * חדרו זה לזה ובלעו עמוד. ההכלה התירה לכל גוף צר יותר להיכנס
 * לתוך אחר. מעטפת הדלת חילקה את רוחב הארגז במספר הכנפיים בכל
 * הקומות יחד. ומגירה פנימית לא קיבלה מעטפת שליפה בכלל.
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
  const { resolvePlan } = await import('/src/features/design/planResolve.ts' + v);
  const { unitEnvelopes } = await import('/src/features/design/envelope.ts' + v);
  const { buildPlan } = await import('/src/features/design/plan.ts' + v);
  const { unitsClash } = await import('/src/features/design/collision.ts' + v);
  const { unitBox, solidBox, frontOverhangMm } = await import('/src/features/design/placement.ts' + v);

  const defaults = { drawerBox: 'wood', backKind: 'thin', socleMm: 100 };
  const item = (over) => ({
    id: 'i-' + Math.random(), name: 'ארגז', glyph: 'doors',
    rooms: ['kitchen'], group: 'base', level: 'floor',
    defaultWidthMm: 600, defaultHeightMm: 880, defaultDepthMm: 580, defaultYMm: 0,
    widthOptionsMm: [600], socleMm: 100, counterMm: 30, doors: 2,
    isBuiltin: false, sortOrder: 1, createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const wall = (over = {}) => ({
    id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const place = (over = {}) => ({
    catalogKey: 'k', wallId: 'w1', xMm: 0, widthMm: 600, level: 'floor', role: 'prep', ...over,
  });
  const run = (placements, items, walls) =>
    resolvePlan({ placements, items, walls, defaults, room: 'kitchen' });

  const one = item({ id: 'k' });

  /* A01 — שני ארגזים באותו מקום */
  const overlap = run([place({ xMm: 0 }), place({ xMm: 300 })], [one], [wall()]);
  /* אותם שניים, זה לצד זה */
  const apart = run([place({ xMm: 0 }), place({ xMm: 600 })], [one], [wall()]);
  /* A01 — חריגה מקצה הקיר */
  const past = run([place({ xMm: 3800 })], [one], [wall()]);
  /* A01 — x שלילי */
  const before = run([place({ xMm: -100 })], [one], [wall()]);
  /* A01 — קיר שאינו קיים */
  const noWall = run([place({ wallId: 'nope' })], [one], [wall()]);
  /* A01 — עמוד במקום שבו מונח הארגז */
  const pillar = wall({
    features: [{ id: 'p1', kind: 'pillar', xMm: 200, yMm: 0, widthMm: 400, heightMm: 2600, depthMm: 400 }],
  });
  const onPillar = run([place({ xMm: 100 })], [one], [pillar]);

  /* A06 — חזית סגורה נכללת בגוף */
  const plan = buildPlan([wall()], []);
  const u = (over) => ({
    id: 'u', projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'a', glyph: 'doors',
    doors: 2, level: 'floor', xMm: 0, yMm: 0, widthMm: 800, heightMm: 900, depthMm: 580,
    createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const frontMm = frontOverhangMm(u({}));

  /* A06 — ארגז מלא אינו מארח ארגז אחר */
  const host = u({ id: 'h', widthMm: 1000, heightMm: 2000, depthMm: 600, doors: 0, shelves: 4,
    zones: [{ id: 'z', heightMm: 2000, kind: 'shelves', shelves: 4 }] });
  const guest = u({ id: 'g', xMm: 100, widthMm: 800, heightMm: 2000, depthMm: 2000, doors: 0 });
  const swallowed = unitsClash(
    { unit: host, box: solidBox(host, plan) },
    { unit: guest, box: solidBox(guest, plan) },
  );

  /* A07 — שתי קומות חזית, בכל אחת שתי דלתות */
  const split = u({
    widthMm: 800, heightMm: 1600, doors: 2,
    zones: [
      { id: 'a', heightMm: 800, kind: 'shelves', shelves: 1, doors: 2 },
      { id: 'b', heightMm: 800, kind: 'shelves', shelves: 1, frontSplit: true, doors: 2 },
    ],
  });
  const doorEnv = unitEnvelopes(split, plan).filter((e) => e.kind === 'cabinetDoor');

  /* A08 — מגירות פנימיות מאחורי דלת */
  const inner = u({
    widthMm: 800, heightMm: 900, doors: 2,
    zones: [{ id: 'z', heightMm: 900, kind: 'drawers', drawers: 3, drawerCols: 1, drawerStyle: 'inner' }],
  });
  const innerEnv = unitEnvelopes(inner, plan).filter((e) => e.kind === 'drawer');

  /* A08 — מגירות בתוך עמודה של אזור */
  const column = u({
    widthMm: 900, heightMm: 900, doors: 0,
    zones: [{
      id: 'z', heightMm: 900, kind: 'shelves',
      columns: [
        { id: 'c1', widthShare: 0.5, kind: 'shelves', shelves: 2 },
        { id: 'c2', widthShare: 0.5, kind: 'drawers', drawers: 3, drawerStyle: 'outer' },
      ],
    }],
  });
  const colEnv = unitEnvelopes(column, plan).filter((e) => e.kind === 'drawer');

  return {
    overlap: overlap.issues.map((i) => i.kind),
    apart: apart.issues.length,
    past: past.issues.map((i) => i.kind),
    before: before.issues.map((i) => i.kind),
    noWall: noWall.issues.map((i) => i.kind),
    onPillar: onPillar.issues.map((i) => i.kind),
    frontMm,
    bodyD: unitBox(u({}), plan).d,
    solidD: solidBox(u({}), plan).d,
    swallowed,
    doorEnvCount: doorEnv.length,
    doorReach: doorEnv.map((e) => Math.round(e.box.d)),
    doorHeights: doorEnv.map((e) => Math.round(e.box.h)),
    innerEnv: innerEnv.length,
    colEnv: colEnv.length,
  };
});

/* A01 */
ok('שני ארגזים באותו מקום נעצרים', r.overlap.includes('overlap'), r.overlap.join());
ok('וזה לצד זה עובר', r.apart === 0, String(r.apart));
ok('ארגז שחורג מקצה הקיר נעצר', r.past.includes('bounds'), r.past.join());
ok('ומיקום שלילי נעצר', r.before.includes('bounds'), r.before.join());
ok('קיר שאינו קיים נעצר', r.noWall.includes('wall'), r.noWall.join());
ok('וארגז שעומד על עמוד נעצר', r.onPillar.includes('overlap'), r.onPillar.join());

/* A06 */
ok('החזית הסגורה נכללת בגוף', r.frontMm === 18 && r.solidD === r.bodyD + 18,
  `גוף=${r.bodyD} מלא=${r.solidD}`);
ok('ארגז מלא אינו מארח ארגז אחר', r.swallowed === true, String(r.swallowed));

/* A07 */
ok('מעטפת לכל קומת חזית בנפרד', r.doorEnvCount === 2, String(r.doorEnvCount));
ok('וכל כנף מגיעה לחצי הרוחב', r.doorReach.every((d) => d === 400), r.doorReach.join());
ok('בגובה הקומה שלה', r.doorHeights.every((h) => h === 800), r.doorHeights.join());

/* A08 */
ok('מגירה פנימית מקבלת מעטפת שליפה', r.innerEnv === 1, String(r.innerEnv));
ok('וגם מגירה בתוך עמודה', r.colEnv === 1, String(r.colEnv));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
