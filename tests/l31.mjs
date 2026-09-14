import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'שכבה16' });
await addUnit(page, 0);            // ארגז תחתון עם דלתות
await page.waitForTimeout(600);

// --- א. "גובה הדלת" ירד מהעורך ---
ok((await page.getByRole('button', { name: 'גובה הדלת' }).count()) === 0, 'אין עוד גובה דלת במנגנון הפתיחה');

// --- ג. תאים בין הדלתות עברו לתצוגת פנים ---
await page.getByRole('button', { name: /^דלתות$/ }).first().waitFor().catch(() => {});
await page.getByRole('button', { name: '2', exact: true }).first().click(); // 2 דלתות
await page.waitForTimeout(500);
ok(await page.getByText('תאים בין הדלתות').count() === 0, 'תאים בין הדלתות אינם בתצוגת חזית');
await btn(/הסתרת חזיתות/).click();
await page.waitForTimeout(600);
await page.screenshot({ path: SP + '/L31-3-inside.png' });
ok(await page.getByText('תאים בין הדלתות').count() === 1, 'תאים בין הדלתות מוצגים בתצוגת פנים');

console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
