/**
 * ביחידות: הכול נשמר במ"מ (דיוק לניסור ולניצול לוח בהמשך),
 * אבל מוצג בסנטימטרים — כי זו השפה שנגר מדבר בה.
 */

export const cmToMm = (cm: number): number => Math.round(cm * 10);
export const mmToCm = (mm: number): number => mm / 10;

/** מציג מ"מ כסנטימטרים, בלי אפסים מיותרים. */
export function cm(mm: number): string {
  const v = mm / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** מ"מ למטרים, לתצוגת מטר רץ. */
export function meters(mm: number): string {
  return (mm / 1000).toFixed(2);
}

/** ניסוח בעברית לפי כמות: "ארגז אחד" מול "3 ארגזים". */
export function count(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}
