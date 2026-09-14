import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'מעקב' });
await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
await addUnit(page, 1);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);

/* מוכרים כדי שיהיה תהליך עבודה לעקוב אחריו */
const dlg = () => page.getByRole('dialog').last();
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
await dlg().getByRole('button', { name: /מכירה והתחלת עבודה/ }).click(); await page.waitForTimeout(900);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1300);
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }

/* מסמנים שלב אחד בגוף של ארגז אחד, במצב תהליך */
await btn(/^תכנון$/).click(); await page.waitForTimeout(600);
await page.locator('svg g[data-unit-id]').first().click(); await page.waitForTimeout(700);
await page.screenshot({ path: SP + '/L34-0-work-sheet.png' });
await page.getByRole('button', { name: /מוכן לחיתוך/ }).first().click(); await page.waitForTimeout(600);
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

/* חוזרים למסך התהליכים הפתוחים */
await page.goBack(); await page.waitForTimeout(600);
await page.goBack(); await page.waitForTimeout(600);
await btn(/תהליכים פתוחים|המשימות שלי/).click(); await page.waitForTimeout(1200);
await page.screenshot({ path: SP + '/L34-1-tasks.png' });

const svgs = await page.locator('main li svg').count();
ok(svgs >= 1, 'תמונת הפרויקט מוצגת בשורה', `${svgs} תמונות`);
const txt = await page.innerText('main');
const pct = txt.match(/(\d+)%/);
ok(!!pct, 'אחוז ההשלמה מוצג', pct?.[0]);
ok(pct && Number(pct[1]) > 0 && Number(pct[1]) < 100, 'האחוז משקף התקדמות חלקית', pct?.[0]);

/* לחיצה פותחת את ההדמיה במצב מעקב */
await page.locator('main li button').first().click(); await page.waitForTimeout(1400);
await page.screenshot({ path: SP + '/L34-2-design-work.png' });
const body = await page.innerText('body');
ok(body.includes('תהליך'), 'ההדמיה נפתחת במצב תהליך עבודה');
ok(!body.includes('הוספת ארגז'), 'במצב תהליך אין כפתור הוספה');

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
