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
await setDefaults({ socleMm: 90, counterTopMm: 900, counterMm: 20 });
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
  fBase?.socle === 90 && fBase?.counter === 20 && fBase?.h === 880,
  JSON.stringify(fBase));
/* תשעים הם הגובה הסופי: הגוף, הרגליים והמשטח יחד */
ok('גם אחרי היישור ראש המשטח הוא מה שנקבע',
  (fBase?.h ?? 0) + (fBase?.counter ?? 0) === 900, String((fBase?.h ?? 0) + (fBase?.counter ?? 0)));
ok('והעליון נשאר גם ביישור', fUpper?.y === 1500 && fUpper?.h === 720, JSON.stringify(fUpper));

/* ------------------------------------------------------------------ */
/* שורת המטבח בספרייה — ראש אחד, ולא חמישה                            */
/* ------------------------------------------------------------------ */
/*
 * בספרייה שנבנתה ביד הצטברו בשורה אחת חמישה גבהים: גוף 87, 88
 * ו-90, ומשטח 0, 2 ו-3 — כלומר ראש ב-87, 88, 90, 91 ו-93. שורת
 * ארונות חייבת ראש אחד, אחרת המשטח מדלג מדרגות.
 */
const run = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { glyphDef } = await import('/src/catalog/glyphList.ts' + v);
  /*
   * מי שבשורה: עומד על רצפת המטבח בטווח גובה של שורת עבודה.
   * מכשיר שנקנה שלם אינו בשורה — גובה המדיח הוא של היצרן, והוא
   * מתכוונן על הרגליים שלו.
   */
  const band = SHIPPED_LIBRARY.filter(
    (i) => i.level === 'floor' && (i.defaultYMm ?? 0) === 0 && i.rooms.includes('kitchen')
      && i.defaultHeightMm >= 820 && i.defaultHeightMm <= 960
      && !glyphDef(i.glyph).standalone,
  );
  return {
    n: band.length,
    /*
     * הראש, ולא הגוף.
     *
     * מה שחייב להיות אחיד הוא הגובה שהיד נוגעת בו, ולא עובי
     * הקופסה: ארגז שנושא משטח 2 ס"מ בנוי 88 כדי להגיע ל-90,
     * וארגז פתוח בלי משטח בנוי 90. שניהם באותה שורה.
     */
    heads: [...new Set(band.map((i) => i.defaultHeightMm + (i.counterMm ?? 0)))].sort((a, b) => a - b),
    bodies: [...new Set(band.filter((i) => (i.counterMm ?? 0) > 0)
      .map((i) => i.defaultHeightMm))].sort((a, b) => a - b),
    thick: [...new Set(band.filter((i) => (i.counterMm ?? 0) > 0)
      .map((i) => i.counterMm))].sort((a, b) => a - b),
  };
});
/*
 * תשעים, ולא תשעים ושתיים. הגובה שהבעלים קבע הוא הסופי — מהרצפה
 * עד פני המשטח, כולל הרגליים וכולל עובי המשטח.
 */
ok('לכל שורת המטבח ראש אחד', run.heads.length === 1 && run.heads[0] === 900,
  JSON.stringify(run.heads));
ok('ומי שנושא משטח בנוי בגוף אחד', run.bodies.length === 1 && run.bodies[0] === 880,
  JSON.stringify(run.bodies));
ok('ובעובי משטח אחד', run.thick.length === 1 && run.thick[0] === 20, JSON.stringify(run.thick));

/*
 * והמיגרציה מיישרת את מי שכבר התקין — אבל היא מזהה שורות לפי
 * מזהה, ומזהה שהשתנה בספרייה הופך אותה לפעולה שקטה שלא עשתה דבר.
 */
const mig = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  /*
   * הקוד נקרא כפי שהשרת מגיש אותו, ולכן הרשימה עשויה להיות
   * מעוצבת אחרת ממה שכתוב בקובץ. מה שנחלץ הוא המחרוזות בתוך
   * הרשימה עצמה, בלי להסתמך על רווחים או על סוג המרכאות.
   */
  const src = await (await fetch('/src/db/db.ts' + v)).text();
  const at = src.indexOf('db.version(32)');
  const block = src.slice(at, src.indexOf('];', at));
  const ids = [...block.matchAll(/["']([^"']{6,})["']/g)]
    .map((m) => m[1])
    .filter((x) => !x.includes(' '));
  const known = new Set(SHIPPED_LIBRARY.map((i) => i.id));
  return { n: ids.length, missing: ids.filter((id) => !known.has(id)) };
});
ok('כל מזהה במיגרציה קיים בספרייה', mig.n > 0 && mig.missing.length === 0,
  `${mig.n} מזהים, חסרים: ${mig.missing.join(',') || '—'}`);

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
