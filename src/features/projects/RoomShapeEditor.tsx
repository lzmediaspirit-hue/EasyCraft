import { useRef, useState } from 'react';
import { clamp } from '../../ui/units';
import { cm, count, unitLabel } from '../../ui/units';
import {
  CloseIcon,
  CornerIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from '../../ui/icons';

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
   * העיפרון: בלעדיו כל קיר נמתח בגרירה, וזו תנועה אחת ארוכה לכל
   * קיר. איתו נגיעה מספיקה — נוגעים בפינה אחרי פינה והחדר נבנה,
   * וזה מה שנוח באצבע. הבחירה למחיקה עוברת אז לנגיעה ארוכה יותר
   * על הקיר עצמו, ולכן שני המצבים לא נדרסים זה על זה.
   */
  const [pencil, setPencil] = useState(true);
  /*
   * זום. חדר גדול נכנס בקושי לרשת, וחדר קטן מצויר בפינה שלה. אין
   * גרירה של התצוגה במכוון: המבט מתמרכז על מה שכבר שורטט, ולכן
   * הזום תמיד מסתכל על העבודה ולא על פינה ריקה.
   */
  const [zoom, setZoom] = useState(1);
  /*
   * היסטוריה מקומית לשרטוט. "בטל" של האשף כולו היה מוציא מהשלב,
   * ומי שמשרטט רוצה לבטל קיר אחד — לא את השרטוט.
   */
  const past = useRef<ShapePoint[][]>([]);
  const future = useRef<ShapePoint[][]>([]);
  const [, bumpHistory] = useState(0);

  /** משנה את הצורה ורושם את הקודמת בהיסטוריה. */
  function commit(next: ShapePoint[]) {
    past.current = [...past.current, points];
    future.current = [];
    bumpHistory((n) => n + 1);
    onChange(next);
  }

  function undo() {
    const prev = past.current[past.current.length - 1];
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [points, ...future.current];
    setPicked(null);
    bumpHistory((n) => n + 1);
    onChange(prev);
  }

  function redo() {
    const next = future.current[0];
    if (!next) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, points];
    setPicked(null);
    bumpHistory((n) => n + 1);
    onChange(next);
  }
  /*
   * הקיר נמתח בגרירה ולא נוצר בשתי נגיעות.
   * נגיעה־נגיעה אילצה לכוון נקודה, לשחרר, ולכוון שוב; גרירה מנקודה
   * לנקודה היא אותה תנועה שעושים עם מטר בשטח — מותחים עד לאן שצריך
   * ומשחררים.
   */
  type Drag = {
    /** המקום שנגעו בו, כדי להבחין בין נגיעה לגרירה */
    press: ShapePoint;
    from: ShapePoint;
    to: ShapePoint;
  };
  /*
   * הגרירה חיה ב-ref ולא רק במצב: נגיעה קצרה מסיימת את עצמה באותו
   * פריים שבו היא התחילה, ואז מטפל השחרור עוד קורא את המצב הישן —
   * ריק — והנגיעה נבלעה. ה-ref נכון תמיד; המצב קיים רק כדי לצייר
   * את הקיר שנמתח.
   */
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
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

  const stroke = (AREA_MM / 220) / zoom;

  /*
   * חלון התצוגה. הוא מתמרכז על מה שכבר שורטט — ובחדר ריק על מרכז
   * הרשת — כדי שהתקרבות תמיד תסתכל על העבודה.
   */
  const span = AREA_MM / zoom;
  const focus = points.length
    ? {
        x: (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2,
        y: (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2,
      }
    : { x: AREA_MM / 2, y: AREA_MM / 2 };
  const view = {
    x: clamp(focus.x - span / 2, 0, Math.max(AREA_MM - span, 0)),
    y: clamp(focus.y - span / 2, 0, Math.max(AREA_MM - span, 0)),
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${span} ${span}`}
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
            const d = dragRef.current;
            if (!d) return;
            const raw = at(e);
            if (raw) setDrag({ ...d, to: resolve(raw, d.from) });
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            const d = dragRef.current;
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
              /*
               * עם העיפרון נגיעה מוסיפה פינה — פינה אחרי פינה, וזה
               * מה שנוח באצבע. בלעדיו נגיעה בוחרת קיר למחיקה, וזו
               * הייתה ההתנהגות היחידה עד עכשיו.
               */
              if (pencil) {
                const to = resolve(raw, points.length ? d.from : null);
                if (points.length && d.from.x === to.x && d.from.y === to.y) return;
                setPicked(null);
                commit(points.length ? [...points, to] : [to]);
                return;
              }
              setPicked(nearestSegment(points, raw));
              return;
            }
            const next: ShapePoint[] = points.length ? [...points, d.to] : [d.from, d.to];
            const last = next[next.length - 2];
            // גרירה שלא זזה לא מוסיפה קיר באורך אפס
            if (last && last.x === d.to.x && last.y === d.to.y) {
              if (!points.length) commit([d.from]);
              return;
            }
            setPicked(null);
            commit(next);
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

      {/*
        סרגל הכלים של השרטוט. הכלים הם אייקונים כי הם חוזרים על עצמם
        עשרות פעמים בשרטוט אחד, ושורה של מילים הייתה נגללת הצידה
        בדיוק כשצריך אותה.
      */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ShapeTool
          label="בטל"
          onClick={undo}
          disabled={past.current.length === 0}
          icon={<UndoIcon className="size-4" />}
        />
        <ShapeTool
          label="חזור"
          onClick={redo}
          disabled={future.current.length === 0}
          icon={<RedoIcon className="size-4" />}
        />

        <span className="mx-0.5 h-6 w-px bg-stone-200" />

        <ShapeTool
          label="ציור בנגיעה"
          active={pencil}
          onClick={() => {
            setPencil((v) => !v);
            setPicked(null);
          }}
          icon={<PencilIcon className="size-4" />}
        />
        <ShapeTool
          label="הצמדה ל־90°"
          active={snap}
          onClick={() => setSnap((v) => !v)}
          icon={<CornerIcon className="size-4" />}
        />

        <span className="mx-0.5 h-6 w-px bg-stone-200" />

        <ShapeTool
          label="התרחקות"
          onClick={() => setZoom((z) => Math.max(z / 1.4, 0.6))}
          disabled={zoom <= 0.6}
          icon={<MinusIcon className="size-4" />}
        />
        <ShapeTool
          label="התקרבות"
          onClick={() => setZoom((z) => Math.min(z * 1.4, 4))}
          disabled={zoom >= 4}
          icon={<PlusIcon className="size-4" />}
        />

        <span className="mx-0.5 h-6 w-px bg-stone-200" />

        {/*
          מחיקה: קיר שנבחר, ואם לא נבחר — הפינה האחרונה. שני
          הכפתורים היו אותה כוונה בשני מקומות, ומי שמשרטט לוחץ
          "מחק" ומצפה שהדבר האחרון ייעלם.
        */}
        <ShapeTool
          label={picked !== null ? 'מחיקת הקיר שנבחר' : 'מחיקת הפינה האחרונה'}
          tone={picked !== null ? 'danger' : undefined}
          disabled={points.length === 0}
          onClick={() => {
            if (picked !== null) {
              const next = [...points];
              next.splice(picked + 1, 1);
              setPicked(null);
              commit(next.length >= 2 ? next : []);
              return;
            }
            commit(points.slice(0, -1));
          }}
          icon={<TrashIcon className="size-4" />}
        />
        <ShapeTool
          label="מחיקת הכול"
          disabled={points.length === 0}
          onClick={() => {
            setPicked(null);
            commit([]);
          }}
          icon={<CloseIcon className="size-4" />}
        />

      </div>

      {/* סגירת החדר היא סוף השרטוט ולא עוד כלי, ולכן היא שורה לעצמה */}
      {points.length > 2 && !closed && (
        <button
          onClick={() => commit([...points, { ...points[0] }])}
          className="w-full rounded-lg bg-stone-900 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          סגירת החדר
        </button>
      )}

      <p className="text-xs leading-snug text-stone-500">
        {points.length === 0
          ? pencil
            ? 'נגיעה על הרשת מניחה את הפינה הראשונה. גרירה מותחת קיר שלם.'
            : 'גרירה על הרשת מותחת את הקיר הראשון.'
          : closed
            ? `החדר סגור. ${count(segs.length, 'קיר אחד', 'קירות')}, המידות ב${unitLabel()}.`
            : `${count(segs.filter((s) => !s.isPreview).length, 'קיר אחד', 'קירות')} עד כה. ${
                pencil
                  ? 'נגיעה מוסיפה פינה, גרירה מותחת קיר.'
                  : 'גרירה מותחת את הקיר הבא; נגיעה בקיר מסמנת אותו למחיקה.'
              }`}
      </p>
    </div>
  );
}

/** כלי אחד בסרגל השרטוט: אייקון, ושם שנשמע כשמקריאים את המסך. */
function ShapeTool({
  label,
  icon,
  onClick,
  active,
  disabled,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid size-9 place-items-center rounded-lg transition-colors disabled:opacity-30 ${
        active
          ? 'bg-oak-600 text-white'
          : tone === 'danger'
            ? 'bg-red-50 text-red-700 hover:bg-red-100'
            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {icon}
    </button>
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
