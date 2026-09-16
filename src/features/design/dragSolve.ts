import { COS30 } from './isoMath';
import { SNAP, SNAP_PX, snapX, snapY } from './snapping';
import { stackSnap } from './stacking';
import { blocked } from './collision';
import { unitBox } from './placement';
import { cornerZones } from './plan';
import { alongWallMm } from '../../db/types';
import { clamp } from '../../ui/units';
import type { IsoView } from './isoMath';
import type { Axis } from './axisLock';
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
  /**
   * ציר נעול — התנועה מוגבלת אליו בלבד.
   *
   * זה לא קיצוץ של התוצאה אלא של הקלט: התנועה בצירים האחרים
   * מאופסת לפני ההצמדה, ולכן גם ההצמדה אינה יכולה להזיז אותם.
   * קיצוץ בסוף היה נותן להצמדה לשנות גובה ואז מחזיר אותו — קפיצה
   * שנראית כמו תקלה.
   */
  axis?: Axis;
}

/** מה יצא מהגרירה: המקום, ועל מי הוא נוחת אם הוא נוחת על מישהו. */
export interface DragResult {
  patch: Partial<PlacedUnit>;
  /** הארגז שהוא הונח עליו — למחוון שמראה על מי */
  onId?: string;
}

/** `null` = אין תשובה, והארגז נשאר איפה שהוא */
export function solveDrag(input: DragInput): DragResult | null {
  const { from, dxMm, dyMm, view, plan, walls, units, pxPerUnit, snap = true, axis } = input;
  const yaw = (view.yawDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  /* אפס = ההצמדה כבויה: יעד שמרחקו קטן מאפס אינו קיים */
  const tol = snap ? Math.max(SNAP, SNAP_PX / pxPerUnit) : 0;
  const step = (v: number) => Math.round(v / 10) * 10;

  /* אי: התנועה על הרצפה נפתרת בשני הצירים */
  if (from.free) {
    const det = 2 * COS30 * view.rise;
    /*
     * נעילה לגובה: האי עולה ויורד ואינו נודד ברצפה. בלי הענף הזה
     * ציר Y לא היה קיים לאי בכלל — התנועה שלו נפתרה תמיד ברצפה.
     */
    if (axis === 'y') {
      const yMm = from.floorLocked ? from.yMm : Math.max(step(from.yMm - dyMm), 0);
      const box = unitBox({ ...from, yMm }, plan);
      return box && !blocked({ ...from, yMm }, box, units, plan) ? { patch: { yMm } } : null;
    }
    const dx = axis === 'z' ? 0 : ((c - s) * view.rise * dxMm + (s + c) * COS30 * dyMm) / det;
    const dz = axis === 'x' ? 0 : (-(c + s) * view.rise * dxMm + (c - s) * COS30 * dyMm) / det;
    /*
     * העיגול שייך לציר שזז, ולציר שזז בלבד.
     *
     * אי שעמד ב-Z=1707 קיבל Z=1710 בגרירת X: הציר הנעול לא זז, אבל
     * הוא עבר את אותו עיגול לסנטימטר שלם — והמידה שהנגר מדד בשטח
     * השתנתה בדרך. מה שלא נגררים בו נשאר בדיוק כפי שהיה.
     */
    const free = {
      ...from.free,
      xMm: axis === 'z' ? from.free.xMm : step(from.free.xMm + dx),
      zMm: axis === 'x' ? from.free.zMm : step(from.free.zMm + dz),
    };
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
  const alongMm = axis === 'y' || Math.abs(ax) < 0.05 ? 0 : dxMm / ax;
  const upMm = axis === 'along' ? 0 : ay * alongMm - dyMm;

  /*
   * מעבר לקיר השכן: הגרירה נמדדת תמיד מנקודת המוצא, ולכן היא
   * הפיכה — מי שגרר רחוק מדי חוזר וממשיך מהמקום שהיה.
   */
  let target = here.wall;
  let x = from.xMm + alongMm;
  const i = walls.findIndex((w) => w.id === from.wallId);
  /*
   * ציר נעול אינו עובר קיר. מעבר לשכן מחליף את הכיוון שבו הארגז
   * זז, וזו בדיוק ההפתעה שהנעילה באה למנוע — מי שנעל "לאורך הקיר
   * הזה" לא ביקש קיר אחר.
   */
  if (!axis && x < -80 && i > 0) {
    target = walls[i - 1];
    x += target.lengthMm;
  } else if (!axis && x > here.wall.lengthMm + 80 && i < walls.length - 1) {
    target = walls[i + 1];
    x -= here.wall.lengthMm;
  }

  const mates = units.filter((u) => u.wallId === target.id);
  /*
   * הנחה על ארגז אחר קודמת להצמדה הרגילה — פינה אחת ולא שני
   * צירים שנפתרו בנפרד. אותו חשבון בדיוק שעובד בציור החזית.
   */
  const rawY = from.yMm + upMm;
  /* הנחה על ארגז פותרת שני צירים יחד — ולכן היא אינה קיימת בנעילה */
  const stack =
    snap && !from.floorLocked && !axis
      ? stackSnap({ ...from, wallId: target.id }, x, rawY, mates, tol, input.onId, target.lengthMm)
      : null;

  const nx = stack
    ? stack.xMm
    : axis === 'y'
      ? from.xMm
      : snapX(x, from, mates, target.lengthMm, cornerZones(walls, target, units), tol);
  const ny = stack
    ? stack.yMm
    : from.floorLocked || axis === 'along'
      ? from.yMm
      : snapY(rawY, from, mates, target.heightMm, tol, nx);

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
   * בנעילה אין החלקה על שכן ואין נפילה לציר השני: יעד תפוס פירושו
   * שהארגז נשאר, ולא שמשהו אחר בו זז במקומו.
   */
  if (axis) {
    const [lx, ly] = ok(nx, ny) ? [nx, ny] : [from.xMm, from.yMm];
    return { patch: { xMm: lx, yMm: ly, wallId: target.id } };
  }

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

/**
 * הזזה במידה ידועה, בציר אחד.
 *
 * זו הדרך שאינה גרירה: מקשי החצים, ובהמשך גם שדה מספרי. היא קיימת
 * כי יש מי שאינו יכול לגרור — עכבר בלי יד יציבה, מקלדת בלבד — ויש
 * מי שפשוט יודע את המספר ורוצה אותו בדיוק, בלי לכוון באצבע.
 *
 * אין כאן הצמדה: מי שנוקב במידה ביקש אותה, ולא את מה שקרוב אליה.
 * ההתנגשות כן נבדקת — היא חוק של החדר ולא עזרה לעין — ומקום תפוס
 * מחזיר `null`, כלומר "לא זז", ולא מקום אחר שלא ביקשו.
 */
export function nudge(
  unit: PlacedUnit,
  axis: Axis,
  deltaMm: number,
  ctx: { plan: PlanWall[]; walls: Wall[]; units: PlacedUnit[] },
): Partial<PlacedUnit> | null {
  const { plan, walls, units } = ctx;
  const fits = (probe: PlacedUnit): boolean => {
    const b = unitBox(probe, plan);
    return !!b && !blocked(probe, b, units, plan);
  };

  if (axis === 'y') {
    /* נעול לרצפה לא עולה — כאן זה נאמר בכך שלא קורה כלום */
    if (unit.floorLocked) return null;
    const yMm = Math.max(Math.round(unit.yMm + deltaMm), 0);
    if (yMm === unit.yMm) return null;
    return fits({ ...unit, yMm }) ? { yMm } : null;
  }

  if (unit.free) {
    /* אי: הצירים שלו הם רצפת החדר, ו"לאורך" אינו קיים לו */
    /* גם כאן: רק הציר שזז מעוגל, והאחר מועתק כפי שהוא */
    const free = {
      ...unit.free,
      xMm: axis === 'z' ? unit.free.xMm : Math.round(unit.free.xMm + deltaMm),
      zMm: axis === 'z' ? Math.round(unit.free.zMm + deltaMm) : unit.free.zMm,
    };
    return fits({ ...unit, free }) ? { free } : null;
  }

  /* ארגז על קיר זז לאורכו בלבד, ובתוך גבולות הקיר */
  const wall = walls.find((w) => w.id === unit.wallId);
  if (!wall) return null;
  const reach = Math.max(wall.lengthMm - alongWallMm(unit), 0);
  const xMm = Math.round(clamp(unit.xMm + deltaMm, 0, reach));
  if (xMm === unit.xMm) return null;
  return fits({ ...unit, xMm }) ? { xMm } : null;
}
