import './_exit.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L17-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1500);

/* ---- הגדרות: גוונים וחומרים ---- */
await btn('הגדרות').click(); await page.waitForTimeout(1000);
const body = await page.innerText('main');
ok('finishes section', body.includes('גוונים') && body.includes('לבן'), '');
ok('materials section', body.includes('לוחות') && body.includes('סנדוויץ׳'));
ok('default back kind', body.includes('הגב של ארגז חדש'));
ok('no yield slider', !body.includes('ניצולת פלטה'));
await full('1-settings');

await btn(/^לבן/).click(); await page.waitForTimeout(700);
const fs = await dlg().innerText();
ok('finish prices per material', fs.includes('מחיר לפלטה, לפי ליבה') && fs.includes('MDF'));
ok('finish has matching edge', fs.includes('קנט תואם'));
await full('2-finish');
await clear();
await page.goBack(); await page.waitForTimeout(800);

/* ---- פרויקט + ארגז ---- */
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('חומרים בע״מ');
await dlg().getByLabel(/עיר/).fill('מודיעין');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/חומרים בע״מ/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(900);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(900);
await btn(/קיר נקי/).click(); await page.waitForTimeout(900);
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1600);
await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
await dlg().locator('div.relative > button').first().click(); await page.waitForTimeout(1200);
const ed = await page.innerText('body');
ok('editor shows part rows', ed.includes('גוף') && ed.includes('חזיתות'), '');
ok('no exposed row without exposed sides', !ed.includes('דפנות זרות\nלא נבחר'), '');
await full('3-editor');

await page.getByRole('button', { name: /לא נבחר גוון/ }).first().click();
await page.waitForTimeout(600);
await full('4-choice-open');
const open = await page.innerText('body');
ok('material chips appear', open.includes('חומר') && open.includes('סנדוויץ׳'));

await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
await page.waitForTimeout(500);

/* ---- חישוב ---- */
await btn(/^חישוב/).click(); await page.waitForTimeout(1800);
const calc = await dlg().innerText();
ok('calc lists finish · material', calc.includes('לבן') || calc.includes('בלי גוון'), calc.slice(0, 200).replace(/\n/g, ' / '));
await full('5-calc');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
