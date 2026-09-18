import './_exit.mjs';
/*
 * שכבה 146 — הספרייה שנשלחת עומדת בכללים של עצמה.
 *
 * כאן ישבה התאמה מול גיליון: 79 שורות, שלוש הסרות, תוספת אחת
 * מאושרת. הגיליון הזה כבר אינו המקור — הנגרייה בונה את הספרייה
 * באפליקציה ומייצאת אותה, ו-`scripts/library-to-seed.mjs` כותב
 * ממנה את `shipped.ts`. ספירה מול מקור שאינו קיים עוד אינה בדיקה.
 *
 * מה שכן נשאר נכון הוא הכללים שהספרייה חייבת לקיים, ואינם תלויים
 * בגודלה: מזהה אחד לכל ארגז, מק״ט אחד, שם אחד, וחדר שקיים. שם
 * כפול הוא הדוגמה החיה — שער השמירה חוסם אותו, ולכן ספרייה
 * שנשלחת איתו נותנת שני פריטים שנראים זהים ואחד מהם לא ניתן
 * לעריכה.
 *
 * והאיחוד עם מוצרי המערכת נעשה לפי מזהה, כמו ב-`shippedLibrary`:
 * מאז שהנגרייה מייצאת מתוך האפליקציה, המוצרים שכבר יש בה נוסעים
 * בספרייה, וחיבור פשוט של שתי הרשימות סופר אותם פעמיים.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const lib = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY, LIBRARY_GENERATION, LIBRARY_RELEASE } =
    await import('/src/catalog/shipped.ts' + v);
  const { SHIPPED_PRODUCTS } = await import('/src/catalog/products.ts' + v);
  const { SEED_ROOMS } = await import('/src/catalog/rooms.ts' + v);
  const { checkItem } = await import('/src/catalog/saveGate.ts' + v);

  const libIds = new Set(SHIPPED_LIBRARY.map((i) => i.id));
  const all = [...SHIPPED_LIBRARY, ...SHIPPED_PRODUCTS.filter((p) => !libIds.has(p.id))];
  const dup = (list) => {
    const seen = new Set();
    const twice = new Set();
    for (const x of list) (seen.has(x) ? twice : seen).add(x);
    return [...twice];
  };
  /* ארגז שאי אפשר לחתוך אינו ארגז שאפשר לשלוח */
  const unbuildable = [];
  for (const i of all) {
    try {
      checkItem(i);
    } catch (e) {
      unbuildable.push(`${i.code}: ${String(e?.message ?? e).slice(0, 60)}`);
    }
  }
  const known = new Set(SEED_ROOMS.map((r) => r.id));
  return {
    n: all.length,
    cabinets: SHIPPED_LIBRARY.length,
    dupIds: dup(all.map((i) => i.id)),
    dupCodes: dup(all.map((i) => i.code)),
    dupNames: dup(all.map((i) => i.name)),
    noCode: all.filter((i) => !i.code).map((i) => i.name),
    noRoom: all.filter((i) => !i.rooms?.length).map((i) => i.code),
    strangeRoom: [...new Set(all.flatMap((i) => i.rooms ?? []))].filter((r) => !known.has(r)),
    rooms: [...new Set(SHIPPED_LIBRARY.flatMap((i) => i.rooms))].sort(),
    groups: [...new Set(all.map((i) => i.group))].sort(),
    perDevice: all.filter((i) => i.createdAt || i.updatedAt || i.workshopId || i.releaseMark)
      .map((i) => i.code),
    notBuiltin: SHIPPED_LIBRARY.filter((i) => !i.isBuiltin).map((i) => i.code),
    hidden: SHIPPED_LIBRARY.filter((i) => i.hiddenAt).length,
    unbuildable,
    generation: LIBRARY_GENERATION,
    release: LIBRARY_RELEASE,
  };
});

ok('הספרייה אינה ריקה', lib.cabinets > 0, `${lib.cabinets} ארגזים, ${lib.n} עם המוצרים`);
ok('אין מזהה כפול', lib.dupIds.length === 0, lib.dupIds.join(','));
ok('אין מק״ט כפול', lib.dupCodes.length === 0, lib.dupCodes.join(','));
/*
 * שני ארגזים באותו שם הם ארגז אחד שאי אפשר לבחור בו: ברשימה הם
 * נראים זהים, ושער השמירה יחסום את מי שינסה לערוך את השני.
 */
ok('אין שם כפול', lib.dupNames.length === 0, lib.dupNames.join(' · '));
ok('לכל ארגז יש מק״ט', lib.noCode.length === 0, lib.noCode.join(','));
ok('לכל ארגז יש חדר', lib.noRoom.length === 0, lib.noRoom.join(','));
ok('וכל חדר שמוזכר קיים', lib.strangeRoom.length === 0, lib.strangeRoom.join(','));
ok('תשעה חדרים מכוסים', lib.rooms.length === 9, lib.rooms.join(','));
ok('שלוש הקטגוריות שכל חדר בנוי מהן קיימות',
  ['base', 'upper', 'tall'].every((g) => lib.groups.includes(g)), lib.groups.join());
/*
 * חותמת זמן, בעלות וסימון שחרור אינם שייכים לקוד: הם נקבעים בכל
 * מכשיר מחדש. סימון שנוסע בקוד היה טוען על התקנה חדשה שהיא כבר
 * קיבלה שחרור שלא היה.
 */
ok('אין בקוד שדות שנקבעים במכשיר', lib.perDevice.length === 0, lib.perDevice.join(','));
ok('הכול מסומן כתבנית שהגיעה עם האפליקציה', lib.notBuiltin.length === 0, lib.notBuiltin.join(','));
ok('ומה שהוסר מהספרייה לא נכנס לקוד', lib.hidden === 0, String(lib.hidden));
ok('כל ארגז בספרייה עובר את שער הבנייה', lib.unbuildable.length === 0,
  lib.unbuildable.slice(0, 3).join(' | '));
ok('לספרייה יש דור, והוא עולה בכל החלפה', lib.generation >= 1, String(lib.generation));
ok('ומנגנון ההצעה שמר את המספר שלו', lib.release >= 1, String(lib.release));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
