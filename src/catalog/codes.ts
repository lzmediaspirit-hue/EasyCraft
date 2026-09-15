/**
 * המק״ט של הארגז — הזהות שהנגר עובד איתה.
 *
 * הכלל נמצא כאן ולא בשני מקומות מפני שהוא נדרש בשניהם: בהגירה של
 * ספרייה קיימת, ובזריעה הראשונה של ספרייה חדשה. כשהכלל היה רק
 * בהגירה, התקנה חדשה קיבלה ספרייה שלמה בלי מק״טים — ואז שום דבר
 * לא מנע ממנה להשתכפל בייבוא הבא.
 */

/** קטגוריה בספרייה, כפי שהיא נשמרת. */
type Group = string;

/**
 * אות הקידומת של המק״ט, לפי הקטגוריה.
 * אות אחת באנגלית ולא בעברית: מק״ט נקרא משמאל לימין, נכתב על
 * מדבקה, ונשלח לספק — ועברית מתהפכת בכל אחד מהשלושה.
 */
export const CODE_PREFIX: Record<string, string> = {
  base: 'B',
  upper: 'U',
  tall: 'T',
  storage: 'S',
  panel: 'P',
};

function prefixOf(group: Group): string {
  return CODE_PREFIX[group] ?? 'B';
}

/** המספר שבתוך מק״ט, או 0 כשאין. */
export function codeNumber(code: string | undefined, prefix: string): number {
  const m = code?.match(new RegExp(`^${prefix}-(\\d+)$`));
  return m ? Number(m[1]) : 0;
}

/** שורה מינימלית שאפשר לחלק לה מק״ט. */
export interface CodeRow {
  id: string;
  group: Group;
  sortOrder: number;
  code?: string;
}

/**
 * מק״ט לכל שורה שאין לה, לפי סדר הספרייה.
 * הספירה ממשיכה מהגבוה שכבר תפוס באותה קידומת, כך שמק״ט קיים
 * לעולם אינו נלקח פעמיים.
 *
 * מחזיר רק את מה שהתחדש — id ומק״ט — ואינו נוגע בשורות עצמן.
 */
export function fillCodes(rows: CodeRow[]): { id: string; code: string }[] {
  const next: Record<string, number> = {};
  for (const row of rows) {
    const p = prefixOf(row.group);
    next[p] = Math.max(next[p] ?? 100, codeNumber(row.code, p));
  }
  const out: { id: string; code: string }[] = [];
  for (const row of [...rows].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (row.code) continue;
    const p = prefixOf(row.group);
    next[p] = (next[p] ?? 100) + 1;
    out.push({ id: row.id, code: `${p}-${next[p]}` });
  }
  return out;
}
