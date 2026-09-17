import './_exit.mjs';
import { chromium } from 'playwright';
import { BOX } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L12-${n}.png`, fullPage: true });
const shot = (n) => page.screenshot({ path: `${SP}/L12-${n}.png` });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ---- כניסה ראשונה: יצירת מנהל ---- */
ok('login screen first', await page.getByLabel('שם משתמש').count() > 0);
/* חשבון admin נוצר מראש; יצירת המנהל הראשון נבדקת ב-admin.mjs */
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1400);
await shot('1-login');
ok('signed in after setup', await page.getByRole('button', { name: /לקוח ראשון|לקוח חדש|הוספת לקוח/ }).count() > 0);

/* ---- המנהל פותח משתמש לנגר ---- */
await btn(/^מנהל/).click(); await page.waitForTimeout(700);
await btn('משתמש חדש').click(); await page.waitForTimeout(400);
await dlg().getByLabel('שם').first().fill('יוסי מזרחי');
await dlg().getByRole('button', { name: 'נגר', exact: true }).click();
await dlg().getByLabel('שם משתמש').fill('yossi');
await dlg().getByLabel('סיסמה').fill('5678');
await dlg().getByRole('button', { name: 'שמירה' }).click(); await page.waitForTimeout(800);
ok('manager created a user', await page.getByRole('button', { name: /יוסי מזרחי/ }).count() > 0);
await full('2-team');

/* ---- יציאה וכניסה כנגר ---- */
await btn('יציאה').click(); await page.waitForTimeout(700);
await page.getByLabel('שם משתמש').fill('yossi');
await page.getByLabel('סיסמה').fill('wrong');
await btn('כניסה').click(); await page.waitForTimeout(900);
ok('wrong password rejected', (await page.textContent('body')).includes('שגויים'));
await page.getByLabel('סיסמה').fill('5678');
await btn('כניסה').click(); await page.waitForTimeout(1000);
ok('carpenter signed in', await page.getByRole('button', { name: /לקוח ראשון|לקוח חדש|הוספת לקוח/ }).count() > 0);
await btn(/יוסי מזרחי/).click(); await page.waitForTimeout(700);
ok('carpenter cannot manage team', await page.getByRole('button', { name: 'משתמש חדש' }).count() === 0);
await full('3-carpenter');
await btn('יציאה').click(); await page.waitForTimeout(600);
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(900);

/*
  מסך ההגדרות נבדק היום ב-l17, l22 ו-l46: מודל "לוח עם גוון בתוכו"
  הוחלף בחומרים וגוונים נפרדים, ובדיקות הישנות כאן ירדו.
*/

/* ---- פרויקט ---- */
await btn(/לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(400);
await page.locator('form input').nth(0).fill('משפחת ברק');
await page.locator('form input').nth(1).fill('נתניה');
await btn('שמירה').click(); await page.waitForTimeout(500);
await btn(/משפחת ברק/).click(); await page.waitForTimeout(500);
await btn('פרויקט חדש').click(); await page.waitForTimeout(300);
await btn(/מטבח/).click(); await page.waitForTimeout(250);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(250);
await btn(/^קיר נקי/).click(); await page.waitForTimeout(250);
const n = dlg().locator('input[type="number"]');
await n.nth(0).fill('260'); await n.nth(1).fill('400');
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1000);

/* המחוונים מתחילים סגורים */
await btn(/הצגת הנתונים/).click(); await page.waitForTimeout(600);
const body = await page.textContent('main');
ok('wall area shown', body.includes('שטח הקיר'));
ok('wall height shown', body.includes('גובה הקיר'));
ok('calc button renamed', await page.getByRole('button', { name: 'חישוב' }).count() > 0);
ok('nesting button exists', await page.getByRole('button', { name: /ניסור/ }).count() > 0);

await btn('הוספת ארגז').click(); await page.waitForTimeout(500);
await btn(BOX.doors2).click(); await page.waitForTimeout(900);
const u = await page.evaluate(() => new Promise((res) => {
  const o = indexedDB.open('easycraft');
  o.onsuccess = () => { const t = o.result.transaction('units','readonly').objectStore('units').getAll();
    t.onsuccess = () => res(t.result.map((x) => ({ y: x.yMm, locked: x.floorLocked, x: x.xMm }))); };
}));
ok('new cabinet sits on the floor', u[0].y === 0 && u[0].locked === true, JSON.stringify(u[0]));

/* ---- עורך פנים בניווט ---- */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(700);
ok('interior shows cells', (await page.getByRole('button', { name: /^תא 1/ }).count()) > 0);
await btn(/מדף מפריד/).click(); await page.waitForTimeout(800);
ok('shelf split makes two cells', (await page.getByRole('button', { name: /^תא [12]/ }).count()) === 2);
await full('5-interior');
await page.getByRole('button', { name: /^תא 1/ }).first().click(); await page.waitForTimeout(600);
ok('drilled into one cell', await page.getByRole('button', { name: /קושרת — חלוקה/ }).count() > 0);
await btn(/קושרת — חלוקה/).click(); await page.waitForTimeout(700);
const subCells = await page.getByRole('button', { name: /^תא [12] / }).count();
ok('divider makes sub-cells', subCells >= 2, `${subCells} cells`);
await full('6-divider');
await page.getByRole('button', { name: /^תא 2 / }).first().click(); await page.waitForTimeout(600);
ok('can delete a sub-cell', await page.getByRole('button', { name: 'הסרת התא' }).count() > 0);
await btn('הסרת התא').click(); await page.waitForTimeout(700);
ok('divider removed with last cell', await page.getByRole('button', { name: /קושרת — חלוקה/ }).count() > 0);
await full('7-after-delete');

/* ---- מבט תלת־ממד ---- */
await btn(/מבט תלת־ממדי/).click(); await page.waitForTimeout(900);
const polys = await page.locator('svg polygon').count();
ok('3D view draws boards', polys > 10, `${polys} faces`);
await shot('8-iso');
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(700);
await shot('9-iso-fronts');
await btn(/^דו־ממד/).click(); await page.waitForTimeout(600);

/* ---- ניסור ---- */
await btn(/ניסור/).click(); await page.waitForTimeout(1200);
const nestText = await dlg().innerText();
ok('nesting sheet opens', nestText.includes('ניסור הלוחות'), nestText.split('\n')[0] ?? '');
ok('nesting shows utilisation', /ניצולת/.test(nestText));
// הקבוצה הראשונה כבר פתוחה — בודקים שהפריסה מצוירת
ok('sheet layout drawn', await dlg().locator('svg rect').count() > 0);
const nestNums = (await dlg().locator('.num').allTextContents()).slice(0, 6).join(' | ');
console.log('  nesting:', nestNums);
await full('10-nesting');

console.log('errors:', errs.length ? errs.slice(0, 4) : 'none');
await b.close();
