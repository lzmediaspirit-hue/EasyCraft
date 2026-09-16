import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit, pickFinishes } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const shot = (n) => page.screenshot({ path: `${SP}/L51-${n}.png`, fullPage: true });
const rowNames = () =>
  page.locator('main ul li span.font-medium').evaluateAll((e) => e.map((x) => x.textContent.trim()));

await setup(page, { name: 'מלאי בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(400);
/* מוכרים, כדי שתהיה דרישה אמיתית */
await btn(/^חזרה$/).click(); await page.waitForTimeout(700);
await btn(/^מכירה$/).click(); await page.waitForTimeout(800);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1200);
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

/* --- מסך המלאי --- */
await btn(/^חזרה$/).click(); await page.waitForTimeout(700);
await btn(/מלאי/).click(); await page.waitForTimeout(1400);
await shot('1-stock');

const names = await rowNames();
ok('only rows with a number', names.length > 0 && names.length <= 4, names.join(','));
ok('no empty finishes listed', !names.includes('אפור בטון'), names.join(','));

/* --- מיון בלחיצה על המספרים --- */
for (const label of ['במלאי', 'הוזמן', 'חסר']) {
  const t = page.getByRole('button', { name: `מיון לפי ${label}` });
  ok(`${label} sorts`, (await t.count()) >= 1);
}
await page.getByRole('button', { name: 'מיון לפי חסר' }).first().click(); await page.waitForTimeout(500);
ok('missing sort is on', (await page.getByRole('button', { name: 'מיון לפי חסר' }).first().getAttribute('aria-pressed')) === 'true');
const byMissing = await rowNames();
await page.getByRole('button', { name: 'מיון לפי מלאי' }).first().click(); await page.waitForTimeout(500);
ok('stock sort is on', (await page.getByRole('button', { name: 'מיון לפי מלאי' }).first().getAttribute('aria-pressed')) === 'true');
await shot('2-sorted');

/* --- הוספת לוח ידנית --- */
const before = (await rowNames()).length;
await btn(/הוספת לוח למלאי/).click(); await page.waitForTimeout(700);
await dlg().getByRole('button', { name: /^אלון טבעי/ }).first().click(); await page.waitForTimeout(400);
await dlg().getByRole('button', { name: /^3$/ }).first().click(); await page.waitForTimeout(300);
await shot('3-add');
await dlg().getByRole('button', { name: 'הוספה למלאי' }).click(); await page.waitForTimeout(1000);
const after = await rowNames();
ok('manual board appears', after.length === before + 1 && after.some((n) => n.includes('אלון')), after.join(','));
await shot('4-added');
console.log('missing-order:', byMissing.join(','));

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
