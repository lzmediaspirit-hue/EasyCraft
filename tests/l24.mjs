import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L24-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };

await setup(page, { name: 'תהליך בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
await addUnit(page, 1);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);

/* אין מצב תהליך לפני מכירה */
ok('no work mode before the sale', await page.getByRole('button', { name: /^(תכנון|תהליך עבודה)$/ }).count() === 0);

/* מכירה */
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
await dlg().getByRole('button', { name: /מכירה והתחלת עבודה/ }).click(); await page.waitForTimeout(1000);
await full('1-sale');
const sale = dlg();
await sale.getByRole('button', { name: /סימון כנמכר/ }).click();
await page.waitForTimeout(1200);
await clear();
await full('2-after-sale');
const hasWork = await page.getByRole('button', { name: /מצב תהליך עבודה|תכנון/ }).count();
ok('work mode button after the sale', hasWork > 0, String(hasWork));

if (hasWork) {
  await page.getByRole('button', { name: /^תכנון$/ }).first().click(); await page.waitForTimeout(700);
  await full('3-work-mode');
  ok('editing tools hidden', await page.getByRole('button', { name: /הוספת ארגז/ }).count() === 0);
  await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(700);
  const w = await dlg().innerText();
  ok('work sheet opens', w.includes('גוף') && w.includes('קנטים'), w.split('\n').slice(0, 3).join(' / '));
  /* השלבים הם שרשרת: קנטים נפתח רק אחרי שהגוף נחתך */
  for (const stage of [/^מוכן לחיתוך/, /^נחתך/, /^קנטים/]) {
    await dlg().getByRole('button', { name: stage }).first().click();
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  const fills = await page.locator('g[data-unit-id] rect').evaluateAll((e) => e.map((x) => x.getAttribute('fill')));
  ok('edged cabinet turns orange', fills.includes('#fed7aa'), fills.slice(0, 6).join(','));
  await full('4-orange');
}

/* מצב תצוגה לפי תפקיד */
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
ok('role switch on home', await page.getByRole('button', { name: /תצוגה של מנהל/ }).count() === 1);
await page.getByRole('button', { name: /תצוגה של מנהל/ }).click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: 'תכנת', exact: true }).click(); await page.waitForTimeout(600);
ok('switched to planner', await page.getByRole('button', { name: /תצוגה של תכנת/ }).count() === 1);
await full('5-planner');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
