/**
 * מנוע האיורים של הארגזים.
 *
 * כל ארגז מצויר מתוך מפרט (`glyph` + מספר דלתות/מגירות) לתוך מלבן ברוחב
 * וגובה נתונים. אותו קוד משרת גם את האייקון הקטן בספרייה וגם את ההדמיה
 * על הקיר — כך שמה שהמשתמש בוחר הוא בדיוק מה שהוא רואה על הקיר.
 */

type Props = {
  glyph: string;
  /** רוחב וגובה ביחידות הציור */
  w: number;
  h: number;
  doors?: number;
  drawers?: number;
  /** עובי קו ביחידות הציור */
  stroke: number;
  className?: string;
};

export function CabinetGlyph({ glyph, w, h, doors = 1, drawers = 0, stroke }: Props) {
  const s = stroke;
  const thin = s * 0.75;
  const r = Math.min(w, h) * 0.04;

  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={s}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={0} y={0} width={w} height={h} rx={r} />
      {details(glyph, w, h, doors, drawers, thin)}
    </g>
  );
}

/* ------------------------------------------------------------------ */

function details(
  glyph: string,
  w: number,
  h: number,
  doors: number,
  drawers: number,
  t: number,
) {
  const L = (x1: number, y1: number, x2: number, y2: number, key: string, dash?: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={t} strokeDasharray={dash} />
  );

  switch (glyph) {
    case 'doors':
      return doorPanels(w, 0, h, doors, t);

    case 'drawers':
      return drawerBands(w, 0, h, drawers, t);

    case 'doorDrawer': {
      const bandH = Math.min(h * 0.22, h / (drawers + 1)) * drawers;
      return [
        ...drawerBands(w, 0, bandH, drawers, t),
        L(0, bandH, w, bandH, 'split'),
        ...doorPanels(w, bandH, h, doors, t),
      ];
    }

    case 'sink': {
      const band = h * 0.24;
      return [
        L(0, band, w, band, 'split'),
        // הכיור מסומן בחזית העיוורת שמעל הארגז
        <rect key="basin" x={w * 0.2} y={band * 0.2} width={w * 0.6} height={band * 0.62}
          rx={band * 0.16} strokeWidth={t} />,
        <circle key="drain" cx={w * 0.5} cy={band * 0.51} r={Math.min(w, h) * 0.035}
          strokeWidth={t} />,
        ...doorPanels(w, band, h, 2, t),
      ];
    }

    case 'hob': {
      const band = h * 0.16;
      const cx = [0.28, 0.5, 0.72];
      return [
        L(0, band, w, band, 'split'),
        ...cx.map((f, i) => (
          <circle key={`b${i}`} cx={w * f} cy={band * 0.5} r={band * 0.26} strokeWidth={t} />
        )),
        ...drawerBands(w, band, h, Math.max(drawers, 2), t),
      ];
    }

    case 'oven': {
      const top = h * 0.1;
      const boxH = h * 0.58;
      return [
        <rect key="box" x={w * 0.08} y={top} width={w * 0.84} height={boxH}
          rx={w * 0.02} strokeWidth={t} />,
        L(w * 0.16, top + boxH * 0.16, w * 0.84, top + boxH * 0.16, 'handle'),
        ...drawerBands(w, top + boxH + h * 0.04, h, 1, t),
      ];
    }

    case 'ovenMicro': {
      const pad = w * 0.08;
      const microH = h * 0.24;
      const ovenH = h * 0.3;
      return [
        <rect key="m" x={pad} y={h * 0.08} width={w - pad * 2} height={microH}
          rx={w * 0.02} strokeWidth={t} />,
        <rect key="o" x={pad} y={h * 0.08 + microH + h * 0.03} width={w - pad * 2} height={ovenH}
          rx={w * 0.02} strokeWidth={t} />,
        L(pad * 1.6, h * 0.08 + microH + h * 0.03 + ovenH * 0.18,
          w - pad * 1.6, h * 0.08 + microH + h * 0.03 + ovenH * 0.18, 'oh'),
        ...doorPanels(w, h * 0.08 + microH + ovenH + h * 0.08, h, 1, t),
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
      return [L(0, h * 0.36, w, h * 0.36, 'sh1'), L(0, h * 0.68, w, h * 0.68, 'sh2')];

    case 'shelves':
      return [0.24, 0.44, 0.64, 0.84].map((f, i) => L(0, h * f, w, h * f, `sh${i}`));

    case 'pantry':
      return [
        ...[0.2, 0.36, 0.52, 0.68, 0.84].map((f, i) =>
          L(w * 0.1, h * f, w * 0.9, h * f, `p${i}`, `${t * 3} ${t * 2}`),
        ),
        L(w * 0.94, h * 0.46, w * 0.94, h * 0.56, 'hd'),
      ];

    case 'corner':
      return [
        <path key="c" d={`M ${w * 0.02} ${h * 0.24} L ${w * 0.34} ${h * 0.02}`} strokeWidth={t} />,
        ...doorPanels(w, h * 0.26, h, 1, t),
      ];

    case 'carousel':
      return [
        <path key="a" d={`M ${w * 0.14} ${h * 0.86} A ${w * 0.62} ${h * 0.62} 0 0 1 ${w * 0.76} ${h * 0.24}`}
          strokeWidth={t} />,
        <circle key="d" cx={w * 0.14} cy={h * 0.86} r={Math.min(w, h) * 0.05} strokeWidth={t} />,
        L(w * 0.9, h * 0.44, w * 0.9, h * 0.56, 'hd'),
      ];

    case 'lift':
      return [
        <path key="a" d={`M ${w * 0.32} ${h * 0.62} A ${w * 0.2} ${h * 0.34} 0 0 1 ${w * 0.68} ${h * 0.62}`}
          strokeWidth={t} />,
        <path key="t" d={`M ${w * 0.6} ${h * 0.5} L ${w * 0.68} ${h * 0.62} L ${w * 0.56} ${h * 0.66}`}
          strokeWidth={t} />,
      ];

    case 'glass':
      return [
        <rect key="in" x={w * 0.12} y={h * 0.1} width={w * 0.76} height={h * 0.8}
          rx={w * 0.02} strokeWidth={t} />,
        L(w * 0.22, h * 0.76, w * 0.5, h * 0.24, 'shine'),
        L(w * 0.4, h * 0.8, w * 0.62, h * 0.44, 'shine2'),
      ];

    case 'shutter':
      return [0.2, 0.34, 0.48, 0.62, 0.76].map((f, i) => L(w * 0.06, h * f, w * 0.94, h * f, `r${i}`));

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
      return [
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
        ...drawerBands(w, unitTop, h, 2, t),
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

    case 'mirror':
      return [
        L(w * 0.2, h * 0.82, w * 0.52, h * 0.2, 'm1'),
        L(w * 0.44, h * 0.86, w * 0.7, h * 0.42, 'm2'),
      ];

    case 'innerDrawers':
      return [
        ...[0.3, 0.5, 0.7].map((f, i) =>
          L(w * 0.1, h * f, w * 0.9, h * f, `d${i}`, `${t * 3} ${t * 2}`),
        ),
        L(w * 0.94, h * 0.46, w * 0.94, h * 0.56, 'hd'),
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
      return doorPanels(w, 0, h, doors, t);
  }
}

/* ------------------------------------------------------------------ */

/** דלתות: קווי הפרדה אנכיים + ידיות בקצה הפתיחה. */
function doorPanels(w: number, top: number, bottom: number, n: number, t: number) {
  const out = [];
  const zoneH = bottom - top;
  const panelW = w / n;
  const hy1 = top + zoneH * 0.44;
  const hy2 = top + zoneH * 0.56;

  for (let i = 1; i < n; i++) {
    out.push(
      <line key={`v${i}`} x1={panelW * i} y1={top} x2={panelW * i} y2={bottom} strokeWidth={t} />,
    );
  }
  for (let i = 0; i < n; i++) {
    // ידית תמיד בצד שנפתח: בדלת בודדת בצד ימין, בזוג — משני צדי המפגש
    const inset = panelW * 0.1;
    const x = n === 1 ? w - inset : i === 0 ? panelW - inset : panelW * i + inset;
    out.push(<line key={`h${i}`} x1={x} y1={hy1} x2={x} y2={hy2} strokeWidth={t} />);
  }
  return out;
}

/** מגירות: קווי הפרדה אופקיים + ידית אופקית במרכז כל מגירה. */
function drawerBands(w: number, top: number, bottom: number, n: number, t: number) {
  const out = [];
  const zoneH = bottom - top;
  const bandH = zoneH / n;

  for (let i = 1; i < n; i++) {
    out.push(
      <line key={`d${i}`} x1={0} y1={top + bandH * i} x2={w} y2={top + bandH * i} strokeWidth={t} />,
    );
  }
  for (let i = 0; i < n; i++) {
    const cy = top + bandH * (i + 0.5);
    out.push(
      <line key={`dh${i}`} x1={w * 0.3} y1={cy} x2={w * 0.7} y2={cy} strokeWidth={t} />,
    );
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
