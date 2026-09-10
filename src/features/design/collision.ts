import { glyphDef } from '../../catalog/glyphList';
import { featureDef, featureOverlaps } from '../projects/wallFeatures';
import { boxCorners, unitBox } from './placement';
import type { UnitBox } from './placement';
import type { PlacedUnit } from '../../db/types';
import type { PlanWall } from './plan';

/**
 * מה מותר לשני ארגזים לעשות זה לזה.
 *
 * הבדיקה הישנה עבדה על מלבן חזית: כל חפיפה ברוחב ובגובה נחסמה, גם
 * כשהארגזים עמדו בעומקים שונים ולא נגעו זה בזה כלל. היא גם לא ידעה
 * לאפשר את מה שנגר עושה כל יום — להניח ארגז על ארגז, להצמיד שניים,
 * או להכניס מכשיר לתוך עמודה.
 *
 * החוק כאן הוא פיזיקלי, ולכן הוא אחד:
 *
 *   • נגיעה מותרת. שני ארגזים שחולקים פאה — זו הצמדה, וזה מה
 *     שההצמדה נועדה לעשות.
 *   • הכלה מותרת. ארגז שנכנס כולו לתוך השני הוא מכשיר בתוך עמודה
 *     או מגירה בתוך ארון; חזית שבולטת קדימה עדיין נחשבת בפנים, כי
 *     ככה נראה תנור אמיתי.
 *   • חדירה חלקית אסורה. שתי תיבות שנכנסות זו לזו רק בחלקן פירושן
 *     שדופן עוברת באמצע תחתית — זה לא נבנה, ולכן זה גם לא מצויר.
 */

/** סובלנות במ"מ: מגע והצמדה אינם חדירה */
const TOUCH = 2;

/** תיבה תלת־ממדית בצירים של עצמה, לבדיקת הכלה */
interface Span {
  lo: number;
  hi: number;
}

/**
 * האם הנחת הארגז כאן פוגעת בארגז אחר.
 *
 * `at` הוא המיקום הנבדק, שאינו בהכרח המיקום השמור — כך אפשר לשאול
 * "אם אניח אותו כאן" בלי לכתוב אותו קודם.
 */
export function blocked(
  unit: PlacedUnit,
  at: UnitBox,
  others: PlacedUnit[],
  plan: PlanWall[],
): boolean {
  if (glyphDef(unit.glyph).cladding) return false;
  if (hitsFeature(unit, plan)) return true;
  for (const o of others) {
    if (o.id === unit.id || glyphDef(o.glyph).cladding) continue;
    const ob = unitBox(o, plan);
    if (ob && clash(at, ob)) return true;
  }
  return false;
}

/**
 * האם הארגז עומד על סימון שאי אפשר לבנות לתוכו.
 *
 * דלת וחלון הם פתח, ועמוד הוא בטון. עד היום ההנחה הצליחה והנגר
 * קיבל אזהרה אחריה — אבל אזהרה על מה שממילא לא ייבנה היא רעש:
 * הארגז פשוט לא נכנס לשם, ולכן הוא נעצר כמו מול ארגז אחר.
 *
 * שקע ונקודת מים אינם חוסמים: הם נקדחים בגב הארון, וארגז שעומד
 * עליהם הוא הדבר הרגיל ולא התקלה.
 */
function hitsFeature(unit: PlacedUnit, plan: PlanWall[]): boolean {
  if (unit.free) return false;
  const wall = plan.find((q) => q.wall.id === unit.wallId)?.wall;
  return !!wall?.features.some((f) => featureDef(f.kind).blocks && featureOverlaps(unit, f));
}

/** האם שתי תיבות חודרות זו לזו בפועל. */
export function clash(a: UnitBox, b: UnitBox): boolean {
  // גובה: אין מפגש בכלל כשאחד נגמר לפני שהשני מתחיל
  if (a.y + a.h <= b.y + TOUCH || b.y + b.h <= a.y + TOUCH) return false;
  // רצפה: מלבנים מסובבים, ולכן צירים מפרידים
  if (!floorsMeet(a, b)) return false;
  // נפגשים — ומותר רק אם אחד מהם נמצא כולו בתוך השני
  return !contains(a, b) && !contains(b, a);
}

/**
 * חפיפה בין שתי רצפות מסובבות, בשיטת הצירים המפרידים.
 * מגע קצה בקצה אינו חפיפה — זו הצמדה.
 */
function floorsMeet(a: UnitBox, b: UnitBox): boolean {
  const pa = boxCorners(a);
  const pb = boxCorners(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (len < 1e-6) continue;
      const n = { x: -(p2.y - p1.y) / len, y: (p2.x - p1.x) / len };
      const [minA, maxA] = project(pa, n);
      const [minB, maxB] = project(pb, n);
      if (maxA <= minB + TOUCH || maxB <= minA + TOUCH) return false;
    }
  }
  return true;
}

/**
 * האם `inner` יושב כולו בתוך `outer`.
 *
 * נמדד בצירים של החיצוני: זו השאלה "האם הוא נכנס לארון", ולארון יש
 * כיוון.
 *
 * שני סייגים שבלעדיהם החוק היה מתיר את מה שאי אפשר לבנות. הרוחב
 * חייב להיות קטן ממש — דבר שנכנס לתוך ארון צר ממנו, ושתי תיבות
 * זהות באותו מקום אינן "אחת בתוך השנייה" אלא שתי תיבות באותו
 * מקום. הגובה לעומת זאת יכול להישען: מכשיר נח על תחתית התא שלו.
 * החזית היא היוצאת מן הכלל השנייה — תנור שבולט קדימה עדיין נמצא
 * בתוך העמודה, וכך הוא גם נראה בשטח.
 */
function contains(inner: UnitBox, outer: UnitBox): boolean {
  if (inner.y < outer.y - TOUCH) return false;
  if (inner.y + inner.h > outer.y + outer.h + TOUCH) return false;

  const f = { x: Math.cos(outer.facing), z: Math.sin(outer.facing) };
  const side = { x: Math.sin(outer.facing), z: -Math.cos(outer.facing) };
  const along = spanOn(inner, outer, side);
  const depth = spanOn(inner, outer, f);
  const halfW = outer.w / 2;
  const halfD = outer.d / 2;
  if (along.lo <= -halfW + TOUCH || along.hi >= halfW - TOUCH) return false;
  // הגב חייב להיות בפנים; מה שבולט קדימה עדיין בפנים
  return depth.lo >= -halfD - TOUCH;
}

/** הטווח שהתיבה הפנימית תופסת על ציר של החיצונית, ביחס למרכזו. */
function spanOn(inner: UnitBox, outer: UnitBox, axis: { x: number; z: number }): Span {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of boxCorners(inner)) {
    const v = (c.x - outer.cx) * axis.x + (c.y - outer.cz) * axis.z;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return { lo, hi };
}

function project(poly: { x: number; y: number }[], n: { x: number; y: number }): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = p.x * n.x + p.y * n.y;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return [min, max];
}
