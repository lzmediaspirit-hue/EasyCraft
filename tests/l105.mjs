import './_exit.mjs';
/* שכבה 105 — מגירות: מיקוד שנכנס פנימה, Escape שסוגר שכבה אחת, וקובץ בודד לנייד */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click();
await page.waitForTimeout(1600);

/* --- C5: מיקוד נכנס למגירה ונשאר בה --- */
await btn(/ספריית הארגזים/).click();
await page.waitForTimeout(800);
const inside = () =>
  page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    return !!dlg && dlg.contains(document.activeElement);
  });
ok('המיקוד נכנס למגירה שנפתחה', await inside());
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
ok('ו-Tab נשאר בתוכה', await inside());
for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
await page.waitForTimeout(200);
ok('וגם אחרי סבב שלם', await inside());
await page.keyboard.press('Shift+Tab');
await page.waitForTimeout(200);
ok('וגם אחורה', await inside());

/* --- C5: Escape סוגר שכבה אחת --- */
await btn(/ארגז משלי/).click();
await page.waitForTimeout(800);
const two = await page.locator('[role="dialog"]').count();
ok('נפתחה מגירה שנייה מעל הראשונה', two === 2, String(two));
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const one = await page.locator('[role="dialog"]').count();
ok('Escape סוגר רק את העליונה', one === 1, String(one));
ok('והספרייה שמתחתיה נשארה', /ספריית הארגזים|ארגזים מועדפים/.test(await page.innerText('body')));
await page.screenshot({ path: SP + 'L105-1-nested.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
ok('והקשה נוספת סוגרת גם אותה', (await page.locator('[role="dialog"]').count()) === 0);
ok(
  'והמיקוד חזר לכפתור שפתח',
  await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'ספריית הארגזים'),
  await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
);

/* --- N11: הקובץ הבודד נפתח בנייד ברוחב המסך --- */
const path = new URL('../dist/easycraft.html', import.meta.url).pathname;
const single = readFileSync(path, 'utf8');
ok('הקובץ הבודד נושא viewport', /name="viewport"/.test(single));
ok('והוא מצהיר על עברית ו-RTL', /lang="he"/.test(single) && /dir="rtl"/.test(single));
const NON_ASCII = new RegExp('[^\\x00-\\x7f]');
ok('והוא עדיין ASCII בלבד', !NON_ASCII.test(single));

const phone = await browser.newPage({ viewport: { width: 390, height: 780 } });
await phone.goto('file://' + path);
await phone.waitForTimeout(2200);
const width = await phone.evaluate(() => document.documentElement.clientWidth);
ok('ורוחב הפריסה בנייד הוא רוחב המסך', width <= 420, String(width));
ok('והאפליקציה עולה בו', (await phone.getByLabel('שם משתמש').count()) === 1);
await phone.screenshot({ path: SP + 'L105-2-single-phone.png' });
await phone.close();

const all = [...out, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);
