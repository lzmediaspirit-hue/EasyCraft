import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404') && errs.push(`${m.type()}: ${m.text().slice(0, 160)}`));
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 160)));
const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'ממשק', walls: 'שני קירות' });

/* --- נתונים סגורים בפתיחה --- */
const body = await page.innerText('body');
ok(body.includes('הצגת הנתונים'), 'הנתונים סגורים בפתיחת ההדמיה');
ok(!body.includes('שטח הקיר'), 'המחוונים אינם מוצגים');
await page.screenshot({ path: SP + '/L44-1-open.png' });

/* --- מתג שורת הקירות ליד המחשבון --- */
const wallsBtn = page.getByRole('button', { name: 'שורת הקירות' });
ok(await wallsBtn.count() === 1, 'מתג שורת הקירות קיים');
ok(await page.getByRole('button', { name: /קיר א׳/ }).count() === 1, 'שורת הקירות מוצגת');
await wallsBtn.click(); await page.waitForTimeout(500);
ok(await page.getByRole('button', { name: /קיר א׳/ }).count() === 0, 'המתג מסתיר את שורת הקירות');
await wallsBtn.click(); await page.waitForTimeout(500);
ok(await page.getByRole('button', { name: /קיר א׳/ }).count() === 1, 'והמתג מחזיר אותה');

/* --- ההדמיה ללקוח היא אייקון בפינה --- */
const present = page.getByRole('button', { name: 'הדמיה ללקוח' });
ok(await present.count() === 1, 'ההדמיה ללקוח היא אייקון');
ok(!(await page.innerText('body')).includes('ללקוח\n'), 'אין יותר כפתור "ללקוח" בסרגל');
ok(!(await present.isEnabled()), 'האייקון כבוי בלי ארגזים');
await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);
ok(await present.isEnabled(), 'האייקון נדלק כשיש ארגזים');
await present.click(); await page.waitForTimeout(1200);
ok((await page.getByRole('dialog').last().innerText()).includes('הגוונים שנבחרו'), 'ההדמיה ללקוח נפתחת');
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
await page.screenshot({ path: SP + '/L44-2-header.png' });

/* --- מרכוז לפני גוון לכולם --- */
const order = await page.locator('button').evaluateAll((els) =>
  els.map((e) => (e.textContent || '').trim()).filter((t) => t === 'מרכוז' || t === 'גוון לכולם'));
ok(JSON.stringify(order) === JSON.stringify(['מרכוז', 'גוון לכולם']), 'מרכוז לפני גוון לכולם', order.join(','));

console.log('console noise:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
