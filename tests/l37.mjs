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
const units = () => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => { const t = db.transaction('units').objectStore('units').getAll(); t.onsuccess = () => res(t.result.map((u) => ({ id: u.id, x: u.xMm, y: u.yMm, w: u.widthMm, h: u.heightMm, lvl: u.level }))); });
});

await setup(page, { name: 'השלמה' });
/* קיר בגובה 300 */
await btn(/הגדרות הקיר/).click(); await page.waitForTimeout(800);
await page.getByLabel('גובה הקיר', { exact: true }).fill('300'); await page.waitForTimeout(600);
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

/* ארון גבוה בגובה 240 */
await addUnit(page, 0);
await page.getByRole('button', { name: /^גובה/ }).first().click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: /הקלדת גובה מדויק/ }).click(); await page.waitForTimeout(300);
await page.locator('input[aria-label="גובה מדויק"]').fill('240'); await page.waitForTimeout(700);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);
let u = await units();
ok(u[0].h === 2400, 'הארגז הראשון בגובה 240', String(u[0].h));

/* ארגז עליון מעליו — עליונים אינם נעולים לרצפה */
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
await page.getByRole('dialog').last().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(600);
/* בוחר החדרים מוצג רק כשהספרייה נפתחת בפעם הראשונה */
if (await page.getByRole('dialog').last().getByRole('button', { name: /^מטבח/ }).count()) {
  await page.getByRole('dialog').last().getByRole('button', { name: /^מטבח/ }).click();
  await page.waitForTimeout(500);
}
await page.getByRole('dialog').last().getByRole('button', { name: 'עליונים', exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('dialog').last().locator('div.relative > button').filter({ hasText: /\S/ }).nth(0).click();
await page.waitForTimeout(900);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);
u = await units();
const upper = u.find((z) => z.lvl === 'wall');
const moved = upper.id;
console.log('before drag:', JSON.stringify(u));
/* גוררים את העליון אל מעל הארון הגבוה — שמאלה ולמעלה */
const tall = u.find((z) => z.h === 2400);
const bb = await page.locator(`svg g[data-unit-id="${moved}"]`).boundingBox();
const pxPerMm = bb.width / upper.w;
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(
  bb.x + bb.width / 2 - (upper.x - tall.x) * pxPerMm,
  bb.y + bb.height / 2 - (2500 - upper.y) * pxPerMm,
  { steps: 18 },
);
await page.mouse.up(); await page.waitForTimeout(700);
u = await units();
console.log('units:', JSON.stringify(u));
await page.screenshot({ path: SP + '/L37-1-stacked.png' });

/* השלמת הגובה */
await page.locator(`svg g[data-unit-id="${moved}"]`).click(); await page.waitForTimeout(700);
await page.getByRole('button', { name: /^גובה/ }).first().click(); await page.waitForTimeout(500);
const chip = page.getByRole('button', { name: /^השלמה/ });
ok(await chip.count() === 1, 'שבב ההשלמה מוצג', (await chip.allInnerTexts()).join(''));
const label = (await chip.innerText()).replace(/\s/g, '');
await chip.click(); await page.waitForTimeout(800);
u = await units();
const top = u.find((z) => z.lvl === 'wall');
ok(!!top && top.y === 2400 && top.h === 600, 'הארגז נכנס לרווח: 240 עד התקרה', JSON.stringify(top) + ' | ' + label);
await page.screenshot({ path: SP + '/L37-2-filled.png' });

/* אין מה להשלים — השבב נעלם */
await page.waitForTimeout(300);
ok(await page.getByRole('button', { name: /^השלמה/ }).count() === 0, 'אחרי ההשלמה אין יותר מה להשלים');

/* השלמה גם ברוחב: הארגז ממלא את הרווח שהוא יושב בו */
await page.getByRole('button', { name: /^רוחב/ }).first().click(); await page.waitForTimeout(500);
const wChip = page.getByRole('button', { name: /^השלמה/ });
ok(await wChip.count() === 1, 'שבב השלמה גם ברוחב', (await wChip.allInnerTexts()).join(''));
await wChip.click(); await page.waitForTimeout(800);
u = await units();
const filled = u.find((z) => z.lvl === 'wall');
ok(filled.x === 0 && filled.w === 3000, 'הארגז ממלא את רוחב הקיר', JSON.stringify(filled));
await page.screenshot({ path: SP + '/L37-3-width.png' });

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
