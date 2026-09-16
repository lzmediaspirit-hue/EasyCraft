import { alongWallMm } from '../../db/types';
import type { PlacedUnit } from '../../db/types';

/*
 * הנחת ארגז על ארגז.
 *
 * זו תנועה אחרת מהצמדה לשכן. הצמדה רגילה שואלת "לאן זה קופץ" בכל
 * ציר בנפרד — הרוחב נפתר מול דפנות השכנים, והגובה מול ראשיהם — ולכן
 * ארגז שהונח על אחר נחת בגובה הנכון אבל בכל מקום לרוחב. הנגר שם
 * ארגז על ארגז כדי שהם יהיו ישרים: פינת התחתית של העליון על פינת
 * הראש של התחתון.
 *
 * כאן שני הצירים נפתרים יחד, מול פינה אחת שנבחרה. אין כאן ציור ואין
 * מגע — נכנס מקום מבוקש, יוצאת פינה לנחות עליה.
 */

/**
 * המשטח שאפשר להניח עליו.
 *
 * ראש הארגז ועליו המשטח, אם יש. ארגז תחתון עם משטח עבודה נושא את מה
 * שמונח עליו בגובה המשטח ולא בגובה הגוף — להתעלם מזה היה אומר לשקע
 * את העליון שני סנטימטרים לתוך השיש.
 */
export function supportTopMm(u: PlacedUnit): number {
  return u.yMm + u.heightMm + (u.counterMm ?? 0);
}

/** פינה שנבחרה להנחה. */
export interface StackSnap {
  xMm: number;
  yMm: number;
  /** על מי הוא יושב */
  onId: string;
  /** לאיזו פינה יושר — תחילת הארגז התחתון או סופו */
  edge: 'start' | 'end';
  /** האם המשטח הוא שנושא אותו, ולא ראש הגוף */
  onCounter: boolean;
}

/**
 * הפינה שאליה ארגז נצמד כשמניחים אותו על ארגז אחר.
 *
 * `xMm` ו-`yMm` הם המקום המבוקש — לאן האצבע לקחה אותו לפני הצמדה.
 * `tol` הוא סף ההצמדה במ"מ, אותו סף שנמדד מקנה המידה של המסך, כך
 * שההצמדה מרגישה זהה ביד בכל מרחק תצוגה.
 *
 * `holdId` הוא היעד שכבר נבחר בגרירה הזאת. הוא מקבל יתרון קטן, כדי
 * שהיעד לא יקפוץ בין שני שכנים כשהאצבע עומדת בדיוק ביניהם.
 *
 * `wallLengthMm` הוא הקיר שהפינה חייבת להיכנס בו. פינה שאינה
 * נכנסת אינה מועמדת: יישור לסוף של תחתון רחב יותר נתן לעליון
 * מקום שלילי — ארגז שיושב מחוץ לקיר, בעודו מדווח על "פינה
 * מדויקת". הוא אינו נדחק פנימה בשקט, כי אז היישור שהובטח כבר
 * אינו קיים; הוא פשוט אינו נבחר, והגרירה ממשיכה בהצמדה הרגילה.
 *
 * `null` = אין על מה להניח כאן, והגרירה ממשיכה בהצמדה הרגילה.
 */
export function stackSnap(
  unit: PlacedUnit,
  xMm: number,
  yMm: number,
  mates: PlacedUnit[],
  tol: number,
  holdId?: string,
  wallLengthMm?: number,
): StackSnap | null {
  /*
   * אי נמדד ברצפת החדר ואין לו "לאורך הקיר", ולכן פינה על קיר אינה
   * אומרת עליו דבר. הרמה של אי דורשת תנועה אנכית משלה, וזו עדיין
   * אינה קיימת — ראה את המגבלות בקובץ הביקורת.
   */
  if (unit.free) return null;

  const w = alongWallMm(unit);
  let best: StackSnap | null = null;
  let bestScore = Infinity;

  for (const other of mates) {
    if (other.id === unit.id || other.free || other.wallId !== unit.wallId) continue;
    const top = supportTopMm(other);
    /* אין הנחה על רצפה: רצפה היא רצפה, ויש לה הצמדה משלה */
    if (top <= 0) continue;
    const dy = Math.abs(yMm - top);
    if (dy > tol) continue;

    const otherW = alongWallMm(other);
    const corners: { x: number; edge: StackSnap['edge'] }[] = [
      { x: other.xMm, edge: 'start' },
      { x: other.xMm + otherW - w, edge: 'end' },
    ];

    for (const c of corners) {
      const dx = Math.abs(xMm - c.x);
      if (dx > tol) continue;
      /* פינה שמוציאה את הארגז מהקיר אינה פינה */
      if (c.x < 0) continue;
      if (wallLengthMm !== undefined && c.x + w > wallLengthMm) continue;
      /*
       * המרחק נמדד בשני הצירים יחד: פינה היא נקודה, ולא שני
       * יעדים שבמקרה נפגשו.
       */
      const score = Math.hypot(dx, dy) * (other.id === holdId ? 0.6 : 1);
      if (score >= bestScore) continue;
      bestScore = score;
      best = {
        xMm: Math.round(c.x),
        yMm: Math.round(top),
        onId: other.id,
        edge: c.edge,
        onCounter: !!other.counterMm,
      };
    }
  }

  return best;
}
