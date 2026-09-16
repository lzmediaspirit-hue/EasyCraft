import './_exit.mjs';
/* שכבה 21 — סיבוב הארגז: שני חצים בתלת־ממד, וציור שיודע לאן הוא פונה */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();

const rotation = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readonly');
    const all = await new Promise((res) => {
      const g = tx.objectStore('units').getAll();
      g.onsuccess = () => res(g.result);
    });
    dbh.close();
    return all[0].rotationDeg ?? 0;
  });

await setup(page);
await addUnit(page, 0);
await page.waitForTimeout(700);

/* ארגז שרוחבו ועומקו שונים בבירור — כדי שהסיבוב יהיה נראה במידות */
await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('units', 'readwrite');
  const st = tx.objectStore('units');
  const all = await new Promise((res) => {
    const g = st.getAll();
    g.onsuccess = () => res(g.result);
  });
  Object.assign(all[0], { widthMm: 900, depthMm: 350, heightMm: 900, xMm: 400 });
  st.put(all[0]);
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

async function toDesign() {
  await btn(/בדיקה/).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /מטבח/ }).first().click();
  await page.waitForTimeout(1400);
}
await toDesign();

/* --- החצים חיים בתלת־ממד, ורק כשארגז נבחר --- */
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1100);
ok('no arrows before a cabinet is picked', (await page.getByRole('button', { name: /^סיבוב/ }).count()) === 0);
await page.locator('[data-unit]').last().click({ force: true });
await page.waitForTimeout(800);
ok('two arrows under the picked cabinet', (await page.getByRole('button', { name: /^סיבוב/ }).count()) === 2);
await page.screenshot({ path: SP + 'L55-1-arrows.png' });

/* --- כל לחיצה היא רבע סיבוב, וארבע מחזירות למקום --- */
await page.getByRole('button', { name: 'סיבוב ימינה' }).click();
await page.waitForTimeout(800);
ok('one click turns a quarter', (await rotation()) === 90, String(await rotation()));
await page.screenshot({ path: SP + 'L55-2-turned.png' });

await page.getByRole('button', { name: 'סיבוב שמאלה' }).click();
await page.waitForTimeout(800);
ok('the other arrow turns back', (await rotation()) === 0, String(await rotation()));

for (let i = 0; i < 4; i++) {
  await page.getByRole('button', { name: 'סיבוב ימינה' }).click();
  await page.waitForTimeout(600);
}
ok('four clicks come back around', (await rotation()) === 0, String(await rotation()));

/* --- בחזית ארגז מסובב מצויר כלוח, ברוחב שהוא תופס על הקיר --- */
await page.getByRole('button', { name: 'סיבוב ימינה' }).click();
await page.waitForTimeout(800);
await btn(/^דו־ממד/).click();
await page.waitForTimeout(1100);
const html = await page.locator('[data-unit-id]').first().innerHTML();
ok('the turned cabinet is a panel on the wall', /מסובב/.test(html), html.slice(0, 90));
ok(
  'it takes its depth on the wall, not its width',
  /<rect width="350"/.test(html),
  (html.match(/<rect width="\d+"/) ?? [''])[0],
);
ok('no doors are drawn side-on', !/CabinetGlyph|rx="8"/.test(html));
await page.screenshot({ path: SP + 'L55-3-elevation.png' });

/* --- חצי סיבוב: רואים את הגב, ברוחב המלא --- */
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1000);
await page.locator('[data-unit]').last().click({ force: true });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'סיבוב ימינה' }).click();
await page.waitForTimeout(800);
await btn(/^דו־ממד/).click();
await page.waitForTimeout(1100);
const back = await page.locator('[data-unit-id]').first().innerHTML();
ok('half a turn shows the back', /גב לחדר/.test(back) && /<rect width="900"/.test(back));
await page.screenshot({ path: SP + 'L55-4-back.png' });

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
