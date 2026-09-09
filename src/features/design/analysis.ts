import { alongWallMm } from '../../db/types';
import type { PlacedUnit, Wall } from '../../db/types';
import { featureDef } from '../projects/wallFeatures';
import { MAX_BODY_MM } from '../../catalog/zones';
import { glyphDef } from '../../catalog/glyphList';
import { cm } from '../../ui/units';

/**
 * התראה אחת, ומי היא מדברת עליו.
 *
 * התראה בלי ארגז היא טקסט שצריך לחפש לפיו על הקיר. `unitIds` הוא
 * מה שהופך אותה לכפתור: לוחצים, והארגז שיש בו הבעיה נבחר.
 */
interface WallWarning {
  text: string;
  unitIds: string[];
}

export interface WallAnalysis {
  /** אורך תפוס על הרצפה (תחתונים ועמודות) */
  floorUsedMm: number;
  /** אורך תפוס במפלס העליון */
  wallUsedMm: number;
  freeMm: number;
  warnings: WallWarning[];
}

/**
 * בדיקות שהנגר היה עושה בראש: חריגה מהקיר, ארגזים שנוגעים זה בזה,
 * ושקעים או נקודות מים שנעלמים מאחורי ארגז.
 */
export function analyzeWall(
  wall: Wall,
  units: PlacedUnit[],
  /** ארונות שמתנגשים בפועל בארון של קיר אחר, ממבט העל */
  clashing: { id: string; name: string }[] = [],
): WallAnalysis {
  const floor = units.filter((u) => u.level !== 'wall');
  const upper = units.filter((u) => u.level === 'wall');

  const floorUsedMm = floor.reduce((sum, u) => sum + alongWallMm(u), 0);
  const wallUsedMm = upper.reduce((sum, u) => sum + alongWallMm(u), 0);
  const warnings: WallWarning[] = [];
  /** מי חורג בפועל מקצה הקיר — אליו מצביעה ההתראה */
  const past = (group: PlacedUnit[]) =>
    group.filter((u) => u.xMm + alongWallMm(u) > wall.lengthMm + 1).map((u) => u.id);

  if (floorUsedMm > wall.lengthMm) {
    warnings.push({
      text: `התחתונים חורגים מהקיר ב-${cm(floorUsedMm - wall.lengthMm)} ס"מ`,
      unitIds: past(floor),
    });
  }
  if (wallUsedMm > wall.lengthMm) {
    warnings.push({
      text: `העליונים חורגים מהקיר ב-${cm(wallUsedMm - wall.lengthMm)} ס"מ`,
      unitIds: past(upper),
    });
  }

  for (const group of [floor, upper]) {
    const sorted = [...group].sort((a, b) => a.xMm - b.xMm);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.xMm < prev.xMm + alongWallMm(prev) - 1) {
        warnings.push({ text: `${prev.name} ו${cur.name} חופפים`, unitIds: [prev.id, cur.id] });
        break;
      }
    }
  }

  for (const f of wall.features) {
    const label = featureDef(f.kind).label;

    // שקע או נקודת מים שנבלעים לגמרי מאחורי ארגז
    if (f.kind === 'socket' || f.kind === 'water') {
      const covered = units.find((u) => contains(u, f));
      if (covered) warnings.push({ text: `${label} מוסתר מאחורי ארגז`, unitIds: [covered.id] });
      continue;
    }

    // חלון, דלת או נישה שארגז נכנס לתוכם — גם חפיפה חלקית היא בעיה
    const blocking = units.find((u) => overlaps(u, f));
    if (blocking) warnings.push({ text: `${blocking.name} חוסם את ה${label}`, unitIds: [blocking.id] });
  }

  // ארון גבוה מדי — קשה להרים, להוביל ולהתקין
  for (const u of units) {
    const bodyH = u.heightMm - (u.socleMm ?? 0);
    if (bodyH > MAX_BODY_MM) {
      warnings.push({
        text: `${u.name} בגובה ${cm(bodyH)} ס"מ — מעל ${cm(MAX_BODY_MM)} עדיף לפצל`,
        unitIds: [u.id],
      });
    }
  }

  /*
   * התנגשות אמיתית בפינה, ולא "נכנס לאזור שסומן".
   * הפינה פתוחה לכל ארגז; מה שאסור זה ששני ארונות יתפסו את אותו
   * מקום בחדר — וזה נמדד במבט העל, על המלבנים עצמם.
   */
  for (const c of clashing) {
    warnings.push({ text: `${c.name} מתנגש בארון על הקיר השכן`, unitIds: [c.id] });
  }

  return { floorUsedMm, wallUsedMm, freeMm: wall.lengthMm - floorUsedMm, warnings };
}

function contains(u: PlacedUnit, f: Wall['features'][number]): boolean {
  return (
    u.xMm <= f.xMm &&
    u.xMm + alongWallMm(u) >= f.xMm + f.widthMm &&
    u.yMm <= f.yMm &&
    u.yMm + u.heightMm >= f.yMm + f.heightMm
  );
}

function overlaps(u: PlacedUnit, f: Wall['features'][number]): boolean {
  return (
    u.xMm < f.xMm + f.widthMm &&
    u.xMm + alongWallMm(u) > f.xMm &&
    u.yMm < f.yMm + f.heightMm &&
    u.yMm + u.heightMm > f.yMm
  );
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
    const start = same
      .filter((u) => u.yMm + u.heightMm <= mid)
      .reduce((n, u) => Math.max(n, u.yMm + u.heightMm), 0);
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
