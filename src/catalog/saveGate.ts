import { MAX_BOARD_MM, MIN_BOARD_MM, unitProblem } from './feasible';
import { glyphDef } from './glyphList';
import { constructionCaps } from './construction';
import { unitCells } from './zones';
import { MATERIAL } from './standards';
import { partThicknessMm } from '../costing/boards';
import type { PartSettings } from '../costing/boards';
import type {
  CatalogItem,
  PlacedUnit,
  Project,
  Zone,
  ZoneContent,
  ZoneKind,
} from '../db/types';

/*
 * שער השמירה.
 *
 * הכלל "אי אפשר לבנות ארגז בגובה 5 ס״מ עם רגליים של 10" היה קיים,
 * אבל הוא ישב בשער אחד בלבד — העריכה המתקדמת. עריכה מהירה, הספרייה
 * והייבוא כתבו מסביבו, וקיבלו בדיוק את אותם חלקים בגובה אפס.
 *
 * כלל שנאכף בשער אחד ונעקף בארבעה אינו כלל. כאן הוא יושב פעם אחת,
 * יחד עם שני הדברים שהיו מפוזרים לצידו: מהו עובי הלוח בפועל, ומה
 * הגבולות של המידה כשהמוצר אינו ארגז.
 */

/** מה שצריך כדי לדעת מאיזה חומר הארגז הזה נבנה בפועל. */
export interface BuildContext {
  parts?: PartSettings;
  project?: Project;
}

/**
 * עובי הגוף בפועל.
 *
 * כל שער חישב אותו לעצמו, ומי שלא קיבל הגדרות נפל לעובי התקן —
 * ואז הבדיקה רצה על 18 מ״מ בזמן שהארגז נחתך מ-22. מקום אחד.
 */
export function carcassMm(
  u: Pick<PlacedUnit, 'glyph'> & Partial<PlacedUnit>,
  ctx: BuildContext = {},
): number {
  return ctx.parts
    ? partThicknessMm(u as PlacedUnit, 'carcass', ctx.parts, ctx.project)
    : MATERIAL.carcassMm;
}

/**
 * עובי החזית של הארגז הזה, או אפס כשאין לו חזית.
 *
 * ארגז פתוח ונישה למכשיר אינם מקבלים תוספת, וגם מגירה פנימית
 * אינה חזית: היא יושבת מאחורי הדלת.
 */
export function frontThicknessMm(
  u: Pick<PlacedUnit, 'glyph'> & Partial<PlacedUnit>,
  ctx: BuildContext = {},
): number {
  const hasFronts =
    (u.doors ?? 0) > 0 ||
    unitCells(u as PlacedUnit).some(
      ({ content: c }) => c.kind === 'drawers' && c.drawerStyle !== 'inner',
    );
  if (!hasFronts) return 0;
  return ctx.parts
    ? partThicknessMm(u as PlacedUnit, 'front', ctx.parts, ctx.project)
    : MATERIAL.frontMm;
}

/**
 * העומק כפי שנמדד בשטח — מהקיר עד פני הדלת.
 *
 * מה שנשמר הוא תמיד עומק הגוף, כי זו המידה שממנה נחתכות הדפנות.
 * מה שנמדד בשטח הוא הגוף ועוד החזית. ההמרה בין השניים ישבה בעורך
 * בלבד, ולכן פעולת "עומק אחיד" כתבה עומק גוף לתוך שדה שהבטיח
 * "כולל חזית": מי שבחר 45 ס״מ ראה אחר כך 46.8 בעריכה המהירה.
 * שתי הדרכים עוברות מכאן, ולכן הן אינן יכולות לא להסכים.
 */
export function overallDepthMm(
  u: Pick<PlacedUnit, 'glyph' | 'depthMm'> & Partial<PlacedUnit>,
  ctx: BuildContext = {},
): number {
  return u.depthMm + frontThicknessMm(u, ctx);
}

/** הדרך ההפוכה: מהעומק שנמדד בשטח אל עומק הגוף שנשמר. */
export function bodyDepthMm(
  overallMm: number,
  u: Pick<PlacedUnit, 'glyph'> & Partial<PlacedUnit>,
  ctx: BuildContext = {},
): number {
  return Math.max(overallMm - frontThicknessMm(u, ctx), 0);
}

/** מה שאי אפשר לבנות, במשפט אחד — או `null` כשהכול תקין. */
export function checkUnit(
  u: Pick<PlacedUnit, 'glyph' | 'heightMm' | 'widthMm' | 'depthMm'> & Partial<PlacedUnit>,
  ctx: BuildContext = {},
): string | null {
  return unitProblem(u, carcassMm(u, ctx));
}

/**
 * אותה בדיקה על פריט בספרייה.
 *
 * לפריט יש מידות ברירת מחדל ולא מידות, ולכן הוא נבדק במידות שבהן
 * הוא ינחת. פריט שאי אפשר להניח אינו פריט תקין בספרייה.
 */
export function checkItem(
  item: Pick<CatalogItem, 'glyph' | 'defaultWidthMm' | 'defaultHeightMm' | 'defaultDepthMm'> &
    Partial<CatalogItem>,
  ctx: BuildContext = {},
): string | null {
  return checkUnit(
    {
      glyph: item.glyph,
      widthMm: item.defaultWidthMm,
      heightMm: item.defaultHeightMm,
      depthMm: item.defaultDepthMm,
      socleMm: item.socleMm,
      /* גם אלה מידות, וגם הן היו יכולות להגיע שליליות או כ-NaN */
      counterMm: item.counterMm,
      yMm: item.defaultYMm,
      carcassMaterialId: item.carcassMaterialId,
    },
    ctx,
  );
}

/**
 * הגבולות של שדה מידה, לפי מה שהמוצר הוא.
 *
 * "גובה" של ארגז ו"גובה" של מדף הם שני דברים: באחד זה המרחק בין
 * הרצפה לתקרה שלו, ובשני זה עובי הלוח. מינימום של 50 מ״מ שהוחל על
 * שניהם הפך מדף של 30 מ״מ ל-50 בלי לומר מילה — הטופס "תיקן" מידה
 * תקינה לגמרי.
 */
export interface Limits {
  /** התווית של שדה הגובה — "גובה" או "עובי הלוח" */
  heightLabel: string;
  heightHint?: string;
  minHeightMm: number;
  /** תקרה לשדה הגובה. קיימת ללוח בלבד — לארגז אין גובה מרבי */
  maxHeightMm?: number;
  minWidthMm: number;
  minDepthMm: number;
  /** לוח בודד נמדד במ״מ: 18 ו-22 בסנטימטרים הם 1.8 ו-2.2 */
  heightInMm: boolean;
}

export function limitsFor(glyph: string): Limits {
  const def = glyphDef(glyph);
  if (def.noCarcass) {
    return {
      heightLabel: 'עובי הלוח',
      heightHint: 'מ״מ',
      minHeightMm: def.thinBoard ? MIN_BOARD_MM : 1,
      /* לשולחן אין תקרת עובי — המידה שלו היא הגובה מהרצפה */
      maxHeightMm: def.thinBoard ? MAX_BOARD_MM : undefined,
      minWidthMm: 50,
      minDepthMm: 50,
      heightInMm: true,
    };
  }
  return {
    heightLabel: 'גובה',
    minHeightMm: 50,
    minWidthMm: 50,
    minDepthMm: 50,
    heightInMm: false,
  };
}

/**
 * מה קורה לפנים הארון כשמחליפים את סוג המוצר.
 *
 * החלפת "שלוש מגירות" ל"דלתות" עדכנה את האיור וכתבה מספר דלתות,
 * והאזורים נשארו מגירות: הארון המשיך להיחתך ולהיראות כמו מגירות,
 * והטופס הראה דלתות. המרה שקטה כזאת גרועה משתי האפשרויות — היא
 * לא שינתה את מה שהובטח ולא אמרה שלא שינתה.
 *
 * ההמרה מפורשת: תוכן שהסוג החדש אינו יודע לבנות הופך למה שהוא כן
 * יודע — מדפים אם יש לו, וחלל ריק אם אין — והמשפט שחוזר אומר מה
 * בדיוק השתנה, כדי שהמסך יוכל לומר את זה לפני השמירה.
 */
export interface Conversion {
  /** האזורים החדשים, או `undefined` כשאין מה לשנות */
  zones?: Zone[];
  /** מה השתנה, בעברית — או `null` כשהמעבר אינו נוגע בתוכן */
  note: string | null;
}

export function convertZones(
  u: Pick<PlacedUnit, 'glyph'> & { zones?: Zone[] },
  nextGlyph: string,
): Conversion {
  if (nextGlyph === u.glyph || !u.zones?.length) return { note: null };
  /*
   * מה שהסוג החדש יודע לבנות — ולא מה שהאיור שלו מצייר.
   *
   * `glyphDef` כאן הפך החלפת איור להמרת תוכן: ארגז מגירות שקיבל
   * איור של דלתות איבד את המגירות, כי `doors` אינו "מצייר" מגירות.
   * גוף ארון הוא גוף ארון, ובו הכול נשאר; מה שבאמת מרוקן את הפנים
   * הוא מעבר ללוח בודד או למכשיר קנוי, והוא נעצר למעלה.
   */
  const next = constructionCaps(nextGlyph);
  /* לוח בודד ומכשיר קנוי אינם מכילים תוכן: מה שהיה בפנים יורד */
  if (next.noCarcass || next.standalone) {
    return { zones: [], note: 'החלוקה הפנימית יורדת — למוצר הזה אין פנים.' };
  }

  const fallback: ZoneKind = next.shelves ? 'shelves' : 'empty';
  let moved = 0;
  /* התוכן יושב על האזור עצמו, וגם על כל עמודה שבתוכו */
  const retarget = <T extends ZoneContent>(c: T): T => {
    if (c.kind === 'drawers' && !next.drawers) {
      moved += 1;
      return { ...c, kind: fallback, drawers: undefined, drawerCols: undefined };
    }
    if (c.kind === 'shelves' && !next.shelves) {
      moved += 1;
      return { ...c, kind: 'empty', shelves: undefined, shelfGapsMm: undefined };
    }
    return c;
  };
  const zones = u.zones.map((z) => {
    const base = retarget(z);
    return base.columns?.length ? { ...base, columns: base.columns.map(retarget) } : base;
  });
  if (!moved) return { note: null };
  const to = fallback === 'shelves' ? 'מדפים' : 'חלל ריק';
  return {
    zones,
    note:
      moved === 1
        ? `אזור אחד בפנים הארון הומר ל${to}, כי הסוג החדש אינו בונה אותו.`
        : `${moved} אזורים בפנים הארון הומרו ל${to}, כי הסוג החדש אינו בונה אותם.`,
  };
}

/**
 * מה שנזרק כשמנסים לכתוב מה שאי אפשר לבנות.
 *
 * המסכים בודקים לפני ואומרים את המשפט למשתמש; הזריקה היא הגבול
 * האחרון, למי שכתב מסביב לשער. סוג משלו כדי שאפשר יהיה להבדיל
 * בינה לבין תקלה אמיתית.
 */
export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildError';
  }
}
