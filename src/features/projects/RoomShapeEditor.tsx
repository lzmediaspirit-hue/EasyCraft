import { useRef, useState } from 'react';
import { cm, count, unitLabel } from '../../ui/units';

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
/** תנועה קטנה מזו היא נגיעה ולא גרירה */
const TAP_MM = 220;

/** הקיר שהאצבע נגעה בו, או `null` כשלא נגעה באף אחד. */
function nearestSegment(points: ShapePoint[], p: ShapePoint): number | null {
  let best: number | null = null;
  let bestD = TAP_MM * 1.6;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    // ההיטל על הקטע, מוגבל לקצוותיו
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < bestD) {
      bestD = d;
      best = i - 1;
    }
  }
  return best;
}

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
  /*
   * הקיר נמתח בגרירה ולא נוצר בשתי נגיעות.
   * נגיעה־נגיעה אילצה לכוון נקודה, לשחרר, ולכוון שוב; גרירה מנקודה
   * לנקודה היא אותה תנועה שעושים עם מטר בשטח — מותחים עד לאן שצריך
   * ומשחררים.
   */
  const [drag, setDrag] = useState<{
    /** המקום שנגעו בו, כדי להבחין בין נגיעה לגרירה */
    press: ShapePoint;
    from: ShapePoint;
    to: ShapePoint;
  } | null>(null);
  /** הקיר שנגעו בו, לפני שמחליטים אם למחוק אותו */
  const [picked, setPicked] = useState<number | null>(null);

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
  function resolve(raw: ShapePoint, from: ShapePoint | null): ShapePoint {
    // חזרה לנקודת ההתחלה סוגרת את הצורה, וזו נקודה שכדאי לתפוס
    const first = points[0];
    if (first && points.length > 2 && Math.hypot(raw.x - first.x, raw.y - first.y) < CLOSE_MM) {
      return { ...first };
    }
    if (!from) {
      return snap
        ? { x: Math.round(raw.x / GRID_MM) * GRID_MM, y: Math.round(raw.y / GRID_MM) * GRID_MM }
        : raw;
    }
    if (!snap) return raw;
    const dx = raw.x - from.x;
    const dy = raw.y - from.y;
    const step = (v: number) => Math.round(v / GRID_MM) * GRID_MM;
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: from.x + step(dx), y: from.y }
      : { x: from.x, y: from.y + step(dy) };
  }

  const closed =
    points.length > 2 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y;

  const preview = drag && !closed ? drag.to : null;
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
          onPointerDown={(e) => {
            if (closed) return;
            const raw = at(e);
            if (!raw) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            /*
             * הגרירה תמיד יוצאת מהנקודה האחרונה. הראשונה נקבעת
             * במקום שנגעו בו, וממנה והלאה הקיר נמתח משם — אחרת כל
             * גרירה הייתה מנתקת את השרשרת.
             */
            const from = points[points.length - 1] ?? resolve(raw, null);
            setDrag({ press: raw, from, to: resolve(raw, points.length ? from : null) });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            const raw = at(e);
            if (raw) setDrag({ ...drag, to: resolve(raw, drag.from) });
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            const d = drag;
            setDrag(null);
            if (!d) return;
            const raw = at(e);
            /*
             * נגיעה בוחרת, גרירה משרטטת.
             * שני המצבים חיים על אותו אירוע ולא על שכבות נפרדות, כי
             * הקיר הבא תמיד מתחיל בפינה של הקודם — כלומר על הקיר
             * הקודם — ושכבת בחירה מעליו הייתה חוסמת כל גרירה שנייה.
             */
            if (raw && Math.hypot(raw.x - d.press.x, raw.y - d.press.y) < TAP_MM) {
              setPicked(nearestSegment(points, raw));
              return;
            }
            const next: ShapePoint[] = points.length ? [...points, d.to] : [d.from, d.to];
            const last = next[next.length - 2];
            // גרירה שלא זזה לא מוסיפה קיר באורך אפס
            if (last && last.x === d.to.x && last.y === d.to.y) {
              if (!points.length) onChange([d.from]);
              return;
            }
            setPicked(null);
            onChange(next);
          }}
          onPointerCancel={() => setDrag(null)}
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
                stroke={s.isPreview ? '#d6d3d1' : picked === i ? '#dc2626' : '#1c1917'}
                strokeWidth={picked === i ? stroke * 1.6 : stroke}
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
        {/*
          מחיקת קיר שאינו האחרון מחברת את שכניו: מוציאים את הפינה
          שביניהם, והשרשרת נשארת רציפה.
        */}
        {picked !== null && (
          <button
            onClick={() => {
              const next = [...points];
              next.splice(picked + 1, 1);
              setPicked(null);
              onChange(next.length >= 2 ? next : []);
            }}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            מחיקת הקיר שנבחר
          </button>
        )}
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
          ? 'גרירה על הרשת מותחת את הקיר הראשון.'
          : closed
            ? `החדר סגור. ${count(segs.length, 'קיר אחד', 'קירות')}, המידות ב${unitLabel()}.`
            : `${count(segs.filter((s) => !s.isPreview).length, 'קיר אחד', 'קירות')} עד כה. גרירה נוספת מותחת את הבא; נגיעה בקיר מסמנת אותו למחיקה.`}
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
