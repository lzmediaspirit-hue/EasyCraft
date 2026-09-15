import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const shot = (n) => page.screenshot({ path: `${SP}/L49B-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

async function add(name, tab) {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(600);
  /* הספרייה נפתחת ישר בחדר של הפרויקט, ולכן בוחר החדרים אינו תמיד שם */
  const room = dlg().getByRole('button', { name: /^מטבח/ });
  if (await room.count()) { await room.click(); await page.waitForTimeout(600); }
  if (tab) { await dlg().getByRole('button', { name: tab, exact: true }).click(); await page.waitForTimeout(500); }
  await dlg().getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
  await page.waitForTimeout(400);
}

await setup(page, { name: 'תצוגה בע״מ' });
await add('ארגז כיור');
await add('ארגז 3 מגירות');
await add('ארגז דלת ומגירה');
await add('עמודת מקרר', 'עמודות');
await add('עליון שתי דלתות', 'עליונים');
await add('עליון ויטרינה', 'עליונים');
await shot('1-front');

await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(700);
await shot('2-inside');
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(500);

/* --- תלת־ממד בזוויות שונות --- */
await btn(/מבט תלת־ממדי/).click(); await page.waitForTimeout(900);
await shot('3-iso-default');
const fills = await page.locator('polygon').evaluateAll((e) => e.map((p) => p.getAttribute('fill')));
/*
 * כל פאה נצבעת לפי הנורמל שלה, ולכן הגוון היוצא הוא הצללה של
 * הגוון ולא הגוון עצמו. הבדיקה היא קרבה, לא זהות.
 */
const near = (hex, tol = 26) => {
  const to = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = to(hex);
  return fills.some((f) => {
    if (!/^#[0-9a-f]{6}$/i.test(f ?? '')) return false;
    const [x, y, z] = to(f);
    return Math.abs(x - r) < tol && Math.abs(y - g) < tol && Math.abs(z - b) < tol;
  });
};
ok('countertop in 3D', near('#78716c'), fills.slice(0, 6).join(' '));
ok('appliance front in 3D', near('#d6d3d1'), fills.slice(0, 6).join(' '));
const svg = page.locator('svg').filter({ has: page.locator('polygon') }).first();
const box = await svg.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const orbit = async (dx, dy, name) => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await shot(name);
};
await orbit(-140, 0, '4-iso-yaw-left');
await orbit(280, 0, '5-iso-yaw-right');
await orbit(-140, -110, '6-iso-rise-up');
await orbit(0, 220, '7-iso-rise-down');

await btn(/^דו־ממד/).click(); await page.waitForTimeout(700);

/* --- מבט על --- */
await btn(/מבט על/).click(); await page.waitForTimeout(900);
await shot('8-plan');
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

/* --- תצוגה ללקוח --- */
await page.getByRole('button', { name: /ללקוח/ }).first().click();
await page.waitForTimeout(1000);
await shot('9-present');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
