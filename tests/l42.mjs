import './_exit.mjs';
import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
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
const table = (n) => page.evaluate(async (name) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => { const t = db.transaction(name).objectStore(name).getAll(); t.onsuccess = () => res(t.result); });
}, n);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1600);

/* --- מסך ברירות המחדל --- */
const gear = page.getByRole('button', { name: 'ברירות מחדל לפרויקט' });
ok(await gear.count() === 1, 'כפתור ברירות מחדל בדף הבית');
await gear.click(); await page.waitForTimeout(1200);
const body = await page.innerText('body');
for (const f of ['גובה רגליים', 'גובה משטח', 'עומק תחתונים', 'תחתית עליון', 'אורך קיר', 'גובה קיר', 'סוג הגב', 'תיבת מגירה'])
  ok(body.includes(f), `הגדרה מוצגת: ${f}`);
await page.screenshot({ path: SP + '/L42-1-defaults.png' });

/* משנים: רגליים 12, קיר 350x280 */
await page.getByLabel('גובה רגליים').fill('12'); await page.waitForTimeout(500);
await page.getByLabel('אורך קיר').fill('350'); await page.waitForTimeout(500);
await page.getByLabel('גובה קיר').fill('280'); await page.waitForTimeout(600);
const st = (await table('settings'))[0];
ok(st.defaults.socleMm === 120, 'גובה הרגליים נשמר', String(st.defaults.socleMm));
ok(st.defaults.wallLengthMm === 3500 && st.defaults.wallHeightMm === 2800, 'מידות הקיר נשמרו',
  `${st.defaults.wallLengthMm}x${st.defaults.wallHeightMm}`);

/* --- אשף: המידות נטענות, לכל קיר בנפרד, וצד הפנייה --- */
await page.goBack(); await page.waitForTimeout(900);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('משפחת לוי');
await dlg().getByLabel(/עיר/).fill('אשדוד');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/משפחת לוי/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
await pickWalls(page, 2); await page.waitForTimeout(700);
await btn(/קיר נקי/).click(); await page.waitForTimeout(800);
await page.screenshot({ path: SP + '/L42-2-dims.png' });
const dimsTxt = await dlg().innerText();
ok(dimsTxt.includes('לאן פונה הקיר השני'), 'בשני קירות נשאלת שאלת הצד', dimsTxt.replace(/\n/g, ' / ').slice(0, 160));
ok(await dlg().getByLabel('גובה קיר א׳').count() === 1 && await dlg().getByLabel('גובה קיר ב׳').count() === 1,
  'גובה לכל קיר בנפרד');
ok((await dlg().getByLabel('אורך קיר א׳').inputValue()) === '350', 'אורך הקיר מגיע מברירת המחדל',
  await dlg().getByLabel('אורך קיר א׳').inputValue());
ok((await dlg().getByLabel('גובה קיר א׳').inputValue()) === '280', 'גובה הקיר מגיע מברירת המחדל');

/* קיר ב׳ נמוך יותר, ופנייה שמאלה */
await dlg().getByLabel('גובה קיר ב׳').fill('240'); await page.waitForTimeout(400);
await dlg().getByRole('button', { name: 'שמאלה' }).click(); await page.waitForTimeout(400);
await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click(); await page.waitForTimeout(1900);
const walls = (await table('walls')).sort((a, b) => a.index - b.index);
console.log('walls:', JSON.stringify(walls.map((w) => [w.lengthMm, w.heightMm, w.turnDeg])));
ok(walls[0].heightMm === 2800 && walls[1].heightMm === 2400, 'לכל קיר הגובה שלו',
  `${walls[0].heightMm}/${walls[1].heightMm}`);
ok(walls[1].turnDeg === -90, 'הפנייה שמאלה נשמרה', String(walls[1].turnDeg));

/* --- רגליים לפי ברירת המחדל, והחזרה בהצמדה --- */
await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
if (await dlg().getByRole('button', { name: /^מטבח/ }).count())
  { await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(400); }
await dlg().locator('div.relative > button').filter({ hasText: /\S/ }).nth(0).click();
await page.waitForTimeout(900);
let u = (await table('units'))[0];
ok(u.socleMm === 120, 'ארגז חדש מקבל את גובה הרגליים שהוגדר', String(u.socleMm));

await page.getByRole('button', { name: /הצמדה לרצפה/ }).click(); await page.waitForTimeout(700);
u = (await table('units'))[0];
ok(u.socleMm === 0 && !u.floorLocked, 'ביטול ההצמדה מאפס רגליים', `${u.socleMm}/${u.floorLocked}`);
await page.getByRole('button', { name: /הצמדה לרצפה/ }).click(); await page.waitForTimeout(700);
u = (await table('units'))[0];
ok(u.socleMm === 120 && u.floorLocked, 'החזרת ההצמדה מחזירה את הרגליים', `${u.socleMm}/${u.floorLocked}`);

/* --- סוג הגב יצא מההדמיה --- */
await page.getByRole('button', { name: /הסתרת חזיתות/ }).click(); await page.waitForTimeout(700);
ok(!(await page.innerText('body')).includes('גב דק'), 'בחירת סוג הגב אינה בהדמיה');
await page.screenshot({ path: SP + '/L42-3-inside.png' });

console.log('console noise:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
