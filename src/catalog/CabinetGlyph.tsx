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
};

export function CabinetGlyph({
  glyph,
  w,
  h,
  doors = 1,
  drawers = 0,
  drawerCols = 1,
  shelves,
  stroke,
  inside = false,
  drawerStyle = 'outer',
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
      })}
    </g>
  );
}

/** מספר מדפים סביר לגובה נתון, כשלא הוגדר מספר במפורש. */
export function autoShelves(h: number): number {
  return Math.max(0, Math.round(h / 400) - 1);
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

  switch (c.glyph) {
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
        ...drawerGrid(c, band, h, Math.max(c.drawers, 2), 1),
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
      const strip = h * 0.16;
      return [
        L(0, strip, w, strip, 'strip'),
        L(w * 0.14, strip * 0.5, w * 0.5, strip * 0.5, 'ctrl'),
        <circle key="c" cx={w * 0.5} cy={h * 0.6} r={Math.min(w, h) * 0.16} strokeWidth={t} />,
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
        ...(c.doors > 0
          ? front(unitTop, h, c.doors)
          : drawerZone(unitTop, h, Math.max(c.drawers, 2), 'tv')),
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

/* ------------------------------------------------------------------ */

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
  // דלת בודדת נפתחת מצד אחד; זוג נפתח מהמפגש שבאמצע;
  // יותר מזה נבנה כזוגות, וכל זוג מקבל ידיות בצד הפנימי שלו.
  for (let i = 0; i < n; i++) {
    const inset = panelW * 0.12;
    const x =
      n === 1 ? w - inset : i % 2 === 0 ? panelW * (i + 1) - inset : panelW * i + inset;
    out.push(
      <line key={`${key}h${i}`} x1={x} y1={hy1} x2={x} y2={hy2} strokeWidth={t} />,
    );
  }
  return out;
}

/** מדפים פנימיים, מרווחים באופן אחיד. */
function shelfLines(c: Ctx, top: number, bottom: number, key = '') {
  const { w, t, shelves } = c;
  if (shelves < 1) return [];
  const step = (bottom - top) / (shelves + 1);
  return Array.from({ length: shelves }, (_, i) => (
    <line
      key={`${key}sh${i}`}
      x1={w * 0.04}
      y1={top + step * (i + 1)}
      x2={w * 0.96}
      y2={top + step * (i + 1)}
      strokeWidth={t}
    />
  ));
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
  return [0.28, 0.5, 0.72].map((f, i) => (
    <path
      key={`hg${key}${i}`}
      d={`M ${w * f} ${h * rodY} l 0 ${h * 0.06} m ${-w * 0.09} ${h * 0.12} L ${w * f} ${h * (rodY + 0.06)} l ${w * 0.09} ${h * 0.12} Z`}
      strokeWidth={t}
    />
  ));
}
