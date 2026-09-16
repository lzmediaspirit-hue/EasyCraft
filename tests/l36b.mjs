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
await btn('כניסה').click(); await page.waitForTimeout(1500);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('אשף');
await dlg().getByLabel(/עיר/).fill('רמלה');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/אשף/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(700);

/* מסלול "יש סימונים": כאן יושב עורך הגרירה */
await page.screenshot({ path: SP + '/L36-3-conditions.png' });
console.log('COND:', (await dlg().getByRole('button').allInnerTexts()).join('|').replace(/\n/g, ' ').slice(0, 300));
await btn(/יש מה לסמן/).click(); await page.waitForTimeout(800);
await dlg().getByRole('button', { name: /המשך לסימונים/ }).click(); await page.waitForTimeout(800);
await page.screenshot({ path: SP + '/L36-4-wizard-features.png' });
const txt = await dlg().innerText();
console.log('STEP:', txt.replace(/\n/g, ' / ').slice(0, 300));
ok(await dlg().locator('svg line').count() > 0, 'הקיר מצויר באשף');
await dlg().getByRole('button', { name: 'חלון', exact: true }).click(); await page.waitForTimeout(700);
ok((await dlg().innerText()).includes('רוחב החלון'), 'אפשר להניח סימון באשף');
await page.screenshot({ path: SP + '/L36-5-wizard-window.png' });

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
