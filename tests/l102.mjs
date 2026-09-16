import './_exit.mjs';
/* שכבה 102 — מודל אחד: עובי הלוח שנבחר, מעטפת הארגז, וגוונים בשרטוט */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/');

const out = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const B = await import('/src/costing/boards.ts' + v);
  const S = await import('/src/features/design/isoScene.ts' + v);
  const M = await import('/src/materials/materialsRepo.ts' + v);

  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
  const settings = await M.settingsRepo.get();

  const unit = (over = {}) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1', name: 'ארגז',
    glyph: 'doors', doors: 2, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 700, heightMm: 880, depthMm: 580,
    socleMm: 0, createdAt: 0, updatedAt: 0, ...over,
  });

  /* --- N1: הארגז נחתך לפי עובי הלוח שנבחר לו --- */
  const thin = { id: 'm17', name: 'סנדוויץ׳ 17', core: 'sandwich', thicknessMm: 17,
    sheetWidthMm: 1220, sheetHeightMm: 2440, sortOrder: 0, createdAt: 0, updatedAt: 0 };
  const parts = { ...settings, carcassThicknessMm: 18, thicknessById: { m17: 17 } };
  const u600 = unit({ widthMm: 600, carcassMaterialId: 'm17', frontMaterialId: 'm17' });
  const deck = (u) => B.unitParts(u, parts).find((p) => p.label === 'תחתית ותקרה');
  const bottom = deck(u600);
  ok('חלקי הגוף נחתכים לפי 17 ולא לפי 18', bottom?.widthMm === 600 - 2 * 17, JSON.stringify(bottom));
  const noBoard = deck(unit({ widthMm: 600 }));
  ok('ולוח בלי עובי נופל להגדרה הכללית', noBoard?.widthMm === 600 - 2 * 18, JSON.stringify(noBoard));
  ok('והפותר מחזיר את העובי של הלוח', B.partThicknessMm(u600, 'carcass', parts) === 17);
  void thin;

  /* --- V3: דופן זרה בתוך המעטפת ולא מעליה --- */
  const wall = { id: 'w1', projectId: 'p1', index: 0, name: 'קיר', lengthMm: 4000,
    heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 };
  const scene = (units, extra = {}) =>
    S.buildScene({
      walls: [wall], units, activeWallId: 'w1', selectedId: null, inside: false,
      finishHex: { red: '#ff0000', blue: '#0000ff', green: '#00ff00' },
      present: false, view: { yawDeg: -30, riseDeg: 20, rise: 0.5 }, ...extra,
    });

  const exposed = unit({ exposed: { start: true, end: true, top: true } });
  const mine = scene([exposed]).solids.filter((s) => s.unitId === 'u1');
  const minX = Math.min(...mine.map((s) => s.lo[0]));
  const maxX = Math.max(...mine.map((s) => s.hi[0]));
  const maxY = Math.max(...mine.filter((s) => !s.key.endsWith('-cnt')).map((s) => s.hi[1]));
  ok('הארגז מצויר בתוך הרוחב שהוגדר לו', minX >= -0.01 && maxX <= 700.01, `${minX}..${maxX}`);
  ok('וגם בתוך הגובה שלו', maxY <= 880.01, String(maxY));
  const plain = scene([unit()]).solids.filter((s) => s.unitId === 'u1');
  ok('ובלי דפנות זרות שום דבר לא השתנה',
    Math.min(...plain.map((s) => s.lo[0])) >= -0.01 &&
    Math.max(...plain.map((s) => s.hi[0])) <= 700.01);

  /* --- V4: גוון ברירת המחדל של הפרויקט מגיע לשרטוט --- */
  const project = {
    id: 'p1', customerId: 'c', name: 'בדיקה', roomKind: 'kitchen', createdAt: 0, updatedAt: 0,
    defaults: { front: { finishId: 'red' }, carcass: { finishId: 'blue' } },
  };
  const withDefaults = scene([unit()], { project }).solids.filter((s) => s.unitId === 'u1');
  ok('החזית מקבלת את גוון הפרויקט',
    withDefaults.some((s) => s.tone === '#ff0000'),
    [...new Set(withDefaults.map((s) => s.tone))].join(','));
  ok('והגוף את שלו',
    withDefaults.some((s) => s.tone.toLowerCase().includes('00') && s.tone !== '#ff0000'),
    [...new Set(withDefaults.map((s) => s.tone))].join(','));
  const override = scene([unit({ frontFinishId: 'green' })], { project }).solids
    .filter((s) => s.unitId === 'u1');
  ok('וגוון שנבחר לארגז גובר על הפרויקט',
    override.some((s) => s.tone === '#00ff00') && !override.some((s) => s.tone === '#ff0000'),
    [...new Set(override.map((s) => s.tone))].join(','));

  /* --- V5: גוון הגב --- */
  const openBox = unit({ doors: 0, carcassFinishId: 'blue', backFinishId: 'green', backKind: 'thin' });
  const backSolid = scene([openBox]).solids.find((s) => s.unitId === 'u1' && s.key.includes('-bk'));
  ok('הגב נצבע בגוון שנבחר לו ולא בגוון הגוף', !!backSolid && backSolid.tone !== '#0000db',
    JSON.stringify(backSolid && { key: backSolid.key, tone: backSolid.tone }));
  const green = backSolid && parseInt(backSolid.tone.slice(3, 5), 16) > parseInt(backSolid.tone.slice(5, 7), 16);
  ok('והוא באמת ירקרק', !!green, backSolid?.tone);
  return log;
});

for (const l of out) console.log(l);
const bad = out.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${out.length}` : `all ${out.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);
