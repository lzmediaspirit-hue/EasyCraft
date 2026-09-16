import './_exit.mjs';
/* שכבה 111 — הספרייה של הנגרייה, חדרים כנתונים, ואפס כפילויות */
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click();
await page.waitForTimeout(1800);

/* --- הספרייה שנזרעה היא זו שהנגר בנה --- */
const lib = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const all = await catalogRepo.all();
  const rows = await db.catalog.toArray();
  return {
    n: all.length,
    rows: rows.length,
    hidden: rows.filter((i) => i.hiddenAt).length,
    codes: new Set(all.map((i) => i.code)).size,
    ids: new Set(all.map((i) => i.id)).size,
    /*
     * כפילות אמיתית: אותו ארגז פעמיים — שם, קטגוריה, חדר ומידות.
     * שני ארגזים שונים באותו שם אינם כפילות; "ארגז תנור" של הנגר
     * ו"ארגז תנור" שהגיע עם האפליקציה הם שני ארגזים שונים באמת.
     */
    twins: new Set(
      all.map((i) =>
        [i.name, i.group, i.rooms.join(), i.glyph, i.defaultWidthMm, i.defaultHeightMm,
         i.defaultDepthMm, i.defaultYMm].join('|'),
      ),
    ).size,
    common: all.filter((i) => i.common).length,
    groups: [...new Set(all.map((i) => i.group))].sort(),
    sample: all.find((i) => i.code === 'B-137'),
  };
});
/* 61 של הנגרייה, ולצדם שני המוצרים של האפליקציה: אי ומדף */
ok('נזרעו 61 הארגזים של הנגרייה ושני המוצרים', lib.n === 63, String(lib.n));
ok('אין ארגז מוסתר בספרייה שנזרעה', lib.hidden === 0 && lib.rows === 63, `${lib.hidden} מוסתרים מתוך ${lib.rows}`);
ok('אין כפילות מזהים', lib.ids === lib.n, `${lib.ids}/${lib.n}`);
ok('אין כפילות מק״טים', lib.codes === lib.n, `${lib.codes}/${lib.n}`);
ok('אין אותו ארגז פעמיים', lib.twins === lib.n, `${lib.twins}/${lib.n}`);
ok('כל הארגזים נגישים מהספרייה הקלאסית', lib.common === lib.n, `${lib.common}/${lib.n}`);
ok('כל הקטגוריות מיוצגות', lib.groups.join() === 'base,island,panel,shelf,storage,tall,upper', lib.groups.join());
/* ארגז שנבנה בנגרייה שמר את המבנה שלו, ולא רק את המידות */
ok('ארגז הכיריים שמר את האזורים שלו',
  lib.sample?.zones?.length === 2 && lib.sample.zones[0].drawers === 3,
  JSON.stringify(lib.sample?.zones));
ok('ואת המסילות החסרות', lib.sample?.rails?.back === false && lib.sample?.rails?.top === false,
  JSON.stringify(lib.sample?.rails));

/* --- חדרים: ארבעה, ובהם חדר שירות --- */
const rooms = await page.evaluate(async () => {
  const { roomsRepo } = await import('/src/catalog/roomsRepo.ts?v=' + Date.now());
  const all = await roomsRepo.all();
  return { labels: all.map((r) => r.label), ids: new Set(all.map((r) => r.id)).size, n: all.length };
});
ok('נוצרה קטגוריית "חדר שירות"', rooms.labels.includes('חדר שירות'), rooms.labels.join(' · '));
ok('ואין כפילות חדרים', rooms.ids === rooms.n, `${rooms.ids}/${rooms.n}`);

/* --- הוספת חדר מהמסך --- */
await btn(/ספריית הארגזים/).click(); await page.waitForTimeout(900);
const inList = await page.innerText('body');
ok('חדר השירות מופיע בספריות לפי חדר', inList.includes('חדר שירות'));
await page.screenshot({ path: SP + 'L111-1-rooms.png' });

await page.getByRole('button', { name: 'חדר', exact: true }).click();
await page.waitForTimeout(700);
await dlg().getByLabel('שם החדר').fill('QA ממ״ד');
await dlg().getByRole('button', { name: 'שמירה' }).click();
await page.waitForTimeout(900);
const added = await page.innerText('body');
ok('חדר שנוסף מהמסך מופיע בספרייה', added.includes('QA ממ״ד'), JSON.stringify(added.slice(0, 120)));

/* הוא חדר לכל דבר: אפשר לסמן לו ארגז */
await btn(/ארגז משלי/).click(); await page.waitForTimeout(800);
ok('והוא ניתן לסימון בעורך הארגז',
  (await dlg().getByRole('button', { name: 'QA ממ״ד', exact: true }).count()) === 1);
await page.screenshot({ path: SP + 'L111-2-new-room.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

/* --- עריכה והסרה של חדר --- */
await page.getByRole('button', { name: 'עריכת QA ממ״ד' }).click();
await page.waitForTimeout(700);
await dlg().getByLabel('שם החדר').fill('QA מחסן');
await dlg().getByRole('button', { name: 'שמירה' }).click();
await page.waitForTimeout(800);
ok('שינוי שם חדר נשמר', (await page.innerText('body')).includes('QA מחסן'));

await page.getByRole('button', { name: 'עריכת QA מחסן' }).click();
await page.waitForTimeout(700);
await dlg().getByRole('button', { name: 'הסרת החדר' }).click();
await page.waitForTimeout(900);
ok('והסרה מורידה אותו', !(await page.innerText('body')).includes('QA מחסן'));

const all = [...out, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);
