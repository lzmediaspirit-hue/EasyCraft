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

/** תצוגה: 050-1234567 לנייד, 03-1234567 לקווי. */
export function formatPhone(normalized: string): string {
  if (normalized.length === 10) return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
  if (normalized.length === 9) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  return normalized;
}
