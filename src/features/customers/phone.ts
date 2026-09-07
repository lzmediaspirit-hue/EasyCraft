/** כלי עזר למספרי טלפון ישראליים. */

/** משאיר ספרות בלבד וממיר קידומת בינלאומית (972+) לפורמט מקומי. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+972')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('972') && digits.length > 10) digits = '0' + digits.slice(3);
  return digits.replace(/\D/g, '');
}

/** מספר סביר: קווי 9 ספרות או נייד 10 ספרות, שמתחיל ב-0. */
export function isValidPhone(normalized: string): boolean {
  return /^0\d{8,9}$/.test(normalized);
}
