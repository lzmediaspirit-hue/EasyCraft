import { pickWalls } from './mk.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L22-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1400);

/* --- גוון: מרקמים והעתקה --- */
await btn('הגדרות').click(); await page.waitForTimeout(900);
await btn(/^אפור בטון/).click(); await page.waitForTimeout(700);
const fs = await dlg().innerText();
ok('texture chips', fs.includes('מרקם') && fs.includes('טרוונטין') && !fs.includes('תיאור קצר'), '');
ok('copy button', await dlg().getByRole('button', { name: /העתקה מגוון אחר/ }).count() === 1);
await dlg().getByRole('button', { name: 'מט', exact: true }).click(); await page.waitForTimeout(200);
/* המרקם החדש נפתח מהעיפרון */
await dlg().getByRole('button', { name: 'הוספת מרקם' }).click(); await page.waitForTimeout(300);
await dlg().getByLabel('מרקם חדש').fill('קשקש');
await dlg().getByRole('button', { name: 'שמירת המרקם' }).click();
await page.waitForTimeout(300);
await full('1-finish');
await dlg().getByRole('button', { name: /העתקה מגוון אחר/ }).click(); await page.waitForTimeout(400);
await dlg().getByRole('button', { name: /לבן/ }).first().click(); await page.waitForTimeout(500);
const prices = await dlg().locator('input[aria-label="מחיר צרכן"]').evaluateAll((e) => e.map((x) => x.value));
ok('prices copied from another finish', prices.join(',').includes('120'), prices.join(','));
await full('2-copied');
await dlg().getByRole('button', { name: 'שמירה' }).click(); await page.waitForTimeout(800);
const list = await page.innerText('main');
ok('textures shown in the list', list.includes('מט') && list.includes('קשקש'), '');
await page.goBack(); await page.waitForTimeout(700);

/* --- שרטוט בגרירה + מחיקת קיר --- */
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('גרירה בע״מ');
await dlg().getByLabel(/עיר/).fill('חולון');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/גרירה בע״מ/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
await pickWalls(page, 'מורכב'); await page.waitForTimeout(700);

const svg = dlg().locator('svg[viewBox="0 0 6000 6000"]');
/* התיבה זזה כשהמגירה גדלה, ולכן היא נמדדת מחדש לפני כל תנועה */
const P = async (fx, fy) => {
  const bb = await svg.boundingBox();
  return [bb.x + bb.width * fx, bb.y + bb.height * fy];
};
const dragTo = async (a, c) => {
  await page.mouse.move(...(await P(...a))); await page.mouse.down();
  await page.mouse.move(...(await P(...c)), { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(350);
};
await dragTo([0.2, 0.25], [0.2, 0.7]);
await dragTo([0.2, 0.7], [0.75, 0.7]);
console.log('after 2:', await svg.locator('line').count(), JSON.stringify(await svg.boundingBox()));
await dragTo([0.75, 0.7], [0.75, 0.4]);
console.log('after 3:', await svg.locator('line').count());
await full('3-dragged');
const t = await dlg().innerText();
ok('drag drew three walls', /3 קירות/.test(t), t.split('\n').filter(Boolean).slice(-2).join(' / '));

/* מחיקת קיר אמצעי */
/* בעיפרון נגיעה מוסיפה פינה; לבחירת קיר מכבים אותו */
await dlg().getByRole('button', { name: 'ציור בנגיעה' }).click(); await page.waitForTimeout(300);
/* אמצע הקיר האופקי, לפי המיקום שלו על המסך ברגע זה */
const mid = await svg.locator('line').nth(1).boundingBox();
await page.mouse.click(mid.x + mid.width / 2, mid.y + mid.height / 2);
await page.waitForTimeout(400);
ok('wall selected for deletion', await dlg().getByRole('button', { name: 'מחיקת הקיר שנבחר' }).count() === 1);
await dlg().getByRole('button', { name: 'מחיקת הקיר שנבחר' }).click(); await page.waitForTimeout(500);
ok('wall removed', /2 קירות/.test(await dlg().innerText()), (await dlg().innerText()).split('\n').filter(Boolean).slice(-2).join(' / '));
await full('4-deleted');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
