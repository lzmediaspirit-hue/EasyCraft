import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L25-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };

await setup(page, { name: 'מלאי בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
await addUnit(page, 1);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
/* מוכרים, כדי שהדרישה תיספר */
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
await dlg().getByRole('button', { name: /מכירה והתחלת עבודה/ }).click(); await page.waitForTimeout(900);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1200);
await clear();

await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
ok('stock button on home', await page.getByRole('button', { name: 'מלאי לוחות' }).count() === 1);
await page.getByRole('button', { name: 'מלאי לוחות' }).click(); await page.waitForTimeout(1500);
const t = await page.innerText('main');
ok('stock table', t.includes('גוון · ליבה') && t.includes('צריך') && t.includes('הוזמן'), '');
ok('filters and sorting', t.includes('ליבה') && t.includes('מיון') && t.includes('רק מה שחסר'), '');
const rowText = (await page.locator('li').filter({ hasText: 'לבן' }).first().innerText()).replace(/\n/g, ' ');
ok('demand counted from the sold project', /[1-9]/.test(rowText), rowText);
ok('edge banding per finish', t.includes('אין קנט תואם') || t.includes('יש קנט תואם'));
await full('1-stock');

/* מזינים מלאי */
await page.getByLabel(/^במלאי /).first().fill('2'); await page.waitForTimeout(600);
await page.getByLabel(/^הוזמן /).first().fill('3'); await page.waitForTimeout(700);
ok('receive button appears', await page.getByRole('button', { name: /ההזמנה הגיעה/ }).count() >= 1);
await page.getByRole('button', { name: /ההזמנה הגיעה/ }).first().click(); await page.waitForTimeout(800);
ok('order moved into stock', (await page.getByLabel(/^במלאי /).first().inputValue()) === '5', await page.getByLabel(/^במלאי /).first().inputValue());
await page.getByRole('button', { name: /אין קנט תואם/ }).first().click(); await page.waitForTimeout(500);
const after = await page.innerText('main');
ok('stock saved', after.includes('יש קנט תואם'), '');
await full('2-filled');
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'מלאי לוחות' }).click(); await page.waitForTimeout(1500);
ok('stock persists', (await page.getByLabel(/^במלאי /).first().inputValue()) === '5');
await page.getByRole('button', { name: 'רק מה שחסר' }).click(); await page.waitForTimeout(500);
await full('3-only-missing');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
