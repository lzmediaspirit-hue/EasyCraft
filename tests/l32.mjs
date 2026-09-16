import './_exit.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1600);

// --- מלאי לוחות: מיון לפי מרקם ---
await btn(/מלאי לוחות|מלאי/).click(); await page.waitForTimeout(1200);
/*
  הרשימה מציגה רק לוחות שיש בהם מספר; בלי פרויקטים מוסיפים שניים
  ביד, בשני מרקמים, כדי שיהיה מה למיין.
*/
for (const name of ['אלון טבעי', 'אפור בטון']) {
  await btn(/הוספת לוח למלאי/).click(); await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.waitForTimeout(400);
  await dlg().getByRole('button', { name: 'הוספה למלאי' }).click(); await page.waitForTimeout(900);
}
const body = await page.innerText('body');
ok(body.includes('מרקם'), 'שורת מיון כוללת מרקם');
await page.getByRole('button', { name: 'מרקם', exact: true }).last().click();
await page.waitForTimeout(600);
const order = await page.locator('ul li span.block.truncate.text-\\[10px\\]').allInnerTexts();
console.log('rows:', JSON.stringify(order));
const tex = order.map((t) => (t.split('·')[1] ?? '').trim()).filter(Boolean);
ok(tex.length > 0, 'המרקם מוצג בשורה', tex.join(','));
const sorted = [...tex].sort((a, b) => a.localeCompare(b, 'he'));
ok(JSON.stringify(tex) === JSON.stringify(sorted), 'השורות ממוינות לפי מרקם', tex.join(','));
await page.screenshot({ path: SP + '/L32-1-stock-texture.png' });

// --- גוון: מרקם אחד בלבד ---
await page.goBack(); await page.waitForTimeout(800);
await btn(/הגדרות/).click(); await page.waitForTimeout(1000);
await btn(/^לבן/).click(); await page.waitForTimeout(800);
const hint = await page.innerText('body');
ok(hint.includes('מרקם אחד ללוח'), 'ההסבר אומר מרקם אחד');
const pressed = () => dlg().locator('button[aria-pressed="true"]').allInnerTexts();
await dlg().getByRole('button', { name: 'יער', exact: true }).click(); await page.waitForTimeout(300);
let p1 = await pressed();
ok(p1.filter((t) => ['מט', 'יער', 'סטון', 'טפ', 'טרוונטין'].includes(t)).length === 1,
  'בחירת מרקם שני מחליפה את הראשון', p1.join(','));
await page.screenshot({ path: SP + '/L32-2-finish-texture.png' });
await dlg().getByRole('button', { name: /שמירה/ }).click(); await page.waitForTimeout(900);
ok((await page.innerText('body')).includes('יער'), 'המרקם נשמר ומוצג ברשימה');

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
