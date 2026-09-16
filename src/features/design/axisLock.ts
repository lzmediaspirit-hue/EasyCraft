import { COS30 } from './isoMath';
import type { IsoView } from './isoMath';
import type { PlacedUnit } from '../../db/types';
import { rad } from './placement';

/*
 * תנועה בציר אחד.
 *
 * גרירה רגילה מזיזה ארגז בשני צירים בבת אחת, וזה בדיוק מה שרוצים
 * כשמחפשים מקום. כשכבר יודעים את המקום ורוצים לתקן מידה אחת — רק
 * את הגובה, רק את המרחק מהפינה — שני צירים הם צרה: מה שלא רצו
 * לשנות זז יחד עם מה שכן.
 *
 * לחיצה ארוכה על הארגז נועלת ציר אחד. מה שיושב כאן הוא ההחלטה
 * עצמה — מתי לחיצה נחשבת ארוכה, איזה ציר נבחר מכיוון האצבע, ואיך
 * הוא נקרא בעברית — בלי לדעת דבר על React, על SVG או על מגע.
 *
 * מוסכמת הצירים בחדר: X ו-Z הם הרצפה, Y הוא הגובה. ארגז על קיר
 * אינו זז בשניים מהם בנפרד — הוא זז לאורך הקיר — ולכן הציר שלו
 * נקרא בשמו ומצוין לצידו איזה ציר עולם הוא, כשהקיר מיושר לאחד מהם.
 */

/**
 * כמה זמן אצבע צריכה לעמוד במקום כדי שזו תהיה לחיצה ארוכה.
 *
 * חצי שנייה: מתחת לזה כל גרירה איטית הייתה ננעלת בטעות, ומעל זה
 * המתנה מורגשת. הביקורת ביקשה 450–600, וזה האמצע.
 */
export const LONG_PRESS_MS = 500;

/**
 * כמה האצבע רשאית לנוע לפני שהלחיצה הארוכה מתבטלת.
 *
 * אפס אינו מציאותי: אצבע על זכוכית זזה תמיד. מי שהתחיל לגרור זז
 * הרבה יותר מזה תוך חצי שנייה, ולכן אין בלבול בין השניים.
 */
export const LONG_PRESS_SLOP_PX = 10;

/**
 * כמה צריך לגרור אחרי הנעילה כדי שייקבע הציר.
 *
 * לפני זה אין כיוון ואין מה לנחש: תנועה של שלושה פיקסלים אינה
 * אומרת "לגובה" יותר מ"לרוחב". עד שהמרחק נעבר הארגז אינו זז.
 */
export const AXIS_PICK_PX = 12;

/** הצירים שאפשר להינעל אליהם. `along` הוא לאורך הקיר. */
export type Axis = 'along' | 'x' | 'z' | 'y';

/** שם הציר בעברית, כפי שהוא מוצג בזמן הנעילה. */
export function axisLabel(axis: Axis, headingDeg = 0): string {
  if (axis === 'y') return 'ציר Y — גובה';
  if (axis === 'x') return 'ציר X — לרוחב החדר';
  if (axis === 'z') return 'ציר Z — לעומק החדר';
  /* קיר מיושר לציר עולם — אומרים לאיזה. קיר אלכסוני: אין מה לומר */
  const h = (((headingDeg % 180) + 180) % 180);
  if (h < 20 || h > 160) return 'לאורך הקיר — ציר X';
  if (h > 70 && h < 110) return 'לאורך הקיר — ציר Z';
  return 'לאורך הקיר';
}

/** הצירים שפתוחים לארגז נתון, לפי מה שהוא. */
export function axesFor(unit: PlacedUnit, iso: boolean): Axis[] {
  /*
   * ארגז על קיר נשאר על הקיר.
   *
   * שני צירי הרצפה היו מוציאים אותו ממנו והופכים אותו לאי בלי
   * שאיש ביקש — ולכן מה שפתוח לו הוא לאורך הקיר ולגובה בלבד.
   */
  if (!unit.free) return ['along', 'y'];
  /* אי: שני צירי הרצפה, ובתלת־ממד גם הגובה */
  return iso ? ['x', 'z', 'y'] : ['along', 'y'];
}

/**
 * הכיוון של "מ"מ אחד בציר" על המסך, בזווית המבט הנוכחית.
 *
 * זה מה שמאפשר לבחור ציר מכיוון האצבע: הציר הנבחר הוא זה שכיוונו
 * על המסך הכי קרוב לכיוון שנגררו בו, ולא ניחוש לפי "יותר אופקי או
 * יותר אנכי" — שנכון בציור החזית ושגוי לגמרי בתלת־ממד.
 */
export function axisOnScreen(axis: Axis, view: IsoView, headingDeg = 0): [number, number] {
  const yaw = rad(view.yawDeg);
  if (axis === 'y') return [0, -1];
  if (axis === 'along') {
    const t = rad(headingDeg + view.yawDeg);
    return [(Math.cos(t) - Math.sin(t)) * COS30, (Math.cos(t) + Math.sin(t)) * view.rise];
  }
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  /* ציר עולם מסובב בזווית המבט, ואז מוטל */
  const [rx, rz] = axis === 'x' ? [c, s] : [-s, c];
  return [(rx - rz) * COS30, (rx + rz) * view.rise];
}

/**
 * הציר שנבחר מכיוון הגרירה, או `null` כשעוד מוקדם להחליט.
 *
 * ההשוואה היא בזווית ולא במרחק: ציר שנראה קצר על המסך — קיר
 * שמסתכלים עליו כמעט מקצהו — עדיין הכיוון הנכון כשגוררים לאורכו.
 */
export function pickAxis(
  dxPx: number,
  dyPx: number,
  axes: Axis[],
  view: IsoView,
  headingDeg = 0,
): Axis | null {
  const len = Math.hypot(dxPx, dyPx);
  if (len < AXIS_PICK_PX) return null;
  let best: Axis | null = null;
  let bestDot = -1;
  for (const a of axes) {
    const [ax, ay] = axisOnScreen(a, view, headingDeg);
    const n = Math.hypot(ax, ay);
    /* ציר שנעלם על המסך אינו מועמד: אין ממנו כיוון לקרוא */
    if (n < 1e-3) continue;
    const dot = Math.abs((dxPx * ax + dyPx * ay) / (len * n));
    if (dot > bestDot) {
      bestDot = dot;
      best = a;
    }
  }
  return best;
}

/** מד זמן ללחיצה ארוכה: נדלק אחרי המתנה, ומתבטל בתנועה. */
export interface LongPress {
  /** מתחיל למדוד מנקודת המגע. `fire` ייקרא אם האצבע לא זזה */
  start(x: number, y: number, fire: () => void): void;
  /** מדווח על תנועה. `false` = חרגה מהסבילות, והמדידה בוטלה */
  move(x: number, y: number): boolean;
  cancel(): void;
}

/**
 * המימוש: שעון אחד ונקודת מוצא אחת.
 *
 * הוא נמסר מבחוץ ולא נוצר בפנים כדי שהבדיקות יוכלו להריץ את הזמן
 * בעצמן, ובעיקר כדי ששני המסכים — החזית והתלת־ממד — יתנהגו זהה.
 */
export function longPress(ms = LONG_PRESS_MS, slop = LONG_PRESS_SLOP_PX): LongPress {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let from: [number, number] | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    from = null;
  };
  return {
    start(x, y, fire) {
      cancel();
      from = [x, y];
      timer = setTimeout(() => {
        timer = null;
        from = null;
        fire();
      }, ms);
    },
    move(x, y) {
      if (!from) return true;
      if (Math.hypot(x - from[0], y - from[1]) <= slop) return true;
      cancel();
      return false;
    },
    cancel,
  };
}
