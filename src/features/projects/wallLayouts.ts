/** פריסות קיר אפשריות בפרויקט. */
export interface WallLayout {
  /** מספר הקירות. 0 = צורה שמשרטטים */
  walls: number;
  label: string;
  hint: string;
  /** ציור קו פשוט של הפריסה, במערכת 0..40 */
  path: string;
}

/** "כמה קירות" — הבחירה עצמה היא במספר, ולכן היא נשאלת אחריה. */
export const ASK_COUNT = -1;
/** כמה קירות אפשר לבקש כשבוחרים "כמה קירות" */
export const WALL_COUNTS = [2, 3, 4, 5, 6];

/**
 * שלוש הבחירות, ולא ארבע.
 *
 * "שני קירות" ו"שלושה קירות" היו אותה בחירה עם מספר אחר, ומי
 * שרצה ארבעה לא מצא אותה בכלל. עכשיו יש שלוש שאלות שונות באמת:
 * קיר אחד, כמה קירות בשרשרת, או חדר שצריך לשרטט.
 */
export const WALL_LAYOUTS: WallLayout[] = [
  { walls: 1, label: 'קיר יחיד', hint: 'שורה אחת', path: 'M4 28 H36' },
  {
    walls: ASK_COUNT,
    label: 'כמה קירות',
    hint: 'פינה, פרסה או חדר סגור',
    path: 'M4 8 V28 H36',
  },
  /*
   * חדר אמיתי לא תמיד נופל לשרשרת של פינות ישרות: יש נישה, יש
   * עמוד, ויש קיר אלכסוני. במקום להוסיף עוד ועוד כפתורים —
   * משרטטים את הצורה, והפרויקט נפתח ישר בתלת־ממד.
   */
  {
    walls: 0,
    label: 'חדר מורכב',
    hint: 'משרטטים את הצורה, ונפתח בתלת־ממד',
    path: 'M5 30 V12 L17 5 L30 12 V22 H35',
  },
];

/** שם הקיר לפי מיקומו — א', ב', ג', ד'. */
const HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
export function wallName(index: number): string {
  return `קיר ${HEB[index] ?? index + 1}׳`;
}

/** השם שהנגר נתן לקיר, ואם אין — השם לפי המיקום. */
export function wallLabel(wall: { name?: string }, index: number): string {
  return wall.name?.trim() || wallName(index);
}
