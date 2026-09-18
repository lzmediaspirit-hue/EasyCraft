import { alongWallMm } from '../../db/types';
import { cm } from '../../ui/units';
import { physicalHeightMm } from './placement';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * הסרגל: המרחק הפנוי בין שני דברים שנבחרו על הקיר.
 *
 * "כמה נשאר מהארון עד הפינה" היא שאלה שנשאלת בשטח לא פחות מ"כמה
 * בין שני הארונות", ולכן גם פינה, גם קצה של הקיר וגם חלון, דלת או
 * עמוד נבחרים בדיוק כמו ארגז — כל אחד עם מזהה משלו, שאינו יכול
 * להתנגש במזהה אמיתי.
 *
 * הכול יושב כאן ולא בתוך ציור הקיר: מדידה היא עבודה בפני עצמה,
 * ומי שמתקן אותה לא צריך לעבור דרך גרירת ארגזים.
 */

const CORNER_START = 'corner:start';
const CORNER_END = 'corner:end';
/** קצוות הסרגל האנכי: הרצפה והתקרה, כמו שהפינות הן קצוות האופקי. */
const EDGE_FLOOR = 'edge:floor';
const EDGE_CEILING = 'edge:ceiling';

/** מה הסרגל מודד — מרווח לרוחב הקיר או לגובהו. */
export type RulerAxis = 'w' | 'h';

/**
 * מה נמדד בין שני הדברים שנבחרו.
 *
 * `gap` לבדו הטעה: שתי יחידות ברוחב 600 שמתחילות ב-0 וב-500
 * החזירו `from=500, to=600, gap=0`, והסרגל צייר קו באורך 100 מ״מ
 * ותייג אותו אפס. קו חיובי שכתוב עליו אפס הוא מדידה שאי אפשר
 * לסמוך עליה.
 *
 * לכן המצב מפורש: מרווח, מגע, או חפיפה — וגודל החפיפה נאמר בשמה.
 * חפיפה כאן היא בהיטל שנמדד בלבד; שני ארגזים בגבהים שונים יכולים
 * לחפוף לרוחב ולא להיפגש בחדר.
 */
export type RulerKind = 'gap' | 'touch' | 'overlap';

export interface RulerSpan {
  from: number;
  to: number;
  /** המרווח הפנוי. אפס במגע ובחפיפה. */
  gap: number;
  /** גודל החפיפה בהיטל. אפס כשאין. */
  overlapMm: number;
  kind: RulerKind;
  mid: number;
}

/** מה שכתוב על הקו: מרווח במספר, מגע בשמו, וחפיפה בשמה ובגודלה. */
export function rulerLabel(span: RulerSpan): string {
  if (span.kind === 'touch') return 'צמוד';
  if (span.kind === 'overlap') return `חפיפה ${cm(span.overlapMm)}`;
  return cm(span.gap);
}

/** גובה מהרצפה אל קואורדינטת הציור, שבה y יורד. */
type Flip = (yFromFloor: number) => number;

/**
 * המרווח הפנוי בין שני הדברים שנבחרו.
 *
 * נמדד מהפאה הפנימית של האחד לפאה הפנימית של השני — זה המרווח
 * שבאמת קיים על הקיר, ולא המרחק בין נקודות ההתחלה שלהם.
 */
export function rulerSpan(
  wall: Wall,
  units: PlacedUnit[],
  picked: string[] | null | undefined,
  axis: RulerAxis,
): RulerSpan | null {
  if (!picked || picked.length < 2) return null;
  /*
   * קצה הסרגל הוא ארגז, סימון על הקיר, או קצה של הקיר. קצה הוא
   * נקודה ולא מלבן, ולכן שתי הפאות שלו זהות — וכל השאר מתנהג
   * בדיוק אותו דבר. `near` ו-`far` הן שתי הפאות בציר הנמדד,
   * ו-`mid` הוא המרכז בציר השני — שם הסרגל יצויר.
   */
  const at = (id: string) => {
    const f = wall.features.find((x) => x.id === id);
    const u = units.find((x) => x.id === id);
    if (axis === 'w') {
      if (id === CORNER_START) return { near: 0, far: 0, mid: wall.heightMm / 2 };
      if (id === CORNER_END) {
        return { near: wall.lengthMm, far: wall.lengthMm, mid: wall.heightMm / 2 };
      }
      if (f) return { near: f.xMm, far: f.xMm + f.widthMm, mid: f.yMm + f.heightMm / 2 };
      return u ? { near: u.xMm, far: u.xMm + alongWallMm(u), mid: u.yMm + u.heightMm / 2 } : null;
    }
    if (id === EDGE_FLOOR) return { near: 0, far: 0, mid: wall.lengthMm / 2 };
    if (id === EDGE_CEILING) {
      return { near: wall.heightMm, far: wall.heightMm, mid: wall.lengthMm / 2 };
    }
    if (f) return { near: f.yMm, far: f.yMm + f.heightMm, mid: f.xMm + f.widthMm / 2 };
    return u
      ? { near: u.yMm, far: u.yMm + physicalHeightMm(u), mid: u.xMm + alongWallMm(u) / 2 }
      : null;
  };

  const [a, b] = picked.map(at);
  if (!a || !b) return null;
  /*
   * חיתוך שני הקטעים, ולא "הקצה של הראשון עד ההתחלה של השני".
   *
   * הביטוי הישן הוא אורך החפיפה רק כששני הקטעים חותכים זה את זה
   * מהצד. כשאחד מוכל בשני — ארון 100 ס״מ ומעליו ארונית 20 —
   * הוא נתן 90 במקום 20, ובהתחלה משותפת התשובה השתנתה לפי סדר
   * הבחירה. הנוסחה הזאת נכונה בכל המקרים ואינה תלויה בסדר.
   */
  const lo = Math.max(a.near, b.near);
  const hi = Math.min(a.far, b.far);
  const overlapMm = Math.max(hi - lo, 0);
  const gap = Math.max(lo - hi, 0);
  return {
    /* הקטע המצויר הוא בדיוק מה שנמדד: הרווח, או החפיפה */
    from: Math.min(lo, hi),
    to: Math.max(lo, hi),
    gap,
    overlapMm,
    kind: overlapMm > 0 ? 'overlap' : gap > 0 ? 'gap' : 'touch',
    mid: Math.round((a.mid + b.mid) / 2),
  };
}

/**
 * יעדי המדידה: הסימונים שעל הקיר, וקצוות הקיר עצמו.
 *
 * מצוירים רק כשהסרגל פתוח — מלבן על כל סימון, ורצועה דקה בכל קצה,
 * רחבים מספיק כדי לפגוע בהם באצבע.
 */
export function RulerTargets({
  wall,
  axis,
  picked,
  stroke,
  flip,
  onPick,
}: {
  wall: Wall;
  axis: RulerAxis;
  picked: string[];
  stroke: number;
  flip: Flip;
  onPick: (id: string) => void;
}) {
  const band = Math.max(wall.lengthMm / 50, 60);
  const vertical = axis === 'w';
  const edges = vertical
    ? [
        { id: CORNER_START, at: 0 },
        { id: CORNER_END, at: wall.lengthMm },
      ]
    : [
        { id: EDGE_FLOOR, at: wall.heightMm },
        { id: EDGE_CEILING, at: 0 },
      ];

  /** צבע היעד: מסומן בולט, לא מסומן מקווקו */
  const paint = (on: boolean, faint = false) => ({
    fill: '#0f766e',
    fillOpacity: on ? 0.35 : faint ? 0.06 : 0.1,
    stroke: '#0f766e',
    strokeWidth: on ? stroke * 1.4 : stroke * 0.7,
    strokeDasharray: on ? undefined : `${stroke * 3} ${stroke * 3}`,
  });
  const grab = (id: string) => ({
    className: 'cursor-pointer',
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      onPick(id);
    },
  });

  return (
    <>
      {/*
        הסימון עצמו הופך ליעד: אותו מלבן שכבר מצויר, רק שעכשיו אפשר
        לפגוע בו. הוא חיוור יותר מרצועת הפינה, כי הוא יושב על ציור
        קיים ולא על שטח ריק.
      */}
      <g>
        {wall.features.map((f) => (
          <rect
            key={`ruler-${f.id}`}
            data-feature-id={f.id}
            x={f.xMm}
            y={flip(f.yMm + Math.max(f.heightMm, 90))}
            width={Math.max(f.widthMm, 90)}
            height={Math.max(f.heightMm, 90)}
            {...paint(picked.includes(f.id), true)}
            {...grab(f.id)}
          />
        ))}
      </g>

      <g>
        {edges.map((t) => (
          <rect
            key={t.id}
            data-corner={t.id}
            x={vertical ? (t.at === 0 ? 0 : t.at - band) : 0}
            y={vertical ? 0 : t.at === 0 ? 0 : t.at - band}
            width={vertical ? band : wall.lengthMm}
            height={vertical ? wall.heightMm : band}
            {...paint(picked.includes(t.id))}
            {...grab(t.id)}
          />
        ))}
      </g>
    </>
  );
}

/**
 * המידה עצמה: קו בין שני הקצוות, שני סימני קצה, ומספר.
 *
 * אותו ציור בדיוק בשני הצירים, רק מסובב — ולכן הוא נכתב פעם אחת
 * ומקבל את הכיוון כפרמטר.
 */
export function RulerMeasure({
  span,
  axis,
  wall,
  stroke,
  flip,
}: {
  span: RulerSpan;
  axis: RulerAxis;
  wall: Wall;
  stroke: number;
  flip: Flip;
}) {
  /* חפיפה אינה מרווח, ולכן היא גם אינה נראית כמוהו */
  const line = {
    stroke: span.kind === 'overlap' ? '#b91c1c' : '#0f766e',
    strokeWidth: stroke * 1.4,
  };
  const across = axis === 'w';
  const main = across
    ? { x1: span.from, y1: flip(span.mid), x2: span.to, y2: flip(span.mid) }
    : { x1: span.mid, y1: flip(span.from), x2: span.mid, y2: flip(span.to) };
  const tick = (at: number) =>
    across
      ? { x1: at, y1: flip(span.mid) - 90, x2: at, y2: flip(span.mid) + 90 }
      : { x1: span.mid - 90, y1: flip(at), x2: span.mid + 90, y2: flip(at) };

  return (
    <g pointerEvents="none">
      <line {...main} {...line} />
      {/* שני הקצוות עשויים ליפול על אותה נקודה כשאין מרווח בכלל */}
      {[span.from, span.to].map((at, i) => (
        <line key={i} {...tick(at)} {...line} />
      ))}
      {/*
        לרוחב התווית יושבת מעל הקו; לגובה היא יושבת לצידו, כי מעליו
        היא נופלת על הארגז.
      */}
      <text
        x={across ? (span.from + span.to) / 2 : span.mid + 130}
        y={across ? flip(span.mid) - 130 : flip((span.from + span.to) / 2)}
        textAnchor={across ? 'middle' : undefined}
        dominantBaseline={across ? undefined : 'middle'}
        fontSize={Math.max(wall.lengthMm / 34, 95)}
        fontWeight={600}
        fill={span.kind === 'overlap' ? '#b91c1c' : '#0f766e'}
        direction="ltr"
      >
        {rulerLabel(span)}
      </text>
    </g>
  );
}
