import './_exit.mjs';
/*
 * שכבה 150 — N10+N11: מידה חיובית לכל מוצר, ושער אחד בכל מסלול כתיבה.
 *
 * לוח ומכשיר יצאו מהבדיקה לפני שהגיעו למידות, ולכן מדף ברוחב אפס
 * ותנור בעומק אפס עברו. ומסלול ההוספה כתב בלי לבדוק כלל — ארגז
 * מגירות ברוחב 50 מ״מ נשמר, אף שהעריכה דוחה אותו.
 *
 * ואפס נשאר ערך תקין במקום שבו הוא אומר "אין": רגליים, משטח
 * וגובה מהרצפה.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await setup(page, { name: 'שער בע״מ' });
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* N10 — אפס במידות הגוף, בכל קטגוריה                                 */
/* ------------------------------------------------------------------ */
const zero = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { checkUnit } = await import('/src/catalog/saveGate.ts' + v);
  const base = { widthMm: 600, heightMm: 880, depthMm: 580, socleMm: 100, counterMm: 30, yMm: 0 };
  const at = (glyph, over) => checkUnit({ ...base, glyph, ...over });
  return {
    /* לוח בודד — אלה שיצאו מהבדיקה ראשונים */
    slabW: at('slab', { widthMm: 0, heightMm: 30 }),
    slabD: at('slab', { depthMm: 0, heightMm: 30 }),
    /* מכשיר שנקנה שלם */
    ovenW: at('oven', { widthMm: 0 }),
    ovenD: at('oven', { depthMm: 0 }),
    /* ופאנל, שהוא לוח עומד */
    panelH: at('panel', { heightMm: 0, widthMm: 18 }),
    /* ארגז רגיל — נדחה גם קודם, וממשיך להידחות */
    doorsW: at('doors', { widthMm: 0 }),
    /* ומה שתקין נשאר תקין */
    soundSlab: at('slab', { heightMm: 30 }),
    soundOven: at('oven', {}),
    soundDoors: at('doors', {}),
    /* אפס במקום שבו הוא אומר "אין" — ולא "לא קיים" */
    noLegs: at('doors', { socleMm: 0 }),
    noCounter: at('doors', { counterMm: 0 }),
    onFloor: at('doors', { yMm: 0 }),
  };
});

for (const [name, label] of [
  ['slabW', 'לוח ברוחב אפס'], ['slabD', 'לוח בעומק אפס'],
  ['ovenW', 'מכשיר ברוחב אפס'], ['ovenD', 'מכשיר בעומק אפס'],
  ['panelH', 'פאנל בגובה אפס'], ['doorsW', 'ארגז ברוחב אפס'],
]) {
  ok(`${label} נדחה`, !!zero[name], String(zero[name]));
}
ok('לוח תקין עובר', zero.soundSlab === null, String(zero.soundSlab));
ok('מכשיר תקין עובר', zero.soundOven === null, String(zero.soundOven));
ok('ארגז תקין עובר', zero.soundDoors === null, String(zero.soundDoors));
ok('בלי רגליים הוא ערך תקין', zero.noLegs === null, String(zero.noLegs));
ok('בלי משטח הוא ערך תקין', zero.noCounter === null, String(zero.noCounter));
ok('ועומד על הרצפה', zero.onFloor === null, String(zero.onFloor));

/* ------------------------------------------------------------------ */
/* N11 — אותו שער בהוספה, בקבוצה ובהחלפה אוטומטית                     */
/* ------------------------------------------------------------------ */
const gate = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { unitsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const proj = (await db.projects.toArray())[0];
  const wall = (await wallsRepo.listForProject(proj.id))[0];
  const item = (await catalogRepo.all()).find((i) => i.level === 'floor' && i.glyph === 'drawers')
    ?? (await catalogRepo.all()).find((i) => i.level === 'floor');

  const before = (await unitsRepo.listForProject(proj.id)).length;
  const tries = {};
  /* רוחב שאי אפשר לבנות ממנו ארגז מגירות */
  try {
    await unitsRepo.add(proj.id, wall.id, item, 0, 50);
    tries.narrow = null;
  } catch (e) {
    tries.narrow = String(e.message ?? e);
  }
  /* ורוחב אפס */
  try {
    await unitsRepo.add(proj.id, wall.id, item, 0, 0);
    tries.zero = null;
  } catch (e) {
    tries.zero = String(e.message ?? e);
  }
  /* ומה שתקין עדיין נכנס */
  const good = await unitsRepo.add(proj.id, wall.id, item, 0);
  const after = await unitsRepo.listForProject(proj.id);
  return {
    tries,
    added: after.length - before,
    goodWidth: good.widthMm,
    /* ולא נשארה שורה ברוחב 50 */
    narrowRows: after.filter((u) => u.widthMm === 50 || u.widthMm === 0).length,
  };
});

ok('הוספה ברוחב 50 נעצרת', !!gate.tries.narrow, String(gate.tries.narrow));
ok('והוספה ברוחב אפס', !!gate.tries.zero, String(gate.tries.zero));
ok('ארגז תקין עדיין נכנס', gate.added === 1 && gate.goodWidth > 0,
  `${gate.added} נוספו, ברוחב ${gate.goodWidth}`);
ok('והמסד נקי ממידות שאי אפשר לבנות', gate.narrowRows === 0, String(gate.narrowRows));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
