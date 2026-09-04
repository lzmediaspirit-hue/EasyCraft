/** פריסות קיר אפשריות בפרויקט. */
export interface WallLayout {
  /** מספר הקירות. 0 = צורה שמשרטטים */
  walls: number;
  label: string;
  hint: string;
  /** ציור קו פשוט של הפריסה, במערכת 0..40 */
  path: string;
}

export const WALL_LAYOUTS: WallLayout[] = [
  { walls: 1, label: 'קיר יחיד', hint: 'שורה אחת', path: 'M4 28 H36' },
  { walls: 2, label: 'שני קירות', hint: 'פינה', path: 'M4 8 V28 H36' },
  { walls: 3, label: 'שלושה קירות', hint: 'פרסה', path: 'M6 8 V28 H34 V8' },
  /*
   * חדר אמיתי לא תמיד נופל לאחת משלוש הפריסות: יש חדר סגור, יש
   * נישה, ויש קיר אלכסוני. במקום להוסיף עוד ועוד כפתורים —
   * משרטטים את הצורה.
   */
  { walls: 0, label: 'ייחודי', hint: 'משרטטים את צורת החדר', path: 'M5 30 V12 L17 5 L30 12 V22 H35' },
];

/** שם הקיר לפי מיקומו — א', ב', ג', ד'. */
const HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
export function wallName(index: number): string {
  return `קיר ${HEB[index] ?? index + 1}׳`;
}
