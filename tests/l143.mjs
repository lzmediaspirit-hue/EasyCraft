import './_exit.mjs';
/*
 * שכבה 143 — B03: כיבוי שורד את כל הדרך חזרה לספרייה.
 *
 * "בלי משטח" נשמר כשדה שלא נשלח במקום כאפס, וכל שער בדרך שמר על
 * מה שהיה: הארגז על הקיר איבד את המשטח, ובשמירה חזרה לספרייה
 * העובי הישן חזר משם. הבדיקה הולכת את המסלול המלא — ספרייה,
 * הנחה, כיבוי, שמירה חזרה, ופתיחה מחדש.
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

await setup(page, { name: 'כיבוי בע״מ' });
await page.waitForTimeout(700);

const trip = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { unitsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);

  /* פריט עם משטח 30 ורגליים 10 */
  const id = await catalogRepo.saveCustom({
    rooms: ['kitchen'], group: 'base', glyph: 'doors', doors: 2, level: 'floor',
    name: 'QA משטח שיורד', defaultWidthMm: 800, widthOptionsMm: [800],
    defaultHeightMm: 900, defaultDepthMm: 580, defaultYMm: 0,
    socleMm: 100, counterMm: 30,
  });

  const proj = (await db.projects.toArray())[0];
  const wall = (await wallsRepo.listForProject(proj.id))[0];
  const unit = await unitsRepo.add(proj.id, wall.id, await catalogRepo.get(id), 1400);
  const placed = { counter: unit.counterMm, socle: unit.socleMm };

  /* מכבים על הארגז — בדיוק מה שהעורך המלא שולח */
  await unitsRepo.update(unit.id, { counterMm: 0, socleMm: 0, heightMm: 800 });
  const off = await db.units.get(unit.id);

  /* ושומרים חזרה אל פריט המקור */
  await catalogRepo.saveCustom({
    id,
    name: 'QA משטח שיורד',
    defaultWidthMm: off.widthMm, widthOptionsMm: [off.widthMm],
    defaultHeightMm: off.heightMm, defaultDepthMm: off.depthMm, defaultYMm: off.yMm,
    socleMm: off.socleMm, counterMm: off.counterMm,
  });
  const back = await catalogRepo.get(id);

  /* ומניחים אותו שוב */
  const again = await unitsRepo.add(proj.id, wall.id, await catalogRepo.get(id), 2400);

  return {
    placed,
    onUnit: { counter: off.counterMm, socle: off.socleMm, h: off.heightMm },
    inLibrary: { counter: back.counterMm, socle: back.socleMm, h: back.defaultHeightMm },
    replaced: { counter: again.counterMm, socle: again.socleMm, h: again.heightMm },
  };
});

ok('הארגז נולד עם משטח ורגליים',
  trip.placed.counter === 30 && trip.placed.socle === 100, JSON.stringify(trip.placed));
ok('הכיבוי נשמר על הארגז',
  trip.onUnit.counter === 0 && trip.onUnit.socle === 0, JSON.stringify(trip.onUnit));
ok('והוא שורד את השמירה חזרה לספרייה',
  trip.inLibrary.counter === 0 && trip.inLibrary.socle === 0, JSON.stringify(trip.inLibrary));
ok('והגובה שנשמר הוא הגוף בלי רגליים',
  trip.inLibrary.h === 800, JSON.stringify(trip.inLibrary));
ok('והנחה חוזרת אינה מחזירה את המשטח',
  trip.replaced.counter === 0, JSON.stringify(trip.replaced));

/* --- ובמסך: כיבוי בעורך המלא מגיע עד הספרייה --- */
await page.waitForTimeout(600);
const viaUi = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const u = (await db.units.toArray()).find((x) => x.name === 'QA משטח שיורד');
  return { id: u?.id, counter: u?.counterMm };
});
ok('יש ארגז כזה על הקיר', !!viaUi.id, JSON.stringify(viaUi));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
