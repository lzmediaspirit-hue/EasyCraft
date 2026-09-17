import { DRAWER, MATERIAL, drawerDepth } from '../../catalog/standards';
import { glyphDef } from '../../catalog/glyphList';
import { blindWidthMm, unitFronts, unitZones, zoneBands, zoneColumns, ZONE_LABELS } from '../../catalog/zones';
import { carcassMm, frontThicknessMm, type BuildContext } from '../../catalog/saveGate';
import { bodyHeightMm } from '../../db/types';
import type { PlacedUnit } from '../../db/types';

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

  const t = carcassMm(u, ctx);
  const ft = frontThicknessMm(u, ctx);
  const body = bodyHeightMm(u);
  const e = u.exposed ?? {};
  /* הגוף מתכווץ בעובי דופן זרה, בדיוק כמו בפירוק החלקים */
  const carcassW = u.widthMm - (e.start ? ft : 0) - (e.end ? ft : 0);
  const blind = blindWidthMm({ ...u, widthMm: carcassW });
  const innerW = Math.max(carcassW - 2 * t - blind, 0);
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
