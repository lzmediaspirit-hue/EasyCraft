import { cornerDepth } from './plan';
import type { CornerZones } from './plan';
import { alongWallMm } from '../../db/types';
import type { PlacedUnit } from '../../db/types';

/*
 * ההצמדה של ארגז לקיר, לשכנים ולפינות.
 *
 * זה החשבון שמאחורי הגרירה, ואין בו שום דבר של ציור: מי שמזיז ארגז
 * — בעכבר, באצבע או מכפתור — צריך את אותן תשובות.
 *
 * מה שאין כאן הוא בדיקת ההתנגשות. הצמדה שואלת "לאן זה קופץ", ואילו
 * התנגשות שואלת "האם זה יכול לעמוד שם" — שאלה פיזיקלית שנמדדת
 * בתיבות שלמות במרחב החדר, ולכן היא יושבת ב-`collision`.
 */

/**
 * מרחק ההצמדה במ"מ, ובנוסף מרחק מינימלי במסך.
 *
 * 60 מ"מ הם כ-5 פיקסלים בקיר של 4 מטר על מסך טלפון — קטן מדי כדי
 * לפגוע באצבע, ולכן הארגזים "לא נצמדו לרצפה". סף ההצמדה נגזר גם
 * מקנה המידה של הציור, כך שהוא מרגיש זהה ביד בכל מרחק תצוגה.
 */
export const SNAP = 60;
export const SNAP_PX = 18;
/** גרירה חופשית נוחתת על סנטימטרים שלמים, לא על מידות שבורות. */
const STEP = 10;


function nearest(value: number, targets: number[], limit: number): number {
  // ברירת המחדל היא הערך המעוגל; יעד הצמדה קרוב מנצח אותה
  let best = Math.round(value / STEP) * STEP;
  let bestDist = limit;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/**
 * מצמיד ארגז לקצות הקיר ולשכנים באותו מפלס.
 *
 * פינה פנויה פתוחה לכל ארגז — היא שייכת למי שיגיע אליה ראשון.
 * פינה שכבר תפוסה בידי ארון של הקיר השכן חסומה, כי שני ארונות
 * באותו מקום בחדר זו התנגשות ולא החלטה. ארגז פינתי מורשה להיכנס
 * לשם בכל מקרה — זה בדיוק מה שהוא נבנה בשבילו.
 *
 * `corners` נמדד מהארונות שבאמת נוגעים בפינה המשותפת, ולכן קיר
 * שכן ריק אינו חוסם כלום.
 */
export function snapX(
  x: number,
  unit: PlacedUnit,
  units: PlacedUnit[],
  wallLength: number,
  corners: CornerZones | undefined,
  tol: number,
): number {
  /*
   * הפינה נחסמת לפי המפלס: ארון עליון בקיר השכן תופס את הפינה
   * לארונות עליונים, ולא לארון תחתון שעומד מתחתיו. ארגז פינתי נכנס
   * בכל מקרה — זה בדיוק מה שהוא נבנה בשבילו.
   */
  const wallLevel = unit.level === 'wall';
  const startMm = unit.corner ? 0 : cornerDepth(corners?.start, wallLevel);
  const endMm = unit.corner ? 0 : cornerDepth(corners?.end, wallLevel);
  const min = startMm;
  const max = Math.max(wallLength - endMm - alongWallMm(unit), min);

  const targets = [min, max];
  for (const other of units) {
    if (other.id === unit.id || other.level !== unit.level) continue;
    targets.push(other.xMm + alongWallMm(other), other.xMm - alongWallMm(unit));
  }
  const snapped = nearest(x, targets, tol);
  return Math.round(Math.min(Math.max(snapped, min), max));
}

/**
 * מצמיד גובה לתקרה ולקצוות של ארגזים אחרים.
 *
 * הרצפה אינה יעד הצמדה כאן במכוון. הפונקציה נקראת רק לארגז שהנעילה
 * לרצפה שלו כבויה — כלומר למי שביקש במפורש להרים אותו — ומגנט לרצפה
 * החזיר אותו לשם בכל פעם. מי שרוצה אותו על הרצפה מדליק את הנעילה,
 * וזה מוריד אותו לאפס בדיוק.
 */
export function snapY(
  y: number,
  unit: PlacedUnit,
  units: PlacedUnit[],
  wallHeight: number,
  tol: number,
  /** ה-x שאליו הארגז הולך — לפיו נקבע על מי הוא יכול לנוח */
  atX: number,
): number {
  const ceiling = wallHeight - unit.heightMm;
  const targets = [ceiling];
  /*
   * ארגז יכול לנוח על שכנו גם כשהוא גבוה מהמקום שנשאר — קיר של 3
   * מטר, ארון של 240, ועליון של 70 שלא נכנס. לחסום אותו שם היה
   * אומר שאי אפשר להניח אותו במקום שהוא שייך לו; מוטב שיישב שם,
   * יבלוט, וכפתור ההשלמה יקצר אותו בלחיצה.
   */
  let rest = 0;
  for (const other of units) {
    if (other.id === unit.id) continue;
    targets.push(other.yMm, other.yMm + other.heightMm, other.yMm - unit.heightMm);
    const sameRun = other.xMm < atX + alongWallMm(unit) && other.xMm + alongWallMm(other) > atX;
    if (sameRun) rest = Math.max(rest, other.yMm + other.heightMm);
  }
  const snapped = nearest(y, targets, tol);
  const maxY = Math.min(Math.max(ceiling, rest), Math.max(wallHeight - 50, 0));
  return Math.round(Math.min(Math.max(snapped, 0), Math.max(maxY, 0)));
}
