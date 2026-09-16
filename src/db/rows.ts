import type { Table } from 'dexie';
import { db } from './db';
import { workshopId } from './workshop';

/*
 * מה שקורה לכל שורה: בעלות, גרסה, וסימון כשהיא נמחקת.
 *
 * שלושת הדברים האלה אינם עניין של מסך מסוים, והם חייבים לקרות בכל
 * כתיבה בלי יוצא מן הכלל — כלל שנאכף בגבול אחד ונעקף בעשרים אינו
 * כלל. לכן הם יושבים כאן, והמאגרים קוראים להם במקום לכתוב ישירות.
 *
 * אין כאן שום דבר של שרת. זה מודל הנתונים שסנכרון יוכל להישען
 * עליו: בעלות כדי שאפשר יהיה להגביל שאילתה, גרסה כדי שאפשר יהיה
 * להכריע בין שני שינויים, וסימון מחיקה כדי שמה שנמחק לא יקום.
 */

/** מה שנוסף לכל שורה חדשה. */
export function owned(): { workshopId: string; rev: number } {
  return { workshopId: workshopId(), rev: 1 };
}

/** האם השורה שייכת לנגרייה שעובדים בה עכשיו. */
export function mine<T extends { workshopId?: string }>(row: T): boolean {
  return row.workshopId === workshopId();
}

/**
 * האם מותר לכתוב על השורה הזאת.
 *
 * כמו `mine`, ובנוסף שורה בלי בעלות בכלל — שורה שנוצרה לפני שהיה
 * שדה כזה ולא עברה את המעבר. היא של מי שמחזיק בה, ואין מי שתיגזל
 * ממנו.
 */
function writable<T extends { workshopId?: string }>(row: T): boolean {
  return row.workshopId === undefined || row.workshopId === workshopId();
}

/** מסנן רשימה לנגרייה הפעילה. */
export function onlyMine<T extends { workshopId?: string }>(rows: T[]): T[] {
  return rows.filter(mine);
}

/**
 * כל השורות של הנגרייה הפעילה בטבלה.
 *
 * דרך האינדקס ולא סינון בזיכרון: זו השאילתה שתעבור לשרת כמו שהיא,
 * ושם ההבדל בין השניים הוא בין "תן לי את שלי" ל"תן לי הכול ואסנן".
 */
export function allMine<T, I>(table: Table<T, string, I>): Promise<T[]> {
  return table.where('workshopId').equals(workshopId()).toArray();
}

/**
 * עדכון שורה: מעלה גרסה ומעדכן זמן, בפעולה אחת.
 *
 * `modify` ולא `update` כי הגרסה נגזרת מהערך הקודם — קריאה ואז
 * כתיבה היו שתי פעולות, ושתי כתיבות בו-זמנית היו מקבלות את אותו
 * מספר.
 */
export async function patchRow<
  T extends { id: string; rev: number; updatedAt: number; workshopId?: string },
  I,
>(table: Table<T, string, I>, id: string, changes: Partial<T>): Promise<void> {
  const owner = workshopId();
  await table
    .where('id')
    .equals(id)
    .modify((row) => {
      /*
       * הבעלות נבדקת כאן, בתוך הפעולה עצמה.
       *
       * הקריאה הייתה מוגבלת לנגרייה והכתיבה לא: שאילתה על ארגז של
       * נגרייה אחרת החזירה ריק כמצופה, אבל `update` על אותו מזהה
       * בדיוק הצליח. גבול שנאכף בקריאה בלבד אינו גבול — הוא הסתרה.
       *
       * הבדיקה יושבת בתוך `modify` ולא לפניו כדי שלא יהיה רווח בין
       * "בדקתי" ל"כתבתי".
       */
      if (row.workshopId !== undefined && row.workshopId !== owner) return;
      Object.assign(row, changes, {
        /*
         * זהות ובעלות אינן שדות שמעדכנים בדרך.
         *
         * `patch` רגיל שנושא `workshopId` היה מעביר שורה לנגרייה
         * אחרת בלי שאיש התכוון לכך, ו-`rev` מהקלט היה מאפשר לכתיבה
         * להכריז על עצמה ישנה יותר ממה שהיא.
         */
        id: row.id,
        workshopId: row.workshopId,
        rev: (row.rev ?? 0) + 1,
        updatedAt: Date.now(),
      });
    });
}

/**
 * מחיקה שמשאירה סימון.
 *
 * בלי הסימון, מכשיר שני שלא יודע על המחיקה שולח את השורה בחזרה,
 * והיא קמה לתחייה — זו התקלה שהכי קשה להסביר לנגר: "מחקתי את זה
 * אתמול". הסימון הוא מזהה וגרסה, ואינו סל מחזור: הוא פנימי, אין לו
 * מסך, ומה שהמשתמש רואה כ"הוסר" הוא דבר אחר לגמרי.
 */
export async function eraseRows<T extends { id: string; rev?: number; workshopId?: string }, I>(
  table: Table<T, string, I>,
  all: T[],
): Promise<void> {
  /* אותו גבול, גם למי שמעביר שורות שקרא בעצמו */
  const rows = all.filter(writable);
  if (!rows.length) return;
  const now = Date.now();
  await db.tombstones.bulkPut(
    rows.map((r) => ({
      id: `${table.name}:${r.id}`,
      table: table.name,
      rowId: r.id,
      workshopId: r.workshopId ?? workshopId(),
      rev: r.rev ?? 1,
      deletedAt: now,
    })),
  );
  await table.bulkDelete(rows.map((r) => r.id));
}

/** מוחק לפי מזהים: קורא את מה שנמחק כדי שהסימון יישא את הגרסה. */
export async function eraseIds<T extends { id: string; rev?: number; workshopId?: string }, I>(
  table: Table<T, string, I>,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  /* מחיקה חוצה נגרייה הצליחה כמו עדכון חוצה נגרייה. גם כאן: לא */
  const rows = (await table.bulkGet(ids)).filter((r): r is T => !!r && writable(r));
  await eraseRows(table, rows);
}

/**
 * הנגרייה המקומית קיימת.
 *
 * המעבר במסד יוצר אותה למי שכבר התקין; התקנה חדשה אינה עוברת שום
 * מעבר, ולכן היא נוצרת גם כאן. הקריאה בטוחה לחזור על עצמה.
 */
export async function ensureWorkshop(): Promise<void> {
  const id = workshopId();
  if (await db.workshops.get(id)) return;
  const now = Date.now();
  await db.workshops.put({ id, name: 'הנגרייה שלי', createdAt: now, updatedAt: now });
}

/**
 * שורות קיימות, מוכנות לכתיבה חוזרת: גרסה אחת קדימה וזמן חדש.
 *
 * ל-`bulkPut` של שורות שכבר קיימות — סידור מחדש, סימון קבוצתי —
 * שבו `patchRow` לשורה הייתה כתיבה לכל אחת בנפרד.
 */
export function bumped<T extends { rev: number; updatedAt: number }>(rows: T[]): T[] {
  const now = Date.now();
  return rows.map((r) => ({ ...r, rev: (r.rev ?? 0) + 1, updatedAt: now }));
}

/**
 * מבטל סימוני מחיקה לשורות שחזרו.
 *
 * "בטל" מחזיר ארגז שנמחק, וזו בדיוק שורה שיש לה סימון מחיקה. בלי
 * ניקוי הסימון, הסנכרון הבא היה מוחק אותה שוב — המשתמש ראה אותה
 * חוזרת על המסך ונעלמת מעצמה כעבור רגע.
 */
export async function revive(tableName: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.tombstones.bulkDelete(ids.map((id) => `${tableName}:${id}`));
}
