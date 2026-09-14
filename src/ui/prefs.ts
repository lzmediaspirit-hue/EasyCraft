/**
 * העדפות קטנות שנשמרות במכשיר.
 *
 * `localStorage` אינו מובטח: חלון פרטי, דפדפן שחוסם אחסון אתרים,
 * או תצוגה מוטמעת — וכל אחד מהם זורק במקום להחזיר ריק. העדפה היא
 * נוחות ולא נתון, ולכן כישלון בקריאה או בכתיבה שקול לכך שהיא לא
 * נשמרה: המסך עולה, הבחירה מחזיקה עד רענון, וזה הכול.
 */

/** קורא העדפה, או `null` כשאין אחסון או אין ערך. */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** כותב העדפה. כישלון נבלע במכוון — ראה למעלה. */
export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // אחסון חסום — הבחירה תחזיק עד רענון
  }
}

/** מוחק העדפה. כישלון נבלע — אין מה לנקות. */
export function clearPref(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // אין אחסון, ולכן אין מה למחוק
  }
}
