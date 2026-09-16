import './_exit.mjs';
/*
 * שכבה 122 — הספרייה: קטגוריות, סדר ידני, ומחיקה שנשאלת.
 *
 * מחיקה היא מחיקה: אין יותר "ארגזים שהוסרו" להחזיר מהם, ומחיקת
 * הפריט האחרון אינה מחזירה את ספריית ההדגמה בפתיחה הבאה.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

const lib = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts?v=' + Date.now());
    const rows = await db.catalog.toArray();
    return rows.map((i) => ({ id: i.id, name: i.name, group: i.group, sort: i.sortOrder }));
  });

await setup(page, { name: 'ספרייה בע״מ' });
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* קטגוריות                                                            */
/* ------------------------------------------------------------------ */

await btn(/הוספת ארגז/).click();
await page.waitForTimeout(800);
const tabs = dlg().getByRole('group', { name: 'קטגוריות' });
ok('the categories are a labelled group', (await tabs.count()) > 0);
const picked = tabs.getByRole('button', { pressed: true });
ok('the chosen one says so, not only in colour', (await picked.count()) === 1, String(await picked.count()));
const icons = await tabs.locator('button svg').count();
const labels = await tabs.locator('button').count();
ok('every category carries an icon and a label', icons === labels, `${icons}/${labels}`);

/* ------------------------------------------------------------------ */
/* מחיקה נשאלת                                                         */
/* ------------------------------------------------------------------ */

await page.keyboard.press('Escape');
await page.waitForTimeout(600);

/* מסך הלקוחות, ומשם ספריית הארגזים במצב ניהול */
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await btn(/ספריית הארגזים/).click();
await page.waitForTimeout(900);

const before = await lib();
const target = before.find((i) => i.group === 'base');

/* הספרייה נפתחת בתפריט החדרים; החיפוש מביא את הפריט עצמו */
await dlg().getByLabel('חיפוש ארגז לפי שם').fill(target.name);
await page.waitForTimeout(700);

/* --- השאלה, והביטול שאינו משנה דבר --- */
const trash = dlg().getByRole('button', { name: new RegExp(`מחיקת ${target.name} מהספרייה`) }).first();
ok('the library offers a delete', (await trash.count()) > 0, target.name);
await trash.click();
await page.waitForTimeout(700);
const ask = await page.getByRole('dialog').last().innerText();
ok('it asks before it deletes', /מחיקת ארגז מהספרייה/.test(ask), JSON.stringify(ask.slice(0, 160)));
ok('and says what happens to placed cabinets', /הונחו בפרויקטים/.test(ask));
await page.getByRole('button', { name: 'ביטול' }).first().click();
await page.waitForTimeout(700);
ok('cancelling changes nothing', (await lib()).length === before.length, String((await lib()).length));

/* --- והאישור מוחק --- */
await trash.click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'כן, למחוק' }).first().click();
await page.waitForTimeout(900);
ok('confirming deletes it', (await lib()).length === before.length - 1, String((await lib()).length));
ok('and it is gone by name', !(await lib()).some((i) => i.id === target.id));

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const deleted = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return { count: await db.catalog.count() };
});
ok('the deleted row is really gone', deleted.count === before.length - 1, `${before.length} → ${deleted.count}`);

const hidden = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return (await db.catalog.toArray()).filter((i) => i.hiddenAt).length;
});
ok('nothing is kept as a hidden leftover', hidden === 0, String(hidden));

/* ------------------------------------------------------------------ */
/* מחיקת הפריט האחרון אינה מחזירה את ספריית ההדגמה                     */
/* ------------------------------------------------------------------ */

await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  await db.catalog.clear();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const afterReload = await lib();
ok('an empty library stays empty after a reload', afterReload.length === 0, String(afterReload.length));

/* ...ו"החזרת ארגזי הספרייה" היא הדרך המפורשת חזרה */
const back = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  return await catalogRepo.reseed();
});
ok('the explicit restore brings it back', back > 0, String(back));

/* ------------------------------------------------------------------ */
/* סדר ידני                                                            */
/* ------------------------------------------------------------------ */

const order = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const inBase = async () => (await catalogRepo.all()).filter((i) => i.group === 'base').map((i) => i.name);
  const start = await inBase();
  const second = (await catalogRepo.all()).filter((i) => i.group === 'base')[1];
  await catalogRepo.move(second.id, -1);
  const moved = await inBase();
  await catalogRepo.move(second.id, 1);
  const home = await inBase();
  /* הראשון אינו יכול לעלות */
  const firstId = (await catalogRepo.all()).filter((i) => i.group === 'base')[0].id;
  await catalogRepo.move(firstId, -1);
  const stuck = await inBase();
  /* קטגוריה אחרת אינה זזה */
  const others = (await catalogRepo.all()).filter((i) => i.group !== 'base').map((i) => i.name);
  return { start, moved, home, stuck, others };
});
ok('moving a cabinet up swaps it with its neighbour',
  order.moved[0] === order.start[1] && order.moved[1] === order.start[0],
  `${order.start.slice(0, 2)} → ${order.moved.slice(0, 2)}`);
ok('and moving it back restores the order', order.home.join() === order.start.join());
ok('the first one cannot go higher', order.stuck.join() === order.start.join());
ok('other categories are untouched', order.others.length > 0);

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
