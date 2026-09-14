import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const shot = (n) => page.screenshot({ path: `${SP}/L10-${n}.png` });
const full = (n) => page.screenshot({ path: `${SP}/L10-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ===== 1. כניסת מנהל ===== */
/*
  הקמת הצוות בקוד מנהל הוחלפה בחשבון admin שנוצר מראש (admin.mjs
  מכסה אותו); כאן רק נכנסים, וממשיכים למה שהבדיקה הזאת באמת בודקת.
*/
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1400);
await shot('1-login');

/* ===== לקוח ופרויקט ===== */
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
ok('no calculator on customers screen', await page.getByRole('button', { name: 'מחשבון' }).count() === 0);
await btn(/לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(400);
const f = page.locator('form input');
await f.nth(0).fill('משפחת ברק'); await f.nth(1).fill('נתניה');
await btn('שמירה').click(); await page.waitForTimeout(500);
await btn(/לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(400);
await page.locator('form input').nth(0).fill('דנה שגב');
await page.locator('form input').nth(1).fill('חדרה');
await btn('שמירה').click(); await page.waitForTimeout(500);

/* ===== 3. ארכיון ומחיקה ===== */
await page.getByRole('button', { name: /פעולות לדנה שגב/ }).click(); await page.waitForTimeout(400);
await btn(/סיים — העברה לארכיון/).click(); await page.waitForTimeout(700);
ok('archived customer left active list', await page.getByRole('button', { name: /דנה שגב/ }).count() === 0);
await btn('לקוחות שסיימו').click(); await page.waitForTimeout(700);
ok('archive screen lists them', await page.getByRole('button', { name: /דנה שגב/ }).count() > 0);
await full('4-archive');
await btn('חזרה').click(); await page.waitForTimeout(600);

await btn(/משפחת ברק/).click(); await page.waitForTimeout(500);
await btn('פרויקט חדש').click(); await page.waitForTimeout(300);
await btn(/מטבח/).click(); await page.waitForTimeout(250);
await pickWalls(page, 2); await page.waitForTimeout(250);
await btn(/^קיר נקי/).click(); await page.waitForTimeout(250);
const n = dlg().locator('input[type="number"]');
await n.nth(0).fill('260'); await n.nth(1).fill('400'); await n.nth(2).fill('300');
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1000);

/* ===== 4 + 7. מחשבון כן, תהליך לא ===== */
ok('calculator on design screen', await page.getByRole('button', { name: 'מחשבון' }).count() > 0);
ok('no workflow tool on design screen', await page.getByRole('button', { name: /^תהליך/ }).count() === 0);

await btn('הוספת ארגז').click(); await page.waitForTimeout(500);
await btn(/^ארגז שתי דלתות/).click(); await page.waitForTimeout(800);

/* ===== 2. גובה הלוח נגרר ===== */
const sep = page.getByRole('separator', { name: 'גובה לוח העריכה' });
ok('panel resize handle exists', await sep.count() > 0);
const panelBefore = (await page.locator('.rounded-t-3xl').first().boundingBox())?.height ?? 0;
await sep.focus();
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(500);
const panelAfter = (await page.locator('.rounded-t-3xl').first().boundingBox())?.height ?? 0;
ok('panel grows when dragged', panelAfter > panelBefore + 20, `${Math.round(panelBefore)} -> ${Math.round(panelAfter)}`);
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);
await shot('5-panel');

/* ===== 6. הצמדה לרצפה בגרירה ===== */
const readUnits = () =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const open = indexedDB.open('easycraft');
        open.onsuccess = () => {
          const tx = open.result.transaction('units', 'readonly');
          const all = tx.objectStore('units').getAll();
          all.onsuccess = () => res(all.result.map((u) => ({ y: u.yMm, locked: u.floorLocked, h: u.heightMm })));
        };
      }),
  );
// ניתוק מהרצפה, גרירה למעלה, ואז גרירה חזרה למטה בגסות
await btn('הצמדה לרצפה').click(); await page.waitForTimeout(600);
// גרירה מהארגז עצמו, לפי המיקום המצויר שלו
const grab = async () => {
  /* מהארגז עצמו: המסגרת של הקבוצה כוללת גם את כפתורי הארגז הנבחר */
  const bb = await page.locator('g[data-unit-id] rect').first().boundingBox();
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, h: bb.height };
};
let g = await grab();
await page.mouse.move(g.x, g.y);
await page.mouse.down();
await page.mouse.move(g.x, g.y - g.h * 1.6, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(600);
let u = (await readUnits())[0];
ok('unlocked unit lifts off floor', u.y > 100, `y=${u.y}`);
// גרירה חזרה למטה — בגסות, לא מדויק
g = await grab();
await page.mouse.move(g.x, g.y);
await page.mouse.down();
await page.mouse.move(g.x, g.y + g.h * 2.2, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(700);
u = (await readUnits())[0];
/* ההצמדה לרצפה היא מתג מפורש היום; הגרירה רק מחזירה לגובה 0 */
ok('rough drag snaps to floor', u.y === 0, `y=${u.y} locked=${u.locked}`);
await shot('6-floor');

/* ===== 12 + 14 + 15. קושרות, כוורת, גובה נעול ואזהרה ===== */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(600);
await btn(/מדף מפריד/).click(); await page.waitForTimeout(700);
ok('divider creates two cells', (await page.getByRole('button', { name: /^תא [12]/ }).count()) === 2);
await full('7-divider');

/*
  כוורת היין ירדה עם מודל האזורים; מה שנשאר הוא תוכן לכל תא —
  מדפים, מגירות, מוט או חלל פתוח.
*/
await page.getByRole('button', { name: /^תא 2/ }).click(); await page.waitForTimeout(500);
await btn(/^מוט תלייה$/).click(); await page.waitForTimeout(600);
ok('cell content changes', (await page.innerText('body')).includes('מוט תלייה'), '');
await full('8-cell-content');

// גובה נעול — האזור נשאר, והארון גדל
const before = (await readUnits())[0].h;
await page.getByRole('button', { name: 'נעילת גובה התא' }).first().click();
await page.waitForTimeout(500);
await page.getByLabel('גובה התא').first().fill('180');
await page.waitForTimeout(900);
const after = (await readUnits())[0].h;
ok('locked zone grows the cabinet', after > before, `${before} -> ${after}`);
await full('9-locked-height');

await b.close();
console.log('errors:', errs.length ? errs.slice(0, 4) : 'none');
