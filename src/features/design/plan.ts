import type { PlacedUnit, Wall } from '../../db/types';

/**
 * גיאומטריית החדר במבט על.
 *
 * הקירות משורשרים: כל קיר מתחיל בסופו של הקודם, אחרי פנייה בזווית
 * שהוגדרה לו. פנייה של 90 מעלות נותנת חדר מלבני; כל ערך אחר מתאר
 * חדר בצורה אחרת, וזה מה שמאפשר לתאר חדר שאינו קובייה.
 */

export interface PlanPoint {
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
export function wallDepth(wall: Wall, units: PlacedUnit[]): number {
  return units
    .filter((u) => u.wallId === wall.id && u.level !== 'wall')
    .reduce((max, u) => Math.max(max, u.depthMm), 0);
}

/**
 * אזורי הפינה של קיר: הרוחב בכל קצה שנתפס על ידי הארונות של הקיר
 * השכן. ארון רגיל שנכנס לשם יתנגש בפועל.
 */
export function cornerZones(
  walls: Wall[],
  wall: Wall,
  units: PlacedUnit[],
): { startMm: number; endMm: number } {
  const i = walls.findIndex((w) => w.id === wall.id);
  const prev = i > 0 ? walls[i - 1] : undefined;
  const next = i < walls.length - 1 ? walls[i + 1] : undefined;
  return {
    startMm: prev ? wallDepth(prev, units) : 0,
    endMm: next ? wallDepth(next, units) : 0,
  };
}
