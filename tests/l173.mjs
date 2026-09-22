import './_exit.mjs';
/**
 * שכבה 173 — מגירה שאינה גונבת את המיקוד, שדה מידה שאינו שומר
 * חצי מספר, ומאמת ניסור שמסכים עם החוזה של המנוע.
 *
 * **המגירה.** הפתיחה שלה — רישום, הכנסת המיקוד, והחזרתו בסגירה —
 * רצה על כל זהות חדשה של `onClose`. רוב הקוראים מעבירים פונקציה
 * שנוצרת בכל רינדור, ושדה שנשמר תוך כדי הקלדה מרנדר את המסך. אחרי
 * 180 מ"ש של שקט המיקוד קפץ לכפתור הסגירה והמשך ההקלדה אבד:
 * "500" באורך קיר נשמר כ-300 מ"מ.
 *
 * **שדה המידה.** בזמן הקלדה הערך נשמר בלי גבולות השדה, והם נאכפו
 * רק ביציאה ממנו. "5" בדרך ל-"500" נשמר כקיר של 5 ס"מ.
 *
 * **מאמת הניסור.** קרא "סיבים חסרים = עוקב סיבים" גם לגב, שהמנוע
 * מסובב בצדק; וחייב חתך להיות חצי מ"מ בתוך המלבן, ולכן פסל חתך
 * שמביא חלק למידתו ומשאיר 0.2 מ"מ לנסורת. בשני המקרים המנוע צדק.
 */
import { chromium } from 'playwright';
import { setup, addBox, BOX } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const out = [];
const ok = (name, cond, extra = '') =>
  out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 180)));

/* ------------------------------------------------------------------ */
/* המאמת, על מספרים                                                    */
/* ------------------------------------------------------------------ */
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const nest = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const N = await import('/src/costing/nesting.ts' + v);
  const C = await import('/src/costing/nestCheck.ts' + v);
  const opts = { sheetWidthMm: 1220, sheetHeightMm: 2440, kerfMm: 4, hasGrain: true, edgeTrimMm: 0 };

  /*
   * גב בלי כיוון מוצהר — חופשי, והמנוע רשאי לסובב אותו. ברוחב 2,400
   * על פלטה של 1,220 הוא *חייב* להסתובב כדי להיכנס.
   */
  const back = [{ label: 'גב', widthMm: 2400, heightMm: 1000, qty: 1, role: 'back' }];
  const backRes = N.nestParts(back, opts);
  const backRotated = backRes.sheets.flatMap((s) => s.parts).some((p) => p.rotated);

  /*
   * חתך שמשאיר פחות מהלהב: לוח ברוחב 247 וחמישה חלקים של 46
   * ועוד ארבעה להבים של 4.2 — 246.8. החתך האחרון מוריד 0.2 מ"מ.
   */
  const sliverOpts = { sheetWidthMm: 247, sheetHeightMm: 1000, kerfMm: 4.2, hasGrain: false, edgeTrimMm: 0 };
  const sliver = [{ label: 'פס', widthMm: 46, heightMm: 900, qty: 5, grain: 'free' }];
  const sliverRes = N.nestParts(sliver, sliverOpts);

  /* והמאמת עדיין תופס טעות אמיתית: חלק עוקב סיבים שסובב */
  const side = [{ label: 'צד', widthMm: 560, heightMm: 2000, qty: 1, grain: 'height' }];
  const sideRes = N.nestParts(side, opts);
  const forged = structuredClone(sideRes);
  const p = forged.sheets[0].parts[0];
  Object.assign(p, { rotated: true, widthMm: p.heightMm, heightMm: p.widthMm });

  /* וחתך שאינו חוצה מלבן שלם */
  const bad = structuredClone(sliverRes);
  bad.sheets[0].cuts.unshift({ axis: 'x', at: 100, from: 200, to: 300 });

  return {
    backRotated,
    backProblems: C.checkNesting(back, opts, backRes).map((x) => x.kind),
    sliverProblems: C.checkNesting(sliver, sliverOpts, sliverRes).map((x) => x.kind),
    sliverCuts: sliverRes.sheets[0]?.cuts.length ?? 0,
    forgedProblems: C.checkNesting(side, opts, forged).map((x) => x.kind),
    badProblems: C.checkNesting(sliver, sliverOpts, bad).map((x) => x.kind),
    sameRule: N.grainOf({ role: 'back' }, { hasGrain: true }) === 'free'
      && N.grainOf({ role: 'side' }, { hasGrain: true }) === 'height'
      && N.grainOf({ role: 'side', grain: 'free' }, { hasGrain: true }) === 'free'
      && N.grainOf({ role: 'side' }, { hasGrain: false }) === 'free',
  };
});
ok('גב שסובב אינו נפסל — הוא חופשי', nest.backRotated && nest.backProblems.length === 0,
  `${nest.backRotated ? 'סובב' : 'לא סובב'} · ${nest.backProblems.join(',')}`);
ok('חתך שמשאיר פחות מהלהב אינו נפסל', nest.sliverProblems.length === 0,
  `${nest.sliverCuts} חתכים · ${nest.sliverProblems.join(',')}`);
ok('אבל חלק עוקב סיבים שסובב — נתפס', nest.forgedProblems.includes('grain'),
  nest.forgedProblems.join(','));
ok('וחתך שאינו חוצה מלבן שלם — נתפס', nest.badProblems.includes('notGuillotine'),
  nest.badProblems.join(','));
ok('כלל הסיבים אחד, למנוע ולמאמת', nest.sameRule);

/* ------------------------------------------------------------------ */
/* אורך הקיר, בהקלדה אמיתית עם הפסקה                                   */
/* ------------------------------------------------------------------ */
await setup(page, { name: 'מיקוד', walls: 'שני קירות', room: 'מטבח' });
await addBox(page, BOX.doors2);
const walls = () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.walls.toArray()).sort((a, b) => a.index - b.index).map((w) => w.lengthMm);
});
const before = await walls();

await page.getByRole('button', { name: 'הגדרות הקיר' }).first().click();
await page.waitForTimeout(800);
const field = page.locator('input[aria-label="אורך הקיר"]').first();
await field.click();
await page.waitForTimeout(150);
await page.keyboard.type('5');
/* הפסקה ארוכה מזמן השמירה — כמו אצבע שמחפשת את הספרה הבאה */
await page.waitForTimeout(450);
const focusAfterPause = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
const midway = await walls();
await page.keyboard.type('00');
await page.waitForTimeout(450);
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
const final = await walls();

ok('המיקוד נשאר בשדה גם אחרי שהוא נשמר', focusAfterPause === 'אורך הקיר',
  String(focusAfterPause));
ok('חצי מספר מתחת למינימום אינו נשמר', midway[0] === before[0],
  `${before[0]} → ${midway[0]}`);
ok('"500" ס"מ נשמר כחמישה מטר', final[0] === 5000, `${final[0]}`);

/* ו-Escape באמצע הקלדה אינו משאיר קיר קצר מהמינימום */
await field.click();
await page.waitForTimeout(150);
await page.keyboard.type('1');
await page.waitForTimeout(450);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const afterEscape = await walls();
/*
 * Escape הוא ביטול: הקיר נשאר במידה שהייתה לו, ולא קופץ למינימום
 * בגלל ספרה אחת שהוקלדה בדרך.
 */
ok('Escape באמצע הקלדה משאיר את הקיר כפי שהיה',
  afterEscape[0] === 5000, `${afterEscape[0]}`);

/* ------------------------------------------------------------------ */
/* שתי עריכות מהירות לאותו ארגז — שתיהן נשמרות                        */
/* ------------------------------------------------------------------ */
/*
 * העריכה הראשונה מצלמת את הפרויקט לפני שהיא כותבת, והשנייה —
 * באותו תג ובתוך חלון האיחוד — מדלגת על הצילום וכותבת מיד. כשהצילום
 * איטי, הישנה נחתה אחרונה ודרסה את החדשה: תחת עומס זה קרה בשישה
 * מתוך שתים־עשרה הרצות של l134.
 *
 * כאן זה נבדק על פרויקט גדול — 150 ארגזים — ובהמתנה עד שהכתיבות
 * נרגעות: מה שבסוף במסד הוא מה שהוקלד אחרון.
 */
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(300);
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const ws = await db.walls.toArray();
  const u0 = (await db.units.toArray())[0];
  const rows = [];
  for (let i = 0; i < 149; i++) {
    rows.push({ ...u0, id: 'heavy-' + i, wallId: ws[1].id, xMm: (i % 5) * 600, hidden: true });
  }
  await db.units.bulkPut(rows);
});
await page.waitForTimeout(1500);
const target = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).find((u) => !u.id.startsWith('heavy-')).id;
});
await page.locator(`[data-unit-id="${target}"]`).first().click().catch(() => {});
await page.waitForTimeout(600);
const btn = (re) => page.getByRole('button', { name: re }).first();
await btn(/עריכה מתקדמת/).click();
await page.waitForTimeout(700);
await btn(/הוספת פרזול/).click();
await page.waitForTimeout(400);
await btn(/פריט משלי/).click();
await page.waitForTimeout(600);
await btn(/פרטי הזמנה/).click();
await page.waitForTimeout(400);
const rounds = [];
for (let i = 1; i <= 3; i++) {
  await page.getByLabel('ספק').first().fill('ספק' + i);
  await page.getByLabel('דגם').first().fill('דגם' + i);
  await page.keyboard.press('Tab');
  /* עד שהמסד מחזיק את שני הערכים, או חמש שניות */
  let got = '';
  for (let t = 0; t < 50; t++) {
    await page.waitForTimeout(100);
    got = await page.evaluate(async (id) => {
      const { db } = await import('/src/db/db.ts');
      const r = ((await db.units.get(id))?.hardware ?? [])[0] ?? {};
      return `${r.supplier}/${r.model}`;
    }, target);
    if (got === `ספק${i}/דגם${i}`) break;
  }
  /* ועוד רגע — אם כתיבה ישנה נוחתת מאוחר, היא הייתה נראית כאן */
  await page.waitForTimeout(600);
  rounds.push(await page.evaluate(async (id) => {
    const { db } = await import('/src/db/db.ts');
    const r = ((await db.units.get(id))?.hardware ?? [])[0] ?? {};
    return `${r.supplier}/${r.model}`;
  }, target));
}
ok('בפרויקט גדול: ספק ומיד אחריו דגם — שניהם נשמרים, בכל סבב',
  rounds.every((v, i) => v === `ספק${i + 1}/דגם${i + 1}`), rounds.join(' , '));

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail}/${out.length} עברו`);
process.exit(fail ? 1 : 0);
