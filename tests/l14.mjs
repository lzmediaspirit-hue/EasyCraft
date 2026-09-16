import './_exit.mjs';
import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L14-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1200);

await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('רון אבידן');
await dlg().getByLabel(/עיר/).fill('רעננה');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/רון אבידן/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(900);
await pickWalls(page, 3); await page.waitForTimeout(900);
await btn(/קיר נקי/).click(); await page.waitForTimeout(900);
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1600);

/* ארגז על כל אחד משלושת הקירות */
for (let i = 0; i < 3; i++) {
  await clear();
  if (i > 0) { await btn(new RegExp(`קיר ${['א','ב','ג'][i]}׳`)).click(); await page.waitForTimeout(600); }
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
  await dlg().locator('div.relative > button').first().click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}
await clear();

/* ---- תלת־ממד: כל הקירות יחד + סימון כיוון ---- */
await full('0-before-iso');
/* בורר המצב מכריז על היעד: לחיצה על "תלת־ממד" נכנסת אליו */
await btn(/^תלת־ממד/).click(); await page.waitForTimeout(1200);
await full('1-iso-room');
const iso = page.locator('main svg, div svg').first();
const txt = await page.innerText('body');
ok('wall marks in 3D', txt.includes('קיר א׳'));
const svgTexts = await page.locator('svg text').evaluateAll((e) => e.map((x) => x.textContent));
ok('all three walls marked', ['קיר א׳','קיר ב׳','קיר ג׳'].every((n) => svgTexts.includes(n)), svgTexts.join(','));

/* ---- הוספת קיר רביעי וחמישי ---- */
await btn(/^קיר נוסף$/).click(); await page.waitForTimeout(900);
await btn(/^קיר נוסף$/).click(); await page.waitForTimeout(900);
const tabs = await page.getByRole('button', { name: /^קיר [אבגדה]׳$/ }).count();
ok('five walls', tabs === 5, String(tabs));
await full('2-five-walls');

/* ---- מבט על: מחיקת קיר ---- */
await btn(/מבט על/).click(); await page.waitForTimeout(900);
await full('3-plan');
ok('plan has add-wall', await dlg().getByRole('button', { name: 'קיר נוסף' }).count() > 0);
await dlg().getByRole('button', { name: /מחיקת קיר ה׳/ }).click(); await page.waitForTimeout(900);
const after = await dlg().getByRole('button', { name: /מחיקת קיר/ }).count();
ok('wall removed', after === 4, String(after));
await clear();

/* ---- פאנל חיפוי קיר מאחורי הארגזים ---- */
/* חזרה לציור החזית */
await btn(/^דו־ממד/).click().catch(() => {});
await page.waitForTimeout(600);
await full('4-after');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
