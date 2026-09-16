import './_exit.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1500);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('חיפוי');
await dlg().getByLabel(/עיר/).fill('חיפה');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/חיפוי/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^סלון/ }).click(); await page.waitForTimeout(800);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(700);
await btn(/קיר נקי/).click(); await page.waitForTimeout(700);
await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click(); await page.waitForTimeout(1700);

const readUnits = () => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => {
    const tx = db.transaction('units').objectStore('units').getAll();
    tx.onsuccess = () => res(tx.result.map((u) => ({ n: u.name, g: u.glyph, x: u.xMm, y: u.yMm, w: u.widthMm, h: u.heightMm })));
  });
});
/**
 * מוסיף ארגז מתוך מדור בספרייה. הספרייה היא של הנגרייה, ולכן
 * הדרך פנימה היא המדור — ולא מקום קבוע ברשימה.
 */
const add = async (section, re, tab) => {
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
  /* הספרייה נפתחת בחדר של הפרויקט; המדורים נמצאים צעד אחורה, בתפריט */
  const back = dlg().getByRole('button', { name: 'לשלב הקודם' });
  if (await back.count()) { await back.click(); await page.waitForTimeout(500); }
  await dlg().getByRole('button', { name: section }).first().click(); await page.waitForTimeout(600);
  if (tab) {
    await dlg().getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
  }
  if (!(await dlg().getByRole('button', { name: re }).count()))
    console.log('LIB:', (await dlg().getByRole('button').allInnerTexts()).join('|').replace(/\n/g, ' ').slice(0, 900));
  await dlg().getByRole('button', { name: re }).first().click(); await page.waitForTimeout(900);
  await btn('סיום עריכה').click(); await page.waitForTimeout(400);
};
await add(/^דפנות ולוחות בודדים/, /^חיפוי קיר/);
await add(/^סלון/, /^ספרייה סגורה/, 'ארונות');
/*
 * "חיפוי קיר" בספרייה של הנגרייה מצויר כלוח בודד, ולא באיור
 * "פאנל" שהוא זה שמסמן חיפוי. הבדיקה כאן היא על היכולת עצמה —
 * ארגז שעומד לפני חיפוי — ולכן היא מסמנת את החיפוי במפורש,
 * במקום להישען על האיור שבחר מי שבנה את הספרייה.
 */
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const units = await db.units.toArray();
  const cover = units.find((x) => x.name.includes('חיפוי'));
  if (cover) await db.units.update(cover.id, { glyph: 'panel' });
});
/* המסך מאזין לטבלה, ולכן הוא מתעדכן לבד — בלי רענון שמחזיר הביתה */
await page.waitForTimeout(1200);

let u = await readUnits();
console.log('units:', JSON.stringify(u));

const panelId = await page.locator('svg g[data-unit-id]').first().getAttribute('data-unit-id');
const isCover = (z) => z.n.includes('חיפוי');
const cab = u.find((z) => !isCover(z));
const panel = u.find(isCover);
ok(!!cab && !!panel, 'פאנל וארגז נוספו');

/* גוררים את הארגז אל תוך הפאנל — מותר, החיפוי אמור להיות מאחוריו */
const gs = await page.locator('svg g[data-unit-id]').evaluateAll((g) => g.map((e) => e.getAttribute('data-unit-id')));
const cabId = gs.find((id) => id !== panelId) ?? gs[1];
const g = page.locator(`svg g[data-unit-id="${cabId}"]`);
const box = await g.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 500, box.y + box.height / 2, { steps: 14 });
await page.mouse.up(); await page.waitForTimeout(600);
u = await readUnits();
const a = u.find(isCover);
const c = u.find((z) => !isCover(z));
const over = a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y;
ok(over, 'ארגז יכול לעמוד לפני חיפוי הקיר', JSON.stringify([[a.x, a.w], [c.x, c.w]]));
await page.screenshot({ path: SP + '/L33-3-cladding.png' });

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
