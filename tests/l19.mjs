import './_exit.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L19-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1500);

/* לקוח + פרויקט, כדי שיהיה מה לקבוע */
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('התקנות בע״מ');
await dlg().getByLabel(/עיר/).fill('רמלה');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/התקנות בע״מ/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(700);
await btn(/קיר נקי/).click(); await page.waitForTimeout(700);
await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click(); await page.waitForTimeout(1600);

/* חזרה הביתה וללוח ההתקנות */
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await btn(/לוח התקנות/).click(); await page.waitForTimeout(1000);
ok('calendar opens', (await page.innerText('main')).includes('לוח התקנות') || (await page.innerText('body')).includes('לוח התקנות'));
ok('schedule button', await page.getByRole('button', { name: 'קביעת התקנה' }).count() === 1);
await full('1-calendar');

await page.getByRole('button', { name: 'קביעת התקנה' }).click(); await page.waitForTimeout(800);
const t = await dlg().innerText();
ok('sheet lists projects', t.includes('מטבח') && t.includes('התקנות בע״מ'), t.slice(0, 150).replace(/\n/g, ' / '));
ok('closed toggle', t.includes('כולל פרויקטים שנסגרו'));
await full('2-sheet');
await dlg().getByRole('button', { name: /מטבח/ }).first().click(); await page.waitForTimeout(1200);
const after = await page.innerText('body');
ok('installation appears on the day', after.includes('מטבח') && after.includes('התקנות בע״מ'), '');
await full('3-scheduled');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
