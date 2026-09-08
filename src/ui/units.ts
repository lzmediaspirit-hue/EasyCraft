import { readPref, writePref } from './prefs';
/**
 * יחידות מידה.
 *
 * הכול נשמר תמיד במ"מ — זו יחידת העבודה של ניסור ושל ניצול לוח,
 * וכל חישוב נשען עליה. מה שמשתנה הוא רק התצוגה: רוב הנגרים מדברים
 * בסנטימטרים, אבל בשרטוט ובעבודה מדויקת נוח יותר במ"מ. הבחירה היא
 * העדפה של המשתמש, ולכן היא לא נוגעת באחסון ולא בחישוב.
 */

export type DisplayUnit = 'cm' | 'mm';

const KEY = 'easycraft.unit';
const listeners = new Set<() => void>();

let unit: DisplayUnit = read();

function read(): DisplayUnit {
  return readPref(KEY) === 'mm' ? 'mm' : 'cm';
}

export const displayUnit = {
  get: (): DisplayUnit => unit,
  set(next: DisplayUnit) {
    unit = next;
    writePref(KEY, next);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** תווית היחידה לתצוגה, לצד מספר. */
export const unitLabel = (): string => (unit === 'mm' ? 'מ״מ' : 'ס״מ');

/** ממיר ערך שהמשתמש הקליד ליחידת האחסון. */
export const toMm = (value: number): number =>
  unit === 'mm' ? Math.round(value) : Math.round(value * 10);

/** ממיר מ"מ ליחידת התצוגה, כמספר. */
export const fromMm = (mm: number): number => (unit === 'mm' ? mm : mm / 10);

/**
 * מציג מ"מ ביחידת התצוגה, בלי אפסים מיותרים.
 * השם נשאר `cm` מסיבות היסטוריות בקוד, אבל הפונקציה מכבדת את
 * היחידה שנבחרה — ולכן היא נקראת גם כשהתצוגה במ"מ.
 */
export function cm(mm: number): string {
  const v = fromMm(mm);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** המרות ישירות, לשימושים שאינם תלויים בתצוגה. */
export const cmToMm = (value: number): number => Math.round(value * 10);
export const mmToCm = (mm: number): number => mm / 10;

/** מ"מ למטרים, לתצוגת מטר רץ. */
export function meters(mm: number): string {
  return (mm / 1000).toFixed(2);
}

/** ניסוח בעברית לפי כמות: "ארגז אחד" מול "3 ארגזים". */
export function count(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** סכום בשקלים, בלי אגורות מיותרות. */
export function shekels(value: number): string {
  return '₪' + Math.round(value).toLocaleString('he-IL');
}
