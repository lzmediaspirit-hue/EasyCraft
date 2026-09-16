import './_exit.mjs';
/** משימה 98: ארגזים — הוצאת ארגזים מהמכשיר, והכנסת ארגזים אליו. */
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
const picker = () => dlg().getByLabel('בחירת קובץ ארגזים');
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

/** כותב חבילה לקובץ ובוחר אותה בבורר — כמו שהמשתמש עושה */
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
ok('יש מדור ארגזים בהגדרות', (await page.innerText('main')).includes('ארגזים'));
await btn(/שמירה והעברה של ארגזים/).click(); await page.waitForTimeout(700);
await page.screenshot({ path: SP + 'L98-1-sheet.png' });

/* ---- הוצאה לקובץ ---- */
const libFile = await download('שמירת הארגזים לקובץ');
const lib = libFile.json;
ok('ייצוא ארגזים יורד כקובץ JSON', lib.app === 'easycraft' && lib.kind === 'library', libFile.name);
ok('שם הקובץ אומר מה יש בו', /^easycraft-cabinets-\d{4}-\d{2}-\d{2}\.json$/.test(libFile.name), libFile.name);
ok('החבילה כוללת את כל הארגזים', lib?.tables?.catalog?.length === before.catalog, `${lib?.tables?.catalog?.length} מול ${before.catalog}`);
ok('החבילה אינה כוללת לקוחות', !lib?.tables?.customers);
ok('ואינה כוללת פרויקטים', !lib?.tables?.projects && !lib?.tables?.units);
ok('נאמר כמה ארגזים ירדו', (await dlg().innerText()).includes(`${before.catalog} ארגזים ירדו`));

/* ---- קובץ שאינו חבילת ארגזים ---- */
await choose('שלום', 'junk.json');
ok('קובץ שאינו חבילה נעצר בהודעה ברורה', (await dlg().innerText()).includes('אינו קובץ ארגזים'));

/* ---- גיבוי מלא ישן: נאמר, ולא נבלע ---- */
await choose({ app: 'easycraft', format: 3, at: Date.now(), kind: 'all', tables: { catalog: [] } }, 'old-all.json');
ok('גיבוי מלא ישן נדחה במפורש', (await dlg().innerText()).includes('גיבוי מלא ישן'));

/* ---- החלפה: הספרייה שהנגר בנה מחליפה את זו שהגיעה עם האפליקציה ---- */
const mine = {
  app: 'easycraft', format: 1, at: Date.now(), kind: 'library',
  tables: { catalog: [{ ...lib.tables.catalog[0], id: 'shelf-98', name: 'הארגז של הנגרייה' }] },
};
await dlg().getByRole('button', { name: 'החלפה מלאה' }).click();
await page.waitForTimeout(300);
await choose(mine, 'mine.json');
await dlg().getByRole('button', { name: 'ייבוא ארגזים' }).click();
await page.waitForTimeout(1000);
const afterReplace = await counts();
ok('ההחלפה השאירה בספרייה רק את מה שיובא', afterReplace.catalog === 1 && afterReplace.names[0] === 'הארגז של הנגרייה', JSON.stringify(afterReplace.names));
ok('נאמר כמה הוסרו', (await dlg().innerText()).includes('הוסרו'));
ok('הפרויקטים לא נפגעו מהחלפת הארגזים',
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
await dlg().getByRole('button', { name: 'ייבוא ארגזים' }).click();
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

/* ---- הקובץ שירד נכנס בחזרה, ומגיע לאותה ספרייה ---- */
await picker().setInputFiles(libFile.path);
await page.waitForTimeout(500);
await dlg().getByRole('button', { name: 'ייבוא ארגזים' }).click();
await page.waitForTimeout(1400);
const restored = await counts();
ok('הקובץ שירד מחזיר את אותם ארגזים', restored.catalog === before.catalog, `${restored.catalog} מול ${before.catalog}`);
ok('והפרויקטים לא נגעו בהם לאורך כל הדרך',
  restored.units === before.units && restored.customers === before.customers && restored.projects === before.projects,
  JSON.stringify(restored).slice(0, 120));
await page.screenshot({ path: SP + 'L98-3-restored.png' });

/* ---- הנתונים שרדו רענון של הדף ---- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const afterReload = await counts();
ok('הייבוא נשמר גם אחרי רענון', afterReload.catalog === before.catalog && afterReload.units === before.units);

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();
