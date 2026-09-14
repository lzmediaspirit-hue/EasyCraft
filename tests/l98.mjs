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
const box = () => dlg().locator('textarea');
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

/* ---- הוצאה ---- */
await dlg().getByRole('button', { name: 'הספרייה' }).click();
await page.waitForTimeout(700);
const libText = await box().inputValue();
let lib = null;
try { lib = JSON.parse(libText); } catch { /* נבדק למטה */ }
ok('ייצוא ספרייה מחזיר JSON תקין', !!lib && lib.app === 'easycraft' && lib.kind === 'library');
ok('הספרייה כוללת את כל הארגזים', lib?.tables?.catalog?.length === before.catalog, `${lib?.tables?.catalog?.length} מול ${before.catalog}`);
ok('הספרייה אינה כוללת לקוחות', !lib?.tables?.customers);
ok('נאמר כמה ארגזים יצאו', (await dlg().innerText()).includes(`${before.catalog} ארגזים בספרייה`));

await dlg().getByRole('button', { name: 'הכול' }).click();
await page.waitForTimeout(800);
const allText = await box().inputValue();
const all = JSON.parse(allText);
ok('ייצוא מלא: לקוחות, פרויקטים, קירות וארגזים', all.kind === 'all'
  && all.tables.customers.length === before.customers
  && all.tables.projects.length === before.projects
  && all.tables.units.length === before.units
  && all.tables.walls.length === before.walls,
  JSON.stringify({ c: all.tables.customers.length, p: all.tables.projects.length, u: all.tables.units.length }));
ok('גם הגדרות, לוחות וגוונים יצאו', all.tables.settings.length >= 1 && all.tables.materials.length >= 1 && all.tables.finishes.length >= 1);

/* ---- קלט שאינו גיבוי ---- */
await box().fill('שלום');
await dlg().getByRole('button', { name: 'ייבוא ספרייה' }).click();
await page.waitForTimeout(500);
ok('טקסט שאינו גיבוי נעצר בהודעה ברורה', (await dlg().innerText()).includes('אינו קובץ גיבוי'));

/* ---- החלפה: הספרייה שהנגר בנה מחליפה את זו שהגיעה עם האפליקציה ---- */
const mine = {
  app: 'easycraft', format: 1, at: Date.now(), kind: 'library',
  tables: { catalog: [{ ...lib.tables.catalog[0], id: 'shelf-98', name: 'הארגז של הנגרייה' }] },
};
await dlg().getByRole('button', { name: 'החלפה מלאה' }).click();
await page.waitForTimeout(300);
await box().fill(JSON.stringify(mine));
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
await box().fill(JSON.stringify(more));
await dlg().getByRole('button', { name: 'ייבוא ספרייה' }).click();
await page.waitForTimeout(900);
const afterMerge = await counts();
ok('מיזוג הוסיף ולא מחק', afterMerge.catalog === 2 && afterMerge.names.includes('הארגז של הנגרייה') && afterMerge.names.includes('ארגז נוסף'), JSON.stringify(afterMerge.names));

/* ---- הדרך חזרה אל ארגזי התקן ---- */
await dlg().getByRole('button', { name: /החזרת ארגזי התקן/ }).click();
await page.waitForTimeout(1200);
const afterReseed = await counts();
ok('ארגזי התקן חזרו', afterReseed.catalog === before.catalog + 2, `${afterReseed.catalog} מול ${before.catalog + 2}`);
ok('ומה שהנגר בנה נשאר', afterReseed.names.includes('הארגז של הנגרייה'));
ok('וכולם נראים ברשימה', afterReseed.shown === afterReseed.catalog, `${afterReseed.shown}/${afterReseed.catalog}`);

/* ---- שחזור מלא ---- */
await box().fill(libText);
await dlg().getByRole('button', { name: 'שחזור מלא' }).click();
await page.waitForTimeout(500);
ok('גיבוי ספרייה נדחה משחזור מלא', (await dlg().innerText()).includes('גיבוי של הספרייה בלבד'));

await box().fill(allText);
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
