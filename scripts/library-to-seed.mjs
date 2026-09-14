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
const PER_DEVICE = ['createdAt', 'updatedAt', 'hiddenAt'];

const HEAD = `import type { CatalogItem } from '../db/types';

/** פריט ספרייה מוכן, לפני שנזרע — חותמות הזמן נקבעות בזריעה עצמה. */
export type ShippedItem = Omit<CatalogItem, 'createdAt' | 'updatedAt'>;

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

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('שימוש: node scripts/library-to-seed.mjs <library.json> | --reset');
  process.exit(args.length ? 0 : 1);
}

if (args[0] === '--reset') {
  writeFileSync(OUT, `${HEAD}export const SHIPPED_LIBRARY: ShippedItem[] = [];\n`);
  console.log('חזרנו לארגזי התקן שב-builtins.ts');
  process.exit(0);
}

const backup = JSON.parse(readFileSync(args[0], 'utf8'));
if (backup.app !== 'easycraft') die('זה לא קובץ גיבוי של EasyCraft');
const rows = backup.tables?.catalog;
if (!Array.isArray(rows) || !rows.length) die('אין ארגזים בקובץ');

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

const body = JSON.stringify(items, null, 2);
writeFileSync(OUT, `${HEAD}export const SHIPPED_LIBRARY: ShippedItem[] = ${body};\n`);
console.log(`${items.length} ארגזים נכנסו ל-src/catalog/shipped.ts`);
const dropped = rows.length - items.length;
if (dropped) console.log(`${dropped} שהוסרו מהספרייה לא נכנסו`);
console.log('הרץ npm run typecheck ואז npm run build:single');

function die(msg) {
  console.error(msg);
  process.exit(1);
}
