import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L13-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1200);
ok('admin signed in', await page.getByRole('heading', { name: 'לקוחות' }).count() > 0);

/* ---- ספרייה ממסך הבית ---- */
await btn('ספריית הארגזים').click(); await page.waitForTimeout(700);
ok('library opens from home', (await dlg().getAttribute('aria-label')) === 'ספרייה');
await full('1-library-home');
/* התפריט אינו רשימה: נכנסים לספרייה של חדר, ומשם לוחצים על ארגז */
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(700);
const first = dlg().locator('div.relative > button').first();
await first.click(); await page.waitForTimeout(600);
ok('tap edits in manage mode', (await page.textContent('body')).includes('שמירה'));
for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
await full('1b-back-home');
console.log('HOME BUTTONS:', (await page.getByRole('button').allInnerTexts()).join(' | ').slice(0, 400));

/* ---- פרויקט עם כמה ארגזים ---- */
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('דנה לוי');
await dlg().getByLabel(/עיר/).fill('חיפה');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/דנה לוי/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(1200);
await pickWalls(page, 2); await page.waitForTimeout(1400);
await btn(/קיר נקי/).click(); await page.waitForTimeout(1400);
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1600);
console.log('NAMES:', JSON.stringify(await page.locator('button').evaluateAll((els) => els.map((e) => e.textContent))));
await full('2-design');

/* מוסיפים כמה ארגזים */
for (let i = 0; i < 4; i++) {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  try { await btn(/הוספת ארגז/).click({ timeout: 12000 }); } catch (e) {
    console.log('BODY:', (await page.innerText('body')).replace(/\n/g,' / ').slice(0,600));
    console.log('ERRS:', errs.join(' | ').slice(0, 800));
    await full('X-stuck'); throw e;
  }
  await page.waitForTimeout(700);
  const items = dlg().locator('div.relative > button');
  await items.first().click(); await page.waitForTimeout(800);
  // ההוספה פותחת מיד את עורך הארגז — סוגרים אותו וחוזרים לקיר
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
}
await full('3-wall');

/* ---- חישוב ---- */
await btn(/^חישוב/).click(); await page.waitForTimeout(1500);
const calcTxt = await dlg().innerText();
const calcSheets = Number((calcTxt.match(/סה״כ פלטות\s*\n?\s*(\d+)/) || [])[1] ?? -1);
ok('calc screen shows sheets', calcSheets > 0, String(calcSheets));
ok('no yield text in calc', !calcTxt.includes('ניצולת'));
await full('4-calc');
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

/* ---- ניסור ---- */
await btn(/ניסור/).click(); await page.waitForTimeout(2000);
const nestTxt = await dlg().innerText();
const nestSheets = Number((nestTxt.match(/פלטות\s*\n\s*(\d+)/) || [])[1] ?? -1);
ok('nesting sheets == calc sheets', nestSheets === calcSheets, `${nestSheets} vs ${calcSheets}`);
await full('5-nesting');
await dlg().getByRole('button', { name: /הצגת השארית/ }).click(); await page.waitForTimeout(700);
ok('offcut toggle works', (await dlg().innerText()).includes('מסתיר שאריות'));
await full('6-offcuts');
/* הפלטה מצוירת שוכבת */
const vbs = await dlg().locator('svg').evaluateAll((els) => els.map((e) => e.getAttribute('viewBox')));
const vb = vbs.find((v) => v && Number(v.split(' ')[2]) > 500);
const [, , vw, vh] = (vb || '0 0 0 0').split(' ').map(Number);
ok('sheet drawn landscape', vw > vh, vb);

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
