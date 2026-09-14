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
await btn(/^הגדרות$/).click(); await page.waitForTimeout(1300);
await page.screenshot({ path: SP + '/L46-1-settings.png' });

/* --- גוונים לפי מרקם --- */
const body = await page.innerText('body');
for (const t of ['מט', 'יער', 'סטון']) ok(body.includes(t), `קטגוריית מרקם: ${t}`);
/* הכותרת של הקבוצה מופיעה לפני הגוון שלה */
const order = await page.locator('section').filter({ hasText: 'גוונים' }).first()
  .locator('h3, button span.font-semibold').allInnerTexts();
console.log('order:', JSON.stringify(order.slice(0, 12)));

/* --- חומרים: שם ואייקון בלבד --- */
ok(!body.includes('פלטה 122'), 'רשימת החומרים בלי מידות פלטה');
const matRow = page.locator('section').filter({ hasText: 'חומרים' }).last()
  .locator('li button').first();
const matTxt = (await matRow.innerText()).trim();
ok(/^[^\n]+$/.test(matTxt), 'שורת חומר היא שורה אחת', JSON.stringify(matTxt));
ok(await matRow.locator('svg').count() >= 2, 'לשורת החומר יש אייקון', String(await matRow.locator('svg').count()));

/* --- מרקם חדש מאחורי עיפרון --- */
await btn(/^לבן/).click(); await page.waitForTimeout(900);
ok(await dlg().getByLabel('מרקם חדש').count() === 0, 'שדה המרקם מוסתר');
const pencil = dlg().getByRole('button', { name: 'הוספת מרקם' });
ok(await pencil.count() === 1, 'עיפרון להוספת מרקם');
await pencil.click(); await page.waitForTimeout(400);
ok(await dlg().getByLabel('מרקם חדש').count() === 1, 'העיפרון פותח את השדה');
await dlg().getByLabel('מרקם חדש').fill('בטון');
await dlg().getByRole('button', { name: 'שמירת המרקם' }).click(); await page.waitForTimeout(500);
ok((await dlg().innerText()).includes('בטון'), 'המרקם החדש נבחר');
await page.screenshot({ path: SP + '/L46-2-texture.png' });
await dlg().getByRole('button', { name: /שמירה/ }).click(); await page.waitForTimeout(900);
ok((await page.innerText('body')).includes('בטון'), 'המרקם החדש הפך לקטגוריה');
await page.screenshot({ path: SP + '/L46-3-grouped.png' });

console.log('console noise:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
