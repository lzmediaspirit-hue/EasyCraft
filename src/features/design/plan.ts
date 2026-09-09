import { alongWallMm, intoRoomMm } from '../../db/types';
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
    const rad = (heading * Math.PI) / 180;
    const end = {
      x: cursor.x + Math.cos(rad) * wall.lengthMm,
      y: cursor.y + Math.sin(rad) * wall.lengthMm,
    };
    out.push({
      wall,
      start: cursor,
      end,
      headingDeg: heading,
      depthMm: wallDepth(wall, units),
    });
    cursor = end;
  }
  return out;
}

/** העומק הגדול ביותר של ארון שעומד על הרצפה בקיר נתון. */
function wallDepth(wall: Wall, units: PlacedUnit[]): number {
  return units
    .filter((u) => u.wallId === wall.id && u.level !== 'wall')
    .reduce((max, u) => Math.max(max, intoRoomMm(u)), 0);
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
  /** מתנגש עם ארון על קיר אחר */
  clash: boolean;
}

/**
 * הארונות במבט על.
 *
 * כל ארון הוא מלבן ברוחב שלו ובעומק שלו, מונח לאורך הקיר ובולט
 * ממנו פנימה. זה מה שמאפשר לראות מיד שארון בקצה קיר אחד נכנס
 * לתוך ארון בקצה הקיר השכן — התנגשות שבמבט חזית לא נראית בכלל.
 */
export function planUnits(plan: PlanWall[], units: PlacedUnit[]): PlanUnit[] {
  const out: PlanUnit[] = [];

  for (const p of plan) {
    const rad = (p.headingDeg * Math.PI) / 180;
    // כיוון הקיר, והניצב לו שאליו הארונות בולטים
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const normal = { x: -Math.sin(rad), y: Math.cos(rad) };

    for (const u of units.filter((x) => x.wallId === p.wall.id)) {
      const a = {
        x: p.start.x + dir.x * u.xMm,
        y: p.start.y + dir.y * u.xMm,
      };
      /* ארגז מסובב תופס על הקיר את עומקו ונכנס לחדר ברוחבו */
      const along = alongWallMm(u);
      const b = { x: a.x + dir.x * along, y: a.y + dir.y * along };
      const d = intoRoomMm(u);
      const corners = [
        a,
        b,
        { x: b.x + normal.x * d, y: b.y + normal.y * d },
        { x: a.x + normal.x * d, y: a.y + normal.y * d },
      ];
      out.push({
        unit: u,
        corners,
        center: {
          x: a.x + dir.x * (along / 2) + normal.x * (d / 2),
          y: a.y + dir.y * (along / 2) + normal.y * (d / 2),
        },
        clash: false,
      });
    }
  }

  /*
   * התנגשות נבדקת רק בין ארונות על קירות שונים ובאותו מפלס: שני
   * ארונות על אותו קיר כבר נבדקים במבט חזית, וארון תלוי עובר מעל
   * ארון רצפה בלי לגעת בו.
   */
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const A = out[i];
      const B = out[j];
      if (A.unit.wallId === B.unit.wallId) continue;
      if ((A.unit.level === 'wall') !== (B.unit.level === 'wall')) continue;
      if (overlaps(A.corners, B.corners)) {
        A.clash = true;
        B.clash = true;
      }
    }
  }

  return out;
}

/**
 * חפיפה בין שני מלבנים מסובבים, בשיטת הצירים המפרידים.
 * אם קיים ציר שעליו ההיטלים אינם נחתכים — אין חפיפה.
 */
function overlaps(a: PlanPoint[], b: PlanPoint[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      const len = Math.hypot(axis.x, axis.y);
      if (len < 1e-6) continue;
      const n = { x: axis.x / len, y: axis.y / len };
      const [minA, maxA] = project(a, n);
      const [minB, maxB] = project(b, n);
      // סובלנות של מילימטר: מגע קצה בקצה אינו התנגשות
      if (maxA <= minB + 1 || maxB <= minA + 1) return false;
    }
  }
  return true;
}

function project(poly: PlanPoint[], n: PlanPoint): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = p.x * n.x + p.y * n.y;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return [min, max];
}
