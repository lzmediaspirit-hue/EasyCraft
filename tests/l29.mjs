import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L29-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };

await setup(page, { name: 'תפקידים בע״מ' });
await addUnit(page, 0);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
await dlg().getByRole('button', { name: /מכירה והתחלת עבודה/ }).click(); await page.waitForTimeout(900);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1400);
await clear();
await full('1-manager-design');
/* אחרי המכירה הכפתור הראשי הוא מתג תכנון/תהליך, והחישוב עבר לסרגל */
ok('manager sees the mode toggle', await page.getByRole('button', { name: /^תכנון$/ }).count() === 1);
ok('manager still reaches the calc', await page.getByRole('button', { name: /חומרים ומחיר/ }).count() === 1);

/* תהליך העבודה — פתיחת פרויקט נסגרת מעצמה */
await page.goBack(); await page.waitForTimeout(900);
await full('2-projects');
const proj = await page.innerText('body');
ok('brief closed automatically', !/פתיחת פרויקט[\s\S]{0,40}ממתין/.test(proj), '');

/* --- מעבר לתכנת --- */
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await page.getByRole('button', { name: /תצוגה של מנהל/ }).click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: 'תכנת', exact: true }).click(); await page.waitForTimeout(700);
await full('3-planner-home');
ok('planner has no settings', await page.getByRole('button', { name: 'הגדרות' }).count() === 0);
ok('planner has stock', await page.getByRole('button', { name: 'מלאי לוחות' }).count() === 1);
ok('planner has no library', await page.getByRole('button', { name: 'ספריית המוצרים' }).count() === 0);

await btn(/תפקידים בע״מ/).click(); await page.waitForTimeout(700);
await btn(/מטבח/).first().click(); await page.waitForTimeout(1200);
await full('4-planner-design');
const pd = await page.innerText('body');
ok('planner gets the work view', !pd.includes('הוספת ארגז') && !pd.includes('חישוב'), '');
ok('planner has no wall stats', !pd.includes('שטח הקיר'), '');
ok('planner has quick marking', await page.getByRole('button', { name: /סימון מהיר/ }).count() === 1);
/*
 * התכנת נכנס לתצוגת התהליך, אבל יש לו מתג חזרה לתכנון: בלעדיו
 * אישור עריכה שהמנהל נותן לו לא פותח שום כלי (N2).
 */
ok('planner starts in the work view', await btn(/^תהליך עבודה$/).count() === 1);
ok('and can switch to planning', await page.getByRole('button', { name: /^תכנון$|^תהליך עבודה$/ }).count() === 1);


console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
