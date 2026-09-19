import './_exit.mjs';
/*
 * שכבה 169 — ברירות המחדל באמת מגיעות לארגז.
 *
 * מסך "ברירות מחדל לפרויקט" שמר תשע מידות, ומתוכן שתיים בלבד
 * הגיעו לאן שהוא. ארבע — גובה משטח, עומק תחתונים, עומק עליונים
 * ותחתית עליון — נשמרו ואף אחד לא קרא אותן. "גובה רגליים" נקרא,
 * אבל כ-`item.socleMm ?? defaults.socleMm`, וכל 126 פריטי הספרייה
 * נושאים רגליים משלהם — ולכן הוא לא חל אף פעם. המסך הבטיח תקן
 * ונתן קישוט.
 *
 * מה שנבדק כאן הוא שהתקן שולט, ובאותה מידה — שהוא אינו דורס את
 * מה שנבנה במתכוון אחרת. בספרייה הזאת שלושים ואחד פריטים עומדים
 * על הרצפה בלי רגליים, ושני ארונות כיור אמבטיה עומדים על 67 ס״מ.
 * "כל מה שעומד על הרצפה מקבל רגליים" היה מדביק רגליים למדף בודד,
 * ו"כל משטח לגובה העבודה" היה מותח ארון אמבטיה לגובה מטבח.
 */
import { chromium } from 'playwright';
import { setup, addBox, BOX, TAB } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* החוק עצמו                                                           */
/* ------------------------------------------------------------------ */
const rule = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { workshopFit } = await import('/src/features/projects/unitSpec.ts' + v);
  const d = { socleMm: 120, counterTopMm: 950, counterMm: 40 };
  const fit = (u, room = 'kitchen') =>
    workshopFit({ level: 'floor', yMm: 0, heightMm: 900, ...u }, d, room);
  return {
    base: fit({ socleMm: 100, counterMm: 30 }),
    /* ארגז שנבנה בלי רגליים במכוון — מדף, דופן, יחידת מגירות */
    noLegs: fit({ socleMm: 0, counterMm: 0 }),
    /* עליון: אינו על הרצפה, ולכן שום דבר בו אינו נגזר */
    upper: workshopFit(
      { level: 'wall', yMm: 1500, heightMm: 720, socleMm: 0, counterMm: 0 }, d, 'kitchen'),
    /* ארון מרחף בגובה 45 — גם הוא אינו עומד על הרצפה */
    floating: fit({ socleMm: 100, counterMm: 0, yMm: 450 }),
    /* ארון כיור אמבטיה: משטח, אבל לא מטבח */
    vanity: fit({ socleMm: 100, counterMm: 20, heightMm: 650 }, 'bathroom'),
    /* עמודה: על הרצפה, רגליים כן, משטח לא */
    tall: workshopFit(
      { level: 'tall', yMm: 0, heightMm: 2200, socleMm: 100, counterMm: 0 }, d, 'kitchen'),
    /* גובה משטח נמוך מהרגליים אינו נותן גוף שלילי */
    silly: workshopFit(
      { level: 'floor', yMm: 0, heightMm: 900, socleMm: 100, counterMm: 30 },
      { socleMm: 120, counterTopMm: 150, counterMm: 40 }, 'kitchen'),
  };
});

ok('ארגז תחתון מקבל את הרגליים והגובה של הנגרייה',
  rule.base.socleMm === 120 && rule.base.counterMm === 40 && rule.base.heightMm === 910,
  JSON.stringify(rule.base));
/* 910 + 40 = 950, כלומר ראש המשטח יושב בדיוק בגובה שנקבע */
ok('וראש המשטח יושב בדיוק בגובה שנקבע',
  rule.base.heightMm + rule.base.counterMm === 950,
  String(rule.base.heightMm + rule.base.counterMm));
ok('ארגז שנבנה בלי רגליים אינו מקבל רגליים',
  rule.noLegs.socleMm === 0, JSON.stringify(rule.noLegs));
ok('עליון אינו נוגע בכלום',
  rule.upper.socleMm === 0 && rule.upper.heightMm === 720, JSON.stringify(rule.upper));
ok('וארון מרחף אינו עומד על הרצפה',
  rule.floating.socleMm === 100 && rule.floating.heightMm === 900, JSON.stringify(rule.floating));
/*
 * גובה המשטח הוא תקן של מטבח. ארון כיור אמבטיה נבנה ל-67 ס״מ,
 * וזו לא טעות שצריך לתקן — אבל הרגליים כן תקן של הנגרייה.
 */
ok('ארון כיור אמבטיה אינו נמתח לגובה מטבח',
  rule.vanity.heightMm === 650 && rule.vanity.counterMm === 20 && rule.vanity.socleMm === 120,
  JSON.stringify(rule.vanity));
ok('עמודה מקבלת רגליים ולא משטח',
  rule.tall.socleMm === 120 && rule.tall.heightMm === 2200, JSON.stringify(rule.tall));
ok('וגובה משטח בלתי אפשרי אינו נותן גוף שלילי',
  rule.silly.heightMm >= rule.silly.socleMm, JSON.stringify(rule.silly));

/* ------------------------------------------------------------------ */
/* ומהספרייה אל הקיר, באפליקציה                                        */
/* ------------------------------------------------------------------ */
await setup(page);
const setDefaults = (patch) => page.evaluate(async (p) => {
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts');
  const s = await settingsRepo.get();
  await settingsRepo.save({ defaults: { ...s.defaults, ...p } });
}, patch);
const units = () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).map((u) => ({
    name: u.name.slice(0, 16), level: u.level,
    socle: u.socleMm, h: u.heightMm, counter: u.counterMm, y: u.yMm,
  }));
});

await setDefaults({ socleMm: 150, counterTopMm: 1000, counterMm: 40 });
await page.waitForTimeout(400);
await addBox(page, BOX.doors2);
await addBox(page, BOX.upper, { tab: TAB.upper });

const added = await units();
const base = added.find((u) => u.level === 'floor');
const upper = added.find((u) => u.level === 'wall');
ok('ארגז שנוסף מהספרייה מקבל את גובה הרגליים שנקבע',
  base?.socle === 150, JSON.stringify(base));
ok('וגובהו נגזר מגובה המשטח ומעוביו',
  base?.h === 960 && base?.counter === 40 && base.h + base.counter === 1000,
  JSON.stringify(base));
ok('והעליון אינו משתנה', upper?.socle === 0 && upper?.y === 1500, JSON.stringify(upper));

/* ------------------------------------------------------------------ */
/* פרויקט שכבר נבנה: לא זז מאליו, וזז בכפתור                          */
/* ------------------------------------------------------------------ */
await setDefaults({ socleMm: 90, counterTopMm: 920, counterMm: 20 });
await page.waitForTimeout(500);
const untouched = await units();
ok('שינוי ההגדרות אינו נוגע במה שכבר עומד',
  untouched.find((u) => u.level === 'floor')?.socle === 150,
  JSON.stringify(untouched.find((u) => u.level === 'floor')));

await page.getByRole('button', { name: 'מידות תקן' }).first().click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'החלה על הפרויקט' }).click();
await page.waitForTimeout(1200);

const fitted = await units();
const fBase = fitted.find((u) => u.level === 'floor');
const fUpper = fitted.find((u) => u.level === 'wall');
ok('והכפתור מיישר את הפרויקט לתקן',
  fBase?.socle === 90 && fBase?.counter === 20 && fBase?.h === 900,
  JSON.stringify(fBase));
ok('גם אחרי היישור ראש המשטח הוא מה שנקבע',
  (fBase?.h ?? 0) + (fBase?.counter ?? 0) === 920, String((fBase?.h ?? 0) + (fBase?.counter ?? 0)));
ok('והעליון נשאר גם ביישור', fUpper?.y === 1500 && fUpper?.h === 720, JSON.stringify(fUpper));

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
