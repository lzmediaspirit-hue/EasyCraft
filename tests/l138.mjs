import './_exit.mjs';
/*
 * שכבה 138 — האיור הוא תמונה, לא הגדרת מבנה.
 *
 * האיור היה גם מה שקבע מה אפשר לבנות: מי שבחר לארגז שלו איור של
 * מדפים גילה שהמגירות שהגדיר נעלמו מהטופס ולא נשמרו, ומי שבחר
 * תלייה איבד את הדלתות. גוף ארון הוא גוף ארון — ובו אפשר הכול.
 * מה שבאמת אין בו מה לבנות הוא מכשיר שנקנה שלם ולוח בודד.
 */
import { chromium } from 'playwright';
import { pickGlyph } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1800);

/* --- היכולות עצמן --- */
const caps = await page.evaluate(async () => {
  const { constructionCaps } = await import('/src/catalog/construction.ts');
  const of = (g) => {
    const c = constructionCaps(g);
    return { doors: !!c.doors, drawers: !!c.drawers, shelves: !!c.shelves };
  };
  return { shelves: of('shelves'), hang: of('hang'), doors: of('doors'), fridge: of('fridge'), slab: of('slab') };
});
ok('גוף ארון מצויר כמדפים עדיין יכול מגירות ודלתות',
  caps.shelves.doors && caps.shelves.drawers && caps.shelves.shelves, JSON.stringify(caps.shelves));
ok('וגם כשהוא מצויר כתלייה',
  caps.hang.doors && caps.hang.drawers && caps.hang.shelves, JSON.stringify(caps.hang));
ok('במכשיר שנקנה שלם אין מה לבנות',
  !caps.fridge.doors && !caps.fridge.drawers && !caps.fridge.shelves, JSON.stringify(caps.fridge));
ok('וגם לא בלוח בודד',
  !caps.slab.doors && !caps.slab.drawers && !caps.slab.shelves, JSON.stringify(caps.slab));

/* --- ובמסך: החלפת איור אינה מוחקת את הפנים --- */
await page.getByRole('button', { name: /ספריית הארגזים/ }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(900);

await dlg().getByLabel('שם הארגז').fill('QA איור ופנים');
/* שלוש מגירות ושתי דלתות, בארגז שמצויר כדלתות */
await pickGlyph(page, dlg(), 'דלתות');

const rowOf = (label) => dlg().getByRole('group', { name: label });
await rowOf('דלתות').getByRole('button', { name: '2', exact: true }).click();
await page.waitForTimeout(300);
await rowOf('שורות מגירות').getByRole('button', { name: '3', exact: true }).click();
await page.waitForTimeout(400);
ok('הוגדרו דלתות ומגירות',
  (await rowOf('דלתות').getByRole('button', { name: '2', exact: true }).getAttribute('aria-pressed')) === 'true' &&
  (await rowOf('שורות מגירות').getByRole('button', { name: '3', exact: true }).getAttribute('aria-pressed')) === 'true');

/* עכשיו מחליפים את האיור למדפים */
await pickGlyph(page, dlg(), 'מדפים');
await page.waitForTimeout(300);
ok('אחרי החלפת איור שדה הדלתות עדיין שם', (await rowOf('דלתות').count()) === 1);
ok('וגם שדה המגירות', (await rowOf('שורות מגירות').count()) === 1);
ok('והמספרים לא נמחקו',
  (await rowOf('דלתות').getByRole('button', { name: '2', exact: true }).getAttribute('aria-pressed')) === 'true' &&
  (await rowOf('שורות מגירות').getByRole('button', { name: '3', exact: true }).getAttribute('aria-pressed')) === 'true');

await dlg().getByRole('button', { name: /שמירה בספרייה/ }).click();
await page.waitForTimeout(1400);
const saved = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const i = (await catalogRepo.all()).find((x) => x.name === 'QA איור ופנים');
  return i && { glyph: i.glyph, doors: i.doors, drawers: i.drawers };
});
ok('וגם בשמירה', saved?.glyph === 'shelves' && saved?.doors === 2 && saved?.drawers === 3, JSON.stringify(saved));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
