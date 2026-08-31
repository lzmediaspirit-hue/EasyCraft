import type { PlacedUnit, Wall } from '../../db/types';
import { featureDef } from '../projects/wallFeatures';
import { cm } from '../../ui/units';

export interface WallAnalysis {
  /** אורך תפוס על הרצפה (תחתונים ועמודות) */
  floorUsedMm: number;
  /** אורך תפוס במפלס העליון */
  wallUsedMm: number;
  freeMm: number;
  warnings: string[];
}

/**
 * בדיקות שהנגר היה עושה בראש: חריגה מהקיר, ארגזים שנוגעים זה בזה,
 * ושקעים או נקודות מים שנעלמים מאחורי ארגז.
 */
export function analyzeWall(
  wall: Wall,
  units: PlacedUnit[],
  corners?: { startMm: number; endMm: number },
): WallAnalysis {
  const floor = units.filter((u) => u.level !== 'wall');
  const upper = units.filter((u) => u.level === 'wall');

  const floorUsedMm = floor.reduce((sum, u) => sum + u.widthMm, 0);
  const wallUsedMm = upper.reduce((sum, u) => sum + u.widthMm, 0);
  const warnings: string[] = [];

  if (floorUsedMm > wall.lengthMm) {
    warnings.push(`התחתונים חורגים מהקיר ב-${cm(floorUsedMm - wall.lengthMm)} ס"מ`);
  }
  if (wallUsedMm > wall.lengthMm) {
    warnings.push(`העליונים חורגים מהקיר ב-${cm(wallUsedMm - wall.lengthMm)} ס"מ`);
  }

  for (const group of [floor, upper]) {
    const sorted = [...group].sort((a, b) => a.xMm - b.xMm);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.xMm < prev.xMm + prev.widthMm - 1) {
        warnings.push(`${prev.name} ו${cur.name} חופפים`);
        break;
      }
    }
  }

  for (const f of wall.features) {
    const label = featureDef(f.kind).label;

    // שקע או נקודת מים שנבלעים לגמרי מאחורי ארגז
    if (f.kind === 'socket' || f.kind === 'water') {
      const covered = units.some((u) => contains(u, f));
      if (covered) warnings.push(`${label} מוסתר מאחורי ארגז`);
      continue;
    }

    // חלון, דלת או נישה שארגז נכנס לתוכם — גם חפיפה חלקית היא בעיה
    const blocking = units.find((u) => overlaps(u, f));
    if (blocking) warnings.push(`${blocking.name} חוסם את ה${label}`);
  }

  // ארון רגיל שנכנס לאזור הפינה יתנגש בארון של הקיר השכן
  if (corners) {
    for (const u of units) {
      if (u.level === 'wall' || u.corner) continue;
      if (corners.startMm > 0 && u.xMm < corners.startMm) {
        warnings.push(`${u.name} נכנס לפינה — שם יושבים ארונות הקיר הקודם`);
        break;
      }
      if (corners.endMm > 0 && u.xMm + u.widthMm > wall.lengthMm - corners.endMm) {
        warnings.push(`${u.name} נכנס לפינה — שם יושבים ארונות הקיר הבא`);
        break;
      }
    }
  }

  return { floorUsedMm, wallUsedMm, freeMm: wall.lengthMm - floorUsedMm, warnings };
}

function contains(u: PlacedUnit, f: Wall['features'][number]): boolean {
  return (
    u.xMm <= f.xMm &&
    u.xMm + u.widthMm >= f.xMm + f.widthMm &&
    u.yMm <= f.yMm &&
    u.yMm + u.heightMm >= f.yMm + f.heightMm
  );
}

function overlaps(u: PlacedUnit, f: Wall['features'][number]): boolean {
  return (
    u.xMm < f.xMm + f.widthMm &&
    u.xMm + u.widthMm > f.xMm &&
    u.yMm < f.yMm + f.heightMm &&
    u.yMm + u.heightMm > f.yMm
  );
}

/** המיקום הפנוי הבא במפלס מסוים — כדי שארגז חדש יינחת צמוד לשורה. */
export function nextFreeX(units: PlacedUnit[], level: PlacedUnit['level']): number {
  const sameLine = units.filter((u) => (level === 'wall' ? u.level === 'wall' : u.level !== 'wall'));
  return sameLine.reduce((end, u) => Math.max(end, u.xMm + u.widthMm), 0);
}
