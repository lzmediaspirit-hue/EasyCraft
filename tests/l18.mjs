import './_exit.mjs';
import { chromium } from 'playwright';
import { BOX, pickFinishes, pickWalls } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L18-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1500);

await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('צורה בע״מ');
await dlg().getByLabel(/עיר/).fill('כפר סבא');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/צורה בע״מ/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(900);
ok('unique layout option', await dlg().getByRole('button', { name: /^חדר מורכב/ }).count() === 1);
await pickWalls(page, 'מורכב'); await page.waitForTimeout(900);
ok('shape step', (await dlg().innerText()).includes('צורת החדר'));
await full('1-shape-empty');

/* מציירים ריבוע פתוח: 3 קירות, בגרירה מנקודה לנקודה */
const svg = dlg().locator('svg[viewBox="0 0 6000 6000"]');
const P = async (fx, fy) => {
  const bb = await svg.boundingBox();
  return [bb.x + bb.width * fx, bb.y + bb.height * fy];
};
const dragTo = async (a, c) => {
  await page.mouse.move(...(await P(...a))); await page.mouse.down();
  await page.mouse.move(...(await P(...c)), { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(350);
};
await dragTo([0.2, 0.25], [0.2, 0.75]);
await dragTo([0.2, 0.75], [0.8, 0.75]);
await dragTo([0.8, 0.75], [0.8, 0.4]);
await full('2-shape-drawn');
console.log('DIALOGS:', await page.getByRole('dialog').count(), 'ERRS:', errs.join(' | ').slice(0, 500));
const t = await dlg().innerText();
ok('three walls drawn', /3 קירות/.test(t), t.split('\n').slice(-3).join(' / '));
ok('snap toggle', await dlg().getByRole('button', { name: 'הצמדה ל־90°' }).count() === 1);

await dlg().getByRole('button', { name: /^המשך · 3/ }).click(); await page.waitForTimeout(700);
ok('order step', (await dlg().innerText()).includes('סדר הקירות'));
await full('3-order');
await dlg().getByRole('button', { name: 'הפיכת כיוון המספור' }).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: 'המשך', exact: true }).click(); await page.waitForTimeout(700);
await btn(/קיר נקי/).click(); await page.waitForTimeout(700);
await full('4-dims');
ok('dims step', (await dlg().innerText()).includes('מידות'), (await dlg().innerText()).split('\n')[0] ?? '');
await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click(); await page.waitForTimeout(1800);

/* הגוונים נבחרים אחרי היצירה — "גוון לכולם" בסרגל ההדמיה */
await pickFinishes(page);

const names = await page.getByRole('button').allInnerTexts();
ok('project created with 3 walls', names.join('|').includes('קיר ג׳'), names.join('|').slice(0, 200));
await full('7-design');

await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
/* ארגז לפי שם: הספרייה היא של הנגרייה, והמחיר נגזר מהארגז שנבחר */
await dlg().getByRole('button', { name: BOX.doors2 }).first().click();
await page.waitForTimeout(1200);
const ed = await page.innerText('body');
ok('unit inherits project finish', ed.includes('לבן') && ed.includes('מהפרויקט'), '');
await full('8-editor');
await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
await page.waitForTimeout(400);
await btn(/^חישוב/).click(); await page.waitForTimeout(1800);
const calc = await dlg().innerText();
ok('calc prices the finish', calc.includes('לבן · סנדוויץ׳') && calc.includes('₪120'), calc.slice(0, 260).replace(/\n/g, ' / '));
await full('9-calc');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
