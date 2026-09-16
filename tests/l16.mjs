import './_exit.mjs';
import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L16-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1200);

/* ---- מחשבון: מלוא המסך, בלי קריסה ---- */
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('בדיקה 13');
await dlg().getByLabel(/עיר/).fill('אשדוד');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/בדיקה 13/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(900);
await pickWalls(page, 2); await page.waitForTimeout(900);
await btn(/קיר נקי/).click(); await page.waitForTimeout(900);
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1600);

await btn(/מחשבון/).click(); await page.waitForTimeout(700);
const cbox = await dlg().boundingBox();
ok('calculator not clipped', cbox.height > 300, JSON.stringify(cbox));
await full('1-calc');
for (const k of ['1','2','0','+','8','5','=']) { await dlg().getByRole('button', { name: k, exact: true }).click(); await page.waitForTimeout(120); }
ok('calculator computes', (await dlg().innerText()).includes('205'), (await dlg().innerText()).split('\n')[1] ?? '');
ok('no crash', errs.length === 0, errs.join('|'));
await clear();

/* ---- שתי שורות כפתורים ---- */
const tools = await page.locator('header > div').evaluateAll((els) =>
  els.map((e) => [...e.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean)),
);
ok('two tool rows', JSON.stringify(tools).includes('ניסור') && JSON.stringify(tools).includes('מבט על'), JSON.stringify(tools));
await full('2-tools');

/* ---- ארגז, עיפרון בקרוסלה ---- */
await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
await dlg().locator('div.relative > button').first().click(); await page.waitForTimeout(900);
ok('no keyboard field on the axis tab', await page.locator('input[aria-label="רוחב"]').count() === 0);
ok('pencil at carousel end', await page.getByRole('button', { name: /הקלדת רוחב מדויק/ }).count() > 0);
await full('3-editor');
await page.getByRole('button', { name: /הקלדת רוחב מדויק/ }).click(); await page.waitForTimeout(400);
ok('pencil opens a field', await page.locator('input[aria-label="רוחב מדויק"]').count() === 1);
await full('4-pencil');

/* ---- ביטול נעילה לרצפה נשאר מבוטל ---- */
await page.getByRole('button', { name: /נעילה לרצפה|צמוד לרצפה|רצפה/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
await full('5-unlocked');

/* ---- פינה פתוחה לכל ארגז ---- */
await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
await page.waitForTimeout(400);

/* ---- תלת־ממד: גרירה מסובבת ---- */
await btn(/^תלת־ממד/).click(); await page.waitForTimeout(1000);
const svg = page.locator('svg').filter({ has: page.locator('polygon') }).first();
const bb = await svg.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2 - 90, bb.y + bb.height / 2 + 30, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(600);
ok('orbit changed the view', await page.getByRole('button', { name: 'זווית התחלתית' }).count() === 1);
await full('6-orbit');
await page.getByRole('button', { name: 'זווית התחלתית' }).click(); await page.waitForTimeout(500);
ok('reset works', await page.getByRole('button', { name: 'זווית התחלתית' }).count() === 0);

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
