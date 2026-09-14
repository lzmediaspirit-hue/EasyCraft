/**
 * כלי צבע לציור.
 *
 * שתי הפונקציות האלה שירתו את הציור השטוח ואת התלת־ממד בשני
 * עותקים זהים. הן שייכות לשניהם ולא לאף אחד מהם, ולכן הן יושבות
 * כאן — ושינוי בהצללה חל על שתי התצוגות בבת אחת.
 */

/**
 * מכהה או מבהיר גוון.
 * `factor` קטן מ-1 מכהה, גדול מ-1 מבהיר. גוון שאינו שש ספרות חוזר
 * כמו שהוא, כי ניחוש עליו יהיה גרוע מלא לגעת.
 */
export function shade(hex: string, factor: number): string {
  const v = hex.replace('#', '');
  if (v.length < 6) return hex;
  const ch = (i: number) =>
    Math.round(Math.min(parseInt(v.slice(i, i + 2), 16) * factor, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/** האם הגוון כהה מספיק כדי שקווים כהים ייבלעו בו. */
export function isDark(hex: string): boolean {
  const v = hex.replace('#', '');
  if (v.length < 6) return false;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}
