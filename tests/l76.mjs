/* שכבה 24ב: טבעת הכפתורים בתלת־ממד — תזוזה, בחירה מרובה, עיפרון */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
let fail = 0;
const ok = (n, c, g = '') => { if (c) console.log('PASS ', n); else { fail++; console.log('FAIL ', n, g); } };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', (e) => { fail++; console.log('PAGEERROR', e.message); });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
async function add(name, tab) {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(600);
  if (tab) { await dlg().getByRole('button', { name: tab, exact: true }).click(); await page.waitForTimeout(500); }
  await dlg().getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
  await page.waitForTimeout(400);
}
const units = () => page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const tx = dbh.transaction('units', 'readonly');
  const all = await new Promise((r) => { const g = tx.objectStore('units').getAll(); g.onsuccess = () => r(g.result); });
  dbh.close();
  return all.map((u) => ({ id: u.id, name: u.name, xMm: u.xMm, hidden: !!u.hidden })).sort((a, b) => a.xMm - b.xMm);
});

await setup(page);
await add('ארגז דלת אחת');
await add('ארגז שתי דלתות');
await add('ארגז 3 מגירות');
await btn(/שטוח/).click(); await page.waitForTimeout(1400);

const svg = page.locator('svg').filter({ has: page.locator('[data-room-floor]') }).first();
const box = await svg.boundingBox();
await page.locator('[data-unit]').first().click({ force: true }); await page.waitForTimeout(900);

/* --- שלושת הכפתורים מופיעים --- */
for (const n of ['תזוזה', 'בחירה מרובה', 'עריכה מהירה']) {
  ok(`ring has ${n}`, (await page.getByRole('button', { name: n }).count()) > 0);
}
await svg.screenshot({ path: SP + 'L76-1-ring.png' });

/* --- עיפרון פותח את העריכה המהירה --- */
await page.getByRole('button', { name: 'עריכה מהירה' }).first().click(); await page.waitForTimeout(900);
ok('the pencil opens the quick edit', (await page.getByRole('dialog').count()) > 0);
await page.keyboard.press('Escape'); await page.waitForTimeout(600);

/* --- תזוזה: המסך ננעל, והארגז זז --- */
await page.locator('[data-unit]').first().click({ force: true }); await page.waitForTimeout(800);
const beforeMove = await units();
const vb0 = await svg.getAttribute('viewBox');
await page.getByRole('button', { name: 'תזוזה' }).first().click(); await page.waitForTimeout(600);
ok('placing shows the confirm button', (await page.getByRole('button', { name: 'הנחת הארגז' }).count()) > 0);
ok('placing shows the cancel button', (await page.getByRole('button', { name: 'ביטול ההזזה' }).count()) > 0);
const live = await svg.boundingBox();
const cx = live.x + live.width / 2, cy = live.y + live.height / 2;
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx + 200, cy, { steps: 14 }); await page.mouse.up();
await page.waitForTimeout(800);
ok('the room does not turn while placing', vb0 === (await svg.getAttribute('viewBox')));
const afterMove = await units();
ok('the cabinet moved', JSON.stringify(beforeMove) !== JSON.stringify(afterMove),
   `${JSON.stringify(beforeMove.map((u) => u.xMm))} -> ${JSON.stringify(afterMove.map((u) => u.xMm))}`);

/* --- ביטול מחזיר למקום --- */
await page.getByRole('button', { name: 'ביטול ההזזה' }).first().click(); await page.waitForTimeout(900);
const afterCancel = await units();
ok('cancelling puts it back',
   JSON.stringify(beforeMove.map((u) => u.xMm)) === JSON.stringify(afterCancel.map((u) => u.xMm)),
   JSON.stringify(afterCancel.map((u) => u.xMm)));

/* --- בחירה מרובה: הסתרה --- */
await page.locator('[data-unit]').first().click({ force: true }); await page.waitForTimeout(800);
await page.getByRole('button', { name: 'בחירה מרובה' }).first().click(); await page.waitForTimeout(600);
ok('the bulk bar appears', (await page.getByRole('button', { name: 'הסתרה' }).count()) > 0);
await page.getByRole('button', { name: 'הסתרה' }).first().click(); await page.waitForTimeout(1000);
const hidden = (await units()).filter((u) => u.hidden).length;
ok('bulk hide hides what was picked', hidden >= 1, String(hidden));
await btn(/הצגת המוסתרים|החזרת/).click().catch(() => {});
await page.waitForTimeout(700);

/* --- בחירה מרובה: שמירה כארגז --- */
await page.locator('[data-unit]').first().click({ force: true }); await page.waitForTimeout(800);
await page.getByRole('button', { name: 'בחירה מרובה' }).first().click(); await page.waitForTimeout(500);
const more = await page.locator('[data-unit]').all();
if (more.length > 4) { await more[more.length - 1].click({ force: true }); await page.waitForTimeout(500); }
await svg.screenshot({ path: SP + 'L76-2-picked.png' });
await page.getByRole('button', { name: 'שמירה כארגז' }).first().click(); await page.waitForTimeout(900);
ok('the group sheet opens', (await page.getByText('שמירת הצירוף בספרייה').count()) > 0);
await page.getByRole('dialog').last().getByRole('button', { name: 'שמירה', exact: true }).click({ force: true }); await page.waitForTimeout(1400);
const saved = await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const tx = dbh.transaction('catalog', 'readonly');
  const all = await new Promise((r) => { const g = tx.objectStore('catalog').getAll(); g.onsuccess = () => r(g.result); });
  dbh.close();
  return all.filter((i) => i.parts?.length).map((i) => ({ name: i.name, n: i.parts.length }));
});
ok('a composite item is in the library', saved.length > 0, JSON.stringify(saved));

await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASS');
