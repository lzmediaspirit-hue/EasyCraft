import { alongWallMm, physicalHeightMm } from '../../db/types';
import type { PlacedUnit, Wall } from '../../db/types';
import { glyphDef } from '../../catalog/glyphList';

export interface WallAnalysis {
  /** אורך תפוס על הרצפה (תחתונים ועמודות) */
  floorUsedMm: number;
  /** אורך תפוס במפלס העליון */
  wallUsedMm: number;
  freeMm: number;
}

/**
 * כמה מהקיר תפוס, וכמה נשאר.
 *
 * כאן ישבו גם אזהרות התכנון — חריגה מהקיר, ארגזים שנוגעים, שקע
 * שנחסם — והן ירדו מהמסך לבקשת הבעלים, ואיתן החישוב שייצר אותן.
 * מה שנשאר הוא מה שהמחוונים קוראים.
 *
 * הבדיקות הגאומטריות עצמן לא ירדו: `planResolve` עדיין חוסם שמירה
 * של ארגז שאינו נכנס, `collision` עדיין מונע הנחה על ארגז אחר,
 * והתכנון האוטומטי עדיין מדרג פריסה. מה שירד הוא ההצגה.
 */
export function analyzeWall(wall: Wall, units: PlacedUnit[]): WallAnalysis {
  /*
   * אי אינו על הקיר, ולכן הוא אינו נמדד בחשבונות שלו: הוא לא תופס
   * מטר רץ. הוא כן נספר בארגזים ובשטח החזיתות — הוא חלק מהעבודה.
   */
  const onWall = units.filter((u) => !u.free);
  const floorUsedMm = onWall
    .filter((u) => u.level !== 'wall')
    .reduce((sum, u) => sum + alongWallMm(u), 0);
  const wallUsedMm = onWall
    .filter((u) => u.level === 'wall')
    .reduce((sum, u) => sum + alongWallMm(u), 0);
  return { floorUsedMm, wallUsedMm, freeMm: wall.lengthMm - floorUsedMm };
}

/** המיקום הפנוי הבא במפלס מסוים — כדי שארגז חדש יינחת צמוד לשורה. */
export function nextFreeX(units: PlacedUnit[], level: PlacedUnit['level']): number {
  const sameLine = units.filter((u) => (level === 'wall' ? u.level === 'wall' : u.level !== 'wall'));
  return sameLine.reduce((end, u) => Math.max(end, u.xMm + alongWallMm(u)), 0);
}

/**
 * הרווח שהארגז יושב בתוכו, בציר נתון: איפה הוא מתחיל וכמה הוא גדול.
 *
 * זו התשובה ל"קיר בגובה 3 מטר, ארגז של 240 — כמה נשאר למעלה":
 * הארגז שמונח מעליו נכנס בדיוק לרווח שנשאר, 60, בלי לחסר בראש.
 * מוחזר גם ההתחלה ולא רק הגודל, כי השלמה שמותירה את הארגז במקום
 * שאליו נגרר בערך היא חצי עבודה — הוא נכנס לרווח ומתיישב עליו.
 *
 * מי שנמצא מעל ומי שמתחת נקבע לפי מרכז הארגז, ולא לפי קצותיו: כך
 * גם ארגז שנגרר וחופף מעט לשכנו יודע לאיזה רווח הוא מכוון.
 */
export function fillSpan(
  unit: PlacedUnit,
  units: PlacedUnit[],
  wall: { lengthMm: number; heightMm: number },
  axis: 'w' | 'h',
): { startMm: number; sizeMm: number } {
  const others = units.filter((u) => u.id !== unit.id && !glyphDef(u.glyph).cladding);

  if (axis === 'h') {
    // רק מי שחולק איתו רוחב יכול לחסום אותו לגובה
    const same = others.filter(
      (u) => u.xMm < unit.xMm + alongWallMm(unit) && u.xMm + alongWallMm(u) > unit.xMm,
    );
    const mid = unit.yMm + unit.heightMm / 2;
    /*
     * הגובה שחוסם מלמטה הוא הגובה הפיזי, כולל משטח העבודה.
     *
     * ההנחה על ארגז נוחתת על פני המשטח — כך `stackSnap` מחשבת —
     * ואילו כאן נמדד הגוף בלבד. ההפרש הוא בדיוק עובי המשטח, ולכן
     * "השלמה עד התקרה" הציעה מידה שגדולה ב-30 מ״מ ממה שנשאר:
     * הארגז נחת ב-2,430 וההצעה חושבה מ-2,400. עד שנוסף שער הגבהים
     * זה נשמר בשקט וחרג מהתקרה; עכשיו הוא פשוט נדחה.
     */
    const start = same
      .filter((u) => u.yMm + physicalHeightMm(u) <= mid)
      .reduce((n, u) => Math.max(n, u.yMm + physicalHeightMm(u)), 0);
    const end = same
      .filter((u) => u.yMm >= mid)
      .reduce((n, u) => Math.min(n, u.yMm), wall.heightMm);
    return { startMm: start, sizeMm: Math.max(end - start, 0) };
  }

  // ברוחב חוסמים רק שכנים באותו מפלס, כמו בהצמדה
  const same = others.filter((u) => (u.level === 'wall') === (unit.level === 'wall'));
  const mid = unit.xMm + alongWallMm(unit) / 2;
  const start = same
    .filter((u) => u.xMm + alongWallMm(u) <= mid)
    .reduce((n, u) => Math.max(n, u.xMm + alongWallMm(u)), 0);
  const end = same
    .filter((u) => u.xMm >= mid)
    .reduce((n, u) => Math.min(n, u.xMm), wall.lengthMm);
  return { startMm: start, sizeMm: Math.max(end - start, 0) };
}
