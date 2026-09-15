/** משימה 98: גיבוי והעברה — הוצאת הנתונים מהמכשיר והחזרתם. */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const picker = () => dlg().getByLabel('בחירת קובץ גיבוי');
const TMP = '/tmp/l98-files';
await import('node:fs').then((fs) => fs.mkdirSync(TMP, { recursive: true }));

/** לוחצים על כפתור ייצוא, ומקבלים את מה שירד — כקובץ, לא כטקסט */
async function download(name) {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    dlg().getByRole('button', { name, exact: true }).click(),
  ]);
  const path = `${TMP}/${dl.suggestedFilename()}`;
  await dl.saveAs(path);
  const fs = await import('node:fs');
  return { path, name: dl.suggestedFilename(), json: JSON.parse(fs.readFileSync(path, 'utf8')) };
}

/** כותב גיבוי לקובץ ובוחר אותו בבורר — כמו שהמשתמש עושה */
async function choose(obj, file = 'pick.json') {
  const fs = await import('node:fs');
  const path = `${TMP}/${file}`;
  fs.writeFileSync(path, typeof obj === 'string' ? obj : JSON.stringify(obj));
  await picker().setInputFiles(path);
  await page.waitForTimeout(400);
}
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
};

/** מה שבאמת יושב בבסיס הנתונים, ולא מה שהמסך מספר */
const counts = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts?v=' + Date.now());
    const catalog = await db.catalog.toArray();
    return {
      catalog: catalog.length,
      shown: catalog.filter((i) => !i.hiddenAt).length,
      customers: await db.customers.count(),
      projects: await db.projects.count(),
      units: await db.units.count(),
      walls: await db.walls.count(),
      names: catalog.map((i) => i.name),
      codes: catalog.map((i) => i.code),
    };
  });

await setup(page, { name: 'שכבה 98' });
await addUnit(page, 0);
await page.waitForTimeout(600);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);
const before = await counts();
ok('נבנה פרויקט עם ארגז', before.units >= 1 && before.customers === 1, JSON.stringify({ u: before.units, c: before.customers }));

/* ---- המסך ---- */
/* רענון מחזיר למסך הבית, ומשם "הגדרות" הוא ההגדרות ולא הגדרות הקיר */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn('הגדרות').click(); await page.waitForTimeout(900);
ok('יש מדור גיבוי בהגדרות', (await page.innerText('main')).includes('גיבוי והעברה'));
await btn(/גיבוי והעברת נתונים/).click(); await page.waitForTimeout(700);
await page.screenshot({ path: SP + 'L98-1-sheet.png' });

/* ---- הוצאה לקובץ ---- */
const libFile = await download('הספרייה');
const lib = libFile.json;
ok('ייצוא ספרייה יורד כקובץ JSON', lib.app === 'easycraft' && lib.kind === 'library', libFile.name);
ok('שם הקובץ אומר מה יש בו', /^easycraft-library-\d{4}-\d{2}-\d{2}\.json$/.test(libFile.name), libFile.name);
ok('הספרייה כוללת את כל הארגזים', lib?.tables?.catalog?.length === before.catalog, `${lib?.tables?.catalog?.length} מול ${before.catalog}`);
ok('הספרייה אינה כוללת לקוחות', !lib?.tables?.customers);
ok('נאמר כמה ארגזים ירדו', (await dlg().innerText()).includes(`${before.catalog} ארגזים ירדו`));

const allFile = await download('הכול');
const all = allFile.json;
ok('גיבוי מלא יורד כקובץ', /^easycraft-backup-\d{4}-\d{2}-\d{2}\.json$/.test(allFile.name), allFile.name);
ok('ייצוא מלא: לקוחות, פרויקטים, קירות וארגזים', all.kind === 'all'
  && all.tables.customers.length === before.customers
  && all.tables.projects.length === before.projects
  && all.tables.units.length === before.units
  && all.tables.walls.length === before.walls,
  JSON.stringify({ c: all.tables.customers.length, p: all.tables.projects.length, u: all.tables.units.length }));
ok('גם הגדרות, לוחות וגוונים יצאו', all.tables.settings.length >= 1 && all.tables.materials.length >= 1 && all.tables.finishes.length >= 1);

/* ---- קובץ שאינו גיבוי ---- */
await choose('שלום', 'junk.json');
ok('קובץ שאינו גיבוי נעצר בהודעה ברורה', (await dlg().innerText()).includes('אינו קובץ גיבוי'));

/* ---- החלפה: הספרייה שהנגר בנה מחליפה את זו שהגיעה עם האפליקציה ---- */
const mine = {
  app: 'easycraft', format: 1, at: Date.now(), kind: 'library',
  tables: { catalog: [{ ...lib.tables.catalog[0], id: 'shelf-98', name: 'הארגז של הנגרייה' }] },
};
await dlg().getByRole('button', { name: 'החלפה מלאה' }).click();
await page.waitForTimeout(300);
await choose(mine, 'mine.json');
await dlg().getByRole('button', { name: 'ייבוא ספרייה' }).click();
await page.waitForTimeout(1000);
const afterReplace = await counts();
ok('ההחלפה השאירה בספרייה רק את מה שיובא', afterReplace.catalog === 1 && afterReplace.names[0] === 'הארגז של הנגרייה', JSON.stringify(afterReplace.names));
ok('נאמר כמה הוסרו', (await dlg().innerText()).includes('הוסרו'));
ok('הפרויקטים לא נפגעו מהחלפת הספרייה',
  afterReplace.units === before.units && afterReplace.projects === before.projects && afterReplace.walls === before.walls,
  JSON.stringify({ u: afterReplace.units, p: afterReplace.projects }));
await page.screenshot({ path: SP + 'L98-2-replaced.png' });

/* ---- מיזוג: מוסיף בלי למחוק ---- */
const more = {
  app: 'easycraft', format: 1, at: Date.now(), kind: 'library',
  tables: { catalog: [{ ...lib.tables.catalog[1], id: 'extra-98', name: 'ארגז נוסף' }] },
};
await dlg().getByRole('button', { name: 'מיזוג' }).click();
await page.waitForTimeout(300);
await choose(more, 'more.json');
await dlg().getByRole('button', { name: 'ייבוא ספרייה' }).click();
await page.waitForTimeout(900);
const afterMerge = await counts();
ok('מיזוג הוסיף ולא מחק', afterMerge.catalog === 2 && afterMerge.names.includes('הארגז של הנגרייה') && afterMerge.names.includes('ארגז נוסף'), JSON.stringify(afterMerge.names));

/* ---- הדרך חזרה אל הספרייה שמגיעה עם האפליקציה ---- */
await dlg().getByRole('button', { name: /החזרת ארגזי הספרייה/ }).click();
await page.waitForTimeout(1200);
const afterReseed = await counts();
/*
 * שני הארגזים שיובאו נושאים מק״טים של ארגזי הספרייה, ולכן ההחזרה
 * מזהה אותם ואינה מוסיפה עותק שני תחת אותו מק״ט. התוצאה היא
 * הספרייה המלאה, לא יותר ממנה.
 */
ok('הספרייה חזרה במלואה', afterReseed.catalog === before.catalog, `${afterReseed.catalog} מול ${before.catalog}`);
ok('ובלי כפילות מק״טים', new Set(afterReseed.codes).size === afterReseed.catalog,
  `${new Set(afterReseed.codes).size}/${afterReseed.catalog}`);
ok('ומה שהנגר בנה נשאר', afterReseed.names.includes('הארגז של הנגרייה'));
ok('וכולם נראים ברשימה', afterReseed.shown === afterReseed.catalog, `${afterReseed.shown}/${afterReseed.catalog}`);

/* ---- שחזור מלא ---- */
await picker().setInputFiles(libFile.path);
await page.waitForTimeout(400);
await dlg().getByRole('button', { name: 'שחזור מלא' }).click();
await page.waitForTimeout(500);
ok('גיבוי ספרייה נדחה משחזור מלא', (await dlg().innerText()).includes('גיבוי של הספרייה בלבד'));

await picker().setInputFiles(allFile.path);
await page.waitForTimeout(400);
await dlg().getByRole('button', { name: 'שחזור מלא' }).click();
await page.waitForTimeout(1400);
const restored = await counts();
ok('שחזור מלא החזיר את המכשיר למה שהיה',
  restored.catalog === before.catalog && restored.units === before.units
  && restored.customers === before.customers && restored.projects === before.projects,
  JSON.stringify(restored).slice(0, 120));
ok('ומה שנוסף אחרי הגיבוי נעלם', !restored.names.includes('הארגז של הנגרייה'));
await page.screenshot({ path: SP + 'L98-3-restored.png' });

/* ---- הנתונים שרדו רענון של הדף ---- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const afterReload = await counts();
ok('השחזור נשמר גם אחרי רענון', afterReload.catalog === before.catalog && afterReload.units === before.units);

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();
