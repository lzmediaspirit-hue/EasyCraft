import './_exit.mjs';
import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404') && errs.push(`${m.type()}: ${m.text().slice(0, 160)}`));
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 160)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1600);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('שרטוט');
await dlg().getByLabel(/עיר/).fill('מודיעין');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/שרטוט/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
await pickWalls(page, 'מורכב'); await page.waitForTimeout(900);

/* כל הכלים קיימים */
for (const t of ['בטל', 'חזור', 'ציור בנגיעה', 'הצמדה ל־90°', 'התרחקות', 'התקרבות', 'מחיקת הכול'])
  ok(await dlg().getByRole('button', { name: t }).count() === 1, `כלי קיים: ${t}`);
await page.screenshot({ path: SP + '/L45-1-tools.png' });

const svg = dlg().locator('svg:has(rect[fill="url(#room-grid)"])').first();
const box = await svg.boundingBox();
const tapAt = async (fx, fy) => {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(400);
};
const corners = () => svg.locator('circle').count();

/* --- עיפרון: נגיעות מוסיפות פינות --- */
await tapAt(0.25, 0.25); console.log('after tap1:', await corners());
await tapAt(0.75, 0.25); console.log('after tap2:', await corners());
await tapAt(0.75, 0.7); console.log('after tap3:', await corners());
let n = await corners();
ok(n === 3, 'שלוש נגיעות = שלוש פינות', String(n));
await page.screenshot({ path: SP + '/L45-2-drawn.png' });

/* --- בטל וחזור --- */
await dlg().getByRole('button', { name: 'בטל' }).click(); await page.waitForTimeout(500);
ok((await corners()) === 2, 'בטל מסיר את הפינה האחרונה', String(await corners()));
await dlg().getByRole('button', { name: 'חזור' }).click(); await page.waitForTimeout(500);
ok((await corners()) === 3, 'חזור מחזיר אותה', String(await corners()));

/* --- זום משנה את חלון התצוגה --- */
const vb = () => svg.getAttribute('viewBox');
const before = await vb();
await dlg().getByRole('button', { name: 'התקרבות' }).click(); await page.waitForTimeout(400);
const after = await vb();
ok(before !== after, 'התקרבות משנה את חלון התצוגה', `${before} → ${after}`);
ok(Number(after.split(' ')[2]) < Number(before.split(' ')[2]), 'התקרבות מקטינה את השטח הנראה');
await dlg().getByRole('button', { name: 'התרחקות' }).click(); await page.waitForTimeout(400);
ok((await vb()) === before, 'התרחקות מחזירה', await vb());
await page.screenshot({ path: SP + '/L45-3-zoom.png' });

/* --- מחיקה --- */
await dlg().getByRole('button', { name: /מחיקת הפינה האחרונה|מחיקת הקיר שנבחר/ }).click();
await page.waitForTimeout(500);
ok((await corners()) === 2, 'מחיקה מסירה פינה', String(await corners()));
await dlg().getByRole('button', { name: 'מחיקת הכול' }).click(); await page.waitForTimeout(500);
ok((await corners()) === 0, 'מחיקת הכול מנקה את השרטוט', String(await corners()));

/* --- בלי עיפרון: נגיעה בוחרת קיר --- */
await dlg().getByRole('button', { name: 'ציור בנגיעה' }).click(); await page.waitForTimeout(300);
await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 10 });
await page.mouse.up(); await page.waitForTimeout(500);
ok((await corners()) === 2, 'גרירה מותחת קיר גם בלי עיפרון', String(await corners()));
await tapAt(0.47, 0.3);
ok(await dlg().getByRole('button', { name: 'מחיקת הקיר שנבחר' }).count() === 1, 'נגיעה בקיר בוחרת אותו למחיקה');
await page.screenshot({ path: SP + '/L45-4-picked.png' });

console.log('console noise:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
