import { alongWallMm, intoRoomMm } from '../../db/types';
import { boxCorners, rad, solidBox, unitBox } from './placement';
import type { UnitBox } from './placement';
import { unitsClash } from './collision';
import { planCloses } from './roomBounds';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * גיאומטריית החדר במבט על.
 *
 * הקירות משורשרים: כל קיר מתחיל בסופו של הקודם, אחרי פנייה בזווית
 * שהוגדרה לו. פנייה של 90 מעלות נותנת חדר מלבני; כל ערך אחר מתאר
 * חדר בצורה אחרת, וזה מה שמאפשר לתאר חדר שאינו קובייה.
 */

interface PlanPoint {
  x: number;
  y: number;
}

export interface PlanWall {
  wall: Wall;
  start: PlanPoint;
  end: PlanPoint;
  /** זווית הקיר במעלות, ביחס לציר האופקי */
  headingDeg: number;
  /** העומק התפוס על הקיר הזה */
  depthMm: number;
  /**
   * לאיזה צד של הקיר נמצא החדר: `1` = תשעים מעלות שמאלה מכיוונו,
   * `-1` = הצד ההפוך.
   *
   * עד כאן זה היה קבוע `1`, ולכן כיוון השרטוט קבע איפה הרהיטים.
   * מי ששרטט את אותו חדר בדיוק בכיוון ההפוך — או רק סימן "היפוך
   * סדר הקירות", שאמור לשנות מספור בלבד — קיבל חדר שתופס Z שלילי
   * וארגזים שיושבים מחוצה לו, בלי התנגשות ובלי אזהרה.
   */
  inward: 1 | -1;
}

export const DEFAULT_TURN_DEG = 90;

/**
 * חדר שאינו שרשרת פשוטה של קירות ישרים.
 *
 * קיר אחד או פינה אחת מצוירים היטב במבט חזית — זה השרטוט שנגר
 * מכיר. מרגע שיש שלושה קירות, או פינה שאינה ישרה, החזית כבר אינה
 * מספרת מה קורה בחדר, והמבט התלת־ממדי הוא זה שמספר. לכן פרויקט
 * כזה נפתח בו.
 */
export function isComplexRoom(walls: Wall[]): boolean {
  return walls.length > 2 || walls.some((w, i) => i > 0 && (w.turnDeg ?? DEFAULT_TURN_DEG) !== 90);
}

/** בונה את קו הקירות מהאורכים ומהזוויות. */
export function buildPlan(walls: Wall[], units: PlacedUnit[]): PlanWall[] {
  const out: PlanWall[] = [];
  let heading = 0;
  let cursor: PlanPoint = { x: 0, y: 0 };

  for (const wall of walls) {
    if (out.length > 0) heading += wall.turnDeg ?? DEFAULT_TURN_DEG;
    const a = rad(heading);
    const end = {
      x: cursor.x + Math.cos(a) * wall.lengthMm,
      y: cursor.y + Math.sin(a) * wall.lengthMm,
    };
    out.push({
      wall,
      start: cursor,
      end,
      headingDeg: heading,
      depthMm: wallDepth(wall, units),
      inward: 1,
    });
    cursor = end;
  }
  /* הצד הפנימי נקבע לשרשרת כולה, ולא לקיר אחד — זה חדר אחד */
  const sign = inwardSign(out);
  return sign === 1 ? out : out.map((p) => ({ ...p, inward: sign }));
}

/**
 * לאיזה צד של הקירות נמצא החדר.
 *
 * שרשרת פתוחה אינה מגדירה פנים, ולכן היא מקבלת את מה שתמיד היה:
 * תשעים מעלות מכיוון הקיר. שרשרת סגורה כן מגדירה — סימן השטח שלה
 * אומר לאיזה צד סובבו — וזו התשובה שהפכה את כיוון השרטוט לשאלה
 * גאומטרית במקום לשאלת מספור.
 */
function inwardSign(plan: PlanWall[]): 1 | -1 {
  if (!planCloses(plan)) return 1;
  const pts = plan.map((p) => p.start);
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice >= 0 ? 1 : -1;
}

/** העומק הגדול ביותר של ארון שעומד על הרצפה בקיר נתון. */
function wallDepth(wall: Wall, units: PlacedUnit[]): number {
  return units
    /* אי אינו עומד על הקיר, ולכן אינו קובע את עומקו */
    .filter((u) => u.wallId === wall.id && u.level !== 'wall' && !u.free)
    .reduce((max, u) => Math.max(max, intoRoomMm(u)), 0);
}

/**
 * רצועה אחת שתפוסה בפינה: כמה היא נכנסת לקיר הזה, ובאיזה גובה.
 *
 * הגובה חשוב: ארון תחתון בפינה תופס את החלק התחתון, וארון עליון
 * את העליון. בלי זה ארון עליון היה נחסם בגלל ארון תחתון שעומד
 * מתחתיו לגמרי, או — מה שקרה בפועל — לא היה נחסם בכלל.
 */
export interface CornerZone {
  /** כמה מ"מ מהקצה תפוסים */
  depthMm: number;
  /** תחתית הרצועה */
  yMm: number;
  /** גובה הרצועה */
  heightMm: number;
  /** המפלס שהרצועה חוסמת — ארון עליון אינו חוסם תחתון ולהיפך */
  wallLevel: boolean;
}

export interface CornerZones {
  start: CornerZone[];
  end: CornerZone[];
}

/**
 * אזורי הפינה של קיר: הרוחב בכל קצה שכבר תפוס בפועל על ידי ארון
 * של הקיר השכן.
 *
 * זו הצגה ולא חסימה — הנגר הוא שמחליט על איזה מהשניים הפינה
 * נופלת. נספרים רק ארונות שבאמת נוגעים בפינה המשותפת: ארון בקצה
 * הרחוק של הקיר השכן לא תופס כאן כלום, וסימון שלו היה חוסם שטח
 * פנוי בלי סיבה.
 */
export function cornerZones(walls: Wall[], wall: Wall, units: PlacedUnit[]): CornerZones {
  const i = walls.findIndex((w) => w.id === wall.id);
  const prev = i > 0 ? walls[i - 1] : undefined;
  const next = i < walls.length - 1 ? walls[i + 1] : undefined;
  return {
    // הפינה עם הקיר הקודם היא הסוף שלו ותחילת שלנו
    start: prev ? zonesAt(prev, units, 'end') : [],
    end: next ? zonesAt(next, units, 'start') : [],
  };
}

/** כמה מ"מ תפוסים בפינה במפלס מסוים — 0 כשהפינה פנויה שם. */
export function cornerDepth(zones: CornerZone[] | undefined, wallLevel: boolean): number {
  return (zones ?? [])
    .filter((z) => z.wallLevel === wallLevel)
    .reduce((max, z) => Math.max(max, z.depthMm), 0);
}

/**
 * הרצועות שנוגעות בקצה מסוים של הקיר, אחת לכל מפלס.
 * נספר הארון העמוק ביותר בכל מפלס, כי הוא זה שקובע כמה נכנס לכאן.
 */
function zonesAt(wall: Wall, units: PlacedUnit[], side: 'start' | 'end'): CornerZone[] {
  const touching = units.filter(
    (u) =>
      u.wallId === wall.id &&
      !u.free &&
      (side === 'start' ? u.xMm <= 1 : u.xMm + alongWallMm(u) >= wall.lengthMm - 1),
  );
  const out: CornerZone[] = [];
  for (const wallLevel of [false, true]) {
    const same = touching.filter((u) => (u.level === 'wall') === wallLevel);
    if (!same.length) continue;
    out.push({
      depthMm: same.reduce((max, u) => Math.max(max, intoRoomMm(u)), 0),
      yMm: same.reduce((min, u) => Math.min(min, u.yMm), Infinity),
      heightMm:
        same.reduce((max, u) => Math.max(max, u.yMm + u.heightMm), 0) -
        same.reduce((min, u) => Math.min(min, u.yMm), Infinity),
      wallLevel,
    });
  }
  return out;
}

/** ארון אחד במבט על, כמלבן בקואורדינטות החדר. */
export interface PlanUnit {
  unit: PlacedUnit;
  /** ארבע פינות המלבן, לפי סדר */
  corners: PlanPoint[];
  /** מרכז המלבן, לתווית */
  center: PlanPoint;
  /** חודר בפועל לתוך ארון אחר */
  clash: boolean;
}

/**
 * הארונות במבט על.
 *
 * הגיאומטריה מגיעה מ-`unitBox`, אותו מקום שהתלת־ממד ובדיקת
 * ההתנגשות שואלים. כשכל מבט חישב את זה בעצמו הם יכלו לא להסכים,
 * ואי — שאינו על קיר בכלל — לא היה מצויר כאן נכון לעולם.
 */
export function planUnits(plan: PlanWall[], units: PlacedUnit[]): PlanUnit[] {
  const out: PlanUnit[] = [];
  /* התיבה מחושבת פעם אחת לכל ארגז, ומשמשת גם לציור וגם לבדיקה */
  const solids: UnitBox[] = [];
  for (const u of units) {
    const b = unitBox(u, plan);
    if (!b) continue;
    /* הציור הוא הגוף; הבדיקה היא הגוף ועוד החזית שבולטת ממנו */
    solids.push(solidBox(u, plan) ?? b);
    out.push({ unit: u, corners: boxCorners(b), center: { x: b.cx, y: b.cz }, clash: false });
  }

  /*
   * התנגשות אמיתית, באותו חוק פיזיקלי של הגרירה: מגע והכלה מותרים,
   * חדירה חלקית לא. כאן היא מסומנת ולא נחסמת — מה שכבר עומד בחדר
   * צריך להיראות, גם כשהוא לא חוקי.
   */
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (unitsClash(
        { unit: out[i].unit, box: solids[i] },
        { unit: out[j].unit, box: solids[j] },
      )) {
        out[i].clash = true;
        out[j].clash = true;
      }
    }
  }

  return out;
}
