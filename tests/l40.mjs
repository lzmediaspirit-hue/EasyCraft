import './_exit.mjs';
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
const dlg = () => page.getByRole('dialog').last();

await setup(page, { name: 'משפחת כהן' });
const present = page.getByRole('button', { name: /ללקוח/ });
ok(await present.count() === 1, 'כפתור ההדמיה ללקוח קיים');
ok(!(await present.isEnabled()), 'הכפתור כבוי כשאין ארגזים');

await addUnit(page, 0);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
await addUnit(page, 1);
await btn('סיום עריכה').click(); await page.waitForTimeout(500);
ok(await present.isEnabled(), 'הכפתור נדלק כשיש ארגזים');
await present.click(); await page.waitForTimeout(1200);
await page.screenshot({ path: SP + '/L40-1-present.png' });

const txt = await dlg().innerText();
ok(txt.includes('מטבח'), 'שם הפרויקט מוצג', txt.split('\n')[0]);
ok(txt.includes('משפחת כהן'), 'שם הלקוח מוצג');
ok(txt.includes('הגוונים שנבחרו'), 'רשימת הגוונים מוצגת');
ok(!/קיר א/.test(txt), 'שמות הקירות אינם מוצגים ללקוח', txt.replace(/\n/g, ' / ').slice(0, 160));

/* התמונה עצמה: יש שכבת אור וקרקע, ואין קווי שרטוט כבדים */
const svg = dlg().locator('svg:has(polygon)').first();
ok(await svg.locator('rect[fill="url(#iso-light)"]').count() === 1, 'שכבת האור מצוירת');
ok(await svg.locator('polygon[fill="url(#iso-floor)"]').count() >= 1, 'הקרקע מצוירת');
const strokes = await svg.locator('polygon').evaluateAll((e) => [...new Set(e.map((p) => p.getAttribute('stroke')))]);
ok(!strokes.includes('#57534e'), 'קווי השרטוט הוסרו', strokes.join(','));

/* פתיחת דלתות */
await dlg().getByRole('button', { name: /פתיחת הדלתות/ }).click(); await page.waitForTimeout(700);
ok((await dlg().innerText()).includes('סגירת הדלתות'), 'אפשר לפתוח את הדלתות ללקוח');
await page.screenshot({ path: SP + '/L40-2-open.png' });

/* סיבוב בגרירה */
const box = await svg.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 12 });
await page.mouse.up(); await page.waitForTimeout(600);
ok(await dlg().getByRole('button', { name: /זווית התחלתית/ }).count() === 1, 'אפשר לסובב את החדר');
await page.screenshot({ path: SP + '/L40-3-orbit.png' });

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');
