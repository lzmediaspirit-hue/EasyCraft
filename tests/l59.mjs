/* שכבה 21 — הסתרת ארגזים ומחווני החדר */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();
const drawn = () => page.locator('[data-unit-id]').count();

await setup(page, { walls: 'שני קירות' });
await addUnit(page, 0);
await page.waitForTimeout(700);

/* --- הסתרה של ארגז אחד --- */
ok('the hide button sits by delete and duplicate', (await page.getByRole('button', { name: 'הסתרת הארגז מהתצוגה' }).count()) === 1);
const before = await drawn();
await page.getByRole('button', { name: 'הסתרת הארגז מהתצוגה' }).click();
await page.waitForTimeout(800);
ok('hiding takes it off the drawing', (await drawn()) === before - 1, `${before} -> ${await drawn()}`);
ok('and the button offers to bring it back', (await page.getByRole('button', { name: 'החזרת הארגז לתצוגה' }).count()) === 1);
await page.screenshot({ path: SP + 'L59-1-hidden.png' });

/* --- הכפתור בסרגל סופר את המוסתרים ומחזיר את כולם --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn(/בדיקה/).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /מטבח/ }).first().click();
await page.waitForTimeout(1400);
const back = page.getByRole('button', { name: /^מוסתרים 1/ });
ok('the toolbar counts what is hidden', (await back.count()) === 1);
await back.click();
await page.waitForTimeout(900);
ok('one press brings them all back', (await drawn()) === before, String(await drawn()));
ok('and the button goes away', (await page.getByRole('button', { name: /^מוסתרים/ }).count()) === 0);

/* --- ארון תלוי על הקיר, בשביל מחווני החדר שאחריו --- */
await addUnit(page, 3);
await page.waitForTimeout(900);
/* הארגז השני נתלה על הקיר */
await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('units', 'readwrite');
  const st = tx.objectStore('units');
  const rows = await new Promise((res) => {
    const g = st.getAll();
    g.onsuccess = () => res(g.result);
  });
  rows.sort((a, b) => a.createdAt - b.createdAt);
  const u = rows[rows.length - 1];
  st.put({ ...u, level: 'wall', yMm: 1500, xMm: 1200, heightMm: 700 });
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn(/בדיקה/).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /מטבח/ }).first().click();
await page.waitForTimeout(1400);
/*
 * כפתור "בלי עליונים" ירד מסרגל הכלים (שכבה 88): ההסתרה נעשית
 * בבחירה של ארגזים, ומתג שמסתיר קטגוריה שלמה היה מצב נוסף לזכור.
 * מה שנשאר כאן הוא הארון התלוי עצמו, שעליו נמדדים המחוונים.
 */
const uppers = await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('units', 'readonly');
  const rows = await new Promise((res) => {
    const g = tx.objectStore('units').getAll();
    g.onsuccess = () => res(g.result);
  });
  dbh.close();
  return rows.filter((u) => u.level === 'wall').length;
});
ok('a hanging cabinet is on the wall', uppers === 1, String(uppers));

/* --- מחווני החדר --- */
await btn(/הצגת הנתונים/).click();
await page.waitForTimeout(800);
const wallText = (await page.locator('[data-stat]').allInnerTexts()).join('|').replace(/\s+/g, ' ');
ok('the stats start on this wall', /שטח הקיר/.test(wallText), wallText);
await btn(/החדר כולו/).click();
await page.waitForTimeout(700);
const roomText = (await page.locator('[data-stat]').allInnerTexts()).join('|').replace(/\s+/g, ' ');
ok('the room scope renames them', /שטח הקירות/.test(roomText) && /ארגזים בחדר/.test(roomText), roomText);
ok('and the room is bigger than one wall', roomText !== wallText);
await page.screenshot({ path: SP + 'L59-3-room-stats.png' });

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
