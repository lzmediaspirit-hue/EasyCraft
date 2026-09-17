import { blindSide, blindWidthMm, isContainer, unitFronts, zoneBands, zoneCells } from './zones';
import { autoShelves } from './construction';
import type { CornerKind, OpeningMech, Zone, ZoneContent } from '../db/types';

/**
 * מנוע האיורים של הארגזים.
 *
 * כל ארגז מצויר מתוך מפרט — דלתות, שורות ועמודות מגירות, מדפים ואופי
 * הארגז — לתוך מלבן ברוחב וגובה נתונים. אותו קוד משרת את האייקון הקטן
 * בספרייה ואת ההדמיה על הקיר, כך שמה שנבחר הוא בדיוק מה שנראה.
 *
 * במצב `inside` החזיתות מוסרות ורואים את פנים הארון: מדפים, ארגזי מגירה
 * ומוטות תלייה.
 */

export type GlyphProps = {
  glyph: string;
  /** רוחב וגובה ביחידות הציור */
  w: number;
  h: number;
  doors?: number;
  /** שורות מגירות */
  drawers?: number;
  /** עמודות מגירות — מגירות זו לצד זו ברוחב אחיד */
  drawerCols?: number;
  /** מדפים פנימיים. אם לא הוגדר, נגזר מגובה הארגז */
  shelves?: number;
  /** עובי קו ביחידות הציור */
  stroke: number;
  /** הסתרת חזיתות — תצוגת פנים הארון */
  inside?: boolean;
  /** מגירות פנימיות מסתתרות מאחורי דלתות ולא נראות בחזית */
  drawerStyle?: 'outer' | 'inner';
  /** דלתות זכוכית — מסגרת עם מילוי שקוף במקום חזית מלאה */
  glassDoors?: boolean;
  /**
   * מרווחים בין המדפים מלמטה למעלה, כולל לתחתית ולתקרה.
   * ריק = מרווחים שווים.
   */
  shelfGapsMm?: number[];
  /** חלוקת הפנים לאזורים — מגירות, מדפים ומוט תלייה באותו ארון */
  zones?: Zone[];
  /** מנגנון פתיחה, מסומן על החזית */
  opening?: OpeningMech;
  /** פינה מתה או ארגז פינתי */
  corner?: CornerKind;
  /** רוחב החלק החסום בפינה מתה */
  blindMm?: number;
  /** ידיות על החזיתות. כבוי = פתיחה בלחיצה, בלי ידית */
  handles?: boolean;
};

export function CabinetGlyph({
  glyph,
  w,
  h,
  /*
   * ריק = בלי דלתות, ולא דלת אחת.
   *
   * המספר הזה הוא אותו מספר שקורא `unitFronts` — התלת־ממד ופירוק
   * החלקים — ושם `undefined` מעולם לא היה דלת. כשהציור הניח כאן 1
   * ארגז פתוח קיבל חזית שאף אחד לא ביקש, ולא נחתכה בשום מקום.
   */
  doors = 0,
  drawers = 0,
  drawerCols = 1,
  shelves,
  stroke,
  inside = false,
  drawerStyle = 'outer',
  glassDoors = false,
  shelfGapsMm,
  zones,
  opening = 'hinge',
  corner,
  blindMm = 0,
  handles = false,
}: GlyphProps) {
  // ארגזי נגרות הם מלבנים; עיגול קל בלבד, שלא ייראה כמו רהיט מצויר
  const r = Math.min(8, Math.min(w, h) * 0.015);

  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={0} y={0} width={w} height={h} rx={r} />
      {details({
        glyph,
        w,
        h,
        doors,
        drawers,
        cols: Math.max(1, drawerCols),
        shelves: shelves ?? autoShelves(h),
        t: stroke * 0.75,
        inside,
        innerDrawers: drawerStyle === 'inner',
        glass: glassDoors,
        gaps: shelfGapsMm,
        zones,
        opening,
        corner,
        blindMm,
        handles,
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */

type Ctx = {
  glyph: string;
  w: number;
  h: number;
  doors: number;
  drawers: number;
  cols: number;
  shelves: number;
  t: number;
  inside: boolean;
  innerDrawers: boolean;
  glass: boolean;
  handles: boolean;
  gaps?: number[];
  zones?: Zone[];
  opening: OpeningMech;
  corner?: CornerKind;
  blindMm: number;
};

function details(c: Ctx) {
  const { w, h, t, inside } = c;
  const L = (x1: number, y1: number, x2: number, y2: number, key: string, dash?: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={t} strokeDasharray={dash} />
  );

  /** חזית סגורה: דלתות מלפנים, מדפים כשמסתכלים פנימה. */
  const front = (top: number, bottom: number, n: number, key = '') =>
    inside ? shelfLines(c, top, bottom, key) : doorPanels(c, top, bottom, n, key);

  /**
   * אזור מגירות. מגירה פנימית מוסתרת מאחורי דלת, ולכן בחזית מציירים
   * דלתות ורק בתצוגת הפנים רואים את ארגזי המגירה.
   */
  const drawerZone = (top: number, bottom: number, rows: number, key = '') =>
    c.innerDrawers && !inside
      ? doorPanels(c, top, bottom, Math.max(c.doors, 1), key)
      : drawerGrid(c, top, bottom, rows, c.cols);

  // ארון שחולק לאזורים מצויר מהאזורים, ולא מהשדות הפשוטים
  if (c.zones?.length && isContainer(c.glyph)) return zonedContainer(c);

  switch (c.glyph) {
    case 'blindStart':
    case 'blindEnd':
      return blindCorner(c);

    case 'lShape':
      return lShapeCorner(c);

    case 'doors':
      return front(0, h, c.doors);

    case 'drawers':
      return drawerZone(0, h, c.drawers || 3);

    case 'doorDrawer': {
      const rows = c.drawers || 1;
      const bandH = Math.min(h * 0.22, h / (rows + 1)) * rows;
      return [
        ...drawerZone(0, bandH, rows, 'dz'),
        L(0, bandH, w, bandH, 'split'),
        ...front(bandH, h, c.doors),
      ];
    }

    case 'sink': {
      const band = h * 0.24;
      return [
        L(0, band, w, band, 'split'),
        <rect key="basin" x={w * 0.2} y={band * 0.2} width={w * 0.6} height={band * 0.62}
          rx={band * 0.16} strokeWidth={t} />,
        <circle key="drain" cx={w * 0.5} cy={band * 0.51} r={Math.min(w, h) * 0.035}
          strokeWidth={t} />,
        ...front(band, h, 2),
      ];
    }

    case 'hob': {
      const band = h * 0.16;
      return [
        L(0, band, w, band, 'split'),
        ...[0.28, 0.5, 0.72].map((f, i) => (
          <circle key={`b${i}`} cx={w * f} cy={band * 0.5} r={band * 0.26} strokeWidth={t} />
        )),
        /*
         * הכיריים הן החלק העליון, ומה שמתחתיהן הוא הארגז עצמו.
         * מי שביקש ארגז פתוח בלי דלתות ובלי מגירות מקבל פתח, לא
         * חזית שהציור החליט עליה בשבילו.
         */
        ...openFront(c, band, h),
      ];
    }

    case 'oven': {
      const top = h * 0.1;
      const boxH = h * 0.58;
      return [
        <rect key="box" x={w * 0.08} y={top} width={w * 0.84} height={boxH}
          rx={w * 0.02} strokeWidth={t} />,
        L(w * 0.16, top + boxH * 0.16, w * 0.84, top + boxH * 0.16, 'handle'),
        ...drawerGrid(c, top + boxH + h * 0.04, h, 1, 1),
      ];
    }

    case 'ovenMicro': {
      const pad = w * 0.08;
      const microH = h * 0.24;
      const ovenH = h * 0.3;
      const ovenTop = h * 0.08 + microH + h * 0.03;
      return [
        <rect key="m" x={pad} y={h * 0.08} width={w - pad * 2} height={microH}
          rx={w * 0.02} strokeWidth={t} />,
        <rect key="o" x={pad} y={ovenTop} width={w - pad * 2} height={ovenH}
          rx={w * 0.02} strokeWidth={t} />,
        L(pad * 1.6, ovenTop + ovenH * 0.18, w - pad * 1.6, ovenTop + ovenH * 0.18, 'oh'),
        ...front(h * 0.08 + microH + ovenH + h * 0.08, h, 1, 'b'),
      ];
    }

    case 'fridge': {
      const split = h * 0.38;
      return [
        L(0, split, w, split, 'split'),
        L(w * 0.86, split - h * 0.11, w * 0.86, split - h * 0.02, 'h1'),
        L(w * 0.86, split + h * 0.02, w * 0.86, split + h * 0.11, 'h2'),
      ];
    }

    case 'dishwasher': {
      /*
       * מדיח, ולא מכונת כביסה.
       *
       * העיגול שהיה כאן במרכז החזית הוא דלת עגולה — כלומר מכונת
       * כביסה. למדיח דלת שטוחה שנפתחת כלפי מטה, פאנל פיקוד ברצועה
       * העליונה, וידית לרוחב. אלה שלושת הסימנים שמזהים אותו.
       */
      const strip = h * 0.16;
      return [
        L(0, strip, w, strip, 'strip'),
        L(w * 0.12, strip * 0.5, w * 0.46, strip * 0.5, 'ctrl'),
        <circle key="k" cx={w * 0.86} cy={strip * 0.5} r={Math.min(w, h) * 0.035} strokeWidth={t} />,
        L(w * 0.1, strip + h * 0.1, w * 0.9, strip + h * 0.1, 'grip'),
        ...(inside ? [] : [L(w * 0.16, h * 0.62, w * 0.84, h * 0.62, 'rack')]),
      ];
    }

    case 'micro': {
      /* דלת זכוכית ברוב הרוחב, ופאנל פיקוד ברצועה שלצידה */
      const pad = w * 0.07;
      const panel = w * 0.22;
      return [
        <rect key="door" x={pad} y={h * 0.16} width={w - pad * 2 - panel} height={h * 0.68}
          rx={w * 0.02} strokeWidth={t} />,
        L(w - pad - panel * 0.75, h * 0.24, w - pad - panel * 0.2, h * 0.24, 'p1'),
        L(w - pad - panel * 0.75, h * 0.36, w - pad - panel * 0.2, h * 0.36, 'p2'),
        <circle key="knob" cx={w - pad - panel * 0.48} cy={h * 0.62} r={Math.min(w, h) * 0.06}
          strokeWidth={t} />,
      ];
    }

    case 'hood':
      return [
        <path key="p" d={`M ${w * 0.24} ${h} L ${w * 0.34} ${h * 0.3} L ${w * 0.66} ${h * 0.3} L ${w * 0.76} ${h} Z`}
          strokeWidth={t} />,
        L(w * 0.3, h * 0.82, w * 0.7, h * 0.82, 's1'),
      ];

    case 'open':
    case 'shelves':
      return shelfLines(c, 0, h);

    case 'pantry':
      return [
        ...shelfLines(c, 0, h),
        ...(inside ? [] : [L(w * 0.94, h * 0.46, w * 0.94, h * 0.56, 'hd')]),
      ];

    case 'corner':
      return [
        <path key="c" d={`M ${w * 0.02} ${h * 0.24} L ${w * 0.34} ${h * 0.02}`} strokeWidth={t} />,
        ...front(h * 0.26, h, c.doors || 1),
      ];

    case 'carousel':
      return [
        <path key="a" d={`M ${w * 0.14} ${h * 0.86} A ${w * 0.62} ${h * 0.62} 0 0 1 ${w * 0.76} ${h * 0.24}`}
          strokeWidth={t} />,
        <circle key="d" cx={w * 0.14} cy={h * 0.86} r={Math.min(w, h) * 0.05} strokeWidth={t} />,
        ...(inside ? [] : [L(w * 0.9, h * 0.44, w * 0.9, h * 0.56, 'hd')]),
      ];

    case 'lift':
      return inside
        ? shelfLines(c, 0, h)
        : [
            <path key="a" d={`M ${w * 0.32} ${h * 0.62} A ${w * 0.2} ${h * 0.34} 0 0 1 ${w * 0.68} ${h * 0.62}`}
              strokeWidth={t} />,
            <path key="t" d={`M ${w * 0.6} ${h * 0.5} L ${w * 0.68} ${h * 0.62} L ${w * 0.56} ${h * 0.66}`}
              strokeWidth={t} />,
          ];

    case 'glass':
      return [
        <rect key="in" x={w * 0.12} y={h * 0.1} width={w * 0.76} height={h * 0.8}
          rx={w * 0.02} strokeWidth={t} />,
        ...shelfLines(c, h * 0.1, h * 0.9, 'g'),
        ...(inside
          ? []
          : [L(w * 0.22, h * 0.76, w * 0.5, h * 0.24, 'shine'),
             L(w * 0.4, h * 0.8, w * 0.62, h * 0.44, 'shine2')]),
      ];

    case 'shutter':
      return inside
        ? shelfLines(c, 0, h)
        : [0.2, 0.34, 0.48, 0.62, 0.76].map((f, i) =>
            L(w * 0.06, h * f, w * 0.94, h * f, `r${i}`),
          );

    case 'hang':
      return [L(w * 0.08, h * 0.2, w * 0.92, h * 0.2, 'rod'), ...hangers(w, h, 0.2, t)];

    case 'hangDouble':
      return [
        L(w * 0.08, h * 0.12, w * 0.92, h * 0.12, 'rod1'),
        ...hangers(w, h, 0.12, t, 'a'),
        L(w * 0.08, h * 0.56, w * 0.92, h * 0.56, 'rod2'),
        ...hangers(w, h, 0.56, t, 'b'),
      ];

    case 'sliding':
      return inside
        ? [...shelfLines(c, 0, h), L(0, h * 0.96, w, h * 0.96, 'track')]
        : [
            <rect key="p1" x={w * 0.04} y={h * 0.06} width={w * 0.5} height={h * 0.82}
              rx={w * 0.02} strokeWidth={t} />,
            <rect key="p2" x={w * 0.44} y={h * 0.1} width={w * 0.52} height={h * 0.82}
              rx={w * 0.02} strokeWidth={t} />,
            L(0, h * 0.96, w, h * 0.96, 'track'),
          ];

    case 'shoes':
      return [0.28, 0.46, 0.64, 0.82].map((f, i) =>
        L(w * 0.08, h * f, w * 0.92, h * (f - 0.09), `s${i}`),
      );

    case 'tv': {
      const unitTop = h * 0.62;
      return [
        <rect key="scr" x={w * 0.14} y={h * 0.08} width={w * 0.72} height={h * 0.4}
          rx={w * 0.02} strokeWidth={t} />,
        L(0, unitTop, w, unitTop, 'top'),
        ...(c.doors > 0 ? front(unitTop, h, c.doors) : openFront(c, unitTop, h, 'tv')),
      ];
    }

    case 'panel':
      return [0.2, 0.4, 0.6, 0.8].map((f, i) => L(w * f, h * 0.08, w * f, h * 0.92, `g${i}`));

    case 'desk':
      return [
        L(0, h * 0.3, w, h * 0.3, 'top'),
        L(w * 0.1, h * 0.3, w * 0.1, h, 'leg1'),
        L(w * 0.9, h * 0.3, w * 0.9, h, 'leg2'),
      ];

    case 'nightstand':
      return drawerZone(0, h, c.drawers || 2);

    case 'mirror':
      return inside
        ? shelfLines(c, 0, h)
        : [
            L(w * 0.2, h * 0.82, w * 0.52, h * 0.2, 'm1'),
            L(w * 0.44, h * 0.86, w * 0.7, h * 0.42, 'm2'),
          ];

    case 'innerDrawers':
      return [
        ...drawerGrid(c, h * 0.12, h * 0.88, c.drawers || 3, c.cols, true),
        ...(inside ? [] : [L(w * 0.94, h * 0.46, w * 0.94, h * 0.56, 'hd')]),
      ];

    case 'slab':
      return [L(0, h * 0.55, w, h * 0.55, 'edge')];

    case 'spacer':
      return [
        L(w * 0.14, h * 0.5, w * 0.86, h * 0.5, 'w', `${t * 4} ${t * 3}`),
        L(w * 0.14, h * 0.34, w * 0.14, h * 0.66, 'l'),
        L(w * 0.86, h * 0.34, w * 0.86, h * 0.66, 'r'),
      ];

    default:
      return front(0, h, c.doors);
  }
}

/**
 * תוכן של תא אחד — אזור שלם, או עמודה בתוך אזור עם קושרת.
 * הרוחב מגיע כפרמטר, ולכן אותו קוד משרת את שתי הרמות.
 */
function cellContent(
  c: Ctx,
  content: ZoneContent,
  cw: number,
  top: number,
  bottom: number,
  key: string,
  /** יש דלת מול התא הזה, ולכן לא רואים מה בתוכו */
  hidden = false,
): React.ReactNode {
  const { t, inside } = c;
  const cc = { ...c, w: cw };

  if (content.kind === 'drawers') {
    const rows = content.drawers ?? 1;
    const cols = Math.max(content.drawerCols ?? 1, 1);
    const inner = content.drawerStyle === 'inner';
    // מגירה פנימית נראית רק כשמסתכלים פנימה
    if (inner && !inside) return null;
    return <g key={`d-${key}`}>{drawerGrid(cc, top, bottom, rows, cols, inner && inside)}</g>;
  }

  if (hidden) return null;

  if (content.kind === 'shelves') {
    return (
      <g key={`s-${key}`}>
        {shelfLines(
          { ...cc, shelves: content.shelves ?? 0, gaps: content.shelfGapsMm },
          top,
          bottom,
          key,
          !!content.glassShelves,
        )}
      </g>
    );
  }

  if (content.kind === 'rod') {
    const rodY = top + (bottom - top) * 0.14;
    return (
      <g key={`r-${key}`}>
        <line x1={cw * 0.08} y1={rodY} x2={cw * 0.92} y2={rodY} strokeWidth={t} />
        {hangersAt(cw, rodY, (bottom - top) * 0.5, t, key)}
      </g>
    );
  }

  return null;
}


/* ------------------------------------------------------------------ */

/**
 * ארון מחולק לאזורים.
 * הפנים מצויר אזור-אזור; החזית מכסה את כל מה שאינו מגירה חיצונית,
 * בדיוק כמו בארון אמיתי.
 */
function zonedContainer(c: Ctx) {
  const { w, h, t, inside } = c;
  const bands = zoneBands(c.zones!, h);
  const out: React.ReactNode[] = [];
  /*
   * החזיתות של הארון, ומה שהן מכסות. תא שאין עליו חזית — נישה
   * פתוחה, מגירה חיצונית — נראה גם כשמסתכלים מלפנים, כי אין שם
   * דלת שתסתיר אותו.
   */
  const fronts = c.doors > 0 ? unitFronts({ ...c, heightMm: h }, h) : [];
  const behindDoor = (top: number, bottom: number) =>
    !inside &&
    fronts.some((f) => h - f.toMm <= top + 1 && h - f.fromMm >= bottom - 1);

  for (const { zone, top, bottom } of bands) {
    const hidden = behindDoor(top, bottom);
    /*
     * כל אזור מצויר תא-תא. בלי קושרת יש תא אחד ברוחב מלא; עם קושרת
     * כל עמודה מקבלת את הרוחב שלה, והקושרת עצמה מצוירת בין העמודות
     * כלוח אנכי — בדיוק כמו בארון אמיתי.
     */
    const cells = zoneCells(zone);
    let x = 0;
    cells.forEach((cell, i) => {
      const cw = w * cell.share;
      out.push(
        <g key={`cell-${zone.id}-${cell.key}`} transform={`translate(${x} 0)`}>
          {cellContent(c, cell.content, cw, top, bottom, `${zone.id}-${cell.key}`, hidden)}
        </g>,
      );
      x += cw;
      // הקושרת בין תא לתא, כשרואים את הפנים
      if (i < cells.length - 1 && !hidden) {
        out.push(
          <line
            key={`div-${zone.id}-${cell.key}`}
            x1={x}
            y1={top}
            x2={x}
            y2={bottom}
            strokeWidth={t * 1.3}
          />,
        );
      }
    });

    // קו הפרדה בין אזורים
    if (top > 0 && !hidden) {
      out.push(
        <line key={`sep-${zone.id}`} x1={0} y1={top} x2={w} y2={top} strokeWidth={t} />,
      );
    }
  }

  /*
   * החזיתות לפי מה שנקבע בעורך פנים הארון: דלת אחת לכל הארון, דלת
   * לכל תא, או דלת שמכסה כמה תאים. אותו חישוב עצמו משרת גם את
   * התלת־ממד וגם את פירוק החלקים, ולכן מה שרואים הוא מה שנחתך.
   */
  if (!inside && c.doors > 0) {
    /*
     * פינה מתה: החזית יושבת רק על החלק הנגיש, ומה שנחסם על ידי
     * הארון שעל הקיר הסמוך מסומן בקווקוו.
     *
     * הפינה נקראת מהשדה ולא מהצורה, כמו בתלת־ממד. כשהיא נקראה
     * מהצורה בלבד, ארון פינתי שנבנה על צורה של דלת רגילה קיבל
     * בחזית דלת על כל הרוחב — הבטחה ללקוח לפתח שאי אפשר לפתוח.
     */
    const blind = blindWidth(c);
    const atStart = blindSide(c) === 'blindStart';
    const openX = blind && atStart ? blind : 0;
    const openW = w - blind;
    if (blind) {
      out.push(
        <rect
          key="blind"
          x={atStart ? 0 : openW}
          y={0}
          width={blind}
          height={h}
          strokeWidth={t}
          strokeDasharray={`${t * 3} ${t * 2}`}
          fill="currentColor"
          fillOpacity={0.08}
        />,
      );
    }
    const sub: Ctx = blind ? { ...c, w: openW } : c;
    fronts.forEach((f, i) => {
      // האזורים נמדדים מלמטה, והציור מלמעלה
      const top = h - f.toMm;
      const bottom = h - f.fromMm;
      out.push(
        <g key={`front-${i}`} transform={openX ? `translate(${openX} 0)` : undefined}>
          {doorPanels(sub, top, bottom, f.doors, `f${i}`)}
          {openingMark(sub, top, bottom)}
        </g>,
      );
      /* הקו שבין חזית לחזית — בלעדיו שתי דלתות נראות כדלת אחת */
      if (top > 0.5) {
        out.push(<line key={`fedge-${i}`} x1={0} y1={top} x2={w} y2={top} strokeWidth={t} />);
      }
    });
  }

  return out;
}

/**
 * פינה מתה: החלק שנחסם על ידי הארון שעל הקיר הסמוך מסומן
 * בקווקוו, והחזית יושבת רק על החלק הנגיש.
 */
function blindCorner(c: Ctx) {
  const { w, h, t } = c;
  const blind = blindWidth(c);
  const atStart = blindSide(c) === 'blindStart';
  const blindX = atStart ? 0 : w - blind;
  const openX = atStart ? blind : 0;
  const openW = w - blind;

  return [
    <rect
      key="blind"
      x={blindX}
      y={0}
      width={blind}
      height={h}
      strokeWidth={t}
      strokeDasharray={`${t * 3} ${t * 2}`}
      fill="currentColor"
      fillOpacity={0.08}
    />,
    <line key="split" x1={atStart ? blind : openW} y1={0} x2={atStart ? blind : openW} y2={h}
      strokeWidth={t} />,
    ...(c.inside
      ? shelfLines(c, 0, h)
      : doorPanelsIn(c, openX, openW, 0, h, Math.max(c.doors, 1))),
  ];
}

/** ארגז פינתי במפגש קירות — פינה קטומה וחזית באלכסון. */
function lShapeCorner(c: Ctx) {
  const { w, h, t } = c;
  const cut = Math.min(w * 0.28, h * 0.28);
  return [
    <path key="cut" d={`M 0 ${cut} L ${cut} 0`} strokeWidth={t} />,
    <line key="v" x1={cut} y1={0} x2={cut} y2={h} strokeWidth={t} strokeDasharray={`${t * 3} ${t * 2}`} />,
    ...(c.inside
      ? shelfLines(c, cut, h)
      : doorPanelsIn(c, cut, w - cut, 0, h, Math.max(c.doors, 1))),
  ];
}

/** סימון מנגנון הפתיחה על החזית. */
function openingMark(c: Ctx, top: number, bottom: number) {
  const { w, t } = c;
  if (c.opening === 'lift') {
    const mid = (top + bottom) / 2;
    return [
      <path key="lift" d={`M ${w * 0.36} ${mid + (bottom - top) * 0.1} A ${w * 0.16} ${(bottom - top) * 0.2} 0 0 1 ${w * 0.64} ${mid + (bottom - top) * 0.1}`}
        strokeWidth={t} />,
      <path key="arrow" d={`M ${w * 0.58} ${mid} L ${w * 0.64} ${mid + (bottom - top) * 0.1} L ${w * 0.52} ${mid + (bottom - top) * 0.14}`}
        strokeWidth={t} />,
    ];
  }
  if (c.opening === 'sliding') {
    return [
      <line key="track" x1={0} y1={bottom - t * 2} x2={w} y2={bottom - t * 2} strokeWidth={t} />,
    ];
  }
  return [];
}

/** דלתות בתוך תת-רוחב של הארגז, לצורך פינות. */
function doorPanelsIn(
  c: Ctx,
  x: number,
  width: number,
  top: number,
  bottom: number,
  n: number,
) {
  const sub: Ctx = { ...c, w: width };
  return [
    <g key="doors" transform={`translate(${x} 0)`}>
      {doorPanels(sub, top, bottom, n)}
    </g>,
  ];
}

/** רוחב הפינה המתה בציור, במידות הציור. */
function blindWidth(c: Ctx): number {
  return blindWidthMm({ corner: c.corner, glyph: c.glyph, blindMm: c.blindMm, widthMm: c.w });
}

/** קולבים מתחת למוט, בגובה נתון. */
function hangersAt(w: number, rodY: number, drop: number, t: number, key: string) {
  return [0.28, 0.5, 0.72].map((f, i) => (
    <path
      key={`hg${key}${i}`}
      d={`M ${w * f} ${rodY} l 0 ${drop * 0.2} m ${-w * 0.09} ${drop * 0.4} L ${w * f} ${rodY + drop * 0.2} l ${w * 0.09} ${drop * 0.4} Z`}
      strokeWidth={t}
    />
  ));
}

/** דלתות: קווי הפרדה אנכיים וידיות בצד הפתיחה. */
function doorPanels(c: Ctx, top: number, bottom: number, n: number, key = '') {
  const { w, t } = c;
  if (n < 1) return [];
  const out = [];
  const zoneH = bottom - top;
  const panelW = w / n;
  const hy1 = top + zoneH * 0.44;
  const hy2 = top + zoneH * 0.56;

  for (let i = 1; i < n; i++) {
    out.push(
      <line key={`${key}v${i}`} x1={panelW * i} y1={top} x2={panelW * i} y2={bottom}
        strokeWidth={t} />,
    );
  }

  // דלת זכוכית: מסגרת פנימית והבזק אור, במקום חזית אטומה
  if (c.glass) {
    const inX = panelW * 0.14;
    const inY = zoneH * 0.08;
    for (let i = 0; i < n; i++) {
      const x = panelW * i;
      out.push(
        <rect
          key={`${key}g${i}`}
          x={x + inX}
          y={top + inY}
          width={panelW - inX * 2}
          height={zoneH - inY * 2}
          strokeWidth={t}
        />,
        <line
          key={`${key}gs${i}`}
          x1={x + panelW * 0.24}
          y1={bottom - zoneH * 0.22}
          x2={x + panelW * 0.62}
          y2={top + zoneH * 0.22}
          strokeWidth={t}
        />,
      );
    }
  }
  // דלת בודדת נפתחת מצד אחד; זוג נפתח מהמפגש שבאמצע;
  // יותר מזה נבנה כזוגות, וכל זוג מקבל ידיות בצד הפנימי שלו.
  for (let i = 0; i < n; i++) {
    const inset = panelW * 0.12;
    const x =
      n === 1 ? w - inset : i % 2 === 0 ? panelW * (i + 1) - inset : panelW * i + inset;
    /*
     * הסימון הזה הוא גם צד הפתיחה וגם הידית, ולכן הוא תמיד מצויר:
     * מי שביקש פתיחה בלחיצה עדיין צריך לדעת מאיזה צד נפתחת הדלת.
     * מה שמשתנה הוא העובי — ידית אמיתית נראית ידית.
     */
    out.push(
      <line
        key={`${key}h${i}`}
        x1={x}
        y1={c.handles ? top + zoneH * 0.36 : hy1}
        x2={x}
        y2={c.handles ? top + zoneH * 0.64 : hy2}
        strokeWidth={c.handles ? t * 2.6 : t}
      />,
    );
  }
  return out;
}

/**
 * מדפים פנימיים. כברירת מחדל במרווחים שווים, ואם הוגדרו מרווחים
 * מפורשים — לפיהם, מלמטה כלפי מעלה.
 */
function shelfLines(c: Ctx, top: number, bottom: number, key = '', glass = false) {
  const { w, t, shelves } = c;
  if (shelves < 1) return [];
  const ys = shelfYs(c, top, bottom);
  // מדף זכוכית מסומן בקו מקווקו — זה מה שמבדיל אותו על הנייר בשטח
  return ys.map((y, i) => (
    <line
      key={`${key}sh${i}`}
      x1={w * 0.04}
      y1={y}
      x2={w * 0.96}
      y2={y}
      strokeWidth={t}
      strokeDasharray={glass ? `${t * 5} ${t * 3}` : undefined}
    />
  ));
}

/** גובה כל מדף בציור, לפי המרווחים שהוגדרו או במרווח אחיד. */
export function shelfYs(
  c: { shelves: number; gaps?: number[] },
  top: number,
  bottom: number,
): number[] {
  const { shelves, gaps } = c;
  if (shelves < 1) return [];
  const zone = bottom - top;

  if (gaps && gaps.length === shelves + 1) {
    const total = gaps.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const ys: number[] = [];
      let fromBottom = 0;
      for (let i = 0; i < shelves; i++) {
        fromBottom += gaps[i];
        ys.push(bottom - (fromBottom / total) * zone);
      }
      return ys;
    }
  }

  const step = zone / (shelves + 1);
  return Array.from({ length: shelves }, (_, i) => top + step * (i + 1));
}

/**
 * מה שיש מתחת לחזית של ארגז מכשיר: מגירות אם הוגדרו, מדפים אם
 * הוגדרו, ואם לא הוגדר דבר — פתח ריק.
 *
 * ארגז שאין לו חזית הוא ארגז פתוח, ולא ארגז שהציור ממציא לו שתי
 * מגירות. מספר שנבחר אפס הוא בחירה, לא חוסר.
 */
function openFront(c: Ctx, top: number, bottom: number, key = '') {
  if (c.drawers > 0) return drawerGrid(c, top, bottom, c.drawers, c.cols);
  if (c.shelves > 0) return shelfLines(c, top, bottom, key);
  return [];
}

/**
 * רשת מגירות: שורות בגובה אחיד, ואפשר גם כמה מגירות זו לצד זו.
 * במצב פנים כל מגירה מצוירת כארגז מקווקו במקום חזית.
 */
function drawerGrid(
  c: Ctx,
  top: number,
  bottom: number,
  rows: number,
  cols: number,
  forceDashed = false,
) {
  const { w, t, inside } = c;
  if (rows < 1) return [];
  const out = [];
  const zoneH = bottom - top;
  const rowH = zoneH / rows;
  const colW = w / cols;
  const dashed = inside || forceDashed;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = colW * col;
      const y = top + rowH * r;
      if (dashed) {
        const pad = Math.min(colW, rowH) * 0.1;
        out.push(
          <rect
            key={`d${r}-${col}`}
            x={x + pad}
            y={y + pad}
            width={colW - pad * 2}
            height={rowH - pad * 2}
            strokeWidth={t}
            strokeDasharray={`${t * 3} ${t * 2}`}
          />,
        );
      } else {
        if (r > 0) {
          out.push(
            <line key={`hr${r}-${col}`} x1={x} y1={y} x2={x + colW} y2={y} strokeWidth={t} />,
          );
        }
        if (col > 0) {
          out.push(
            <line key={`vr${r}-${col}`} x1={x} y1={y} x2={x} y2={y + rowH} strokeWidth={t} />,
          );
        }
        out.push(
          <line
            key={`dh${r}-${col}`}
            x1={x + colW * 0.3}
            y1={y + rowH * 0.5}
            x2={x + colW * 0.7}
            y2={y + rowH * 0.5}
            strokeWidth={t}
          />,
        );
      }
    }
  }
  return out;
}

/** קולבים מתחת למוט תלייה. */
function hangers(w: number, h: number, rodY: number, t: number, key = '') {
  return hangersAt(w, h * rodY, h * 0.3, t, key);
}
