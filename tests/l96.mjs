import './_exit.mjs';
/** משימה 96: ההדמיה מסתובבת אל הקיר שנבחר. */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

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

await setup(page, { name: 'שכבה 96', walls: 'שלושה קירות' });
await page.waitForTimeout(900);
await addUnit(page, 0);
await page.waitForTimeout(700);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);

/* מעבר לתלת־ממד. חדר עם שלושה קירות כבר נפתח שם */
if (await page.getByRole('button', { name: /^תלת־ממד/ }).count()) {
  await btn(/^תלת־ממד/).click();
  await page.waitForTimeout(1200);
}

/**
 * הקיר הפעיל בציור: הרקע שלו מסומן `active` בסצנה. מודדים אותו
 * דרך רוחב המצולע שלו על המסך — קיר שעומדים מולו רחב יותר מקיר
 * שנראה מהצד.
 */
const activeWidth = () =>
  page.evaluate(() => {
    /* הציור הוא ה-SVG עם הכי הרבה מצולעים; השאר הם אייקונים */
    const svgs = [...document.querySelectorAll('svg')];
    const svg = svgs.sort(
      (a, b) => b.querySelectorAll('polygon').length - a.querySelectorAll('polygon').length,
    )[0];
    if (!svg || !svg.querySelectorAll('polygon').length) return -1;
    return svg.getAttribute('viewBox');
  });

const headings = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const walls = (await db.walls.toArray()).sort((a, b) => a.index - b.index);
  return P.buildPlan(walls, []).map((p) => ({ id: p.wall.id, heading: p.headingDeg }));
});
ok('לחדר שלושה קירות בכיוונים שונים', new Set(headings.map((h) => h.heading)).size >= 2, JSON.stringify(headings));

const wallTabs = page.locator('button').filter({ hasText: /^קיר [א-ג]׳?$/ });
const tabs = await wallTabs.count();
ok('יש לשוניות קירות', tabs >= 3, String(tabs));

await page.screenshot({ path: SP + 'L96-1-wall-a.png' });
const wA = await activeWidth();

/* מעבר לקיר ב׳ — התמונה חייבת להשתנות */
await wallTabs.nth(1).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: SP + 'L96-2-wall-b.png' });
const wB = await activeWidth();
ok('התמונה השתנתה כשעברנו קיר', wA !== wB && wA !== -1, `${wA} → ${wB}`);

/* הכיוון עצמו: המבט מסתובב בדיוק בכיוון הקיר החדש */
const yawFor = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const S = await import('/src/features/design/isoScene.ts' + v);
  const walls = (await db.walls.toArray()).sort((a, b) => a.index - b.index);
  const units = await db.units.toArray();
  const plan = P.buildPlan(walls, units);
  /* מה שהמסך עושה: זווית המבט היא מינוס כיוון הקיר הפעיל */
  return plan.map((p) => {
    const scene = S.buildScene({
      walls, units, activeWallId: p.wall.id, selectedId: null, inside: false,
      finishHex: {}, present: false, view: { yawDeg: -p.headingDeg, rise: 0.5 },
    });
    return { heading: p.headingDeg, shown: scene.view.yawDeg };
  });
});
for (const { heading, shown } of yawFor) {
  ok(`קיר בכיוון ${heading} נראה מלפניו`, Math.abs(shown - -heading) < 0.001, `${shown}`);
}

/* כפתור "זווית התחלתית" מחזיר אל הקיר הנוכחי ולא אל הראשון */
await page.mouse.move(210, 500);
await page.mouse.down();
await page.mouse.move(120, 520, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(700);
const reset = page.getByRole('button', { name: 'זווית התחלתית' });
ok('כפתור זווית התחלתית הופיע אחרי סיבוב', await reset.isVisible());
await reset.click();
await page.waitForTimeout(900);
ok('הכפתור נעלם אחרי החזרה', (await reset.count()) === 0);
const wBack = await activeWidth();
ok('חזרנו אל אותה זווית מול הקיר', wBack === wB, `${wB} → ${wBack}`);
await page.screenshot({ path: SP + 'L96-3-reset.png' });

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();
