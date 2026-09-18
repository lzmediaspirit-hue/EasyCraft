import './_exit.mjs';
/*
 * שכבה 165 — שמירה לספרייה: החלפה לפי שם, וגיבוי שנושא הכול.
 *
 * ארגז שנערך בחדר נשמר לספרייה, ועד כאן הייתה רק דרך אחת: ארגז
 * *נוסף*. מי שרצה להחליף את הקיים נתקל בשער השם — "כבר יש בספרייה
 * ארגז בשם הזה" — ונאלץ למחוק אותו קודם או להמציא שם שני. שם זהה
 * הוא בדיוק הכוונה "זה אותו ארגז, בגרסה מעודכנת".
 *
 * ומה שנשמר חייב לנסוע: גיבוי הספרייה נושא גם ארגז חדש, גם ארגז
 * קיים שהוחלף, וגם ארגז שהגיע עם האפליקציה ונערך.
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
const dlg = () => page.getByRole('dialog').last();

/* ------------------------------------------------------------------ */
/* החלפה לפי שם, במסך                                                  */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'החלפה בספרייה' });
await addUnit(page, 0);
await page.waitForTimeout(800);

/* מכווננים את הארגז, כדי שיהיה מה להחליף */
const src = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, { widthMm: 950 });
  const item = await db.catalog.get(u.catalogItemId);
  return { name: item.name, widthMm: item.defaultWidthMm, builtin: item.isBuiltin, id: item.id };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn(/החלפה בספרייה/).click().catch(() => {});
await page.waitForTimeout(900);
await btn(/^מטבח/).click().catch(() => {});
await page.waitForTimeout(1400);
await page.locator('svg g[data-unit-id]').first().click();
await page.waitForTimeout(800);
await btn(/שמירה לספרייה/).click().catch(() => {});
await page.waitForTimeout(900);

const nameField = dlg().getByLabel('שם בספרייה');
ok('השמירה מציעה שם פנוי כברירת מחדל',
  (await nameField.inputValue()) !== src.name, await nameField.inputValue());

/* מקלידים את שם הארגז הקיים — וזו הבקשה להחליף אותו */
await nameField.fill(src.name);
await page.waitForTimeout(700);
const sheetText = await dlg().innerText();
ok('שם תפוס נאמר על המסך', /כבר יש/.test(sheetText),
  sheetText.split('\n').filter((l) => l.includes('כבר יש')).join());
ok('ונאמר שהוא הגיע עם האפליקציה', !src.builtin || /עם האפליקציה/.test(sheetText));
const label = (await dlg().getByRole('button', { name: /החלפת/ }).first().innerText()).trim();
ok('והכפתור אומר את מי הוא מחליף', label.includes(src.name), label);

const beforeCount = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.catalog.toArray()).length;
});
await dlg().getByRole('button', { name: /החלפת/ }).first().click();
await page.waitForTimeout(1600);
await page.screenshot({ path: SP + 'L165-replace.png' });

const after = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const all = await db.catalog.toArray();
  return {
    count: all.length,
    sameName: all.filter((i) => i.name === (window.__srcName ?? '')).length,
    byId: all.find((i) => i.id === window.__srcId),
  };
}).catch(() => null);
const replaced = await page.evaluate(async (id) => {
  const { db } = await import('/src/db/db.ts');
  const all = await db.catalog.toArray();
  const row = all.find((i) => i.id === id);
  return {
    count: all.length,
    width: row?.defaultWidthMm,
    twins: all.filter((i) => i.name === row?.name).length,
  };
}, src.id);

ok('ההחלפה אינה מוסיפה שורה', replaced.count === beforeCount,
  `${beforeCount} → ${replaced.count}`);
ok('הארגז הקיים קיבל את המידה החדשה', replaced.width === 950,
  `${src.widthMm} → ${replaced.width}`);
ok('ואין שני ארגזים באותו שם', replaced.twins === 1, String(replaced.twins));

/* שם פנוי עדיין שומר ארגז נוסף */
await page.locator('svg g[data-unit-id]').first().click();
await page.waitForTimeout(700);
await btn(/שמירה לספרייה/).click().catch(() => {});
await page.waitForTimeout(800);
await dlg().getByLabel('שם בספרייה').fill('ארגז בשם חדש לגמרי');
await page.waitForTimeout(600);
ok('שם פנוי חוזר לשמירה כארגז חדש',
  (await dlg().getByRole('button', { name: /שמירה כארגז חדש/ }).count()) === 1);
await dlg().getByRole('button', { name: /שמירה כארגז חדש/ }).click();
await page.waitForTimeout(1500);
const added = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const all = await db.catalog.toArray();
  return { count: all.length, has: all.some((i) => i.name === 'ארגז בשם חדש לגמרי') };
});
ok('והוא באמת נוסף', added.has && added.count === replaced.count + 1,
  `${replaced.count} → ${added.count}`);

/* ------------------------------------------------------------------ */
/* הגיבוי נושא את הכול                                                 */
/* ------------------------------------------------------------------ */

const pack = await page.evaluate(async (id) => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const BK = await import('/src/db/cabinetPack.ts' + v);
  /* ארגז שהגיע עם האפליקציה, שנערך במקום מתוך הספרייה */
  const all = await catalogRepo.all();
  const builtin = all.find((i) => i.isBuiltin && i.id !== id);
  await catalogRepo.saveCustom({ id: builtin.id, name: builtin.name, defaultDepthMm: 611 });

  const p = await BK.exportCabinets();
  const rows = p.tables.catalog;
  const find = (n) => rows.find((r) => r.name === n);
  return {
    rows: rows.length,
    inLibrary: all.length,
    replaced: find(rows.find((r) => r.id === id)?.name)?.defaultWidthMm,
    fresh: !!find('ארגז בשם חדש לגמרי'),
    editedBuiltin: rows.find((r) => r.id === builtin.id)?.defaultDepthMm,
    manifest: p.manifest?.items,
  };
}, src.id);

ok('הגיבוי נושא ארגז חדש', pack.fresh === true);
ok('והוא נושא את הארגז שהוחלף, במידה החדשה', pack.replaced === 950, String(pack.replaced));
ok('וגם ארגז שהגיע עם האפליקציה ונערך', pack.editedBuiltin === 611, String(pack.editedBuiltin));
ok('והחבילה נושאת את כל הספרייה', pack.rows === pack.inLibrary,
  `${pack.rows} מתוך ${pack.inLibrary}`);
ok('והמניפסט סופר אותם', pack.manifest === pack.rows,
  `${pack.manifest} מול ${pack.rows}`);

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
if (bad.length) process.exitCode = 1;
