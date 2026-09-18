#!/usr/bin/env node
/**
 * הספרייה שנבנתה בנגרייה הופכת לספרייה שמגיעה עם האפליקציה.
 *
 * הנגר בונה את הארגזים שלו באפליקציה, מייצא אותם ממסך "גיבוי
 * והעברה", ושולח את הטקסט. הכלי הזה ממיר אותו ל-`src/catalog/shipped.ts`,
 * ומאותו רגע הם מה שכל מכשיר חדש מקבל — במקום ארגזי התקן שנכתבו
 * בקוד.
 *
 *   node scripts/library-to-seed.mjs library.json
 *   node scripts/library-to-seed.mjs --reset      חזרה לארגזי התקן
 *
 * הכלי אינו נוגע בבסיס הנתונים של אף אחד: הוא כותב קוד. מכשיר
 * שכבר יש בו ספרייה שומר על שלו, כי זריעה מוסיפה רק מה שחסר.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/catalog/shipped.ts');

/**
 * שדות שאינם שייכים לקוד: הם נקבעים מחדש בכל מכשיר.
 *
 * `releaseMark` הוא ביניהם, וזו לא קוסמטיקה: הוא אומר "מה המכשיר
 * הזה קיבל בשחרור הקודם", והזריעה מחשבת אותו מחדש מהשורה עצמה.
 * סימון שנוסע בקוד היה טוען על התקנה חדשה שהיא כבר קיבלה שחרור
 * שלא היה, ומנגנון העדכון היה קורא לזה "נערך כאן".
 */
const PER_DEVICE = [
  'createdAt', 'updatedAt', 'hiddenAt', 'workshopId', 'rev', 'sourceId', 'releaseMark',
];

const HEAD = `import type { CatalogItem, Finish, Material } from '../db/types';

/** פריט ספרייה מוכן, לפני שנזרע — חותמות הזמן נקבעות בזריעה עצמה. */
/*
 * פריט שמגיע עם האפליקציה.
 *
 * הבעלות והגרסה אינן חלק ממנו: הן נקבעות ברגע שהוא נזרע אל נגרייה
 * מסוימת. רשימה שנושאת בעלות הייתה טוענת שהיא שייכת למישהו עוד
 * לפני שהותקנה.
 */
export type ShippedItem = Omit<CatalogItem, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;
export type ShippedMaterial = Omit<Material, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;
export type ShippedFinish = Omit<Finish, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;

/**
 * הספרייה שמגיעה עם האפליקציה, כשהיא נבנתה בנגרייה ולא נכתבה בקוד.
 *
 * ארגזי התקן שב-\`builtins.ts\` הם נקודת פתיחה: מידות מקובלות, שמות
 * מקובלים, מה שאפשר להתחיל ממנו ביום הראשון. הספרייה האמיתית של
 * נגרייה נבנית בעבודה — ארגז שנבנה פעם אחת נכון, ומאז מוזמן שוב.
 *
 * מי שבנה אותה מייצא אותה ממסך "גיבוי והעברה", והקובץ הזה נכתב
 * ממנה על ידי \`scripts/library-to-seed.mjs\`. מרגע שהוא אינו ריק,
 * הוא זה שנזרע — ומה שכתוב ב-\`builtins.ts\` כבר אינו מוצג.
 *
 * נכתב בכלי, לא ביד.
 */
`;

/**
 * הלוחות והגוונים שהספרייה מפנה אליהם, עם ההערה שמסבירה למה.
 */
const DEPS_DOC = `
/**
 * הלוחות והגוונים שהספרייה הזו מפנה אליהם.
 *
 * ארגז שומר מזהה של גוון, לא את הגוון עצמו. בלי השניים האלה, ספרייה
 * שנבנתה בנגרייה הייתה מגיעה למכשיר חדש עם הפניות לשום דבר: הצבע
 * שנבחר לחזית לא היה קיים, והמחיר לא היה מחושב. הם נזרעים עם
 * המזהים המקוריים שלהם, וזה מה שמחזיק את ההפניות.
 */
`;

/**
 * שני המספרים ששומרים על התקנות קיימות, ומה ההבדל ביניהם.
 *
 * `LIBRARY_RELEASE` הוא מנגנון ההצעה: תבנית שהשתנתה מוצגת, והנגרייה
 * בוחרת אם לקבל אותה. הוא נכון לשינוי נקודתי.
 *
 * `LIBRARY_GENERATION` הוא החלפה. כשספרייה שלמה מוחלפת באחרת אין מה
 * להציע ואין מה למזג: מה שהיה יורד, ומה שבא נכנס. הוא עולה בכל פעם
 * שהכלי הזה כותב ספרייה חדשה, וזה מה שאומר להתקנה קיימת שהיא צריכה
 * להחליף ולא להוסיף.
 *
 * שניהם נכתבים כאן ולא ביד. `LIBRARY_RELEASE` נוסף פעם אחת ביד אחרי
 * שהכלי נכתב, והריצה הבאה הייתה מוחקת אותו בשקט — הקובץ נכתב מאפס
 * בכל פעם. מי שממשיך להיכתב ביד ייעלם בהרצה הבאה.
 */
function carriedOver() {
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const read = (name, fallback) => {
    const m = prev.match(new RegExp(`export const ${name} = (\\d+)`));
    return m ? Number(m[1]) : fallback;
  };
  return { release: read('LIBRARY_RELEASE', 1), generation: read('LIBRARY_GENERATION', 0) };
}

/** הקבועים, בתחתית הקובץ — כדי שהספרייה עצמה תישאר למעלה */
function versions({ release, generation }) {
  return `
/**
 * גרסת הספרייה — מנגנון ההצעה.
 *
 * מספר שעולה כשתבנית כאן משתנה. התקנה קיימת אינה נזרעת שוב, ולכן
 * המספר הזה הוא מה שמאפשר לה לדעת שיש שינוי, להציג אותו, ולבחור מה
 * לקבל. ראה \`libraryRelease.ts\`.
 */
export const LIBRARY_RELEASE = ${release};

/**
 * דור הספרייה — מנגנון ההחלפה.
 *
 * עולה בכל פעם שהכלי כותב כאן ספרייה אחרת. התקנה שהדור שלה נמוך
 * יותר אינה מקבלת הצעות למיזוג: היא מקבלת את הספרייה הזאת במקום מה
 * שהיה לה. ראה \`replaceLibrary\` ב-\`catalogRepo.ts\`.
 */
export const LIBRARY_GENERATION = ${generation};
`;
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('שימוש: node scripts/library-to-seed.mjs <library.json> | --reset');
  process.exit(args.length ? 0 : 1);
}

if (args[0] === '--reset') {
  const was = carriedOver();
  writeFileSync(OUT, empty(was));
  console.log('חזרנו לארגזי התקן שב-builtins.ts');
  process.exit(0);
}

const backup = JSON.parse(readFileSync(args[0], 'utf8'));
if (backup.app !== 'easycraft') die('זה לא קובץ גיבוי של EasyCraft');
const catalogRows = backup.tables?.catalog;
if (!Array.isArray(catalogRows) || !catalogRows.length) die('אין ארגזים בקובץ');
const materialRows = backup.tables?.materials ?? [];
const finishRows = backup.tables?.finishes ?? [];

/*
 * מה שהוסר מהספרייה אינו נכנס. הוא הוסר בכוונה, ולהחזיר אותו
 * דרך הקוד היה מבטל בדיוק את ההחלטה הזו.
 */
const items = catalogRows
  .filter((i) => !i.hiddenAt)
  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  .map((i, order) => {
    const out = { ...i, isBuiltin: true, sortOrder: order };
    for (const k of PER_DEVICE) delete out[k];
    /* מפתח קבוע — בלעדיו עדכון האפליקציה היה מייצר כפילויות */
    if (!out.id) die(`ארגז בלי מזהה: ${out.name ?? '?'}`);
    return out;
  });

/*
 * הלוחות והגוונים שהארגזים מפנים אליהם נוסעים איתם, במזהה המקורי.
 * בלעדיהם כל ארגז שנבנה עם גוון מפורש מגיע למכשיר חדש עם הפניה
 * לשום דבר: הצבע לא מופיע, והמחיר לא מחושב.
 */
const needFinishes = new Set();
const needMaterials = new Set();
for (const i of items) {
  for (const k of ['carcassFinishId', 'frontFinishId', 'exposedFinishId', 'backFinishId']) {
    if (i[k]) needFinishes.add(i[k]);
  }
  for (const k of ['carcassMaterialId', 'frontMaterialId', 'exposedMaterialId', 'backMaterialId']) {
    if (i[k]) needMaterials.add(i[k]);
  }
}
const finishes = finishRows.filter((f) => needFinishes.has(f.id)).map(strip);
/* גוון מתומחר על לוחות מסוימים, וגם הם נדרשים */
for (const f of finishes) for (const id of Object.keys(f.prices ?? {})) needMaterials.add(id);
const materials = materialRows.filter((m) => needMaterials.has(m.id)).map(strip);

const missing = [...needFinishes].filter((id) => !finishes.some((f) => f.id === id)).length
  + [...needMaterials].filter((id) => !materials.some((m) => m.id === id)).length;

const was = carriedOver();
writeFileSync(
  OUT,
  HEAD +
    `export const SHIPPED_LIBRARY: ShippedItem[] = ${rows(items)};\n` +
    DEPS_DOC +
    `export const SHIPPED_MATERIALS: ShippedMaterial[] = ${rows(materials)};\n` +
    `export const SHIPPED_FINISHES: ShippedFinish[] = ${rows(finishes)};\n` +
    versions({ release: was.release, generation: was.generation + 1 }),
);
console.log(`${items.length} ארגזים נכנסו ל-src/catalog/shipped.ts`);
console.log(`דור הספרייה: ${was.generation} ← ${was.generation + 1}`);
console.log(`${materials.length} לוחות ו-${finishes.length} גוונים נכנסו איתם`);
const dropped = catalogRows.length - items.length;
if (dropped) console.log(`${dropped} שהוסרו מהספרייה לא נכנסו`);
if (missing) {
  console.log(
    `שים לב: ${missing} הפניות לגוון או ללוח לא נמצאו בקובץ. ייצא את הספרייה מגרסה עדכנית של האפליקציה, שנושאת איתה גם אותם.`,
  );
}
console.log('הרץ npm run typecheck ואז npm run build:single');

/**
 * טבלה, שורה בשורה.
 *
 * `JSON.stringify` עם הזחה פורס כל שדה לשורה משלו, ושמונים ארגזים
 * הפכו לשלושת אלפים שורות שאי אפשר לקרוא ואי אפשר להשוות ביניהן
 * בדיף. ארגז הוא שורה: מה שהשתנה בין שתי גרסאות נראה מיד.
 */
function rows(list) {
  if (!list.length) return '[]';
  return `[\n${list.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]`;
}

/** שורה שמוכנה לקוד: בלי חותמות הזמן שנקבעות בכל מכשיר מחדש */
function strip(row) {
  const out = { ...row };
  for (const k of ['createdAt', 'updatedAt']) delete out[k];
  return out;
}

/** הקובץ הריק — כשחוזרים לארגזי התקן */
function empty(was) {
  return (
    HEAD +
    'export const SHIPPED_LIBRARY: ShippedItem[] = [];\n' +
    DEPS_DOC +
    'export const SHIPPED_MATERIALS: ShippedMaterial[] = [];\n' +
    'export const SHIPPED_FINISHES: ShippedFinish[] = [];\n' +
    versions({ release: was.release, generation: was.generation + 1 })
  );
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}
