import './_exit.mjs';
/*
 * שכבה 148 — B08: סדר השאלות במסך בניית הארגז, ובורר איורים קצר.
 *
 * הבורר הציג שלושים וארבעה איורים בבת אחת, והחדר והקבוצה נשאלו
 * אחרי הכול — כלומר הבורר לא ידע בשביל מה הוא נשאל. עכשיו:
 * שם → חדרים → קבוצה → איורים של החדר → בנייה ומידות, וכל השאר
 * מאחורי "כל האיורים", שנפתח מעצמו כשהאיור הנבחר אינו ברשימה.
 */
import { chromium } from 'playwright';
import { pickGlyph } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').waitFor();
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1600);

await page.getByRole('button', { name: /ספריית הארגזים/ }).first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(900);

/* --- הבורר קצר, וכל השאר מאחורי מרחיב --- */
const picker = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[role="dialog"] button')];
  const glyphs = btns.filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('איור '));
  return {
    shown: glyphs.length,
    expander: btns.some((b) => b.textContent.trim() === 'כל האיורים'),
  };
});
ok('בורר האיורים מצומצם', picker.shown > 0 && picker.shown <= 12, String(picker.shown));
ok('וכל השאר מאחורי "כל האיורים"', picker.expander);

/* --- סדר השאלות: שם, חדרים, קבוצה, איור, ואז מידות --- */
const order = await page.evaluate(() => {
  /* המסך שנפתח אחרון — מתחת לו יושבת גם ספריית הארגזים */
  const root = [...document.querySelectorAll('[role="dialog"]')].pop();
  const y = (el) => (el ? Math.round(el.getBoundingClientRect().y) : null);
  const x = (el) => (el ? Math.round(el.getBoundingClientRect().x) : null);
  const group = (label) =>
    [...root.querySelectorAll('[role="group"]')].find(
      (g) => (g.getAttribute('aria-label') ?? '') === label,
    );
  const name = root.querySelector('.cabinet-form input');
  const glyph = root.querySelector('[aria-label^="איור "]');
  const width = [...root.querySelectorAll('label')].find((l) => l.textContent.includes('רוחב'));
  return {
    name: [x(name), y(name)],
    rooms: [x(group('באילו חדרים יופיע')), y(group('באילו חדרים יופיע'))],
    group: [x(group('קבוצה בספרייה')), y(group('קבוצה בספרייה'))],
    glyph: [x(glyph), y(glyph)],
    width: [x(width), y(width)],
  };
});
/*
 * במחשב הטופס בשתי עמודות, ולכן "אחרי" נמדד בזרימת הקריאה: אותה
 * עמודה, נמוך יותר. כל השדות כאן יושבים בעמודת השדות.
 */
const after = (a, b) => a[1] !== null && b[1] !== null && b[1] > a[1];
ok('החדרים אחרי השם', after(order.name, order.rooms), JSON.stringify([order.name, order.rooms]));
ok('הקבוצה אחרי החדרים', after(order.rooms, order.group), JSON.stringify(order.group));
ok('האיור אחרי הקבוצה', after(order.group, order.glyph), JSON.stringify(order.glyph));
ok('והמידות אחרי האיור', after(order.glyph, order.width), JSON.stringify(order.width));

/* --- הרשימה נפתחת בשביל איור שאינו בקצרה, והבחירה נתפסת --- */
await dlg().getByLabel('שם הארגז').fill('QA בורר איורים');
await pickGlyph(page, dlg(), 'נעליים');
const picked = await dlg()
  .getByRole('button', { name: 'איור נעליים', exact: true })
  .first()
  .getAttribute('aria-pressed');
ok('איור מהרשימה המלאה נבחר', picked === 'true', String(picked));

/* --- ובפתיחה מחדש של ארגז כזה, הרשימה כבר פתוחה --- */
await dlg().getByRole('button', { name: /שמירה בספרייה/ }).click();
await page.waitForTimeout(1400);
const saved = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  const i = (await catalogRepo.all()).find((x) => x.name === 'QA בורר איורים');
  return i?.glyph ?? null;
});
ok('ונשמר כך', saved === 'shoes', String(saved));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
