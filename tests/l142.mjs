import './_exit.mjs';
/*
 * שכבה 142 — B02: מה שנשמר בפריט הוא מה שנוחת על הקיר.
 *
 * ההנחה החליפה רגליים מפורשות בברירת המחדל, ומכיוון שהגובה השמור
 * הוא גוף ועוד רגליים — היא לא קיצרה את הרגליים אלא האריכה את
 * הגוף. וארגז שנשמר מרחף ירד לרצפה.
 *
 * **הגבול הזה זז מאז, לבקשת בעל הפרויקט.** גובה הרגליים הוא תקן
 * של הנגרייה ולא של התבנית: מי שמשנה אותו במסך ההגדרות מצפה
 * שהארגז הבא יקבל אותו, וקודם זה לא קרה אף פעם — כל 126 הפריטים
 * נושאים רגליים משלהם, ולכן ההגדרה לא חלה על אחד מהם.
 *
 * מה שלא זז הוא כל השאר, וזה מה שנבדק כאן: הגובה הכולל, הגוף
 * שנגזר ממנו, והגובה מהרצפה. ארגז שנשמר מרחף נשאר מרחף, ורגליים
 * שנשמרו כאפס נשארות אפס — אפס מפורש הוא החלטה שאין רגליים, ולא
 * שתיקה.
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

/* פרויקט אמיתי עם קיר, דרך המסכים — ואז מניחים דרך המאגר */
await setup(page, { name: 'הנחה בע״מ' });
await page.waitForTimeout(700);

const placed = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { unitsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);

  /* הנגרייה עובדת ברגליים של 10 ס"מ */
  const s = await settingsRepo.get();
  await settingsRepo.save({ defaults: { ...s.defaults, socleMm: 100 } });

  const BASE = {
    rooms: ['kitchen'], group: 'base', glyph: 'doors', doors: 2, level: 'floor',
    widthOptionsMm: [800], defaultWidthMm: 800, defaultDepthMm: 580, counterMm: 0,
  };
  /* גוף 80 ורגליים 17 — גובה שמור 97 */
  const tallLegs = await catalogRepo.saveCustom({
    ...BASE, name: 'QA רגליים גבוהות', defaultHeightMm: 970, socleMm: 170, defaultYMm: 0,
  });
  /* בלי רגליים, ומרחף 45 ס"מ מהרצפה */
  const floating = await catalogRepo.saveCustom({
    ...BASE, name: 'QA מרחף', defaultHeightMm: 800, socleMm: 0, defaultYMm: 450,
  });

  const proj = (await db.projects.toArray())[0];
  const wall = (await wallsRepo.listForProject(proj.id))[0];

  let at = 0;
  const put = async (id) => {
    const item = await catalogRepo.get(id);
    const u = await unitsRepo.add(proj.id, wall.id, item, (at += 900));
    return {
      h: u.heightMm, socle: u.socleMm ?? 0, body: u.heightMm - (u.socleMm ?? 0),
      y: u.yMm, locked: !!u.floorLocked,
    };
  };
  return { legs: await put(tallLegs), float: await put(floating) };
});

/*
 * הרגליים הן של הנגרייה: 17 ס״מ שנשמרו בתבנית הופכים ל-10 שנקבעו
 * בהגדרות. הגובה הכולל אינו זז, ולכן מה שגדל הוא הגוף.
 */
ok('גובה הרגליים נלקח מהתקן של הנגרייה', placed.legs.socle === 100,
  JSON.stringify(placed.legs));
ok('והגובה הכולל אינו זז, ולכן הגוף הוא ההפרש',
  placed.legs.body === placed.legs.h - placed.legs.socle && placed.legs.body === 870,
  JSON.stringify(placed.legs));
ok('והגובה הכולל נשאר 97', placed.legs.h === 970, JSON.stringify(placed.legs));
ok('ארגז עם רגליים עומד על הרצפה', placed.legs.y === 0 && placed.legs.locked, JSON.stringify(placed.legs));

ok('ארגז שנשמר מרחף נשאר מרחף', placed.float.y === 450, JSON.stringify(placed.float));
ok('ואינו ננעל לרצפה שהוא לא נוגע בה', placed.float.locked === false, JSON.stringify(placed.float));
ok('והגוף שלו לא השתנה', placed.float.h === 800 && placed.float.socle === 0, JSON.stringify(placed.float));

/* וברירת המחדל עדיין ממלאת מה שאין */
const inherited = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { unitsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const id = await catalogRepo.saveCustom({
    rooms: ['kitchen'], group: 'base', glyph: 'doors', doors: 2, level: 'floor',
    widthOptionsMm: [800], defaultWidthMm: 800, defaultDepthMm: 580,
    name: 'QA בלי רגליים שנשמרו', defaultHeightMm: 900, defaultYMm: 0,
  });
  /* אין רגליים בשורה כלל — לא אפס, אלא שדה שלא נשאל */
  await db.catalog.update(id, { socleMm: undefined });
  const item = await catalogRepo.get(id);
  const proj = (await db.projects.toArray())[0];
  const wall = (await wallsRepo.listForProject(proj.id))[0];
  const u = await unitsRepo.add(proj.id, wall.id, item, 2800);
  return { asked: item.socleMm, got: u.socleMm };
});
ok('פריט בלי רגליים מקבל את ברירת המחדל של הנגרייה',
  inherited.asked === undefined && inherited.got === 100, JSON.stringify(inherited));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
