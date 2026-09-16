import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L49-${n}.png`, fullPage: true });
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'זוויות בע״מ' });
/* ארגז גבוה עם דלתות */
await addUnit(page, 0);
await page.waitForTimeout(400);
/* גובה גדול, כדי שיהיה מקום לשלושה תאים */
await btn(/גובה/).click(); await page.waitForTimeout(400);
await btn(/הקלדת גובה מדויק/).click(); await page.waitForTimeout(400);
const h = page.getByRole('spinbutton', { name: 'גובה מדויק' });
await h.fill('200'); await page.keyboard.press('Enter');
await page.waitForTimeout(700);

/* עורך הפנים נפתח רק במצב "פנים" */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(700);

/* --- שלושה תאים, מגירות באמצע --- */
const split = btn(/מדף מפריד/);
await split.scrollIntoViewIfNeeded();
await split.click(); await page.waitForTimeout(500);
await split.click(); await page.waitForTimeout(500);
const cells = await page.getByRole('button', { name: /^תא \d/ }).count();
ok('three cells', cells === 3, String(cells));
await page.getByRole('button', { name: /^תא 2/ }).click(); await page.waitForTimeout(500);
await btn(/^מגירות$/).click(); await page.waitForTimeout(700);
await full('1-editor');
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(600);
await full('2-elevation');

/*
  הדלתות אינן חוצות את פס המגירות: מעל המגירה ומתחתיה שתי חזיתות
  נפרדות, ולכן שתי ידיות — ידית אחת פירושה דלת אחת שנמתחה על הכול.
*/
const handles = await page
  .locator('g[data-unit-id] line')
  .evaluateAll((els) =>
    els
      .map((e) => ['x1', 'y1', 'x2', 'y2'].map((k) => +e.getAttribute(k)))
      .filter(([x1, y1, x2, y2]) => Math.abs(x1 - x2) < 1 && Math.abs(y2 - y1) < 400)
      .map(([, y1]) => Math.round(y1)),
  );
ok('two door fronts, one handle each', handles.length === 2, handles.join(','));

/* --- תלת־ממד: משטח, חזית מכשיר --- */
await btn(/מבט תלת־ממדי/).click(); await page.waitForTimeout(900);
await full('3-iso');
ok('3D draws the cabinet', (await page.locator('polygon').count()) > 10, '');

await b.close();
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
