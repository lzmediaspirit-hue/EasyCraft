/* שכבה 99 — ממצאי הביקורת, החלק הטהור: תמחור, צבע, מחשבון, קיר, גיבוי */
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');

const out = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const B = await import('/src/costing/boards.ts' + v);
  const W = await import('/src/workflow/unitWork.ts' + v);
  const A = await import('/src/features/design/analysis.ts' + v);
  const BK = await import('/src/db/cabinetPack.ts' + v);
  const M = await import('/src/materials/materialsRepo.ts' + v);

  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

  const settings = await M.settingsRepo.get();
  const mat = { id: 'm1', name: 'סנדוויץ׳', core: 'sandwich', thicknessMm: 17, sheetWidthMm: 1220, sheetHeightMm: 2440, sortOrder: 0, createdAt: 0, updatedAt: 0 };
  const unit = (over = {}) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1', name: 'ארגז',
    glyph: 'base-door2', doors: 2, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 800, heightMm: 880, depthMm: 580,
    socleMm: 100, createdAt: 0, updatedAt: 0, ...over,
  });

  /* --- 7. לוח שנמחק: החלקים שלו נספרים כלא מתומחרים --- */
  /*
   * הצירוף המלא הוא גוון על לוח, ורק לו יש מחיר. ארגז עם לוח בלי
   * גוון הוא מפרט חלקי, ומאז שזמינות הופרדה ממחיר גם הוא נספר
   * כלא מתומחר — ולכן הבקרה החיובית כאן נושאת גוון מתומחר.
   */
  const fin = { id: 'f1', name: 'לבן', hex: '#fff', prices: { m1: { consumerPrice: 120 } }, sortOrder: 0, createdAt: 0, updatedAt: 0 };
  const priced = { carcassMaterialId: 'm1', frontMaterialId: 'm1', backMaterialId: 'm1',
                   carcassFinishId: 'f1', frontFinishId: 'f1', backFinishId: 'f1' };
  const good = B.projectCosting([unit(priced)], [mat], settings, [], [fin]);
  const gone = B.projectCosting([unit({ ...priced, carcassMaterialId: 'x', frontMaterialId: 'x', backMaterialId: 'x' })], [mat], settings, [], [fin]);
  ok('לוח קיים מתומחר', good.totalSheets > 0, `${good.totalSheets}`);
  ok('לוח שנמחק נספר כחלקים בלי לוח', gone.unpricedParts > 0, `unpriced=${gone.unpricedParts}`);
  ok('ולא נעלם בשקט', gone.totalSheets === 0 && good.unpricedParts === 0, `${gone.totalSheets}/${good.unpricedParts}`);

  /* --- 7ב. לוח זמין בלי מחיר אינו נכנס להצעה כאילו הוא בחינם --- */
  const noPrice = { ...fin, id: 'f2', prices: { m1: {} } };
  const vague = B.projectCosting(
    [unit({ ...priced, carcassFinishId: 'f2', frontFinishId: 'f2', backFinishId: 'f2' })],
    [mat], settings, [], [noPrice],
  );
  ok('לוח בלי מחיר נספר כלא מתומחר', vague.unpricedParts > 0, `unpriced=${vague.unpricedParts}`);
  ok('והוא עדיין נחתך', vague.totalSheets > 0, `${vague.totalSheets}`);

  /* --- 11. ארגז עם גב דק שהותקן — ירוק ולא כתום --- */
  const done = unit({ backKind: 'thin', work: { tracks: { carcass: 'installed', fronts: 'installed', back: 'cut' } } });
  ok('גב דק שנחתך + הכול הותקן = מורכב', W.workTone(done) === 'done', W.workTone(done));
  ok('וההתקדמות 100%', W.workProgress([done]) === 1, String(W.workProgress([done])));
  const mid = unit({ backKind: 'thin', work: { tracks: { carcass: 'edged', fronts: 'cut', back: 'cut' } } });
  ok('ארגז באמצע אינו ירוק', W.workTone(mid) !== 'done', W.workTone(mid));
  const noBack = unit({ backKind: 'none', work: { tracks: { carcass: 'assembled', fronts: 'assembled' } } });
  ok('ארגז בלי גב שהורכב = מורכב', W.workTone(noBack) === 'done', W.workTone(noBack));

  /* --- 14. חריגה מהקיר לפי מיקום ולא לפי סכום --- */
  const wall = { id: 'w1', projectId: 'p1', index: 0, name: 'קיר', lengthMm: 3000, heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 };
  const far = A.analyzeWall(wall, [unit({ xMm: 2800, widthMm: 600 })]);
  ok('ארגז שחורג מקצה הקיר מתריע', far.warnings.some((w) => w.text.includes('חורגים')), JSON.stringify(far.warnings.map((w) => w.text)));
  ok('וההתראה מצביעה עליו', far.warnings.some((w) => w.unitIds.includes('u1')));
  const inside = A.analyzeWall(wall, [unit({ xMm: 0, widthMm: 600 })]);
  ok('ארגז שנכנס אינו מתריע', !inside.warnings.length, JSON.stringify(inside.warnings.map((w) => w.text)));

  /* --- 3. חבילה פגומה נדחית --- */
  const noCatalog = JSON.stringify({ app: 'easycraft', format: 3, kind: 'library', tables: { finishes: [] } });
  ok('חבילה בלי ארגזים נדחית', 'error' in BK.readPack(noCatalog), JSON.stringify(BK.readPack(noCatalog)));
  const noKind = JSON.stringify({ app: 'easycraft', format: 1, tables: { catalog: [] } });
  ok('קובץ בלי kind נדחה', 'error' in BK.readPack(noKind));
  const badRow = JSON.stringify({ app: 'easycraft', format: 1, kind: 'library', tables: { catalog: [{ name: 'בלי מזהה' }] } });
  ok('שורה בלי מזהה נדחית', 'error' in BK.readPack(badRow), JSON.stringify(BK.readPack(badRow)));
  const lib = await BK.exportCabinets();
  ok('ייצוא ארגזים מתקבל', !('error' in BK.readPack(JSON.stringify(lib))), JSON.stringify(BK.readPack(JSON.stringify(lib))).slice(0, 120));

  return log;
});

/* --- 13. המחשבון: נקודה מובילה --- */
const calc = await page.evaluate(async () => {
  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
  const src = await (await fetch('/src/ui/QuickCalc.tsx')).text();
  // הפונקציה פנימית לקובץ, ולכן נבדקת דרך אותו ביטוי בדיוק
  const m = src.match(/const tokens = src\.match\((\/[^\n]+\/g)\);/);
  ok('נמצא הביטוי של הפירוק', !!m, m ? m[1] : 'לא נמצא');
  if (m) {
    const re = new RegExp(m[1].slice(1, -2), 'g');
    ok('.5 מפורק כמספר אחד', JSON.stringify('.5'.match(re)) === '[".5"]', JSON.stringify('.5'.match(re)));
    ok('.5+1 מפורק נכון', JSON.stringify('.5+1'.match(re)) === '[".5","+","1"]', JSON.stringify('.5+1'.match(re)));
    ok('0.5 עדיין עובד', JSON.stringify('0.5'.match(re)) === '["0.5"]', JSON.stringify('0.5'.match(re)));
  }
  return log;
});

const all = [...out, ...calc];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);
