import { COS30 } from './isoMath';
import { SNAP, SNAP_PX, snapX, snapY } from './snapping';
import { stackSnap } from './stacking';
import { blocked } from './collision';
import { unitBox } from './placement';
import { cornerZones } from './plan';
import { alongWallMm } from '../../db/types';
import { clamp } from '../../ui/units';
import type { IsoView } from './isoMath';
import type { PlanWall } from './plan';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * לאן ארגז מגיע אחרי גרירה בתלת־ממד.
 *
 * זו מתמטיקה ולא ממשק: נכנסת תנועת אצבע במידות הציור, יוצא מקום
 * בחדר. היא יושבת כאן ולא בתוך רכיב הציור כדי שאפשר יהיה לבדוק
 * אותה על מספרים — ומי שמתקן הצמדה לא צריך לעבור דרך מטפלי מגע.
 *
 * ההיפוך עצמו: ההיטל מפעיל על התנועה מטריצה קבועה, וכאן היא
 * מבוטלת. לאי יש שני צירים על הרצפה ותמיד יש פתרון; לארגז על קיר
 * יש ציר אחד לאורכו ואחד לגובה, וקיר שנראה כמעט מקצהו אינו נותן
 * תשובה לאורך בכלל.
 */
export interface DragInput {
  /** הארגז כפי שהיה בתחילת הגרירה — כל הגרירה נמדדת ממנו */
  from: PlacedUnit;
  /** תנועת האצבע במידות הציור */
  dxMm: number;
  dyMm: number;
  view: IsoView;
  plan: PlanWall[];
  walls: Wall[];
  units: PlacedUnit[];
  /** כמה פיקסלים נכנסים ליחידת ציור — קובע את סף ההצמדה */
  pxPerUnit: number;
  /** ההצמדה פעילה. כבויה = הארגז נוחת במקום שהאצבע לקחה אותו */
  snap?: boolean;
  /** היעד שכבר נבחר להנחה, כדי שהוא לא יקפוץ בין שני שכנים */
  onId?: string;
}

/** מה יצא מהגרירה: המקום, ועל מי הוא נוחת אם הוא נוחת על מישהו. */
export interface DragResult {
  patch: Partial<PlacedUnit>;
  /** הארגז שהוא הונח עליו — למחוון שמראה על מי */
  onId?: string;
}

/** `null` = אין תשובה, והארגז נשאר איפה שהוא */
export function solveDrag(input: DragInput): DragResult | null {
  const { from, dxMm, dyMm, view, plan, walls, units, pxPerUnit, snap = true } = input;
  const yaw = (view.yawDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  /* אפס = ההצמדה כבויה: יעד שמרחקו קטן מאפס אינו קיים */
  const tol = snap ? Math.max(SNAP, SNAP_PX / pxPerUnit) : 0;
  const step = (v: number) => Math.round(v / 10) * 10;

  /* אי: התנועה על הרצפה נפתרת בשני הצירים */
  if (from.free) {
    const det = 2 * COS30 * view.rise;
    const dx = ((c - s) * view.rise * dxMm + (s + c) * COS30 * dyMm) / det;
    const dz = (-(c + s) * view.rise * dxMm + (c - s) * COS30 * dyMm) / det;
    const free = { ...from.free, xMm: step(from.free.xMm + dx), zMm: step(from.free.zMm + dz) };
    const box = unitBox({ ...from, free }, plan);
    return box && !blocked(from, box, units, plan) ? { patch: { free } } : null;
  }

  const here = plan.find((q) => q.wall.id === from.wallId);
  if (!here) return null;
  // הכיוון של "מטר אחד לאורך הקיר" על המסך, בזווית המבט הנוכחית
  const theta = ((here.headingDeg + view.yawDeg) * Math.PI) / 180;
  const ax = (Math.cos(theta) - Math.sin(theta)) * COS30;
  const ay = (Math.cos(theta) + Math.sin(theta)) * view.rise;
  // קיר שנראה כמעט מקצהו אינו נותן תשובה לאורך — עדיף לא לנחש
  const alongMm = Math.abs(ax) < 0.05 ? 0 : dxMm / ax;
  const upMm = ay * alongMm - dyMm;

  /*
   * מעבר לקיר השכן: הגרירה נמדדת תמיד מנקודת המוצא, ולכן היא
   * הפיכה — מי שגרר רחוק מדי חוזר וממשיך מהמקום שהיה.
   */
  let target = here.wall;
  let x = from.xMm + alongMm;
  const i = walls.findIndex((w) => w.id === from.wallId);
  if (x < -80 && i > 0) {
    target = walls[i - 1];
    x += target.lengthMm;
  } else if (x > here.wall.lengthMm + 80 && i < walls.length - 1) {
    target = walls[i + 1];
    x -= here.wall.lengthMm;
  }

  const mates = units.filter((u) => u.wallId === target.id);
  /*
   * הנחה על ארגז אחר קודמת להצמדה הרגילה — פינה אחת ולא שני
   * צירים שנפתרו בנפרד. אותו חשבון בדיוק שעובד בציור החזית.
   */
  const rawY = from.yMm + upMm;
  const stack =
    snap && !from.floorLocked
      ? stackSnap({ ...from, wallId: target.id }, x, rawY, mates, tol, input.onId, target.lengthMm)
      : null;

  const nx = stack
    ? stack.xMm
    : snapX(x, from, mates, target.lengthMm, cornerZones(walls, target, units), tol);
  const ny = stack ? stack.yMm : from.floorLocked ? from.yMm : snapY(rawY, from, mates, target.heightMm, tol, nx);

  /*
   * חוקי הפיזיקה של החדר: נגיעה והכלה מותרות, חדירה חלקית לא.
   * ארגז שכבר חודר במקום שהוא עומד בו הוא היוצא מן הכלל — דווקא
   * ממנו צריך להיות אפשר לצאת.
   */
  const start = unitBox(from, plan);
  const stuck = !!start && blocked(from, start, units, plan);
  const ok = (px: number, py: number) => {
    const probe = { ...from, wallId: target.id, xMm: px, yMm: py };
    const b = unitBox(probe, plan);
    return !!b && (stuck || !blocked(probe, b, units, plan));
  };

  /*
   * ארגז שנתקל בשכן נעצר עליו, ולא נשאר במקום.
   *
   * קודם הוא פשוט לא זז — מי שגרר לתוך ארון אחר קיבל ארגז שנתקע
   * באוויר בלי סיבה נראית. עכשיו נבחרת המידה הקרובה ביותר שבה הוא
   * באמת נכנס: זו בדיוק הדופן של השכן, וזו גם התנועה שהנגר עושה
   * בשטח — דוחף עד שנוגע.
   */
  const stops = [nx];
  for (const other of mates) {
    if (other.id === from.id || other.level !== from.level) continue;
    stops.push(other.xMm + alongWallMm(other), other.xMm - alongWallMm(from));
  }
  const reach = Math.max(target.lengthMm - alongWallMm(from), 0);
  const near = stops
    .map((v) => Math.round(clamp(v, 0, reach)))
    .sort((a, b) => Math.abs(a - nx) - Math.abs(b - nx));
  const slid = near.find((v) => ok(v, ny)) ?? near.find((v) => ok(v, from.yMm));

  const [fx, fy] = ok(nx, ny)
    ? [nx, ny]
    : slid !== undefined && ok(slid, ny)
      ? [slid, ny]
      : slid !== undefined
        ? [slid, from.yMm]
        : ok(from.xMm, ny)
          ? [from.xMm, ny]
          : [from.xMm, from.yMm];
  /* היעד מדווח רק כשבאמת נחתו עליו, ולא כשהתנגשות דחפה הצידה */
  const landed = stack && fx === stack.xMm && fy === stack.yMm ? stack.onId : undefined;
  return { patch: { xMm: fx, yMm: fy, wallId: target.id }, onId: landed };
}
