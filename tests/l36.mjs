import './_exit.mjs';
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const walls = () => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => {
    const t = db.transaction('walls').objectStore('walls').getAll();
    t.onsuccess = () => res(t.result.map((w) => ({ len: w.lengthMm, h: w.heightMm, f: w.features })));
  });
});

await setup(page, { name: 'סימונים' });
await page.waitForTimeout(600);

/* עורך הסימונים נמצא בכלי הקיר */
await btn(/הגדרות הקיר/).click(); await page.waitForTimeout(900);
await page.screenshot({ path: SP + '/L36-0-tools.png' });
const body = await dlg().innerText();
ok(body.includes('מה יש על הקיר'), 'עורך הסימונים בכלי הקיר');
for (const label of ['חלון', 'דלת / פתח', 'שקע חשמל', 'נקודת מים', 'עמוד / פינוי', 'נישה'])
  ok(body.includes(label), `הספרייה כוללת ${label}`);

/* מוסיפים חלון — הוא נוחת במרכז ונבחר */
await dlg().getByRole('button', { name: 'חלון', exact: true }).click(); await page.waitForTimeout(700);
let w = (await walls())[0];
ok(w.f.length === 1 && w.f[0].kind === 'window', 'החלון נוסף לקיר', JSON.stringify(w.f[0]));
const centered = Math.round((w.len - w.f[0].widthMm) / 2 / 10) * 10;
ok(w.f[0].xMm === centered, 'הוא נוחת במרכז הקיר', `x=${w.f[0].xMm} מרכז=${centered}`);
ok((await dlg().innerText()).includes('רוחב החלון'), 'המידות של הסימון שנבחר נפתחות');
await page.screenshot({ path: SP + '/L36-1-window.png' });

/* גוררים אותו על הקיר */
const g = dlg().locator(`svg [data-feature-id="${w.f[0].id}"]`);
const box = await g.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 30, { steps: 12 });
await page.mouse.up(); await page.waitForTimeout(600);
const moved = (await walls())[0].f[0];
ok(moved.xMm !== w.f[0].xMm || moved.yMm !== w.f[0].yMm, 'גרירה מזיזה את הסימון על הקיר',
  `${w.f[0].xMm},${w.f[0].yMm} → ${moved.xMm},${moved.yMm}`);
ok(moved.xMm >= 0 && moved.xMm + moved.widthMm <= w.len, 'הסימון נשאר בתוך הקיר',
  `x=${moved.xMm} רוחב=${moved.widthMm} קיר=${w.len}`);
await page.screenshot({ path: SP + '/L36-2-dragged.png' });

/* שמאל/ימין ומהרצפה/מהתקרה */
/* התאמה מדויקת: "צירים מימין" מכיל את "מימין", ובלעדיה שניהם נתפסים */
await dlg().getByRole('button', { name: 'מימין', exact: true }).click();
await page.waitForTimeout(500);
ok((await walls())[0].f[0].fromSide === 'end', 'אפשר למדוד מהקצה השני');
await dlg().getByRole('button', { name: 'מהתקרה' }).click(); await page.waitForTimeout(500);
ok((await walls())[0].f[0].heightRef === 'ceiling', 'אפשר למדוד גובה מהתקרה');

/* המידות: רוחב וגובה */
await dlg().getByLabel('חלון — רוחב החלון').fill('150'); await page.waitForTimeout(600);
ok((await walls())[0].f[0].widthMm === 1500, 'רוחב נשמר', String((await walls())[0].f[0].widthMm));

/* הסרה */
await dlg().getByRole('button', { name: /הסרת חלון/ }).click(); await page.waitForTimeout(600);
ok((await walls())[0].f.length === 0, 'אפשר להסיר סימון');

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
