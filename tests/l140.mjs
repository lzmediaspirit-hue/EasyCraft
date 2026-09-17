import './_exit.mjs';
/*
 * שכבה 140 — גרסת מחשב לכל האפליקציה.
 *
 * כל מסך נבנה לטלפון ונשא את אותה מעטפת ברוחב 512, ולכן במחשב
 * האפליקציה כולה הייתה עמודה צרה באמצע מסך ריק. רק ההדמיה
 * התרחבה, והשאר לא.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

/** רוחב מעטפת העמוד, וגלישה לרוחב */
const page_ = () =>
  page.evaluate(() => {
    const el = document.querySelector('.app-page');
    return {
      w: el ? Math.round(el.getBoundingClientRect().width) : null,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

/* --- מסך הכניסה --- */
const login = await page_();
ok('מסך הכניסה מתרחב במחשב', (login.w ?? 0) > 512, String(login.w));

await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1600);

/* --- מסך הלקוחות --- */
const home = await page_();
ok('מסך הבית מתרחב במחשב', (home.w ?? 0) > 512, String(home.w));
ok('ואין גלילה לרוחב', !home.overflow);

/* --- מסך ההגדרות --- */
await page.getByRole('button', { name: /הגדרות/ }).first().click();
await page.waitForTimeout(900);
const settings = await page_();
ok('גם מסך ההגדרות', (settings.w ?? 0) > 512, String(settings.w));

/* --- הגיליון רחב יותר במחשב, ובו טופס בשתי עמודות --- */
await page.goBack();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /ספריית הארגזים/ }).first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(900);
const sheet = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const f = document.querySelector('.cabinet-form');
  const p = document.querySelector('.cabinet-preview');
  const name = document.querySelector('.cabinet-form input');
  return {
    dialog: d ? Math.round(d.getBoundingClientRect().width) : null,
    cols: f ? getComputedStyle(f).gridTemplateColumns : null,
    previewX: p ? Math.round(p.getBoundingClientRect().x) : null,
    fieldX: name ? Math.round(name.getBoundingClientRect().x) : null,
  };
});
ok('הגיליון רחב יותר במחשב', (sheet.dialog ?? 0) > 512, String(sheet.dialog));
ok('והטופס בשתי עמודות', /\d+px \d+px/.test(sheet.cols ?? ''), String(sheet.cols));
/* ב-RTL התצוגה המקדימה בתחילת השורה, כלומר ב-x הגדול */
ok('התצוגה המקדימה לצד השדות ולא מעליהם',
  (sheet.previewX ?? 0) > (sheet.fieldX ?? 0), JSON.stringify([sheet.previewX, sheet.fieldX]));

/* --- ובטלפון הכול כמו שהיה --- */
await page.setViewportSize({ width: 420, height: 900 });
await page.waitForTimeout(600);
const small = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const f = document.querySelector('.cabinet-form');
  return {
    dialog: d ? Math.round(d.getBoundingClientRect().width) : null,
    cols: f ? getComputedStyle(f).gridTemplateColumns : null,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
ok('בטלפון הגיליון ברוחב המסך', (small.dialog ?? 0) <= 420, String(small.dialog));
ok('והטופס עמודה אחת', !/\d+px \d+px/.test(small.cols ?? ''), String(small.cols));
ok('ואין גלילה לרוחב', !small.overflow);

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
