/** משימה 93: עריכה מתקדמת — פס לד, גב וקושרות. */
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

const btn = (re) => page.getByRole('button', { name: re }).first();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
};
const esc = async () => {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
};
const unit = async () => (await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return db.units.toArray();
}))[0];

/** רשימת החיתוך של הפרויקט, לפי תווית החלק. */
const parts = () => page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const B = await import('/src/costing/boards.ts' + v);
  const M = await import('/src/materials/materialsRepo.ts' + v);
  const units = await db.units.toArray();
  const [materials, settings, finishes] = await Promise.all([
    M.materialsRepo.list(), M.settingsRepo.get(), M.finishesRepo.all(),
  ]);
  const c = B.projectCosting(units, materials, settings, [], finishes, undefined);
  return c.groups.flatMap((g) => g.parts).map((p) => ({
    label: p.label, w: p.widthMm, h: p.heightMm, qty: p.qty,
  }));
});

await setup(page, { name: 'שכבה 93', walls: 'קיר יחיד' });
await page.waitForTimeout(700);
await addNamed(page, /^ארגז שתי דלתות/);
await page.waitForTimeout(800);
await page.locator('[data-unit-id]').first().click();
await page.waitForTimeout(700);

/* ---------- פותחים עריכה מתקדמת ---------- */
await btn(/עריכה מתקדמת/).click();
await page.waitForTimeout(500);
for (const label of ['פס לד', 'גב', 'קושרות', 'גובה הגב', 'צבע גוף', 'גוון הגב']) {
  ok(`${label} בעריכה המתקדמת`, await page.getByText(label, { exact: true }).first().isVisible());
}
await page.screenshot({ path: SP + 'L93-1-advanced.png' });

/* ---------- לד ---------- */
await page.getByRole('button', { name: 'מתחת למדף', exact: true }).click();
await page.waitForTimeout(600);
ok('פס לד נשמר', (await unit()).led?.includes('shelf') === true, JSON.stringify((await unit()).led));

/* ---------- קושרות במקום תקרה ---------- */
let before = await parts();
const deck = (list) => list.find((p) => p.label === 'תחתית ותקרה');
ok('לפני הקושרות: שתי תקרות', deck(before)?.qty === 2, JSON.stringify(deck(before)));

await page.getByRole('button', { name: 'תקרה', exact: true }).click();
await page.waitForTimeout(800);
let after = await parts();
ok('הקושרות נשמרו', (await unit()).rails?.top === true);
ok('נשארה תחתית אחת', deck(after)?.qty === 1, JSON.stringify(deck(after)));
const rail = after.find((p) => p.label === 'קושרת עליונה');
ok('שתי קושרות של 10 ס״מ', rail?.qty === 2 && rail?.h === 100, JSON.stringify(rail));

/* ---------- גובה גב ---------- */
const backOf = (list) => list.find((p) => p.label === 'גב');
const fullBack = backOf(before)?.h;
ok('הגב מלא מלכתחילה', fullBack > 600, String(fullBack));
const hInput = page.getByRole('spinbutton', { name: 'גובה הגב' });
await hInput.fill('30');
await hInput.blur();
await page.waitForTimeout(800);
ok('גובה הגב נשמר', (await unit()).backHeightMm === 300, String((await unit()).backHeightMm));
after = await parts();
ok('הגב נחתך נמוך יותר', backOf(after)?.h === 300, JSON.stringify(backOf(after)));

/* ---------- קושרות גב ---------- */
const railsRow = page.locator('div').filter({ hasText: /^קושרות/ }).last();
await railsRow.getByRole('button', { name: 'גב', exact: true }).click();
await page.waitForTimeout(800);
ok('קושרות גב נשמרו', (await unit()).rails?.back === true);
after = await parts();
ok('אין עוד לוח גב', !backOf(after), JSON.stringify(after.map((p) => p.label)));
const backRail = after.find((p) => p.label === 'קושרת גב');
ok('שתי קושרות גב', backRail?.qty === 2 && backRail?.h === 100, JSON.stringify(backRail));
ok('שדה גובה הגב נעלם כשיש קושרות', (await page.getByRole('spinbutton', { name: 'גובה הגב' }).count()) === 0);

/* ---------- ביטול הגב ---------- */
const backRow = page.locator('div').filter({ hasText: /^גב/ }).first();
await page.getByRole('button', { name: 'ללא גב', exact: true }).click();
await page.waitForTimeout(800);
ok('הגב בוטל', (await unit()).backKind === 'none');
after = await parts();
ok('לא נחתך שום גב', !after.some((p) => p.label.includes('גב')), JSON.stringify(after.map((p) => p.label)));
ok('קושרות וגוון הגב נעלמו', (await page.getByText('גוון הגב', { exact: true }).count()) === 0);
await page.screenshot({ path: SP + 'L93-2-noback.png' });

/* ---------- ההדמיה לא נשברת ---------- */
await page.getByRole('button', { name: 'גב דק', exact: true }).click();
await page.waitForTimeout(600);
await esc();
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: SP + 'L93-3-iso.png' });
ok('התלת־ממד מצייר', (await page.locator('svg polygon').count()) > 0, String(await page.locator('svg polygon').count()));

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();
