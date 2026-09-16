import { bodyHeightMm, slabThicknessMm } from '../db/types';
import { glyphDef } from './glyphList';
import type { PlacedUnit } from '../db/types';

/**
 * מה אפשר לבנות, ומה רק אפשר להקליד.
 *
 * ארגז בגובה 5 ס״מ עם רגליים של 10 ס״מ נשמר בלי מילה — ורשימת
 * החיתוך שיצאה ממנו הכילה דפנות בגובה שלילי וגב באפס. המספרים
 * עברו כל אחד לחוד את הבדיקה "מידה חיובית"; מה שלא נבדק הוא
 * היחס ביניהם.
 *
 * הכלל כאן הוא פיזי ולא שרירותי: הגוף מכיל תחתית ותקרה, ובין
 * שתיהן צריך להישאר חלל שאפשר להכניס אליו משהו. ארגז שאין בו
 * חלל אינו ארגז צר — הוא שני לוחות זה על זה.
 */

/** החלל הפנוי הקטן ביותר שעדיין אומר "ארגז" ולא "שני לוחות". */
export const MIN_INNER_MM = 60;

/** הגובה הקטן ביותר שאפשר לבנות בו את הארגז הזה, כולל הרגליים. */
export function minHeightMm(u: Pick<PlacedUnit, 'glyph' | 'socleMm'>, t: number): number {
  if (!buildsFromBoards(u.glyph)) return 1;
  return (u.socleMm ?? 0) + 2 * t + MIN_INNER_MM;
}

/** הרוחב הקטן ביותר: שתי דפנות, ובין שתיהן חלל. */
export function minWidthMm(u: Pick<PlacedUnit, 'glyph'>, t: number): number {
  return buildsFromBoards(u.glyph) ? 2 * t + MIN_INNER_MM : 1;
}

/**
 * לוח בודד ומכשיר חשמלי אינם נבנים מלוחות סביב חלל: ללוח אין
 * תחתית ותקרה, ומכשיר מגיע שלם מהיצרן. הכלל אינו חל עליהם.
 */
function buildsFromBoards(glyph: string): boolean {
  const def = glyphDef(glyph);
  return !def.noCarcass && !def.standalone;
}

/**
 * עובי לוח סביר: מדף דק מ-3 מ״מ אינו מדף, ועבה מ-100 אינו לוח.
 *
 * כאן ולא בשער השמירה, כי כאן הם נאכפים — קבוע שיושב רחוק מהבדיקה
 * שלו הוא בדיוק איך `MAX_BOARD_MM` הפך למספר שאיש לא שאל.
 */
export const MIN_BOARD_MM = 3;
export const MAX_BOARD_MM = 100;

/**
 * מה שאי אפשר לבנות, במשפט אחד — או `null` כשהכול תקין.
 *
 * ההודעה אומרת גם את המינימום עצמו: "אי אפשר" בלי מספר שולח את
 * הנגר לנחש, ומי שמכוון גובה רוצה לדעת לאן.
 */
export function unitProblem(
  u: Pick<PlacedUnit, 'glyph' | 'heightMm' | 'widthMm' | 'depthMm' | 'socleMm'>,
  t: number,
): string | null {
  /*
   * לוח בודד נבדק על מה שהוא כן — העובי שלו.
   *
   * עד כאן הוא יצא מהבדיקה כולה בשורה הראשונה, ולכן מדף בעובי
   * 300 מ״מ נשמר בשקט: הטופס הציע מינימום, והשער לא בדק דבר.
   * `MAX_BOARD_MM` היה קיים כמספר שאיש לא שאל אותו.
   */
  const def = glyphDef(u.glyph);
  const flat = def.noCarcass;
  if (flat && def.thinBoard) {
    const th = slabThicknessMm(u, flat);
    if (th < MIN_BOARD_MM) {
      return `עובי ${th} מ״מ דק מדי ללוח. המינימום הוא ${MIN_BOARD_MM} מ״מ.`;
    }
    if (th > MAX_BOARD_MM) {
      return `עובי ${th} מ״מ אינו לוח אלא גוף. המקסימום כאן ${MAX_BOARD_MM} מ״מ.`;
    }
    return null;
  }
  if (!buildsFromBoards(u.glyph)) return null;

  const socle = u.socleMm ?? 0;
  const minH = minHeightMm(u, t);
  if (socle && socle >= u.heightMm) {
    return `הרגליים (${socle} מ״מ) גבוהות מהארגז כולו (${u.heightMm} מ״מ). המינימום כאן ${minH} מ״מ.`;
  }

  if (u.heightMm < minH) {
    const body = bodyHeightMm({ heightMm: u.heightMm, socleMm: socle });
    return socle
      ? `גובה ${u.heightMm} מ״מ אינו מספיק: ${socle} לרגליים ו-${2 * t} לתחתית ולתקרה משאירים ${body - 2 * t} מ״מ חלל. המינימום כאן ${minH} מ״מ.`
      : `גובה ${u.heightMm} מ״מ אינו מספיק: ${2 * t} לתחתית ולתקרה. המינימום כאן ${minH} מ״מ.`;
  }

  const minW = minWidthMm(u, t);
  if (u.widthMm < minW) {
    return `רוחב ${u.widthMm} מ״מ אינו מספיק: ${2 * t} לשתי הדפנות. המינימום כאן ${minW} מ״מ.`;
  }

  if (u.depthMm <= t) {
    return `עומק ${u.depthMm} מ״מ אינו מספיק — הוא אינו גדול מעובי הלוח (${t} מ״מ).`;
  }
  return null;
}
