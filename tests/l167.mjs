import './_exit.mjs';
/*
 * שכבה 167 — ספרייה שמוחלפת, ולא נערמת.
 *
 * `addShippedCabinets` ו-`applyLibraryUpdate` הם מנגנון ההצעה, והם
 * נכונים לשינוי נקודתי: תבנית שהשתנתה מוצגת, והנגרייה בוחרת. הם
 * אינם נכונים כשספרייה שלמה מוחלפת באחרת — אין "גרסה חדשה של אותו
 * ארגז" למזג, ומה שהיה כאן הוא פשוט ספרייה אחרת. זה קרה כבר פעם:
 * הספרייה הראשונה שנכנסה השאירה שישים ואחת תבניות ישנות מתחת
 * לחדשות, באותם חדרים, ו-`removeSuperseded` נכתב כדי לנקות אחריה
 * ביד.
 *
 * `LIBRARY_GENERATION` הוא מה שהופך את זה לאוטומטי, ופעם אחת לכל
 * החלפה. מה שנבדק כאן הוא ארבעת הדברים שההחלפה מבטיחה: הישן יורד,
 * מה שנמחק פעם חוזר, מה שהנגרייה בנתה בעצמה נשאר, וריצה שנייה
 * אינה עושה דבר.
 */
import { chromium } from 'playwright';

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

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

/* ------------------------------------------------------------------ */
/* התקנה חדשה: הספרייה שנזרעה היא זו שבקוד                             */
/* ------------------------------------------------------------------ */

const fresh = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts');
  const { SHIPPED_LIBRARY, LIBRARY_GENERATION } = await import('/src/catalog/shipped.ts' + v);
  const { SHIPPED_PRODUCTS } = await import('/src/catalog/products.ts' + v);
  const all = await db.catalog.toArray();
  const libIds = new Set(SHIPPED_LIBRARY.map((i) => i.id));
  const want = new Set([...libIds, ...SHIPPED_PRODUCTS.map((p) => p.id)]);
  const s = (await db.settings.toArray())[0];
  return {
    total: all.length,
    want: want.size,
    stray: all.filter((i) => !want.has(i.id)).map((i) => i.code),
    marks: all.filter((i) => !i.releaseMark).length,
    generation: s?.libraryGeneration,
    codeGeneration: LIBRARY_GENERATION,
  };
});
ok('התקנה חדשה מקבלת בדיוק את מה שבקוד', fresh.total === fresh.want,
  `${fresh.total} מתוך ${fresh.want}`);
ok('ואין בה שורה שאינה משם', fresh.stray.length === 0, fresh.stray.join(','));
ok('לכל שורה יש סימון שחרור', fresh.marks === 0, String(fresh.marks));
ok('והדור נרשם מיד, בלי החלפה מיותרת', fresh.generation === fresh.codeGeneration,
  `${fresh.generation} מול ${fresh.codeGeneration}`);

/* ------------------------------------------------------------------ */
/* התקנה ותיקה: הספרייה הישנה יורדת, החדשה נכנסת                       */
/* ------------------------------------------------------------------ */

const up = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts');
  const { replaceLibrary } = await import('/src/catalog/catalogRepo.ts' + v);
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);

  const now = Date.now();
  const ws = (await db.workshops.toArray())[0].id;
  await db.catalog.clear();
  await db.tombstones.clear();

  const stub = (o) => ({
    rooms: ['kitchen'], group: 'base', level: 'floor', glyph: 'doors',
    defaultWidthMm: 600, defaultHeightMm: 800, defaultDepthMm: 580, defaultYMm: 0,
    widthOptionsMm: [600], workshopId: ws, rev: 1, createdAt: now, updatedAt: now, ...o,
  });

  /* ספרייה קודמת: תבניות מובנות שאינן בחדשה */
  const old = ['EC-901', 'EC-902', 'EC-903'].map((code, i) =>
    stub({ id: `old-${i}`, code, name: `ארגז ישן ${i}`, isBuiltin: true, sortOrder: i }));
  /* תבנית מהחדשה שנערכה כאן — ההחלפה דורסת אותה */
  const edited = {
    ...SHIPPED_LIBRARY[0], name: 'שם שהנגר שינה', defaultWidthMm: 1234,
    workshopId: ws, rev: 1, createdAt: now, updatedAt: now,
  };
  /* תבנית מהחדשה שנמחקה פעם — הסימון הישן אינו תשובה לספרייה הזאת */
  const buried = SHIPPED_LIBRARY[1];
  await db.tombstones.put({
    id: `catalog:${buried.id}`, table: 'catalog', rowId: buried.id, workshopId: ws, at: now,
  });
  /* ומה שהנגרייה בנתה בעצמה — לא הגיע עם האפליקציה, ואינו מוחלף */
  const mine = stub({ id: 'mine-1', code: 'QA-1', name: 'הארגז שלי', isBuiltin: false, sortOrder: 99 });

  await db.catalog.bulkPut([...old, edited, mine]);
  const st = (await db.settings.toArray())[0];
  await db.settings.put({ ...st, catalogSeededAt: now - 1000, libraryGeneration: 0 });

  const res = await replaceLibrary();
  const after = await db.catalog.toArray();
  const back = await db.catalog.get(SHIPPED_LIBRARY[0].id);
  return {
    res,
    oldLeft: after.filter((i) => i.id.startsWith('old-')).map((i) => i.code),
    mineKept: !!after.find((i) => i.id === 'mine-1'),
    editedName: back?.name,
    editedWidth: back?.defaultWidthMm,
    wantName: SHIPPED_LIBRARY[0].name,
    wantWidth: SHIPPED_LIBRARY[0].defaultWidthMm,
    buriedBack: !!after.find((i) => i.id === buried.id),
    buriedMark: !!(await db.tombstones.get(`catalog:${buried.id}`)),
    /* ומה שירד באמת סומן כמחוק, כדי שלא יחזור בעדכון הבא */
    oldMarks: (await db.tombstones.toArray()).filter((m) => m.rowId.startsWith('old-')).length,
    again: await replaceLibrary(),
    total: after.length,
  };
});

ok('הספרייה הישנה ירדה', up.oldLeft.length === 0 && up.res.removed === 3,
  `נשארו ${up.oldLeft.join(',') || '—'}, הוסרו ${up.res.removed}`);
ok('ומה שירד סומן כמחוק', up.oldMarks === 3, String(up.oldMarks));
ok('החדשה נכנסה במלואה', up.res.added > 0 && up.total === up.res.added + 1,
  `${up.res.added} נכנסו, ${up.total} בטבלה`);
ok('תבנית שנערכה כאן הוחלפה במה שבקוד',
  up.editedName === up.wantName && up.editedWidth === up.wantWidth,
  `${up.editedName} ${up.editedWidth}`);
ok('תבנית שנמחקה פעם חזרה', up.buriedBack === true);
ok('וסימון המחיקה הישן נוקה', up.buriedMark === false);
ok('ומה שהנגרייה בנתה בעצמה נשאר', up.mineKept === true);
ok('וריצה שנייה אינה עושה דבר',
  up.again.removed === 0 && up.again.added === 0, JSON.stringify(up.again));

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
if (bad.length) process.exitCode = 1;
