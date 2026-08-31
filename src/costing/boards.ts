import { glyphDef } from '../catalog/glyphList';
import { MATERIAL } from '../catalog/standards';
import { countDrawers, countShelves, unitZones } from '../catalog/zones';
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

/** שורת אביזר בתמחור. */
export interface AccessoryLine {
  label: string;
  qty: number;
  unit: string;
  factoryPrice: number;
  consumerPrice: number;
  factoryTotal: number;
  consumerTotal: number;
}

export interface ProjectCosting {
  lines: BoardLine[];
  accessories: AccessoryLine[];
  units: number;
  drawers: number;
  doors: number;
  exposedPanels: number;
  /** מטרים רצים של פס לד */
  ledMeters: number;
  /** מנגנוני קלאפה */
  lifts: number;
  totalSheets: number;
  boardsFactoryTotal: number;
  boardsConsumerTotal: number;
  factoryTotal: number;
  consumerTotal: number;
}

/* ------------------------------------------------------------------ */

/** מגירה פנימית מוסתרת מאחורי דלת, ולכן יש חזית גם בלי שהוגדרו דלתות. */
function effectiveDoors(u: PlacedUnit): number {
  const hasInner = unitZones(u).some((z) => z.kind === 'drawers' && z.drawerStyle === 'inner');
  return hasInner ? Math.max(u.doors ?? 0, 1) : (u.doors ?? 0);
}

/** מנגנוני קלאפה בארגז — אחד לכל דלת שנפתחת כלפי מעלה. */
function liftCount(u: PlacedUnit): number {
  return u.opening === 'lift' ? effectiveDoors(u) : 0;
}

/**
 * פירוק ארגז אחד לחלקים עם מידות, אחרי כל ההפחתות:
 * דופן זרה בולעת את עובי הלוח מהגוף, הגב יושב בחריץ ולכן קטן מהגוף,
 * והחזית קטנה מהפתח במרווח סביבה.
 */
export function unitParts(u: PlacedUnit, s: PartSettings): Part[] {
  const w = u.widthMm;
  const h = u.heightMm;
  const d = u.depthMm;
  const t = s.carcassThicknessMm;
  const ft = MATERIAL.frontMm;

  // לוח בודד — נספר לפי המישור שבו הוא מונח
  const flat = glyphDef(u.glyph).noCarcass;
  if (flat) {
    return [
      {
        role: u.panelThicknessMm && u.panelThicknessMm < 10 ? 'back' : 'front',
        label: u.name,
        widthMm: w,
        heightMm: flat === 'horizontal' ? d : h,
        qty: 1,
      },
    ];
  }

  const parts: Part[] = [];
  const e = u.exposed ?? {};

  // דופן זרה היא חלק מהמעטפת החיצונית, ולכן הגוף מתכווץ בעוביה
  const carcassW = w - (e.start ? ft : 0) - (e.end ? ft : 0);
  const carcassH = h - (e.top ? ft : 0) - (e.bottom ? ft : 0);
  const innerW = Math.max(carcassW - 2 * t, 0);

  parts.push({ role: 'carcass', label: 'צד', widthMm: d, heightMm: carcassH, qty: 2 });
  parts.push({ role: 'carcass', label: 'תחתית ותקרה', widthMm: innerW, heightMm: d, qty: 2 });

  // מדפים מכל האזורים
  const zones = unitZones(u);
  const shelves = zones.reduce((n, z) => n + (z.kind === 'shelves' ? (z.shelves ?? 0) : 0), 0);
  if (shelves > 0) {
    parts.push({
      role: 'carcass',
      label: 'מדף',
      widthMm: innerW,
      heightMm: Math.max(d - 20, 0),
      qty: shelves,
    });
  }
  // כל אזור מעל הראשון מופרד בלוח חוצץ
  if (zones.length > 1) {
    parts.push({
      role: 'carcass',
      label: 'חוצץ בין אזורים',
      widthMm: innerW,
      heightMm: d,
      qty: zones.length - 1,
    });
  }

  // הגב יושב בחריץ: קטן בעובי הצדדים, וחוזר בעומק החריץ
  const groove = s.backGrooveMm;
  parts.push({
    role: 'back',
    label: 'גב',
    widthMm: Math.max(carcassW - 2 * t + 2 * groove, 0),
    heightMm: Math.max(carcassH - 2 * t + 2 * groove, 0),
    qty: 1,
  });

  // חזיתות מגירה, אזור אחר אזור
  const gap = s.frontGapMm;
  for (const z of zones) {
    if (z.kind !== 'drawers' || z.drawerStyle === 'inner') continue;
    const rows = z.drawers ?? 1;
    const cols = Math.max(z.drawerCols ?? 1, 1);
    parts.push({
      role: 'front',
      label: 'חזית מגירה',
      widthMm: Math.max(carcassW / cols - gap, 0),
      heightMm: Math.max(z.heightMm / rows - gap, 0),
      qty: rows * cols,
    });
  }

  // דלתות מכסות את כל מה שאינו מגירה חיצונית
  const doors = effectiveDoors(u);
  const coveredMm = zones
    .filter((z) => !(z.kind === 'drawers' && z.drawerStyle !== 'inner'))
    .reduce((n, z) => n + z.heightMm, 0);
  if (doors > 0 && coveredMm > 0) {
    parts.push({
      role: 'front',
      label: u.glassDoors ? 'מסגרת דלת זכוכית' : 'דלת',
      widthMm: Math.max(carcassW / doors - gap, 0),
      // דלת זכוכית היא מסגרת בלבד וצורכת חלק קטן משטח לוח מלא
      heightMm: Math.max(coveredMm - gap, 0) * (u.glassDoors ? 0.25 : 1),
      qty: doors,
    });
  }

  // דפנות זרות במידה החיצונית המלאה, ועמוקות מהארגז
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

/** ההגדרות שנחוצות לפירוק לחלקים. */
export interface PartSettings {
  carcassThicknessMm: number;
  backGrooveMm: number;
  frontGapMm: number;
}

/** מטרים רצים של פס לד בארגז. */
export function unitLedMeters(u: PlacedUnit): number {
  if (!u.led?.length) return 0;
  const shelves = countShelves(u);
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

  let lifts = 0;

  for (const u of units) {
    for (const part of unitParts(u, settings)) {
      // הכרסום נאכל סביב כל חלק בנפרד
      const area = ((part.widthMm + kerf) * (part.heightMm + kerf)) / 1_000_000;
      areaByRole[part.role] += area * part.qty;
    }
    drawers += countDrawers(u);
    doors += effectiveDoors(u);
    lifts += liftCount(u);
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

  const a = settings.accessories;
  const accessories: AccessoryLine[] = [
    accessory('מגירות', drawers, 'יח׳', a.drawerFactory, a.drawerConsumer),
    accessory('פס לד', ledMeters, 'מ׳', a.ledFactory, a.ledConsumer),
    accessory('מנגנוני קלאפה', lifts, 'יח׳', a.liftFactory, a.liftConsumer),
  ].filter((l) => l.qty > 0);

  const boardsFactoryTotal = lines.reduce((n, l) => n + l.factoryTotal, 0);
  const boardsConsumerTotal = lines.reduce((n, l) => n + l.consumerTotal, 0);
  const accFactory = accessories.reduce((n, l) => n + l.factoryTotal, 0);
  const accConsumer = accessories.reduce((n, l) => n + l.consumerTotal, 0);

  return {
    lines,
    accessories,
    units: units.length,
    drawers,
    doors,
    exposedPanels,
    ledMeters,
    lifts,
    totalSheets: lines.reduce((n, l) => n + l.sheets, 0),
    boardsFactoryTotal,
    boardsConsumerTotal,
    factoryTotal: boardsFactoryTotal + accFactory,
    consumerTotal: boardsConsumerTotal + accConsumer,
  };
}

function accessory(
  label: string,
  qty: number,
  unit: string,
  factoryPrice: number,
  consumerPrice: number,
): AccessoryLine {
  return {
    label,
    qty,
    unit,
    factoryPrice,
    consumerPrice,
    factoryTotal: qty * factoryPrice,
    consumerTotal: qty * consumerPrice,
  };
}
