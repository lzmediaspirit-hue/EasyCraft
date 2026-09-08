import { glyphDef } from '../catalog/glyphList';
import { nestParts, type NestResult, type PartGrain } from './nesting';
import { DRAWER, MATERIAL, drawerDepth } from '../catalog/standards';
import {
  countDrawers,
  countShelves,
  unitCells,
  unitFronts,
  unitZones,
  zoneCells,
} from '../catalog/zones';
import { materialForRole } from '../db/types';
import type {
  Material,
  PartChoice,
  PartRole,
  PlacedUnit,
  Project,
  ProjectPrice,
  Finish,
  Settings,
} from '../db/types';

/**
 * פירוק הפרויקט לחלקים וחישוב כמות פלטות ומחיר.
 *
 * כל ארגז מפורק לחלקים אמיתיים עם מידות — זו כבר רשימת ניסור מקוצרת,
 * ולא רק סכום שטחים. עובי הכרסום נוסף לכל חלק בנפרד, כי המסור אוכל
 * חתך סביב כל חלק ולא פעם אחת בסוף.
 *
 * כמות הפלטות נגזרת מפריסה אמיתית על הלוח ולא מחלוקת שטחים: אותו
 * מנוע ניסור שמצייר את הפלטות במסך הניסור הוא זה שסופר אותן כאן,
 * ולכן שני המסכים לעולם לא סותרים זה את זה. אחוז הניצולת שבהגדרות
 * נשאר רק כרזרבה לרכש, ולא כבסיס לספירה.
 */

export interface Part {
  role: PartRole;
  /**
   * אורך הצלע שמקונטת בחלק אחד, במ"מ.
   * חזית מקונטת בכל ההיקף; חלק גוף מקונט רק בצלע הקדמית הגלויה,
   * וזו לא תמיד אותה צלע — בצד זו הצלע האנכית, במדף האופקית.
   * ריק = לא מקונט (גב, וחלקים שנשארים בפנים).
   */
  edgeMm?: number;
  /**
   * כיוון הסיבים בחלק, לפריסה על לוח עם טקסטורה.
   * `height` — הסיבים רצים לאורך `heightMm`, ולכן אסור לסובב אותו.
   * `free` — חלק פנימי שלא רואים, ומותר לסובב לניצול טוב יותר.
   */
  grain?: PartGrain;
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
}

interface BoardLine {
  /** מפתח השורה, `finishId:materialId` — לפיו נדרס המחיר בפרויקט */
  key: string;
  material: Material;
  /** הגוון שהחלקים האלה נצבעים בו — חומר אחד משמש בכמה גוונים */
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
interface AccessoryLine {
  label: string;
  qty: number;
  unit: string;
  factoryPrice: number;
  consumerPrice: number;
  factoryTotal: number;
  consumerTotal: number;
}

/** דלת זכוכית בגודל מסוים, וכמה כאלה יש בפרויקט. */
interface GlassDoorLine {
  /** דלת זכוכית או מדף זכוכית — פריטים שונים בהזמנה מהזגג */
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  areaM2: number;
  factoryTotal: number;
  consumerTotal: number;
}

/** החלקים שנחתכים מחומר וגוון מסוימים, והפריסה שלהם על הפלטות. */
interface PartGroup {
  key: string;
  material: Material;
  finish?: Finish;
  parts: Part[];
  /**
   * הפריסה בפועל. היא מחושבת כאן פעם אחת ומשמשת גם לספירת הפלטות
   * בתמחור וגם לציור במסך הניסור — אותו מספר בשני המקומות.
   */
  nest: NestResult;
}

export interface ProjectCosting {
  lines: BoardLine[];
  /** החלקים מקובצים לפי לוח וגוון, לפריסה על פלטות */
  groups: PartGroup[];
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
  /** חלקים שלא שויכו לשום לוח, ולכן אינם מתומחרים */
  unpricedParts: number;
  /** מטרים רצים של קנט */
  edgeMeters: number;
  boardsFactoryTotal: number;
  boardsConsumerTotal: number;
  /** לפני מע"מ */
  factoryTotal: number;
  consumerTotal: number;
  vatPct: number;
  vatAmount: number;
  /** מה שהלקוח משלם בפועל */
  consumerWithVat: number;
}

/* ------------------------------------------------------------------ */

/**
 * החזיתות של הארגז כפי שהן נחתכות: כל רצף והדלתות שבו.
 *
 * מגירה פנימית מוסתרת מאחורי דלת, ולכן יש חזית גם בלי שהוגדרו
 * דלתות. בנישה למכשיר החזית היא המכשיר עצמו — ערך ישן שנשאר משינוי
 * איור לא ייהפך לדלת שמישהו ישלם עליה.
 */
function doorFronts(u: PlacedUnit): { fromMm: number; toMm: number; doors: number }[] {
  if (glyphDef(u.glyph).appliance) return [];
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const hasInner = unitZones(u).some((z) => z.kind === 'drawers' && z.drawerStyle === 'inner');
  const doors = Math.max(u.doors ?? 0, hasInner ? 1 : 0);
  return unitFronts({ ...u, heightMm: h, doors }, h);
}

/** כמה לוחות חזית יש בארגז — הסכום של כל החזיתות. */
function effectiveDoors(u: PlacedUnit): number {
  return doorFronts(u).reduce((n, f) => n + f.doors, 0);
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
  /*
   * הגובה כולל את הרגליים, והגוף מתחיל מעליהן.
   * פס הסוקל עצמו אינו נספר כאן במכוון: הוא נחתך משאריות או מפרופיל
   * נפרד, ולא מהפלטות של הארון.
   */
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const d = u.depthMm;
  const t = s.carcassThicknessMm;
  const ft = MATERIAL.frontMm;

  /*
   * מכשיר חשמלי נקנה ולא נחתך: מקרר, תנור, מדיח וקולט אדים תופסים
   * מקום על הקיר, אבל אין להם חלקים בפלטות. מי שבונה סביבם עמודה
   * מוסיף אותה כארגז נפרד.
   */
  if (glyphDef(u.glyph).standalone) return [];

  // לוח בודד — נספר לפי המישור שבו הוא מונח
  const flat = glyphDef(u.glyph).noCarcass;
  if (flat) {
    return [
      {
        role: u.panelThicknessMm && u.panelThicknessMm < 10 ? 'back' : 'front',
        // לוח מונח לרוחב — הסיבים רצים לאורכו, לא לעומקו
        grain: flat === 'horizontal' ? 'width' : 'height',
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
        // בצד הצלע הגלויה היא האנכית
    parts.push({
      role: 'carcass',
      label: 'צד',
      // צד גלוי — הסיבים חייבים לרוץ במאונך, כמו בכל הארון
      grain: 'height',
      widthMm: d,
      heightMm: carcassH,
      qty: boardSides,
      edgeMm: carcassH,
    });
  }
  parts.push({
    role: 'carcass',
    label: 'תחתית ותקרה',
    // בתוך הארון לא רואים את הסיבים, ולכן מותר לסובב לניצול טוב יותר
    grain: 'free',
    widthMm: innerW,
    heightMm: d,
    qty: 2,
    edgeMm: innerW,
  });

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
        grain: 'free',
        widthMm: zoneDepth,
        heightMm: zone.heightMm,
        qty: dividers,
        edgeMm: zone.heightMm,
      });
    }

    // הקושרות אוכלות מרוחב הפנים פעם אחת, והשאר מתחלק בין התאים
    const usableW = Math.max(innerW - dividers * t, 0);
    for (const { content, share } of cells) {
      const cellDepth = zoneDepth;
      const cellW = Math.round(usableW * share);

      if (content.kind === 'shelves' && !content.glassShelves) {
        const n = content.shelves ?? 0;
        if (n > 0) {
          parts.push({
            role: 'carcass',
            label: 'מדף',
            grain: 'free',
            widthMm: cellW,
            heightMm: Math.max(cellDepth - 20, 0),
            qty: n,
            edgeMm: cellW,
          });
        }
      }

    }
  }

  // כל אזור מעל הראשון מופרד בלוח חוצץ
  if (zones.length > 1) {
    parts.push({
      role: 'carcass',
      label: 'חוצץ בין אזורים',
      grain: 'free',
      widthMm: innerW,
      heightMm: d,
      qty: zones.length - 1,
      edgeMm: innerW,
    });
  }

  // הגב: דק בחריץ, בעובי הגוף, או בכלל לא
  const backKind = u.backKind ?? 'thin';
  if (backKind !== 'none') {
    const groove = backKind === 'thin' ? s.backGrooveMm : 0;
    parts.push({
      role: backKind === 'thin' ? 'back' : 'carcass',
      label: backKind === 'thin' ? 'גב' : 'גב בעובי גוף',
      grain: 'free',
      widthMm: Math.max(carcassW - 2 * t + 2 * groove, 0),
      heightMm: Math.max(carcassH - 2 * t + 2 * groove, 0),
      qty: 1,
    });
  }

  /*
   * מגירות, תא אחר תא.
   *
   * החזית נספרת תמיד; תיבת המגירה תלויה במבנה שנבחר. מגירת עץ
   * נבנית בנגרייה — תחתית, שתי דפנות וגב — ומגירת ברזל מגיעה עם
   * דפנות מוכנות, ולכן נחתכים לה רק התחתית והגב.
   */
  const gap = s.frontGapMm;
  const boxKind = u.drawerBox ?? 'metal';
  const boxDepth = drawerDepth(d);
  for (const z of zones) {
    for (const { content, share } of zoneCells(z)) {
      if (content.kind !== 'drawers') continue;
      const rows = content.drawers ?? 1;
      const cols = Math.max(content.drawerCols ?? 1, 1);
      const qty = rows * cols;
      // רוחב פנים התיבה — רוחב התא פחות מרווח המסילה משני הצדדים
      const cellW = Math.max((innerW * share) / cols - 2 * DRAWER.sideClearMm, 0);

      if (content.drawerStyle !== 'inner') {
        parts.push({
          role: 'front',
          // חזית נראית — כיוון הסיבים חייב להיות אחיד בכל החזיתות
          grain: 'height',
          label: 'חזית מגירה',
          widthMm: Math.max((carcassW * share) / cols - gap, 0),
          heightMm: Math.max(z.heightMm / rows - gap, 0),
          qty,
        });
      }

      if (boxDepth <= 0 || cellW <= 0) continue;
      parts.push({
        role: 'carcass',
        grain: 'free',
        label: 'תחתית מגירה',
        widthMm: cellW,
        heightMm: boxDepth,
        qty,
      });
      parts.push({
        role: 'carcass',
        grain: 'free',
        label: 'גב מגירה',
        widthMm: cellW,
        heightMm: DRAWER.sideHeightMm,
        qty,
      });
      if (boxKind === 'wood') {
        parts.push({
          role: 'carcass',
          grain: 'free',
          label: 'דופן מגירה',
          widthMm: boxDepth,
          heightMm: DRAWER.sideHeightMm,
          qty: qty * 2,
        });
      }
    }
  }

  /*
   * בפינה מתה החזית יושבת רק על החלק הנגיש: מה שנחסם על ידי הארון
   * שעל הקיר הסמוך אין דרך לפתוח, ולכן גם אין שם דלת.
   */
  const blind =
    u.glyph === 'blindStart' || u.glyph === 'blindEnd'
      ? Math.min(u.blindMm ?? 300, carcassW)
      : 0;
  const frontW = Math.max(carcassW - blind, 0);
  /*
   * חזית לכל רצף, ולא דלת אחת לארגז: ארון עם דלת עליונה ודלת
   * תחתונה הוא שני לוחות בשתי מידות, וזה מה שצריך להגיע למסור.
   * דלת זכוכית אינה לוח ולכן היא נספרת בנפרד.
   */
  const fronts = doorFronts(u);
  if (!u.glassDoors && frontW > 0) {
    for (const f of fronts) {
      const doorH = f.toMm - f.fromMm;
      if (doorH <= 0) continue;
      parts.push({
        role: 'front',
        grain: 'height',
        label: 'דלת',
        widthMm: Math.max(frontW / f.doors - gap, 0),
        heightMm: Math.max(doorH - gap, 0),
        qty: f.doors,
      });
    }
  }

  // דפנות זרות במידה החיצונית המלאה, ועמוקות מהארגז.
  // ברירת המחדל מכסה חזית סטנדרטית; נגר שעובד אחרת מזין מידה משלו.
  const panelDepth = u.exposedDepthMm ?? d + MATERIAL.exposedExtraMm;
  const sideH = h;
  const panel = (heightMm: number): Part => ({
    role: 'exposed',
    grain: 'height',
    label: 'דופן זרה',
    widthMm: panelDepth,
    heightMm,
    qty: 1,
  });
  if (e.start) parts.push(panel(sideH));
  if (e.end) parts.push(panel(sideH));
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

/** חלק זכוכית בארגז — דלת או מדף — עם המידה והכמות שלו. */
interface GlassPart {
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
}

/** כל חלקי הזכוכית בארגז: דלתות ומדפים. */
function unitGlassDoors(u: PlacedUnit, s: PartSettings): GlassPart[] {
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const e = u.exposed ?? {};
  const ft = MATERIAL.frontMm;
  const carcassW = u.widthMm - (e.start ? ft : 0) - (e.end ? ft : 0);
  const t = s.carcassThicknessMm;
  const zones = unitZones({ ...u, heightMm: h });
  const out: GlassPart[] = [];

  if (u.glassDoors) {
    for (const f of doorFronts(u)) {
      const doorH = f.toMm - f.fromMm;
      if (doorH <= 0) continue;
      out.push({
        label: 'דלת זכוכית',
        widthMm: Math.round(Math.max(carcassW / f.doors - s.frontGapMm, 0)),
        heightMm: Math.round(Math.max(doorH - s.frontGapMm, 0)),
        qty: f.doors,
      });
    }
  }

  // מדף זכוכית נחתך למידת התא שהוא יושב בו
  const innerW = Math.max(carcassW - 2 * t, 0);
  for (const zone of zones) {
    const cells = zoneCells(zone);
    const usableW = Math.max(innerW - (cells.length - 1) * t, 0);
    for (const { content, share } of cells) {
      if (content.kind !== 'shelves' || !content.glassShelves) continue;
      const n = content.shelves ?? 0;
      if (n < 1) continue;
      out.push({
        label: 'מדף זכוכית',
        widthMm: Math.round(usableW * share),
        heightMm: Math.round(Math.max((zone.depthMm ?? u.depthMm) - 20, 0)),
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

/**
 * מטרי קנט בארגז.
 *
 * מקנטים את מה שנראה: היקף כל חזית — דלת או מגירה — ואת קדמת
 * החלקים של הגוף, כלומר את הצלע הגלויה של הצדדים, התחתית, התקרה,
 * המדפים והקושרות. הגב וקצוות שנשארים בפנים אינם מקונטים, ולכן
 * הם לא נספרים כאן.
 */
function unitEdgeMeters(u: PlacedUnit, s: PartSettings): number {
  let mm = 0;
  for (const p of unitParts(u, s)) {
    if (p.role === 'back') continue;
    // חזית ודופן זרה מקונטות בכל ההיקף; חלק גוף רק בצלע שסומנה כגלויה
    if (p.role === 'front' || p.role === 'exposed') mm += 2 * (p.widthMm + p.heightMm) * p.qty;
    else if (p.edgeMm) mm += p.edgeMm * p.qty;
  }
  return mm / 1000;
}

/**
 * ידיות בארגז — אחת לכל חזית נראית.
 * נספר לפי התאים ולא לפי האזורים: אזור שחולק בקושרת מחזיק את
 * המגירות בעמודות, והשדות שברמת האזור עלולים להישאר מהמצב הקודם.
 */
function unitHandles(u: PlacedUnit): number {
  if (!u.handles) return 0;
  const h = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const outerDrawers = unitCells({ ...u, heightMm: h }).reduce(
    (n, { content: c }) =>
      n +
      (c.kind === 'drawers' && c.drawerStyle !== 'inner'
        ? (c.drawers ?? 0) * Math.max(c.drawerCols ?? 1, 1)
        : 0),
    0,
  );
  return effectiveDoors(u) + outerDrawers;
}

/** מטרים רצים של פס לד בארגז. */
function unitLedMeters(u: PlacedUnit): number {
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

/**
 * הגוון והחומר שחלים על חלק מסוים בארגז.
 *
 * הארגז מנצח על הפרויקט, והפרויקט על ברירת המחדל של העסק. כך אפשר
 * לקבוע גוף אחד לכל המטבח ולשנות ארגז אחד בלי שהשאר יזוזו.
 */
export function partChoice(u: PlacedUnit, role: PartRole, project?: Project): PartChoice {
  const fromProject = project?.defaults?.[role];
  const finishId =
    role === 'carcass'
      ? u.carcassFinishId
      : role === 'front'
        ? (u.frontFinishId ?? u.finishId)
        : role === 'exposed'
          ? // דופן זרה נופלת לגוון החזיתות רק אם לא נבחר לה גוון משלה
            (u.exposedFinishId ?? u.frontFinishId ?? u.finishId)
          : u.backFinishId;
  const materialId =
    role === 'carcass'
      ? u.carcassMaterialId
      : role === 'front'
        ? u.frontMaterialId
        : role === 'exposed'
          ? (u.exposedMaterialId ?? u.frontMaterialId)
          : u.backMaterialId;
  return {
    finishId: finishId ?? fromProject?.finishId,
    materialId: materialId ?? fromProject?.materialId,
  };
}

export function projectCosting(
  units: PlacedUnit[],
  materials: Material[],
  settings: Settings,
  overrides: ProjectPrice[] = [],
  finishes: Finish[] = [],
  project?: Project,
): ProjectCosting {

  /*
   * שטח מצטבר לפי חומר וגוון.
   * נגרייה עובדת עם כמה גוונים על אותו חומר באותו פרויקט, וכל
   * צירוף מוזמן בנפרד — ולכן רשימת ההזמנה חייבת להפריד ביניהם.
   */
  const areaByKey = new Map<
    string,
    { materialId: string; finishId?: string; areaM2: number; parts: Part[] }
  >();

  /*
   * כשלא נבחר חומר לחלק — לא לארגז ולא לפרויקט — נופלים לחומר
   * סביר לפי מיקומו ברשימה: הראשון לגוף, השני לחזית, והאחרון
   * לגב. זה ניחוש, אבל הוא שומר על פרויקט ישן מתומחר במקום
   * להשאיר אותו ריק.
   */
  const fallbackMaterial = (role: PartRole): string | undefined =>
    materialForRole(role, materials)?.id;

  const resolve = (u: PlacedUnit, role: PartRole) => {
    const choice = partChoice(u, role, project);
    const finish = choice.finishId ? finishes.find((f) => f.id === choice.finishId) : undefined;
    return {
      materialId: choice.materialId ?? fallbackMaterial(role),
      finishId: finish?.id,
      finish,
    };
  };

  let drawers = 0;
  let doors = 0;
  let exposedPanels = 0;
  let ledMeters = 0;

  let lifts = 0;
  let handles = 0;
  let edgeMeters = 0;
  /** מטרי קנט לפי גוון, כדי לתמחר כל אחד במחיר שלו */
  const edgeByFinish = new Map<string, number>();
  /** חלקים שלא נמצא להם לוח — נספרים כדי שאפשר יהיה להתריע עליהם */
  let unpriced = 0;
  const glassMap = new Map<string, GlassDoorLine>();

  for (const u of units) {
    for (const part of unitParts(u, settings)) {
      // שטח נטו. הכרסום נאכל בקווי החיתוך, וזה כבר עניינו של מנוע הניסור
      const area = (part.widthMm * part.heightMm) / 1_000_000;
      const { materialId, finishId } = resolve(u, part.role);
      // אין חומרים בכלל — אין למה לשייך את החלק, ולא נעלים אותו בשקט
      if (!materialId) {
        unpriced += part.qty;
        continue;
      }
      const key = `${finishId ?? ''}:${materialId}`;
      const row = areaByKey.get(key) ?? { materialId, finishId, areaM2: 0, parts: [] };
      row.areaM2 += area * part.qty;
      row.parts.push(part);
      areaByKey.set(key, row);
    }
    /*
     * הקנט נספר לפי הגוון של החזיתות: קנט תואם ללוח הוא המצב
     * הרגיל, ולכן מטר קנט של גוון יקר עולה אחרת ממטר של גוון זול.
     */
    const um = unitEdgeMeters(u, settings);
    edgeMeters += um;
    if (um > 0) {
      const front = resolve(u, 'front');
      const k = front.finishId ?? '';
      edgeByFinish.set(k, (edgeByFinish.get(k) ?? 0) + um);
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

  // שורה לכל צירוף של גוון וחומר — כך נראית הזמנה אמיתית מהספק
  const lines: BoardLine[] = [];
  const groups: PartGroup[] = [];
  for (const [key, row] of areaByKey) {
    const material = materials.find((m) => m.id === row.materialId);
    if (!material || row.areaM2 <= 0) continue;

    const override = overrides.find((o) => o.lineKey === key);
    const finish = row.finishId ? finishes.find((f) => f.id === row.finishId) : undefined;
    // המחיר יושב בהצטלבות: אותו גוון עולה אחרת על סנדוויץ׳ ועל MDF
    const listed = finish?.prices?.[material.id];
    const factoryPrice = override?.factoryPrice ?? listed?.factoryPrice ?? 0;
    const consumerPrice = override?.consumerPrice ?? listed?.consumerPrice ?? 0;
    /*
     * כמה פלטות באמת צריך — לפי פריסה על הלוח.
     * גוון עם טקסטורה מחייב כיוון סיבים קבוע בחזיתות ובצדדים, ולכן
     * הוא כמעט תמיד יבזבז יותר מגוון חלק. זה הבדל שהנגר משלם עליו,
     * ולכן הוא צריך להופיע במחיר ולא להיעלם בתוך אחוז ניצולת.
     */
    const nest = nestParts(row.parts, {
      sheetWidthMm: material.sheetWidthMm,
      sheetHeightMm: material.sheetHeightMm,
      kerfMm: settings.kerfMm,
      hasGrain: !!finish?.hasGrain,
    });
    const sheets = nest.sheets.length;

    lines.push({
      key,
      material,
      finish,
      areaM2: row.areaM2,
      sheets,
      factoryPrice,
      consumerPrice,
      factoryTotal: sheets * factoryPrice,
      consumerTotal: sheets * consumerPrice,
      overridden: !!override,
    });
    groups.push({ key, material, finish, parts: row.parts, nest });
  }
  lines.sort((a, b) => a.material.sortOrder - b.material.sortOrder || b.areaM2 - a.areaM2);

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
  /*
   * קנט נמכר במטר רץ, ולכן הוא שורת אביזר ולא שורת פלטה — ושורה
   * לכל גוון, כי קנט תואם ללוח נקנה בגוון של הלוח ובמחיר שלו.
   */
  for (const [finishId, meters] of edgeByFinish) {
    const finish = finishId ? finishes.find((f) => f.id === finishId) : undefined;
    const factoryPrice = finish?.edgeFactoryPerM ?? settings.edgeFactoryPerM;
    const consumerPrice = finish?.edgeConsumerPerM ?? settings.edgeConsumerPerM;
    if (factoryPrice <= 0 && consumerPrice <= 0) continue;
    const qty = Math.ceil(meters);
    accessories.push({
      label: finish ? `קנט ${finish.name}` : 'קנט',
      qty,
      unit: 'מ׳',
      factoryPrice,
      consumerPrice,
      factoryTotal: qty * factoryPrice,
      consumerTotal: qty * consumerPrice,
    });
  }

  const boardsConsumerTotal = lines.reduce((n, l) => n + l.consumerTotal, 0);
  const accFactory = accessories.reduce((n, l) => n + l.factoryTotal, 0);
  const accConsumer = accessories.reduce((n, l) => n + l.consumerTotal, 0);
  const glassFactory = glass.reduce((n, g) => n + g.factoryTotal, 0);
  const glassConsumer = glass.reduce((n, g) => n + g.consumerTotal, 0);
  // מע"מ מחושב על המחיר ללקוח בלבד; מחיר המפעל הוא עלות ולא מכירה
  const consumerBeforeVat = boardsConsumerTotal + accConsumer + glassConsumer;
  const vat = Math.round(consumerBeforeVat * (settings.vatPct / 100));

  return {
    lines,
    groups,
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
    unpricedParts: unpriced,
    boardsFactoryTotal,
    boardsConsumerTotal,
    factoryTotal: boardsFactoryTotal + accFactory + glassFactory,
    edgeMeters,
    consumerTotal: consumerBeforeVat,
    vatPct: settings.vatPct,
    vatAmount: vat,
    consumerWithVat: consumerBeforeVat + vat,
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
