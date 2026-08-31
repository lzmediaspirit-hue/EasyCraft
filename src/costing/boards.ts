import { MATERIAL, usableSheetM2 } from '../catalog/standards';
import { glyphDef } from '../catalog/glyphList';
import { autoShelves } from '../catalog/CabinetGlyph';
import type { PlacedUnit } from '../db/types';

/**
 * חישוב כמות הפלטות בפרויקט.
 *
 * שלוש קבוצות נספרות בנפרד, כי כל אחת נקנית כפלטה אחרת:
 *   גוף      — צדדים, תחתית, תקרה ומדפים
 *   גב       — סיבית דקה, נספר רק אם עוביו שונה מהגוף
 *   חזיתות   — דלתות, חזיתות מגירה ודפנות זרות
 *
 * החישוב הוא שטח חלקים חלקי שטח פלטה נטו. זו הערכה ריאלית ולא ניסור
 * אמיתי: מנוע ניצול הלוח יחליף אותה בהמשך ויחזיר מספר מדויק, ואז
 * גם אחוז הניצולת ייגזר מהניסורים בפועל.
 */

export interface UnitParts {
  /** שטח חלקי הגוף במ"ר */
  carcassM2: number;
  /** שטח הגב במ"ר */
  backM2: number;
  /** שטח חזיתות במ"ר */
  frontM2: number;
  /** שטח דפנות זרות במ"ר */
  exposedM2: number;
  drawers: number;
  doors: number;
  exposedPanels: number;
}

export interface ProjectBoards extends UnitParts {
  units: number;
  carcassSheets: number;
  backSheets: number;
  frontSheets: number;
  totalSheets: number;
  /** האם הגב נספר בנפרד — כלומר עוביו שונה מהגוף */
  backIsSeparate: boolean;
}

const M2 = (widthMm: number, heightMm: number) => (widthMm * heightMm) / 1_000_000;

/** אזור החזית שמכוסה במגירות חיצוניות, כשיש כאלה. */
function outerDrawerZone(u: PlacedUnit): number {
  const rows = u.drawers ?? 0;
  if (rows < 1 || u.drawerStyle === 'inner') return 0;
  // באיור "דלת ומגירה" המגירות תופסות רק רצועה עליונה
  if (u.glyph === 'doorDrawer') {
    return Math.min(u.heightMm * 0.22, u.heightMm / (rows + 1)) * rows;
  }
  return u.heightMm;
}

/** פירוק ארגז אחד לחלקים. */
export function unitParts(u: PlacedUnit): UnitParts {
  const t = MATERIAL.carcassMm;
  const w = u.widthMm;
  const h = u.heightMm;
  const d = u.depthMm;
  // אותה ברירת מחדל כמו בציור, כדי שמה שנראה על הקיר הוא מה שנספר
  const shelves = u.shelves ?? autoShelves(h);

  // גוף: שני צדדים, תחתית ותקרה, ומדפים
  const sides = 2 * M2(d, h);
  const topBottom = 2 * M2(Math.max(w - 2 * t, 0), d);
  const shelfArea = shelves * M2(Math.max(w - 2 * t, 0), Math.max(d - 20, 0));
  const carcassM2 = sides + topBottom + shelfArea;

  const backM2 = M2(w, h);

  // חזיתות: מה שבאמת מכסה את הארגז מלפנים.
  // מגירה פנימית לא נראית — במקומה יש דלת, גם אם לא הוגדרו דלתות.
  const innerDrawers = u.drawerStyle === 'inner' && (u.drawers ?? 0) > 0;
  const doorCount = innerDrawers ? Math.max(u.doors ?? 0, 1) : (u.doors ?? 0);
  const drawerZone = outerDrawerZone(u);
  const doorZone = doorCount > 0 ? Math.max(h - drawerZone, 0) : 0;
  const frontM2 = M2(w, drawerZone + doorZone);

  // דפנות זרות עמוקות מהארגז, כדי לכסות את קצה החזית
  const panelDepth = d + MATERIAL.exposedExtraMm;
  const e = u.exposed ?? {};
  const exposedPanels = [e.start, e.end, e.top, e.bottom].filter(Boolean).length;
  const exposedM2 =
    (e.start ? M2(panelDepth, h) : 0) +
    (e.end ? M2(panelDepth, h) : 0) +
    (e.top ? M2(panelDepth, w) : 0) +
    (e.bottom ? M2(panelDepth, w) : 0);

  return {
    carcassM2,
    backM2,
    frontM2,
    exposedM2,
    drawers: (u.drawers ?? 0) * Math.max(u.drawerCols ?? 1, 1),
    doors: doorCount,
    exposedPanels,
  };
}

/** סיכום כל הארגזים בפרויקט לכמות פלטות. */
export function projectBoards(units: PlacedUnit[]): ProjectBoards {
  const sum: UnitParts = {
    carcassM2: 0,
    backM2: 0,
    frontM2: 0,
    exposedM2: 0,
    drawers: 0,
    doors: 0,
    exposedPanels: 0,
  };

  for (const u of units) {
    // לוח בודד ולא ארון — נספר לפי המישור שבו הוא מונח
    const flat = glyphDef(u.glyph).noCarcass;
    if (flat) {
      sum.frontM2 += M2(u.widthMm, flat === 'horizontal' ? u.depthMm : u.heightMm);
      continue;
    }
    const p = unitParts(u);
    sum.carcassM2 += p.carcassM2;
    sum.backM2 += p.backM2;
    sum.frontM2 += p.frontM2;
    sum.exposedM2 += p.exposedM2;
    sum.drawers += p.drawers;
    sum.doors += p.doors;
    sum.exposedPanels += p.exposedPanels;
  }

  const backIsSeparate = MATERIAL.backMm !== MATERIAL.carcassMm;
  const carcassSheets = sheets(sum.carcassM2 + (backIsSeparate ? 0 : sum.backM2));
  const backSheets = backIsSeparate ? sheets(sum.backM2) : 0;
  const frontSheets = sheets(sum.frontM2 + sum.exposedM2);

  return {
    ...sum,
    units: units.length,
    carcassSheets,
    backSheets,
    frontSheets,
    totalSheets: carcassSheets + backSheets + frontSheets,
    backIsSeparate,
  };
}

function sheets(areaM2: number): number {
  return areaM2 > 0 ? Math.ceil(areaM2 / usableSheetM2) : 0;
}
