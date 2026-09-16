import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const shot = (n) => page.screenshot({ path: `${SP}/L50-${n}.png`, fullPage: true });

/** קורא טבלה מתוך IndexedDB, כדי לבדוק מצב ולא מסך */
const rows = (table) =>
  page.evaluate(
    (t) =>
      new Promise((res) => {
        const open = indexedDB.open('easycraft');
        open.onsuccess = () => {
          const all = open.result.transaction(t).objectStore(t).getAll();
          all.onsuccess = () => res(all.result);
        };
      }),
    table,
  );

await setup(page, { name: 'מלאי בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(500);

/* מוכרים, ואז מסמנים חיתוך — זה מה שמוריד פלטות מהמלאי */
await btn(/^חזרה$/).click().catch(() => {});
await page.waitForTimeout(700);
await btn(/^מכירה$/).click(); await page.waitForTimeout(800);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1200);
await page.locator('main li button').first().click(); await page.waitForTimeout(1000);

await btn(/^תכנון$/).click().catch(() => {});
await page.waitForTimeout(700);
await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(800);
for (const stage of [/^מוכן לחיתוך/, /^נחתך/]) {
  await dlg().getByRole('button', { name: stage }).first().click();
  await page.waitForTimeout(500);
}
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
await shot('1-cut');

const stockAfterCut = await rows('stock');
const used = stockAfterCut.reduce((n, r) => n + r.sheets, 0);
ok('cutting takes sheets out of stock', used < 0, `sheets=${used}`);
const consumed = await rows('consumption');
ok('consumption recorded', consumed.length > 0, `${consumed.length} rows`);

/* מוחקים את הלקוח על כל הפרויקטים שלו — הפלטות חוזרות */
await btn(/^חזרה$/).click(); await page.waitForTimeout(800);
await btn(/^חזרה$/).click(); await page.waitForTimeout(800);
await page.getByRole('button', { name: /פעולות ל/ }).first().click(); await page.waitForTimeout(500);
await shot('2-actions');
await page.getByRole('button', { name: 'מחיקה', exact: true }).click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'כן, למחוק' }).click();
await page.waitForTimeout(1600);
await shot('3-deleted');

const back = (await rows('stock')).reduce((n, r) => n + r.sheets, 0);
ok('deleting the customer returns the sheets', back === 0, `sheets=${back}`);
ok('consumption cleared', (await rows('consumption')).length === 0, '');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
