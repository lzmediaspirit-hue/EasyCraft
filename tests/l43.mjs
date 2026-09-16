import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
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

await setup(page, { name: 'גוונים' });

/* גוון שקיים רק על MDF — כך אפשר לראות את הסינון */
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  const mats = await new Promise((res) => { const t = db.transaction('materials').objectStore('materials').getAll(); t.onsuccess = () => res(t.result); });
  /* לפי הליבה ולא לפי השם: שם הלוח נגזר מהעובי ומהצבע, והוא משתנה */
  const mdf = mats.find((m) => m.core === 'mdf');
  const now = Date.now();
  /* גוון חדש שייך לנגרייה של הלוח שהוא מתומחר עליו */
  db.transaction('finishes', 'readwrite').objectStore('finishes').put({
    id: 'only-mdf', name: 'לכה כחולה', hex: '#2f4f8f', texture: 'מט',
    prices: { [mdf.id]: { consumerPrice: 600 } },
    workshopId: mdf.workshopId, rev: 1, createdAt: now, updatedAt: now,
  });
});
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await btn(/גוונים/).click(); await page.waitForTimeout(800);
await btn(/מטבח/).first().click(); await page.waitForTimeout(1400);
await addUnit(page, 0);
await page.waitForTimeout(600);

/* חזיתות: הגוון של ה-MDF מוצע */
const openRow = async (label) => {
  const row = page.getByRole('button', { name: new RegExp(label) }).first();
  await row.click(); await page.waitForTimeout(500);
};
const frontRow = page.locator('button[aria-expanded]').filter({ hasText: /לבן/ });
await page.screenshot({ path: SP + '/L43-1-fronts.png' });
const rows = await page.locator('button[aria-expanded]').allInnerTexts();
console.log('rows:', JSON.stringify(rows));
await page.locator('button[aria-expanded]').first().click(); await page.waitForTimeout(600);
const frontOffer = await page.locator('button[aria-expanded="true"] ~ div button, [aria-expanded="true"]').evaluateAll(() => []);
const bodyTxt = await page.innerText('body');
ok(bodyTxt.includes('לכה כחולה'), 'גוון של MDF מוצע לחזיתות', rows.join(' | '));
await page.screenshot({ path: SP + '/L43-2-front-open.png' });
await page.locator('button[aria-expanded="true"]').first().click(); await page.waitForTimeout(400);

/* גוף: אותו גוון לא מוצע */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(700);
const carcassRow = page.locator('button[aria-expanded]').first();
await carcassRow.click(); await page.waitForTimeout(600);
const inside = await page.innerText('body');
ok(!inside.includes('לכה כחולה'), 'גוון של MDF אינו מוצע לגוף');
ok(inside.includes('לבן'), 'הגוונים של הסנדוויץ׳ כן מוצעים');
await page.screenshot({ path: SP + '/L43-3-carcass-open.png' });

/* --- הגוונים נבחרים בסוף ההצעה --- */
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);
await btn(/^חישוב/).click(); await page.waitForTimeout(1700);
ok(await dlg().getByRole('button', { name: /הגוונים לפרויקט/ }).count() === 1, 'הגוונים נבחרים בסוף ההצעה');
await dlg().getByRole('button', { name: /הגוונים לפרויקט/ }).click(); await page.waitForTimeout(900);
ok((await dlg().innerText()).includes('גוף'), 'מסך הגוונים נפתח מההצעה');
await page.screenshot({ path: SP + '/L43-4-quote-finishes.png' });

console.log('console noise:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
