import './_exit.mjs';
/*
 * שכבה 145 — B05+B06: מתג הרצפה הפיך, והשער דוחה מידה שאינה מידה.
 *
 * הורדת רגליים בלי לגעת בגובה אינה מורידה רגליים אלא מאריכה את
 * הגוף באותה מידה. וההשוואות בשער הן `<` ו-`>`, שמול NaN מחזירות
 * false — ולכן רוחב שאינו מספר עבר הכול והגיע לרשימת החיתוך.
 */
import { chromium } from 'playwright';
import { BOX, addNamed, setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

/* ------------------------------------------------------------------ */
/* B06 — השער                                                          */
/* ------------------------------------------------------------------ */
/* פרויקט אמיתי עם קיר — שני חלקי הבדיקה נשענים עליו */
await setup(page, { name: 'מתג בע״מ' });
await page.waitForTimeout(700);

const gate = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { checkItem } = await import('/src/catalog/saveGate.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const base = {
    glyph: 'doors', defaultWidthMm: 800, defaultHeightMm: 900, defaultDepthMm: 580,
    socleMm: 100, counterMm: 30, defaultYMm: 0,
  };
  const save = async (patch) => {
    try {
      await catalogRepo.saveCustom({
        rooms: ['kitchen'], group: 'base', level: 'floor', widthOptionsMm: [800],
        name: 'QA ' + Math.random().toString(36).slice(2, 8), ...base, ...patch,
      });
      return null;
    } catch (e) {
      return String(e.message ?? e);
    }
  };
  return {
    sound: checkItem(base),
    negCounter: checkItem({ ...base, counterMm: -20 }),
    negY: checkItem({ ...base, defaultYMm: -5 }),
    nanWidth: checkItem({ ...base, defaultWidthMm: NaN }),
    infDepth: checkItem({ ...base, defaultDepthMm: Infinity }),
    savedNegCounter: await save({ counterMm: -20 }),
    savedNanWidth: await save({ defaultWidthMm: NaN }),
  };
});

ok('ארגז תקין עובר', gate.sound === null, String(gate.sound));
ok('משטח שלילי נדחה', !!gate.negCounter, String(gate.negCounter));
ok('גובה מהרצפה שלילי נדחה', !!gate.negY, String(gate.negY));
ok('רוחב שאינו מספר נדחה', !!gate.nanWidth, String(gate.nanWidth));
ok('עומק אינסופי נדחה', !!gate.infDepth, String(gate.infDepth));
ok('והשמירה עצמה נעצרת', !!gate.savedNegCounter && !!gate.savedNanWidth,
  JSON.stringify([gate.savedNegCounter, gate.savedNanWidth]));

/* גם עדכון ארגז מונח עובר בשער */
const onUnit = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { unitsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const proj = (await db.projects.toArray())[0];
  if (!proj) return { skipped: true };
  const wall = (await wallsRepo.listForProject(proj.id))[0];
  const item = (await catalogRepo.all()).find((i) => i.code === 'EC-055');
  const u = await unitsRepo.add(proj.id, wall.id, item, 0);
  const tries = {};
  for (const [name, patch] of [['counter', { counterMm: -20 }], ['y', { yMm: NaN }]]) {
    try {
      await unitsRepo.update(u.id, patch);
      tries[name] = null;
    } catch (e) {
      tries[name] = String(e.message ?? e);
    }
  }
  const after = await db.units.get(u.id);
  return { tries, counter: after.counterMm, y: after.yMm };
});
if (!onUnit.skipped) {
  ok('עדכון ארגז במשטח שלילי נעצר', !!onUnit.tries.counter, String(onUnit.tries.counter));
  ok('ועדכון בגובה שאינו מספר', !!onUnit.tries.y, String(onUnit.tries.y));
  ok('והמסד נשאר נקי', onUnit.counter !== -20 && Number.isFinite(onUnit.y), JSON.stringify(onUnit));
}

/* ------------------------------------------------------------------ */
/* B05 — מתג ההצמדה לרצפה                                              */
/* ------------------------------------------------------------------ */
/*
 * חלק B06 כבר הניח ארגז על הקיר, ולכן "הארגז הראשון במסד" אינו
 * הארגז שנערך כאן. מה שנקרא הוא מה שנוסף עכשיו, ולא מה שבמקרה
 * יושב ראשון בטבלה.
 */
const before = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).map((u) => u.id);
});

await addNamed(page, BOX.doors1);
await page.waitForTimeout(900);

const read = () =>
  page.evaluate(async (old) => {
    const { db } = await import('/src/db/db.ts');
    const rows = await db.units.toArray();
    const u = rows.find((r) => !old.includes(r.id)) ?? rows[rows.length - 1];
    return { h: u.heightMm, socle: u.socleMm ?? 0, body: u.heightMm - (u.socleMm ?? 0), y: u.yMm };
  }, before);

/* רגליים מפורשות של 17 ס"מ */
await page.getByLabel('גובה רגליים').fill('17');
await page.getByLabel('גובה רגליים').blur();
await page.waitForTimeout(800);
const start = await read();
ok('רגליים 170 והגוף שמור', start.socle === 170, JSON.stringify(start));

const toggle = page.getByRole('button', { name: /הצמדה לרצפה/ });
await toggle.click();
await page.waitForTimeout(800);
const free = await read();
ok('שחרור מהרצפה מוריד את הרגליים', free.socle === 0, JSON.stringify(free));
ok('ואינו מאריך את הגוף', free.body === start.body, `${start.body} → ${free.body}`);

await toggle.click();
await page.waitForTimeout(800);
const back = await read();
ok('הצמדה חוזרת מחזירה בדיוק את הרגליים שהיו', back.socle === 170, JSON.stringify(back));
ok('והגוף חזר להיות מה שהיה', back.body === start.body, `${start.body} → ${back.body}`);
ok('והגובה הכולל חזר לעצמו', back.h === start.h, `${start.h} → ${back.h}`);

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
