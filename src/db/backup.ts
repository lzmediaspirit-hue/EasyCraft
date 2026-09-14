import { db } from './db';
import type { CatalogItem } from './types';

/**
 * הוצאת הנתונים מהמכשיר, והחזרתם אליו.
 *
 * הכול נשמר מקומית ב-IndexedDB, וזה מה שמאפשר לאפליקציה לעבוד בלי
 * אינטרנט. המחיר הוא שהנתונים כלואים: הם לא עוברים למכשיר שני, אי
 * אפשר לשלוח אותם למישהו, ואם הדפדפן ינוקה הם ייעלמו.
 *
 * הקובץ כאן הוא הדלת. הוא JSON פשוט וקריא — לא פורמט סודי — ולכן
 * אפשר לפתוח אותו, לקרוא אותו, לשמור אותו בענן, ולהחזיר אותו לכל
 * מכשיר אחר.
 */

/** גרסת הפורמט. מי שקורא קובץ ישן צריך לדעת מה הוא מקבל. */
export const BACKUP_FORMAT = 1;

/** הטבלאות שנכנסות לגיבוי מלא, בסדר שבו הן נכתבות בחזרה. */
const TABLES = [
  'settings',
  'materials',
  'finishes',
  'catalog',
  'team',
  'customers',
  'projects',
  'walls',
  'units',
  'stages',
  'stock',
  'consumption',
  'projectPrices',
] as const;

type TableName = (typeof TABLES)[number];

/** שם הטבלה בעברית, כדי שהודעת שגיאה תדבר על מה שחסר ולא על טבלה. */
const TABLE_LABEL: Record<TableName, string> = {
  settings: 'ההגדרות',
  materials: 'הלוחות',
  finishes: 'הגוונים',
  catalog: 'הספרייה',
  team: 'הצוות',
  customers: 'הלקוחות',
  projects: 'הפרויקטים',
  walls: 'הקירות',
  units: 'הארגזים',
  stages: 'השלבים',
  stock: 'המלאי',
  consumption: 'הצריכה',
  projectPrices: 'המחירים',
};

export interface Backup {
  app: 'easycraft';
  format: number;
  /** מתי נוצר, כדי שאפשר יהיה לדעת מה חדש יותר */
  at: number;
  /** מה יש בו: הכול, או הספרייה בלבד */
  kind: 'all' | 'library';
  tables: Partial<Record<TableName, unknown[]>>;
}

/**
 * גיבוי מלא: לקוחות, פרויקטים, קירות, ארגזים, לוחות, גוונים, מלאי,
 * צוות והגדרות.
 *
 * הקבצים המצורפים אינם כאן. הם תמונות וקבצים שנשמרים כ-Blob, ו-JSON
 * אינו יודע להחזיק אותם — קידוד שלהם היה מנפח את הקובץ פי כמה
 * ומקשה על העברה. הפרויקטים עצמם נשמרים במלואם.
 */
export async function exportAll(): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const name of TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  return { app: 'easycraft', format: BACKUP_FORMAT, at: Date.now(), kind: 'all', tables };
}

/**
 * הספרייה בלבד — הארגזים שאפשר להניח על קיר.
 *
 * זה מה ששולחים כשרוצים שהספרייה של הנגרייה תעבור למכשיר אחר, או
 * תיכנס לאפליקציה עצמה כברירת מחדל. פרויקטים ולקוחות אינם כאן,
 * ולכן אפשר לשלוח אותה בלי לשלוח את הלקוחות.
 */
export async function exportLibrary(): Promise<Backup> {
  return {
    app: 'easycraft',
    format: BACKUP_FORMAT,
    at: Date.now(),
    kind: 'library',
    tables: { catalog: await db.table('catalog').toArray() },
  };
}

/**
 * קריאת קובץ גיבוי מטקסט.
 *
 * מחזירה הודעה בעברית כשהקובץ אינו מה שהוא אמור להיות — "JSON לא
 * תקין" אינו משפט שנגר אמור לפענח.
 *
 * הבדיקה כאן היא התנאי לשחזור, ולא נימוס: שחזור מלא מוחק את מה
 * שבמכשיר, ולכן קובץ חסר טבלה היה מוחק חצי ומשאיר חצי — ומדווח
 * שהכול שוחזר. קובץ שאינו שלם נעצר לפני שנגעו בנתונים.
 */
export function readBackup(text: string): { backup: Backup } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'הטקסט אינו קובץ גיבוי — נראה שהעתקה נקטעה באמצע' };
  }
  const b = parsed as Partial<Backup>;
  if (b?.app !== 'easycraft' || !b.tables || typeof b.tables !== 'object') {
    return { error: 'זה לא קובץ גיבוי של EasyCraft' };
  }
  if ((b.format ?? 0) > BACKUP_FORMAT) {
    return { error: 'הקובץ נוצר בגרסה חדשה יותר של האפליקציה' };
  }
  if (b.kind !== 'all' && b.kind !== 'library') {
    return { error: 'לא כתוב בקובץ מה יש בו — גיבוי מלא או ספרייה' };
  }
  const required: readonly TableName[] = b.kind === 'all' ? TABLES : ['catalog'];
  for (const name of required) {
    const rows = b.tables[name];
    if (!Array.isArray(rows)) return { error: `חסר בקובץ החלק של ${TABLE_LABEL[name]}` };
    if (!rows.every(isRow)) return { error: `יש שורות פגומות בחלק של ${TABLE_LABEL[name]}` };
  }
  return { backup: b as Backup };
}

/** שורה בטבלה היא אובייקט עם מזהה. בלי מזהה אי אפשר לכתוב אותה. */
function isRow(row: unknown): boolean {
  return !!row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string';
}

/** מה קרה בייבוא, כדי לומר את זה במספרים ולא ב"בוצע". */
export interface ImportResult {
  added: number;
  replaced: number;
  removed: number;
}

/**
 * ייבוא ספרייה.
 *
 * `merge` מוסיף את מה שאין ומעדכן את מה שיש — ככה מעבירים ארגזים
 * בודדים בין מכשירים. `replace` מוחק את הספרייה הקיימת ושם את
 * החדשה במקומה, וזו פעולה שנגר עושה פעם אחת: כשהספרייה שהוא בנה
 * לעצמו היא הספרייה, ומה שהגיע עם האפליקציה כבר לא רלוונטי.
 *
 * פרויקטים קיימים אינם נפגעים בשום מקרה: ארגז שהונח על קיר שמר את
 * המידות שלו בעצמו ברגע ההנחה, והוא אינו קורא מהספרייה.
 */
export async function importLibrary(
  backup: Backup,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const items = (backup.tables.catalog ?? []) as CatalogItem[];
  const now = Date.now();
  const out: ImportResult = { added: 0, replaced: 0, removed: 0 };

  await db.transaction('rw', db.catalog, async () => {
    const existing = new Map((await db.catalog.toArray()).map((i) => [i.id, i]));
    if (mode === 'replace') {
      const keep = new Set(items.map((i) => i.id));
      const drop = [...existing.keys()].filter((id) => !keep.has(id));
      out.removed = drop.length;
      await db.catalog.bulkDelete(drop);
    }
    for (const item of items) {
      if (existing.has(item.id)) out.replaced++;
      else out.added++;
    }
    await db.catalog.bulkPut(items.map((i) => ({ ...i, updatedAt: now })));
  });
  return out;
}

/**
 * שחזור מלא: מה שבקובץ מחליף את מה שבמכשיר.
 *
 * זו פעולה של "המכשיר החדש מקבל את מה שהיה בישן", ולכן היא מוחקת
 * ולא ממזגת — מיזוג של שני מצבי עולם שונים מייצר פרויקטים כפולים
 * ומלאי שלא מסתדר. הקבצים המצורפים נשארים במכשיר הישן.
 *
 * כל הטבלאות מתנקות, גם כאלה שהקובץ ריק בהן: "החלפה" שמשאירה את
 * הלקוחות הישנים לצד החדשים אינה החלפה. `readBackup` כבר ודאה
 * שהקובץ שלם, ולכן טבלה ריקה כאן היא ריקה באמת ולא חסרה.
 */
export async function importAll(backup: Backup): Promise<void> {
  await db.transaction('rw', TABLES.map((n) => db.table(n)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      const rows = backup.tables[name];
      if (rows?.length) await db.table(name).bulkPut(rows);
    }
  });
}
