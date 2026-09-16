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
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/catalog/shipped.ts');

/** שדות שאינם שייכים לקוד: הם נקבעים מחדש בכל מכשיר. */
const PER_DEVICE = ['createdAt', 'updatedAt', 'hiddenAt', 'workshopId', 'rev', 'sourceId'];

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

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('שימוש: node scripts/library-to-seed.mjs <library.json> | --reset');
  process.exit(args.length ? 0 : 1);
}

if (args[0] === '--reset') {
  writeFileSync(OUT, empty());
  console.log('חזרנו לארגזי התקן שב-builtins.ts');
  process.exit(0);
}

const backup = JSON.parse(readFileSync(args[0], 'utf8'));
if (backup.app !== 'easycraft') die('זה לא קובץ גיבוי של EasyCraft');
const rows = backup.tables?.catalog;
if (!Array.isArray(rows) || !rows.length) die('אין ארגזים בקובץ');
const materialRows = backup.tables?.materials ?? [];
const finishRows = backup.tables?.finishes ?? [];

/*
 * מה שהוסר מהספרייה אינו נכנס. הוא הוסר בכוונה, ולהחזיר אותו
 * דרך הקוד היה מבטל בדיוק את ההחלטה הזו.
 */
const items = rows
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

writeFileSync(
  OUT,
  HEAD +
    `export const SHIPPED_LIBRARY: ShippedItem[] = ${JSON.stringify(items, null, 2)};\n` +
    DEPS_DOC +
    `export const SHIPPED_MATERIALS: ShippedMaterial[] = ${JSON.stringify(materials, null, 2)};\n` +
    `export const SHIPPED_FINISHES: ShippedFinish[] = ${JSON.stringify(finishes, null, 2)};\n`,
);
console.log(`${items.length} ארגזים נכנסו ל-src/catalog/shipped.ts`);
console.log(`${materials.length} לוחות ו-${finishes.length} גוונים נכנסו איתם`);
const dropped = rows.length - items.length;
if (dropped) console.log(`${dropped} שהוסרו מהספרייה לא נכנסו`);
if (missing) {
  console.log(
    `שים לב: ${missing} הפניות לגוון או ללוח לא נמצאו בקובץ. ייצא את הספרייה מגרסה עדכנית של האפליקציה, שנושאת איתה גם אותם.`,
  );
}
console.log('הרץ npm run typecheck ואז npm run build:single');

/** שורה שמוכנה לקוד: בלי חותמות הזמן שנקבעות בכל מכשיר מחדש */
function strip(row) {
  const out = { ...row };
  for (const k of ['createdAt', 'updatedAt']) delete out[k];
  return out;
}

/** הקובץ הריק — כשחוזרים לארגזי התקן */
function empty() {
  return (
    HEAD +
    'export const SHIPPED_LIBRARY: ShippedItem[] = [];\n' +
    DEPS_DOC +
    'export const SHIPPED_MATERIALS: ShippedMaterial[] = [];\n' +
    'export const SHIPPED_FINISHES: ShippedFinish[] = [];\n'
  );
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}
