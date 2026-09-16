import './_exit.mjs';
/*
 * שכבה 121 — המדף כמוצר.
 *
 * מדף הוא לוח, לא ארגז: רוחב, עומק ועובי משלו, בלי דפנות, בלי
 * דלתות ובלי רגליים. הוא נשען על התמיכה שכבר קיימת ללוח מונח
 * (E06), ואינו מנוע ציור שני.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();

const units = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts?v=' + Date.now());
    return await db.units.toArray();
  });

await setup(page, { name: 'מדפים בע״מ' });
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);

/* --- המדף נמצא בספרייה, בקטגוריה משלו --- */
await btn(/הוספת ארגז/).click();
await page.waitForTimeout(800);
const dlg = page.getByRole('dialog').last();
ok('the library has a shelves tab', (await dlg.getByRole('button', { name: 'מדפים', exact: true }).count()) > 0);
await dlg.getByLabel('חיפוש ארגז לפי שם').fill('מדף צף');
await page.waitForTimeout(600);
await dlg.getByRole('button', { name: /^מדף צף/ }).first().click();
await page.waitForTimeout(1100);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(500);

const placed = (await units())[0];
ok('a shelf can be placed', !!placed, JSON.stringify(placed?.name));
ok('its thickness is its height, not 50 mm', placed?.heightMm === 30, String(placed?.heightMm));
ok('and it hangs at its own height', placed?.yMm === 1400, String(placed?.yMm));
ok('it is not locked to the floor', !placed?.floorLocked);
await page.screenshot({ path: SP + 'L121-1-elevation.png', fullPage: true });

/* --- רשימת החיתוך: לוח אחד, בלי דפנות ובלי רגליים --- */
const cut = await page.evaluate(async (id) => {
  const v = '?v=' + Date.now();
  const B = await import('/src/costing/boards.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const u = await db.units.get(id);
  const s = await (await import('/src/materials/materialsRepo.ts' + v)).settingsRepo.get();
  return B.unitParts(u, s).map((p) => ({ role: p.role, w: p.widthMm, h: p.heightMm, grain: p.grain, label: p.label }));
}, placed.id);
ok('the cut list is one board', cut.length === 1, JSON.stringify(cut));
ok('and it is the shelf itself, width by depth', cut[0]?.w === 800 && cut[0]?.h === 250, JSON.stringify(cut[0]));
ok('its grain runs along its length', cut[0]?.grain === 'width', String(cut[0]?.grain));

/* --- העובי נערך בשדה משלו, ולא כ"גובה ארגז" --- */
await page.locator('[data-unit-id]').first().click();
await page.waitForTimeout(900);
const panel = await page.innerText('body');
ok('the editor offers a board thickness', /עובי הלוח/.test(panel), JSON.stringify(panel.slice(0, 120)));
ok('and does not offer a cabinet height', (await page.getByRole('button', { name: /^גובה/ }).count()) === 0);

/* --- שינוי העובי משנה את הגוף עצמו --- */
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, { heightMm: 18 });
});
await page.waitForTimeout(700);
const thin = (await units())[0];
ok('an 18 mm shelf is 18 mm', thin.heightMm === 18, String(thin.heightMm));

const geo = await page.evaluate(async (id) => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/placement.ts' + v);
  const PL = await import('/src/features/design/plan.ts' + v);
  const S = await import('/src/features/design/isoScene.ts' + v);
  const u = await db.units.get(id);
  const walls = await db.walls.toArray();
  const box = P.unitBox(u, PL.buildPlan(walls, [u]));
  const scene = S.buildScene({
    walls, units: [u], activeWallId: u.wallId, selectedId: null,
    inside: false, finishHex: {}, present: false, view: { yawDeg: -45, riseDeg: 20 },
  });
  const mine = scene.solids.filter((q) => q.unitId === u.id);
  return { boxH: box?.h ?? null, solids: mine.length, drawnH: mine.length ? mine[0].hi[1] - mine[0].lo[1] : -1 };
}, placed.id);
ok('the collision box is the board itself', geo.boxH === 18, String(geo.boxH));
ok('3D draws one board', geo.solids === 1, String(geo.solids));
ok('at the same thickness', Math.abs(geo.drawnH - 18) < 1, String(geo.drawnH));

await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: SP + 'L121-2-iso.png', fullPage: true });
await btn(/מבט על/).click();
await page.waitForTimeout(1100);
await page.screenshot({ path: SP + 'L121-3-plan.png', fullPage: true });

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
