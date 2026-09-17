import './_exit.mjs';
/*
 * שכבה 137ב — חוזה המידות ומשטח העבודה בטופס הארגז.
 *
 * הגובה השמור הוא גוף ועוד רגליים, פעם אחת. הטופס הראה את הסכום
 * ולצידו שדה רגליים נפרד, ולכן כל שינוי ברגליים קיצר או האריך את
 * הגוף בשקט. משטח העבודה היה מספר בלי מצב כבוי: אפס נראה כמו שדה
 * שלא מולא, ומי שרצה להוריד משטח לא ידע שזה מה שהוא עושה.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
const dlg = () => page.getByRole('dialog').last();
const num = (label) => dlg().getByLabel(label);

/** שדה מידה מוצג בס״מ; שדה עובי מוצג במ״מ. שניהם נקראים כמ״מ */
const mm = async (label) => Math.round(Number(await num(label).inputValue()) * 10);
const raw = async (label) => Number(await num(label).inputValue());
async function set(label, cm) {
  await num(label).fill(String(cm));
  await num(label).blur();
  await page.waitForTimeout(400);
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1800);
await page.getByRole('button', { name: /ספריית הארגזים/ }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(900);

ok('הטופס שואל על גובה הגוף', (await num('גובה גוף').count()) === 1);
await set('גובה גוף', 80);
await set('גובה רגליים', 10);
ok('גוף 80 ורגליים 10', (await mm('גובה גוף')) === 800 && (await mm('גובה רגליים')) === 100,
  `${await mm('גובה גוף')} + ${await mm('גובה רגליים')}`);

/* --- רגליים אינן מקצרות את הגוף --- */
await set('גובה רגליים', 15);
ok('שינוי רגליים אינו נוגע בגוף', (await mm('גובה גוף')) === 800, String(await mm('גובה גוף')));

/* --- רגליים מעמידות על הרצפה, ולכן אין "גובה מהרצפה" --- */
ok('עם רגליים אין שדה גובה מהרצפה', (await num('גובה מהרצפה').count()) === 0);
await set('גובה רגליים', 0);
ok('בלי רגליים השדה חוזר', (await num('גובה מהרצפה').count()) === 1);
ok('והגוף עדיין לא זז', (await mm('גובה גוף')) === 800, String(await mm('גובה גוף')));

/* --- משטח עבודה: יש, כמה, אין --- */
const on = dlg().getByRole('button', { name: 'יש', exact: true });
const off = dlg().getByRole('button', { name: 'אין', exact: true });
ok('המשטח הוא יש או אין', (await on.count()) === 1 && (await off.count()) === 1);
ok('ובלי משטח אין שדה עובי', (await num('עובי המשטח').count()) === 0);

await on.click();
await page.waitForTimeout(400);
ok('"יש" פותח עובי אמיתי', (await raw('עובי המשטח')) > 0, String(await raw('עובי המשטח')));
await set('עובי המשטח', 40);
ok('שינוי עובי אינו משנה את הגוף', (await mm('גובה גוף')) === 800, String(await mm('גובה גוף')));

await off.click();
await page.waitForTimeout(400);
ok('"אין" סוגר את שדה העובי', (await num('עובי המשטח').count()) === 0);
await on.click();
await page.waitForTimeout(400);
ok('והדלקה חוזרת מחזירה את העובי שנבחר', (await raw('עובי המשטח')) === 40, String(await raw('עובי המשטח')));

/* --- וזה מה שנשמר: גוף ועוד רגליים, פעם אחת --- */
await set('גובה רגליים', 10);
await dlg().getByLabel('שם הארגז').fill('QA חוזה מידות');
await page.waitForTimeout(300);
await dlg().getByRole('button', { name: /שמירה בספרייה/ }).click();
await page.waitForTimeout(1400);

const saved = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const i = (await catalogRepo.all()).find((x) => x.name === 'QA חוזה מידות');
  return i && { h: i.defaultHeightMm, socle: i.socleMm, counter: i.counterMm, y: i.defaultYMm };
});
ok('הגובה השמור הוא גוף ועוד רגליים', saved?.h === 900 && saved?.socle === 100, JSON.stringify(saved));
ok('והמשטח נשמר בנפרד', saved?.counter === 40, JSON.stringify(saved));

/* --- ומה שנפתח מחדש מראה את אותו גוף --- */
/* הארגז נשמר למטבח, ולכן הוא נמצא בספרייה של המטבח */
await page.getByRole('button', { name: /^מטבח/ }).first().click();
await page.waitForTimeout(900);
/* במסך הספרייה הלחיצה על הארגז עצמו היא עריכה, ולא הוספה */
await dlg().getByRole('button', { name: /^QA חוזה מידות/ }).first().click();
await page.waitForTimeout(900);
ok('פתיחה מחדש מראה את הגוף ולא את הסכום', (await mm('גובה גוף')) === 800, String(await mm('גובה גוף')));

/* --- וכיבוי משטח שנשמר נשאר כבוי --- */
await dlg().getByRole('button', { name: 'אין', exact: true }).click();
await page.waitForTimeout(400);
await dlg().getByRole('button', { name: /שמירה בספרייה/ }).click();
await page.waitForTimeout(1400);
const after = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  return (await catalogRepo.all()).find((x) => x.name === 'QA חוזה מידות')?.counterMm;
});
ok('כיבוי המשטח נשמר ואינו חוזר', after === 0, String(after));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
