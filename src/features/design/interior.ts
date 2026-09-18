import { DRAWER, MATERIAL, drawerDepth } from '../../catalog/standards';
import { glyphDef } from '../../catalog/glyphList';
import { blindSide, blindWidthMm, unitFronts, unitZones, zoneBands, zoneCells, zoneColumns, ZONE_LABELS } from '../../catalog/zones';
import { carcassMm, frontThicknessMm, type BuildContext } from '../../catalog/saveGate';
import { bodyHeightMm } from '../../db/types';
import type { PlacedUnit, ZoneContent, ZoneKind } from '../../db/types';

/**
 * המידות הפנימיות הנקיות של ארגז.
 *
 * "מה נכנס לתא הזה" היא השאלה שנגר שואל בכל ארון, ועד כאן לא
 * הייתה לה תשובה: כפתור המדידה החליף בין רוחב, גובה ועומק של
 * הארגז *כולו*, ומצב פנים רק הסיר את החזיתות. מי שרצה לדעת כמה
 * נשאר בין הדפנות חישב את זה בראש.
 *
 * מה שנגזר כאן נגזר מאותו מפרט שממנו נחתכים החלקים — אותו עובי
 * לוח, אותם אזורים, אותה פינה מתה — ולכן המספר שעל המסך הוא
 * המספר שיֵצא מהמסור. חישוב נפרד היה נותן שני מספרים לאותו ארון.
 *
 * ומה שאין עליו נתון אינו מנוחש: מידות מנגנון שלא הוזנו מדווחות
 * כחסרות במקום להופיע כמידה מדויקת.
 *
 * שתי פונקציות כאן, ושתיהן מאותו מפרט: `interiorCells` מציירת את
 * התאים על הדו־ממד — זה מה שכפתור "מידות פנימיות" מדליק —
 * ו-`interiorDims` נותנת את הרשימה המלאה במילים, כולל מגירות,
 * מדפים וחזיתות. הרשימה אינה מוצגת כרגע בשום מסך: הגיליון שהציג
 * אותה ירד, והחישוב נשאר כי הוא נכון ומכוסה בבדיקות (l157).
 */

/** מידה פנימית אחת, בשמה ובמה שהיא מודדת. */
export interface ClearSpan {
  /** מה נמדד, במילים של נגר */
  label: string;
  /** באיזה ציר */
  axis: 'width' | 'height' | 'depth';
  mm: number;
  /** הסבר קצר, כשהמידה אינה מובנת מאליה */
  note?: string;
}

/** גובה התא הנקי: גובה האזור פחות הלוח שמפריד אותו מהבא. */
function clearHeight(bandMm: number, t: number): number {
  return Math.max(bandMm - t, 0);
}

/**
 * מה שגוזר את הפנים מהגוף, פעם אחת לשתי הפונקציות.
 *
 * הרשימה והציור חייבים לומר את אותו מספר, ולכן הם אינם מחשבים
 * אותו פעמיים: עובי הלוח, הגוף שמתכווץ בדופן זרה, הפינה המתה,
 * והרוחב הנקי שנשאר — כולם כאן.
 */
function carcassInner(u: PlacedUnit, ctx: BuildContext) {
  const t = carcassMm(u, ctx);
  const ft = frontThicknessMm(u, ctx);
  /* הגוף מתכווץ בעובי דופן זרה, בדיוק כמו בפירוק החלקים */
  const e = u.exposed ?? {};
  const carcassW = u.widthMm - (e.start ? ft : 0) - (e.end ? ft : 0);
  const blind = blindWidthMm({ ...u, widthMm: carcassW });
  return {
    t,
    blind,
    innerW: Math.max(carcassW - 2 * t - blind, 0),
    body: bodyHeightMm(u),
    /* הפינה המתה יושבת בקצה החסום, ולכן הפנים מתחיל אחריה */
    startMm: (blindSide(u) === 'blindStart' ? blind : 0) + t,
  };
}

/**
 * המידות הפנימיות של הארגז הנבחר.
 *
 * הסדר הוא הסדר שבו נגר מודד: רוחב, ואז תא־תא מלמטה למעלה, ואז
 * העומק השימושי והחזיתות.
 */
export function interiorDims(u: PlacedUnit, ctx: BuildContext = {}): ClearSpan[] {
  const def = glyphDef(u.glyph);
  if (def.standalone) {
    return [{
      label: 'מכשיר שנקנה שלם',
      axis: 'width',
      mm: u.widthMm,
      note: 'המידות הן של היצרן, ואין בו פנים שנבנה כאן.',
    }];
  }
  if (def.noCarcass) {
    return [
      { label: 'רוחב הלוח', axis: 'width', mm: u.widthMm },
      { label: 'עומק הלוח', axis: 'depth', mm: u.depthMm },
    ];
  }

  const { t, blind, innerW, body } = carcassInner(u, ctx);
  const back = u.backKind === 'none' ? 0 : MATERIAL.backMm;

  const out: ClearSpan[] = [
    {
      label: 'רוחב נקי בין הדפנות',
      axis: 'width',
      mm: innerW,
      note: blind > 0 ? `אחרי פינה מתה ברוחב ${Math.round(blind)} מ״מ` : undefined,
    },
    { label: 'עומק שימושי עד הגב', axis: 'depth', mm: Math.max(u.depthMm - back, 0) },
  ];

  const zones = unitZones(u);
  const bands = zoneBands(zones, body);
  bands.forEach(({ zone, top, bottom }, i) => {
    const bandMm = bottom - top;
    const name = `תא ${i + 1} — ${ZONE_LABELS[zone.kind]}`;
    const cols = zoneColumns(zone);
    if (cols.length > 1) {
      /*
       * קושרת: הרוחב הנקי של תא אינו רוחב האזור חלקי מספר
       * העמודות — בין כל שתי עמודות עומדת מחיצה, והיא גוזלת
       * את עוביה מהתאים משני צדדיה.
       */
      const dividers = (cols.length - 1) * t;
      const share = (innerW - dividers) / cols.length;
      out.push({
        label: `${name}: רוחב נקי לכל תא`,
        axis: 'width',
        mm: Math.max(share, 0),
        note: `${cols.length} עמודות, ${cols.length - 1} מחיצות בעובי ${Math.round(t)} מ״מ`,
      });
    }
    out.push({
      label: `${name}: גובה נקי`,
      axis: 'height',
      mm: clearHeight(bandMm, t),
    });
    /* מדפים בתוך התא מחלקים אותו שוב */
    const shelves = zone.shelves ?? 0;
    if (zone.kind === 'shelves' && shelves > 0) {
      const gap = (clearHeight(bandMm, t) - shelves * t) / (shelves + 1);
      out.push({
        label: `${name}: מרווח בין מדפים`,
        axis: 'height',
        mm: Math.max(gap, 0),
        note: `${shelves} מדפים בעובי ${Math.round(t)} מ״מ`,
      });
    }
    /* מגירה: פנים התיבה, ולא פתח התא */
    const drawers = zone.drawers ?? 0;
    if (zone.kind === 'drawers' && drawers > 0) {
      const boxW = Math.max(innerW - 2 * DRAWER.sideClearMm - 2 * DRAWER.woodMm, 0);
      const boxD = drawerDepth(u.depthMm, back);
      out.push({ label: `${name}: רוחב פנים המגירה`, axis: 'width', mm: boxW });
      out.push({
        label: `${name}: עומק תיבת המגירה`,
        axis: 'depth',
        mm: boxD,
        note: `מסילה תקנית ${boxD} מ״מ`,
      });
      out.push({
        label: `${name}: גובה פנים המגירה`,
        axis: 'height',
        mm: DRAWER.sideHeightMm,
        note: 'גובה דופן תיבה תקני',
      });
    }
  });

  /* והחזיתות: מה שרואים, ומה שנחתך */
  for (const [i, f] of unitFronts({ ...u, heightMm: body }, body).entries()) {
    out.push({
      label: `חזית ${i + 1}: גובה`,
      axis: 'height',
      mm: f.toMm - f.fromMm,
      note: f.doors > 1 ? `${f.doors} דלתות` : undefined,
    });
  }
  return out;
}

/**
 * תא פנימי אחד, במקום שהוא תופס על החזית.
 *
 * `interiorDims` נותנת רשימה לקריאה; זו נותנת גאומטריה לציור.
 * שתיהן נגזרות מאותו מפרט — אותו עובי לוח, אותם אזורים, אותה
 * פינה מתה — ולכן המספר שעל הציור והמספר שברשימה הם אותו מספר.
 *
 * המידות הן ביחס לארגז עצמו: `xMm` מתחילתו לאורך הקיר, ו-`yMm`
 * מתחתיתו כלפי מעלה. המסך מוסיף את מיקום הארגז.
 */
export interface InteriorCell {
  xMm: number;
  yMm: number;
  /** הרוחב הנקי בין הדפנות, בין קושרות, או בין מגירות שזו לצד זו */
  widthMm: number;
  /** הגובה הנקי של התא הזה — בין מדף למדף, או של שורת מגירה אחת */
  heightMm: number;
  /** מה יושב בו, כדי שהתווית תדע על מה היא מדברת */
  kind: ZoneKind;
}

/**
 * החלוקה היחסית של המרווחים בין המדפים.
 *
 * `shelfGapsMm` נשמר כרשימה של מרווחים, והוא נקרא יחסית ולא
 * במילימטרים — בדיוק כפי שהציור קורא אותו. מי שלא קבע מרווחים
 * מקבל חלוקה שווה.
 */
function gapShares(gaps: number[] | undefined, count: number): number[] {
  if (gaps && gaps.length === count) {
    const total = gaps.reduce((a, b) => a + b, 0);
    if (total > 0) return gaps.map((g) => g / total);
  }
  return Array.from({ length: count }, () => 1 / count);
}

/**
 * תא אחד, מחולק למה שבאמת יושב בו.
 *
 * "מידה פנימית" של תא עם ארבעה מדפים אינה מספר אחד — היא חמישה
 * מרווחים, וזה מה שנגר מודד כשהוא שואל מה נכנס לכאן. הגובה הנקי
 * של התא כולו הוא מה שהוצג עד כאן, והוא לא ענה על השאלה.
 *
 * המדפים גוזלים את עוביים מהגובה הפנוי, המגירות מחלקות אותו
 * לשורות שוות, והקושרת שבתוך תא מגירות מחלקת את הרוחב — הכול
 * כמו בציור עצמו, ולא בקירוב שלו.
 */
function splitCell(
  content: ZoneContent,
  xMm: number,
  yMm: number,
  widthMm: number,
  clearH: number,
  t: number,
): InteriorCell[] {
  const kind = content.kind;
  const whole = [{ xMm, yMm, widthMm, heightMm: clearH, kind }];

  if (kind === 'shelves') {
    const shelves = content.shelves ?? 0;
    if (shelves < 1) return whole;
    const free = clearH - shelves * t;
    if (free <= 0) return whole;
    const out: InteriorCell[] = [];
    let y = yMm;
    for (const share of gapShares(content.shelfGapsMm, shelves + 1)) {
      const heightMm = free * share;
      out.push({ xMm, yMm: y, widthMm, heightMm, kind });
      y += heightMm + t;
    }
    return out;
  }

  if (kind === 'drawers') {
    const rows = content.drawers ?? 0;
    if (rows < 1) return whole;
    /*
     * מגירות זו לצד זו אינן מופרדות בלוח — כל אחת על המסילות שלה,
     * וכך הן גם נחתכות. לכן הרוחב מתחלק בלי לחסר עובי.
     */
    const cols = Math.max(content.drawerCols ?? 1, 1);
    const rowH = clearH / rows;
    const colW = widthMm / cols;
    const out: InteriorCell[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        out.push({ xMm: xMm + c * colW, yMm: yMm + r * rowH, widthMm: colW, heightMm: rowH, kind });
      }
    }
    return out;
  }

  return whole;
}

/**
 * התאים הנקיים של ארגז, לציור על החזית.
 *
 * מכשיר שנקנה שלם ולוח בודד מוחזרים ריקים: אין להם פנים שנבנה
 * כאן, ומידה פנימית עליהם הייתה המצאה.
 */
export function interiorCells(u: PlacedUnit, ctx: BuildContext = {}): InteriorCell[] {
  const def = glyphDef(u.glyph);
  if (def.standalone || def.noCarcass) return [];

  const { t, innerW, body, startMm } = carcassInner(u, ctx);
  const socle = u.socleMm ?? 0;

  const out: InteriorCell[] = [];
  for (const { zone, top, bottom } of zoneBands(unitZones(u), body)) {
    const clearH = clearHeight(bottom - top, t);
    if (clearH <= 0) continue;
    /* הגבהים בציור נמדדים מלמעלה; התא נמדד מתחתית הגוף */
    const yMm = socle + (body - bottom);
    /*
     * `zoneCells` מחזירה תא אחד לאזור בלי קושרת, ותא לכל עמודה
     * כשיש — ולכן אותו לולאה משרתת את שני המקרים. החלק היחסי הוא
     * זה שנשמר בעמודה, ולא חלוקה שווה: קושרת שהוזזה הוזזה גם כאן.
     */
    const cells = zoneCells(zone);
    const usable = innerW - (cells.length - 1) * t;
    if (usable <= 0) continue;
    let x = startMm;
    for (const { content, share } of cells) {
      const widthMm = usable * share;
      if (widthMm > 0) out.push(...splitCell(content, x, yMm, widthMm, clearH, t));
      x += widthMm + t;
    }
  }
  return out;
}
