import './_exit.mjs';
/*
 * שכבה 114 — חיפוש ארגז בספרייה לפי שם.
 *
 * ספרייה של שישים ארגזים מחולקת לחדרים ולקטגוריות. מי שיודע את השם
 * לא אמור לנחש באיזה חדר הוא שמור: החיפוש חוצה את הכול.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await setup(page, { name: 'חיפוש', walls: 'קיר יחיד' });
await page.waitForTimeout(700);
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await btn(/הוספת ארגז/).click();
await page.waitForTimeout(800);

const box = dlg().getByLabel('חיפוש ארגז לפי שם');
ok('שדה החיפוש קיים', (await box.count()) === 1);

/** שמות הארגזים שמוצגים ברשת כרגע */
const shown = async () =>
  (await dlg().locator('div.relative > button').first().locator('..').locator('..').innerText())
    .split('\n')
    .filter((t) => t.trim());

/* --- שם מלא של ארגז שיושב במטבח --- */
await box.fill('ארגז תנור ומגירה');
await page.waitForTimeout(500);
let body = await dlg().innerText();
ok('נמצא הארגז המבוקש', body.includes('ארגז תנור ומגירה'), body.slice(0, 120).replace(/\n/g, ' · '));
ok('ונאמר שהוא אחד', /ארגז אחד בכל הספרייה/.test(body), (body.match(/.*בכל הספרייה/) ?? [''])[0]);

/* --- חיפוש חלקי מחזיר כמה, והוא חוצה חדרים --- */
await box.fill('ארגז');
await page.waitForTimeout(500);
body = await dlg().innerText();
const many = (body.match(/(\d+) ארגזים בכל הספרייה/) ?? [])[1];
ok('חיפוש חלקי מחזיר כמה', Number(many) > 3, `נמצאו ${many}`);

/* --- החיפוש אינו תלוי בחדר שפתוח: מוצא גם מכשיר וגם ארגז חדר שינה --- */
await box.fill('מקרר');
await page.waitForTimeout(500);
body = await dlg().innerText();
ok('מוצא מכשיר מקטגוריה אחרת', body.includes('מקרר'), body.slice(0, 100).replace(/\n/g, ' · '));

/* --- רווח כפול וגרש לא מכשילים --- */
await box.fill('ארגז  תנור  ומגירה');
await page.waitForTimeout(500);
ok('רווח כפול אינו מכשיל', (await dlg().innerText()).includes('ארגז תנור ומגירה'));

/* --- שם שאינו קיים --- */
await box.fill('זגוגית מרחפת');
await page.waitForTimeout(500);
ok('שם שאינו קיים נאמר במפורש', (await dlg().innerText()).includes('אין ארגז בשם הזה'));

/* --- ניקוי מחזיר את התפריט --- */
await dlg().getByRole('button', { name: 'ניקוי החיפוש' }).click();
await page.waitForTimeout(500);
body = await dlg().innerText();
ok('הניקוי מחזיר את הספרייה', !body.includes('אין ארגז בשם הזה'), body.slice(0, 80).replace(/\n/g, ' · '));

/* --- ומהחיפוש אפשר להוסיף ארגז לקיר --- */
await box.fill('ארגז תנור ומגירה');
await page.waitForTimeout(500);
await dlg().locator('div.relative > button').filter({ hasText: /ארגז תנור ומגירה/ }).first().click();
await page.waitForTimeout(1000);
const placed = await page.evaluate(async () => {
  const dbh = await new Promise((res, rej) => {
    const r = indexedDB.open('easycraft');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  return await new Promise((res) => {
    const g = dbh.transaction('units').objectStore('units').getAll();
    g.onsuccess = () => res(g.result.map((u) => u.name));
  });
});
ok('הוספה מתוך החיפוש מניחה את הארגז', placed.includes('ארגז תנור ומגירה'), JSON.stringify(placed));

await browser.close();
for (const e of errs) out.push(e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL') || l.startsWith('pageerror')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
