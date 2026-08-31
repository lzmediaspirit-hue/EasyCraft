import { glyphDef } from '../catalog/glyphList';
import { autoShelves } from '../catalog/CabinetGlyph';
import { MATERIAL } from '../catalog/standards';
import type { Board, BoardRole, PlacedUnit, ProjectPrice, Settings } from '../db/types';

/**
 * פירוק הפרויקט לחלקים וחישוב כמות פלטות ומחיר.
 *
 * כל ארגז מפורק לחלקים אמיתיים עם מידות — זו כבר רשימת ניסור מקוצרת,
 * ולא רק סכום שטחים. עובי הכרסום נוסף לכל חלק בנפרד, כי המסור אוכל
 * חתך סביב כל חלק ולא פעם אחת בסוף.
 *
 * כמות הפלטות היא עדיין הערכה: שטח החלקים חלקי שטח פלטה נטו. מנוע
 * ניצול הלוח יחליף את החלוקה הזו במספר מדויק, ואז גם אחוז הניצולת
 * ייגזר מהניסורים בפועל במקום להיות הגדרה.
 */

export interface Part {
  role: BoardRole;
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
}

export interface BoardLine {
  board: Board;
  areaM2: number;
  sheets: number;
  /** המחיר שבאמת חל, אחרי דריסה ברמת הפרויקט */
  factoryPrice: number;
  consumerPrice: number;
  factoryTotal: number;
  consumerTotal: number;
  /** האם המחיר נקבע במיוחד לפרויקט הזה */
  overridden: boolean;
}

export interface ProjectCosting {
  lines: BoardLine[];
  units: number;
  drawers: number;
  doors: number;
  exposedPanels: number;
  /** מטרים רצים של פס לד */
  ledMeters: number;
  totalSheets: number;
  factoryTotal: number;
  consumerTotal: number;
}

/* ------------------------------------------------------------------ */

/** אזור החזית שמכוסה במגירות חיצוניות. */
function outerDrawerZone(u: PlacedUnit): number {
  const rows = u.drawers ?? 0;
  if (rows < 1 || u.drawerStyle === 'inner') return 0;
  if (u.glyph === 'doorDrawer') {
    return Math.min(u.heightMm * 0.22, u.heightMm / (rows + 1)) * rows;
  }
  return u.heightMm;
}

/** מגירה פנימית מוסתרת מאחורי דלת, ולכן יש חזית גם בלי שהוגדרו דלתות. */
function effectiveDoors(u: PlacedUnit): number {
  const inner = u.drawerStyle === 'inner' && (u.drawers ?? 0) > 0;
  return inner ? Math.max(u.doors ?? 0, 1) : (u.doors ?? 0);
}

/** פירוק ארגז אחד לחלקים עם מידות. */
export function unitParts(u: PlacedUnit, carcassThicknessMm: number): Part[] {
  const w = u.widthMm;
  const h = u.heightMm;
  const d = u.depthMm;
  const parts: Part[] = [];

  // לוח בודד ולא ארון — נספר לפי המישור שבו הוא מונח
  const flat = glyphDef(u.glyph).noCarcass;
  if (flat) {
    return [
      {
        role: 'front',
        label: u.name,
        widthMm: w,
        heightMm: flat === 'horizontal' ? d : h,
        qty: 1,
      },
    ];
  }

  const inner = Math.max(w - 2 * carcassThicknessMm, 0);
  const shelves = u.shelves ?? autoShelves(h);

  parts.push({ role: 'carcass', label: 'צד', widthMm: d, heightMm: h, qty: 2 });
  parts.push({ role: 'carcass', label: 'תחתית ותקרה', widthMm: inner, heightMm: d, qty: 2 });
  if (shelves > 0) {
    parts.push({
      role: 'carcass',
      label: 'מדף',
      widthMm: inner,
      heightMm: Math.max(d - 20, 0),
      qty: shelves,
    });
  }

  parts.push({ role: 'back', label: 'גב', widthMm: w, heightMm: h, qty: 1 });

  const drawerZone = outerDrawerZone(u);
  const rows = u.drawers ?? 0;
  const cols = Math.max(u.drawerCols ?? 1, 1);
  if (drawerZone > 0) {
    parts.push({
      role: 'front',
      label: 'חזית מגירה',
      widthMm: w / cols,
      heightMm: drawerZone / rows,
      qty: rows * cols,
    });
  }

  const doors = effectiveDoors(u);
  const doorZone = doors > 0 ? Math.max(h - drawerZone, 0) : 0;
  if (doorZone > 0) {
    // דלת זכוכית היא מסגרת דקה בלבד, ולכן צורכת חלק קטן משטח לוח מלא
    parts.push({
      role: 'front',
      label: u.glassDoors ? 'מסגרת דלת זכוכית' : 'דלת',
      widthMm: w / doors,
      heightMm: doorZone * (u.glassDoors ? 0.25 : 1),
      qty: doors,
    });
  }

  const e = u.exposed ?? {};
  const panelDepth = d + MATERIAL.exposedExtraMm;
  const panel = (heightMm: number): Part => ({
    role: 'front',
    label: 'דופן זרה',
    widthMm: panelDepth,
    heightMm,
    qty: 1,
  });
  if (e.start) parts.push(panel(h));
  if (e.end) parts.push(panel(h));
  if (e.top) parts.push(panel(w));
  if (e.bottom) parts.push(panel(w));

  return parts;
}

/** מטרים רצים של פס לד בארגז. */
export function unitLedMeters(u: PlacedUnit): number {
  if (!u.led?.length) return 0;
  const shelves = u.shelves ?? autoShelves(u.heightMm);
  let mm = 0;
  for (const spot of u.led) {
    if (spot === 'start' || spot === 'end') mm += u.heightMm;
    else if (spot === 'top' || spot === 'bottom') mm += u.widthMm;
    else if (spot === 'shelf') mm += u.widthMm * shelves;
  }
  return mm / 1000;
}

/* ------------------------------------------------------------------ */

export function projectCosting(
  units: PlacedUnit[],
  boards: Board[],
  settings: Settings,
  overrides: ProjectPrice[] = [],
): ProjectCosting {
  const kerf = settings.kerfMm;
  const usableSheetM2 =
    (settings.sheetWidthMm / 1000) * (settings.sheetHeightMm / 1000) * (settings.yieldPct / 100);

  const areaByRole: Record<BoardRole, number> = { carcass: 0, front: 0, back: 0 };
  let drawers = 0;
  let doors = 0;
  let exposedPanels = 0;
  let ledMeters = 0;

  for (const u of units) {
    for (const part of unitParts(u, settings.carcassThicknessMm)) {
      // הכרסום נאכל סביב כל חלק בנפרד
      const area = ((part.widthMm + kerf) * (part.heightMm + kerf)) / 1_000_000;
      areaByRole[part.role] += area * part.qty;
    }
    drawers += (u.drawers ?? 0) * Math.max(u.drawerCols ?? 1, 1);
    doors += effectiveDoors(u);
    const e = u.exposed ?? {};
    exposedPanels += [e.start, e.end, e.top, e.bottom].filter(Boolean).length;
    ledMeters += unitLedMeters(u);
  }

  // כשיש כמה לוחות באותו תפקיד, השטח נזקף לראשון שבהם
  const primary = new Map<BoardRole, string>();
  for (const b of boards) if (!primary.has(b.role)) primary.set(b.role, b.id);

  const lines: BoardLine[] = [];
  for (const board of boards) {
    if (primary.get(board.role) !== board.id) continue;
    const areaM2 = areaByRole[board.role];
    if (areaM2 <= 0) continue;

    const override = overrides.find((o) => o.boardId === board.id);
    const factoryPrice = override?.factoryPrice ?? board.factoryPrice;
    const consumerPrice = override?.consumerPrice ?? board.consumerPrice;
    const sheets = Math.ceil(areaM2 / usableSheetM2);

    lines.push({
      board,
      areaM2,
      sheets,
      factoryPrice,
      consumerPrice,
      factoryTotal: sheets * factoryPrice,
      consumerTotal: sheets * consumerPrice,
      overridden: !!override,
    });
  }

  return {
    lines,
    units: units.length,
    drawers,
    doors,
    exposedPanels,
    ledMeters,
    totalSheets: lines.reduce((n, l) => n + l.sheets, 0),
    factoryTotal: lines.reduce((n, l) => n + l.factoryTotal, 0),
    consumerTotal: lines.reduce((n, l) => n + l.consumerTotal, 0),
  };
}
