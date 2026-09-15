/* שכבה 21 — תשתית: הסתרת ארגז מהתצוגה וסיבובו ב-90 מעלות */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
/* ה-404 של הפאביקון הוא של שרת הפיתוח, לא של האפליקציה */
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('requestfailed', (r) => !/favicon/.test(r.url()) && errs.push('REQ ' + r.url()));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();

/** כותב שדות לארגז הראשון ישירות במסד, מרענן, וחוזר להדמיה. */
async function patchUnit(patch) {
  await page.evaluate(async (p) => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readwrite');
    const store = tx.objectStore('units');
    const all = await new Promise((res) => {
      const g = store.getAll();
      g.onsuccess = () => res(g.result);
    });
    const u = all[0];
    Object.assign(u, p);
    store.put(u);
    await new Promise((res) => (tx.oncomplete = res));
    dbh.close();
  }, patch);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

/** מהבית אל מסך ההדמיה של הפרויקט היחיד; מחזיר את המחיר שעל הכרטיס. */
async function toDesign() {
  await btn(/בדיקה/).click();
  await page.waitForTimeout(900);
  const card = await page.getByRole('button', { name: /מטבח/ }).first().innerText();
  await page.getByRole('button', { name: /מטבח/ }).first().click();
  await page.waitForTimeout(1300);
  return card;
}

await setup(page);
await addUnit(page, 0);
await page.waitForTimeout(700);

const drawn = () => page.locator('[data-unit-id], [data-unit]').count();
const stats = async () =>
  (await page.locator('[data-stat]').allInnerTexts()).join('|').replace(/\s+/g, ' ');

/* הלוח של הארגז החדש פתוח; רענון מחזיר את מסך ההדמיה הנקי */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await toDesign();
await btn(/הצגת הנתונים/).click();
await page.waitForTimeout(700);
const before = await drawn();
const wallBefore = await stats();

// --- הסתרה היא של העין בלבד
await patchUnit({ hidden: true });
const priceHidden = await toDesign();
/* מתג הנתונים חי בזיכרון בלבד, ולכן הוא נדלק שוב אחרי הרענון */
await btn(/הצגת הנתונים/).click();
await page.waitForTimeout(700);
const after = await drawn();
ok('hidden cabinet is not drawn', before > 0 && after === 0, `${before} -> ${after}`);
ok(
  'the wall still counts it',
  (await stats()) === wallBefore,
  `${wallBefore} => ${await stats()}`,
);
ok('the project still costs the same', /₪\s*\d/.test(priceHidden), priceHidden.replace(/\n/g, ' '));
await page.screenshot({ path: SP + 'L54-1-hidden.png' });

await btn(/^חישוב/).click();
await page.waitForTimeout(1800);
const calc = await page.getByRole('dialog').last().innerText();
ok('hidden cabinet still in the calculation', /₪/.test(calc), calc.split('\n').slice(0, 3).join(' / '));
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// --- סיבוב: תופס על הקיר את עומקו ונכנס לחדר ברוחבו
await patchUnit({ hidden: false, widthMm: 800, depthMm: 400 });
await toDesign();
await btn(/מבט על/).click();
await page.waitForTimeout(900);
const flatBox = await page.locator('[data-plan-unit]').first().boundingBox();
await page.screenshot({ path: SP + 'L54-2-plan-straight.png' });

await patchUnit({ rotationDeg: 90 });
await toDesign();
await btn(/מבט על/).click();
await page.waitForTimeout(900);
const turnedBox = await page.locator('[data-plan-unit]').first().boundingBox();
await page.screenshot({ path: SP + 'L54-3-plan-turned.png' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
ok(
  'a turned cabinet is narrow on the wall and deep into the room',
  !!flatBox && !!turnedBox && turnedBox.width < flatBox.width && turnedBox.height > flatBox.height,
  `${JSON.stringify(flatBox)} -> ${JSON.stringify(turnedBox)}`,
);

await toDesign();
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(900);
await page.screenshot({ path: SP + 'L54-4-iso-turned.png' });
ok('the 3D still draws the turned cabinet', (await page.locator('[data-unit]').count()) > 0);

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
