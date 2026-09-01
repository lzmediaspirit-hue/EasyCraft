import { glyphDef } from '../catalog/glyphList';
import { MATERIAL } from '../catalog/standards';
import { countDrawers, countShelves, unitZones, zoneCells } from '../catalog/zones';
import type {
  Board,
  BoardRole,
  PlacedUnit,
  ProjectPrice,
  Finish,
  Settings,
  Zone,
} from '../db/types';

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
  /** הגוון שהחלקים האלה נצבעים בו — לוח אחד יכול לשמש בכמה גוונים */
  finish?: Finish;
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

/** דלת זכוכית בגודל מסוים, וכמה כאלה יש בפרויקט. */
export interface GlassDoorLine {
  /** דלת זכוכית או מדף זכוכית — פריטים שונים בהזמנה מהזגג */
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  areaM2: number;
  factoryTotal: number;
  consumerTotal: number;
}

export interface ProjectCosting {
  lines: BoardLine[];
  accessories: AccessoryLine[];
  glass: GlassDoorLine[];
  glassAreaM2: number;
  units: number;
  drawers: number;
  doors: number;
  exposedPanels: number;
  /** מטרים רצים של פס לד */
  ledMeters: number;
  /** מנגנוני קלאפה */
  lifts: number;
  handles: number;
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
  // הגובה כולל את הרגליים, והגוף מתחיל מעליהן
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
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

  // צד שעשוי זכוכית אינו לוח — הוא נספר ברשימת הזכוכית
  const g = u.glassSides ?? {};
  const boardSides = 2 - (g.start ? 1 : 0) - (g.end ? 1 : 0);
  if (boardSides > 0) {
    parts.push({ role: 'carcass', label: 'צד', widthMm: d, heightMm: carcassH, qty: boardSides });
  }
  parts.push({ role: 'carcass', label: 'תחתית ותקרה', widthMm: innerW, heightMm: d, qty: 2 });

  /*
   * פנים הארון, תא אחר תא.
   *
   * כל אזור עשוי להיות מחולק בקושרות לעמודות, ולכל עמודה יש רוחב
   * משלה ותוכן משלו. לכן המדפים נמדדים לפי רוחב התא ולא לפי רוחב
   * הארון — זה בדיוק ההבדל בין רשימת חיתוך שאפשר לעבוד לפיה לבין
   * מספר שמתקרב.
   */
  const zones = unitZones({ ...u, heightMm: h });
  for (const zone of zones) {
    const cells = zoneCells(zone);
    const dividers = cells.length - 1;
    // עומק התא — מדף רדוד מקבל את העומק שהוגדר לו
    const zoneDepth = zone.depthMm ?? d;

    if (dividers > 0) {
      parts.push({
        role: 'carcass',
        label: 'קושרת',
        widthMm: zoneDepth,
        heightMm: zone.heightMm,
        qty: dividers,
      });
    }

    for (const { content, share } of cells) {
      const cellDepth = content.depthMm ?? zoneDepth;
      // רוחב פנים התא: רוחב הארון פחות הצדדים, פחות הקושרות שמסביבו
      const cellW = Math.max(innerW * share - (dividers > 0 ? t : 0), 0);

      if (content.kind === 'shelves' && !content.glassShelves) {
        const n = content.shelves ?? 0;
        if (n > 0) {
          parts.push({
            role: 'carcass',
            label: 'מדף',
            widthMm: cellW,
            heightMm: Math.max(cellDepth - 20, 0),
            qty: n,
          });
        }
      }

      if (content.kind === 'wine') {
        /*
         * כוורת: שתי סדרות אלכסונים מצטלבות. כל אלכסון חוצה את התא,
         * ולכן אורכו הוא אלכסון המלבן. זו הערכה לתמחור — הנגר יחתוך
         * לפי שרטוט — אבל היא בסדר הגודל הנכון ולא מתעלמת מהחומר.
         */
        const rows = Math.max(content.wineRows ?? 3, 1);
        const cols = Math.max(content.wineCols ?? 4, 1);
        parts.push({
          role: 'carcass',
          label: 'לוח כוורת',
          widthMm: Math.round(Math.hypot(cellW, zone.heightMm)),
          heightMm: Math.max(cellDepth - 20, 0),
          qty: rows + cols,
        });
      }
    }
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

  // הגב: דק בחריץ, בעובי הגוף, או בכלל לא
  const backKind = u.backKind ?? 'thin';
  if (backKind !== 'none') {
    const groove = backKind === 'thin' ? s.backGrooveMm : 0;
    parts.push({
      role: backKind === 'thin' ? 'back' : 'carcass',
      label: backKind === 'thin' ? 'גב' : 'גב בעובי גוף',
      widthMm: Math.max(carcassW - 2 * t + 2 * groove, 0),
      heightMm: Math.max(carcassH - 2 * t + 2 * groove, 0),
      qty: 1,
    });
  }

  // חזיתות מגירה, תא אחר תא — תא בתוך קושרת מקבל חזית צרה יותר
  const gap = s.frontGapMm;
  for (const z of zones) {
    for (const { content, share } of zoneCells(z)) {
      if (content.kind !== 'drawers' || content.drawerStyle === 'inner') continue;
      const rows = content.drawers ?? 1;
      const cols = Math.max(content.drawerCols ?? 1, 1);
      parts.push({
        role: 'front',
        label: 'חזית מגירה',
        widthMm: Math.max((carcassW * share) / cols - gap, 0),
        heightMm: Math.max(z.heightMm / rows - gap, 0),
        qty: rows * cols,
      });
    }
  }

  // דלתות מכסות את כל מה שאינו מגירה חיצונית
  const doors = effectiveDoors(u);
  const coveredMm = coveredHeight(zones);
  // דלת זכוכית אינה לוח, ולכן היא נספרת בנפרד ולא בעמודות הפלטות
  if (doors > 0 && coveredMm > 0 && !u.glassDoors) {
    parts.push({
      role: 'front',
      label: 'דלת',
      widthMm: Math.max(carcassW / doors - gap, 0),
      heightMm: Math.max(coveredMm - gap, 0),
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

/**
 * הגובה שהחזית מכסה.
 * אזור שכולו מגירות חיצוניות כבר יש לו חזית משלו; אזור מעורב —
 * למשל קושרת עם מגירות מצד אחד ומדפים מהשני — עדיין צריך דלת.
 */
function coveredHeight(zones: Zone[]): number {
  return zones.reduce((n, z) => {
    const cells = zoneCells(z);
    const allOuterDrawers = cells.every(
      (c) => c.content.kind === 'drawers' && c.content.drawerStyle !== 'inner',
    );
    return n + (allOuterDrawers ? 0 : z.heightMm);
  }, 0);
}

/** ההגדרות שנחוצות לפירוק לחלקים. */
export interface PartSettings {
  carcassThicknessMm: number;
  backGrooveMm: number;
  frontGapMm: number;
}

/** חלק זכוכית בארגז — דלת או מדף — עם המידה והכמות שלו. */
export interface GlassPart {
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
}

/** כל חלקי הזכוכית בארגז: דלתות ומדפים. */
export function unitGlassDoors(u: PlacedUnit, s: PartSettings): GlassPart[] {
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const e = u.exposed ?? {};
  const ft = MATERIAL.frontMm;
  const carcassW = u.widthMm - (e.start ? ft : 0) - (e.end ? ft : 0);
  const t = s.carcassThicknessMm;
  const zones = unitZones({ ...u, heightMm: h });
  const out: GlassPart[] = [];

  const doors = effectiveDoors(u);
  const coveredMm = coveredHeight(zones);
  if (u.glassDoors && doors > 0 && coveredMm > 0) {
    out.push({
      label: 'דלת זכוכית',
      widthMm: Math.round(Math.max(carcassW / doors - s.frontGapMm, 0)),
      heightMm: Math.round(Math.max(coveredMm - s.frontGapMm, 0)),
      qty: doors,
    });
  }

  // מדף זכוכית נחתך למידת התא שהוא יושב בו
  const innerW = Math.max(carcassW - 2 * t, 0);
  for (const zone of zones) {
    const cells = zoneCells(zone);
    const dividers = cells.length - 1;
    for (const { content, share } of cells) {
      if (content.kind !== 'shelves' || !content.glassShelves) continue;
      const n = content.shelves ?? 0;
      if (n < 1) continue;
      out.push({
        label: 'מדף זכוכית',
        widthMm: Math.round(Math.max(innerW * share - (dividers > 0 ? t : 0), 0)),
        heightMm: Math.round(Math.max((content.depthMm ?? zone.depthMm ?? u.depthMm) - 20, 0)),
        qty: n,
      });
    }
  }

  // צד זכוכית בוויטרינה — במקום לוח צד
  const sides = (u.glassSides?.start ? 1 : 0) + (u.glassSides?.end ? 1 : 0);
  if (sides > 0) {
    out.push({
      label: 'צד זכוכית',
      widthMm: Math.round(u.depthMm),
      heightMm: Math.round(h - (u.exposed?.top ? ft : 0) - (u.exposed?.bottom ? ft : 0)),
      qty: sides,
    });
  }

  return out;
}

/** ידיות בארגז — אחת לכל חזית נראית. */
export function unitHandles(u: PlacedUnit): number {
  if (!u.handles) return 0;
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const outerDrawers = unitZones({ ...u, heightMm: h }).reduce(
    (n, z) =>
      n +
      (z.kind === 'drawers' && z.drawerStyle !== 'inner'
        ? (z.drawers ?? 0) * Math.max(z.drawerCols ?? 1, 1)
        : 0),
    0,
  );
  return effectiveDoors(u) + outerDrawers;
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
  finishes: Finish[] = [],
): ProjectCosting {
  const kerf = settings.kerfMm;
  const usableSheetM2 =
    (settings.sheetWidthMm / 1000) * (settings.sheetHeightMm / 1000) * (settings.yieldPct / 100);

  /*
   * שטח מצטבר לפי לוח וגוון, ולא רק לפי תפקיד.
   * נגרייה עובדת עם כמה סוגי MDF באותו פרויקט, וכל אחד מהם מוזמן
   * בנפרד — ולכן רשימת ההזמנה חייבת להפריד ביניהם ולציין את הגוון.
   */
  const areaByKey = new Map<string, { boardId: string; finishId?: string; areaM2: number }>();
  const primary = new Map<BoardRole, string>();
  for (const b of boards) if (!primary.has(b.role)) primary.set(b.role, b.id);

  /** הלוח שחלק בתפקיד מסוים באמת נחתך ממנו, לפי הגוון שנבחר לו. */
  const resolve = (u: PlacedUnit, role: BoardRole): { boardId?: string; finishId?: string } => {
    const finishId =
      role === 'carcass'
        ? u.carcassFinishId
        : role === 'front'
          ? (u.frontFinishId ?? u.finishId)
          : undefined;
    const finish = finishId ? finishes.find((f) => f.id === finishId) : undefined;
    return { boardId: finish?.boardId ?? primary.get(role), finishId: finish?.id };
  };
  let drawers = 0;
  let doors = 0;
  let exposedPanels = 0;
  let ledMeters = 0;

  let lifts = 0;
  let handles = 0;
  const glassMap = new Map<string, GlassDoorLine>();

  for (const u of units) {
    for (const part of unitParts(u, settings)) {
      // הכרסום נאכל סביב כל חלק בנפרד
      const area = ((part.widthMm + kerf) * (part.heightMm + kerf)) / 1_000_000;
      const { boardId, finishId } = resolve(u, part.role);
      if (!boardId) continue;
      const key = `${boardId}:${finishId ?? ''}`;
      const row = areaByKey.get(key) ?? { boardId, finishId, areaM2: 0 };
      row.areaM2 += area * part.qty;
      areaByKey.set(key, row);
    }
    drawers += countDrawers(u);
    doors += effectiveDoors(u);
    lifts += liftCount(u);
    handles += unitHandles(u);
    for (const g of unitGlassDoors(u, settings)) {
      const key = `${g.label} ${g.widthMm}x${g.heightMm}`;
      const line = glassMap.get(key) ?? {
        label: g.label,
        widthMm: g.widthMm,
        heightMm: g.heightMm,
        qty: 0,
        areaM2: 0,
        factoryTotal: 0,
        consumerTotal: 0,
      };
      line.qty += g.qty;
      glassMap.set(key, line);
    }
    const e = u.exposed ?? {};
    exposedPanels += [e.start, e.end, e.top, e.bottom].filter(Boolean).length;
    ledMeters += unitLedMeters(u);
  }

  // שורה לכל צירוף של לוח וגוון — כך נראית הזמנה אמיתית מהספק
  const lines: BoardLine[] = [];
  for (const row of areaByKey.values()) {
    const board = boards.find((b) => b.id === row.boardId);
    if (!board || row.areaM2 <= 0) continue;

    const override = overrides.find((o) => o.boardId === board.id);
    const finish = row.finishId ? finishes.find((f) => f.id === row.finishId) : undefined;
    // גוון עשוי לעלות אחרת מהלוח הבסיסי
    const factoryPrice = override?.factoryPrice ?? finish?.factoryPrice ?? board.factoryPrice;
    const consumerPrice = override?.consumerPrice ?? finish?.consumerPrice ?? board.consumerPrice;
    const sheets = Math.ceil(row.areaM2 / usableSheetM2);

    lines.push({
      board,
      finish,
      areaM2: row.areaM2,
      sheets,
      factoryPrice,
      consumerPrice,
      factoryTotal: sheets * factoryPrice,
      consumerTotal: sheets * consumerPrice,
      overridden: !!override,
    });
  }
  lines.sort((a, b) => a.board.sortOrder - b.board.sortOrder || b.areaM2 - a.areaM2);

  // דלתות הזכוכית מתומחרות לפי שטח ולא לפי פלטה
  const glass = [...glassMap.values()].map((g) => {
    const areaM2 = (g.widthMm * g.heightMm * g.qty) / 1_000_000;
    return {
      ...g,
      areaM2,
      factoryTotal: areaM2 * settings.glassFactoryPerM2,
      consumerTotal: areaM2 * settings.glassConsumerPerM2,
    };
  });
  const glassAreaM2 = glass.reduce((n, g) => n + g.areaM2, 0);

  const a = settings.accessories;
  const basis: Record<string, number> = {
    door: doors,
    drawer: drawers,
    cabinet: units.length,
    lift: lifts,
    handle: handles,
    ledMeter: ledMeters,
  };

  const accessories: AccessoryLine[] = [
    accessory('מגירות', drawers, 'יח׳', a.drawerFactory, a.drawerConsumer),
    accessory('פס לד', ledMeters, 'מ׳', a.ledFactory, a.ledConsumer),
    accessory('מנגנוני קלאפה', lifts, 'יח׳', a.liftFactory, a.liftConsumer),
    // תוספות שהעסק הגדיר בעצמו
    ...settings.extras.map((x) =>
      accessory(
        x.name,
        x.per === 'manual' ? (x.qty ?? 0) : (basis[x.per] ?? 0),
        x.per === 'ledMeter' ? 'מ׳' : 'יח׳',
        x.factoryPrice,
        x.consumerPrice,
      ),
    ),
  ].filter((l) => l.qty > 0);

  const boardsFactoryTotal = lines.reduce((n, l) => n + l.factoryTotal, 0);
  const boardsConsumerTotal = lines.reduce((n, l) => n + l.consumerTotal, 0);
  const accFactory = accessories.reduce((n, l) => n + l.factoryTotal, 0);
  const accConsumer = accessories.reduce((n, l) => n + l.consumerTotal, 0);
  const glassFactory = glass.reduce((n, g) => n + g.factoryTotal, 0);
  const glassConsumer = glass.reduce((n, g) => n + g.consumerTotal, 0);

  return {
    lines,
    accessories,
    glass,
    glassAreaM2,
    units: units.length,
    drawers,
    doors,
    exposedPanels,
    ledMeters,
    lifts,
    handles,
    totalSheets: lines.reduce((n, l) => n + l.sheets, 0),
    boardsFactoryTotal,
    boardsConsumerTotal,
    factoryTotal: boardsFactoryTotal + accFactory + glassFactory,
    consumerTotal: boardsConsumerTotal + accConsumer + glassConsumer,
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
