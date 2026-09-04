import { useRef, useState } from 'react';
import { cm, unitLabel } from '../../ui/units';

/** נקודה בקווי החדר, במ"מ. */
export interface ShapePoint {
  x: number;
  y: number;
}

/** גודל השטח שאפשר לשרטט בו, במ"מ. שישה מטר לכל כיוון מכסים חדר רגיל. */
const AREA_MM = 6000;
/** מרווח הרשת. גם צעד ההצמדה של האורך */
const GRID_MM = 250;
/** הצמדה לנקודת ההתחלה, לסגירת צורה */
const CLOSE_MM = 400;

/**
 * שרטוט צורת החדר.
 *
 * חדר אמיתי הוא לא "שניים / שלושה / ארבעה קירות" — הוא צורה, ולפעמים
 * צורה שאין לה שם. כאן משרטטים אותה: נגיעה מוסיפה פינה, וכל קטע בין
 * שתי פינות הוא קיר.
 *
 * ההצמדה ל-90 מעלות דלוקה כברירת מחדל, כי רוב הפינות ישרות ואצבע על
 * מסך לא מדייקת. אפשר לכבות אותה לחדר עם קיר אלכסוני — וזה בדיוק
 * המקרה שבו שרטוט חופשי שווה משהו.
 */
export function RoomShapeEditor({
  points,
  onChange,
}: {
  points: ShapePoint[];
  onChange: (points: ShapePoint[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [snap, setSnap] = useState(true);
  const [hover, setHover] = useState<ShapePoint | null>(null);

  /** מיקום המצביע בקואורדינטות השרטוט. */
  function at(e: React.PointerEvent): ShapePoint | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const local = p.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  /**
   * הנקודה שתתווסף בפועל.
   * בהצמדה הקטע נעשה אופקי או אנכי — לפי הציר שבו התנועה גדולה
   * יותר — והאורך מתעגל לצעד הרשת.
   */
  function resolve(raw: ShapePoint): ShapePoint {
    const last = points[points.length - 1];
    // חזרה לנקודת ההתחלה סוגרת את הצורה, וזו נקודה שכדאי לתפוס
    const first = points[0];
    if (first && points.length > 2 && Math.hypot(raw.x - first.x, raw.y - first.y) < CLOSE_MM) {
      return { ...first };
    }
    if (!last) {
      return snap
        ? { x: Math.round(raw.x / GRID_MM) * GRID_MM, y: Math.round(raw.y / GRID_MM) * GRID_MM }
        : raw;
    }
    if (!snap) return raw;
    const dx = raw.x - last.x;
    const dy = raw.y - last.y;
    const step = (v: number) => Math.round(v / GRID_MM) * GRID_MM;
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: last.x + step(dx), y: last.y }
      : { x: last.x, y: last.y + step(dy) };
  }

  const closed =
    points.length > 2 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y;

  const preview = hover && !closed ? resolve(hover) : null;
  const all = preview ? [...points, preview] : points;

  const segs = all.slice(1).map((p, i) => {
    const a = all[i];
    return {
      a,
      b: p,
      lengthMm: Math.round(Math.hypot(p.x - a.x, p.y - a.y)),
      mid: { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 },
      isPreview: preview !== null && i === all.length - 2,
    };
  });

  const stroke = AREA_MM / 220;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${AREA_MM} ${AREA_MM}`}
          className="block w-full touch-none select-none"
          onPointerMove={(e) => setHover(at(e))}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => {
            if (closed) return;
            const raw = at(e);
            if (!raw) return;
            const next = resolve(raw);
            const last = points[points.length - 1];
            // נגיעה כפולה באותו מקום לא מוסיפה קיר באורך אפס
            if (last && last.x === next.x && last.y === next.y) return;
            onChange([...points, next]);
          }}
        >
          <defs>
            <pattern id="room-grid" width={GRID_MM} height={GRID_MM} patternUnits="userSpaceOnUse">
              <path
                d={`M ${GRID_MM} 0 L 0 0 0 ${GRID_MM}`}
                fill="none"
                stroke="#e7e5e4"
                strokeWidth={stroke / 3}
              />
            </pattern>
          </defs>
          <rect width={AREA_MM} height={AREA_MM} fill="url(#room-grid)" />

          {closed && (
            <polygon points={all.map((p) => `${p.x},${p.y}`).join(' ')} fill="#faf6f0" />
          )}

          {segs.map((s, i) => (
            <g key={i}>
              <line
                x1={s.a.x}
                y1={s.a.y}
                x2={s.b.x}
                y2={s.b.y}
                stroke={s.isPreview ? '#d6d3d1' : '#1c1917'}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={s.isPreview ? `${stroke * 3} ${stroke * 2}` : undefined}
              />
              {s.lengthMm > 0 && (
                <text
                  x={s.mid.x}
                  y={s.mid.y - stroke * 2}
                  textAnchor="middle"
                  fontSize={AREA_MM / 30}
                  fill={s.isPreview ? '#a8a29e' : '#57534e'}
                  direction="ltr"
                >
                  {cm(s.lengthMm)}
                </text>
              )}
            </g>
          ))}

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={stroke * 1.6}
              fill={i === 0 ? '#a06236' : '#1c1917'}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSnap((v) => !v)}
          aria-pressed={snap}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            snap ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          הצמדה ל־90°
        </button>
        <button
          onClick={() => onChange(points.slice(0, -1))}
          disabled={points.length === 0}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 disabled:opacity-40"
        >
          ביטול פינה
        </button>
        <button
          onClick={() => onChange([])}
          disabled={points.length === 0}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 disabled:opacity-40"
        >
          מחיקה
        </button>
        {points.length > 2 && !closed && (
          <button
            onClick={() => onChange([...points, { ...points[0] }])}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            סגירת החדר
          </button>
        )}
      </div>

      <p className="text-xs leading-snug text-stone-500">
        {points.length === 0
          ? 'נגיעה מסמנת את הפינה הראשונה. כל נגיעה נוספת מותחת קיר.'
          : closed
            ? `החדר סגור. ${segs.length} קירות, המידות ב${unitLabel()}.`
            : `${segs.filter((s) => !s.isPreview).length} קירות עד כה. אפשר לסגור את החדר או להשאיר אותו פתוח.`}
      </p>
    </div>
  );
}

/** אורכי הקירות שנגזרים מהצורה, במ"מ, לפי סדר השרטוט. */
export function shapeWalls(points: ShapePoint[]): { lengthMm: number; headingDeg: number }[] {
  const out: { lengthMm: number; headingDeg: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const lengthMm = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
    if (lengthMm <= 0) continue;
    out.push({ lengthMm, headingDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
  }
  return out;
}
