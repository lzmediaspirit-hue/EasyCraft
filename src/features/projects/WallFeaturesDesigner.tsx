import { useRef, useState } from 'react';
import {
  FEATURE_DEFS,
  HEIGHT_REF_LABEL,
  SIDE_LABEL,
  featureDef,
  featureDepth,
  featureX,
  featureXToMm,
  featureY,
  featureYToMm,
  newFeature,
} from './wallFeatures';
import { MeasureInput } from '../../ui/MeasureInput';
import { TrashIcon } from '../../ui/icons';
import type { HeightRef, WallFeature, WallSide } from '../../db/types';

/** גרירה חופשית נוחתת על סנטימטרים שלמים, כמו בהדמיית הארגזים. */
const STEP = 10;
/** מרחק הצמדה לרצפה, לתקרה ולקצות הקיר, במ"מ */
const SNAP = 60;

/**
 * סימונים על הקיר, בגרירה.
 *
 * הקיר מצויר כמו בהדמיית הארגזים, וזו הנקודה: הנגר לא מדמיין איפה
 * החלון נופל ביחס לארונות — הוא רואה. גוררים את הסימון למקומו,
 * והמידות המדויקות נשארות בשדות מתחת, כי בסוף מודדים במטר ולא בעין.
 *
 * מה שנשמר הוא תמיד xMm מתחילת הקיר ו-yMm מהרצפה. הקצה שמודדים
 * ממנו והמנין לגובה הם רק דרך הצגה, ולכן הגרירה לא צריכה לדעת עליהם.
 */
export function WallFeaturesDesigner({
  features,
  wallLengthMm,
  wallHeightMm,
  onAdd,
  onPatch,
  onRemove,
}: {
  features: WallFeature[];
  wallLengthMm: number;
  wallHeightMm: number;
  onAdd: (feature: WallFeature) => void;
  onPatch: (id: string, patch: Partial<WallFeature>) => void;
  onRemove: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    scale: number;
  } | null>(null);

  const selected = features.find((f) => f.id === selectedId) ?? null;
  const length = Math.max(wallLengthMm, 1);
  const height = Math.max(wallHeightMm, 1);
  const stroke = length / 400;
  /** המסך גדל כלפי מטה, הקיר נמדד כלפי מעלה */
  const flip = (mm: number) => height - mm;

  function startDrag(e: React.PointerEvent, f: WallFeature) {
    setSelectedId(f.id);
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // אין תפיסה — ה-SVG עדיין מקבל את התנועה
    }
    drag.current = {
      id: f.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: f.xMm,
      originY: f.yMm,
      scale: 1 / ctm.a,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const f = features.find((x) => x.id === d.id);
    if (!f) return;

    const maxX = Math.max(length - f.widthMm, 0);
    const maxY = Math.max(height - f.heightMm, 0);
    const rawX = d.originX + (e.clientX - d.startX) * d.scale;
    const rawY = d.originY - (e.clientY - d.startY) * d.scale;
    /*
     * הצמדה לקצוות ולרצפה: פתח נגמר בקיר, ודלת יושבת על הרצפה.
     * שאר הדרך חופשית, ונוחתת על סנטימטרים שלמים.
     */
    const snap = (v: number, targets: number[]) => {
      const hit = targets.find((t) => Math.abs(v - t) < SNAP);
      return hit ?? Math.round(v / STEP) * STEP;
    };
    onPatch(d.id, {
      xMm: Math.min(Math.max(snap(rawX, [0, maxX]), 0), maxX),
      yMm: Math.min(Math.max(snap(rawY, [0, maxY]), 0), maxY),
    });
  }

  function endDrag(e: React.PointerEvent) {
    if (drag.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // לא נתפס מלכתחילה
      }
    }
    drag.current = null;
  }

  return (
    <>
      {/* הקיר עצמו — אותה תצוגה שבה רואים את הארגזים */}
      <svg
        ref={svgRef}
        viewBox={`${-length * 0.03} ${-height * 0.03} ${length * 1.06} ${height * 1.06}`}
        className="w-full touch-pan-y select-none rounded-xl border border-stone-200 bg-white"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelectedId(null);
        }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect
          x={0}
          y={0}
          width={length}
          height={height}
          fill="none"
          stroke="#d6d3d1"
          strokeWidth={stroke}
        />
        {/* הרצפה מודגשת: היא הקו שממנו נמדד הכול */}
        <line x1={0} y1={height} x2={length} y2={height} stroke="#78716c" strokeWidth={stroke * 2} />

        {features.map((f) => {
          const def = featureDef(f.kind);
          const on = f.id === selectedId;
          return (
            <g
              key={f.id}
              data-feature-id={f.id}
              onPointerDown={(e) => startDrag(e, f)}
              className="cursor-grab"
            >
              <rect
                x={f.xMm}
                y={flip(f.yMm + f.heightMm)}
                width={Math.max(f.widthMm, length / 60)}
                height={Math.max(f.heightMm, height / 40)}
                fill={def.tone}
                fillOpacity={0.55}
                stroke={on ? '#a06236' : '#57534e'}
                strokeWidth={on ? stroke * 2.5 : stroke}
              />
              <text
                x={f.xMm + Math.max(f.widthMm, length / 60) / 2}
                y={flip(f.yMm + f.heightMm) - height * 0.015}
                textAnchor="middle"
                fontSize={height / 22}
                fill="#57534e"
              >
                {def.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* הספרייה: מה אפשר להניח על הקיר */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FEATURE_DEFS.map((def) => (
          <button
            key={def.kind}
            onClick={() => {
              /* נוחת במרכז הקיר: משם גוררים למקום, ולא מאפס */
              const f = newFeature(def.kind);
              f.xMm = Math.max(Math.round((wallLengthMm - f.widthMm) / 2 / STEP) * STEP, 0);
              onAdd(f);
              setSelectedId(f.id);
            }}
            className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: def.tone }}
            />
            {def.label}
          </button>
        ))}
      </div>

      {selected ? (
        <FeatureSettings
          feature={selected}
          wallLengthMm={wallLengthMm}
          wallHeightMm={wallHeightMm}
          onPatch={(patch) => onPatch(selected.id, patch)}
          onRemove={() => {
            onRemove(selected.id);
            setSelectedId(null);
          }}
        />
      ) : (
        features.length > 0 && (
          <p className="mt-2 text-center text-[11px] text-stone-400">
            הקשה על סימון פותחת את המידות שלו. גרירה מזיזה אותו על הקיר.
          </p>
        )
      )}
    </>
  );
}

/**
 * המידות של הסימון שנבחר.
 *
 * כל סימון מבקש בדיוק את מה שמודדים לו בשטח: שקע נמדד למרכז, דלת
 * נמדדת לקצה הפתח. הקצה שממנו מודדים והמנין לגובה נבחרים כאן, כי
 * בשטח מודדים מהצד שנוח להגיע אליו.
 */
function FeatureSettings({
  feature: f,
  wallLengthMm,
  wallHeightMm,
  onPatch,
  onRemove,
}: {
  feature: WallFeature;
  wallLengthMm: number;
  wallHeightMm: number;
  onPatch: (patch: Partial<WallFeature>) => void;
  onRemove: () => void;
}) {
  const def = featureDef(f.kind);
  const side: WallSide = f.fromSide ?? 'start';
  const heightRef: HeightRef = f.heightRef ?? 'floor';

  type Key = 'x' | 'width' | 'height' | 'y' | 'depth';

  const value = (key: Key) =>
    key === 'x'
      ? featureX(f, wallLengthMm)
      : key === 'y'
        ? featureY(f, wallHeightMm)
        : key === 'width'
          ? f.widthMm
          : key === 'depth'
            ? featureDepth(f)
            : f.heightMm;

  const write = (key: Key, mm: number) => {
    if (key === 'x') return onPatch({ xMm: featureXToMm(f, mm, wallLengthMm) });
    if (key === 'y') return onPatch({ yMm: featureYToMm(f, mm, wallHeightMm) });
    if (key === 'width') return onPatch({ widthMm: mm });
    if (key === 'depth') return onPatch({ depthMm: mm });
    // שינוי הגובה מזיז גם את התחתית, כשהמידה נמדדת מהתקרה
    const yMm =
      heightRef === 'ceiling' && !def.xToCenter ? Math.max(f.yMm + f.heightMm - mm, 0) : f.yMm;
    return onPatch({ heightMm: mm, yMm });
  };

  return (
    <div className="mt-2 rounded-xl border border-oak-300 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ background: def.tone }} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
          {def.label}
        </span>

        {/* מאיזה קצה של הקיר מודדים */}
        <div className="flex shrink-0 gap-0.5 rounded-lg bg-stone-100 p-0.5">
          {(['start', 'end'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onPatch({ fromSide: s })}
              aria-pressed={side === s}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                side === s ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>

        <button
          onClick={onRemove}
          aria-label={`הסרת ${def.label}`}
          className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {def.fields.map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
              {field.key === 'y' ? `${field.label} ${HEIGHT_REF_LABEL[heightRef]}` : field.label}
            </span>
            <MeasureInput
              value={value(field.key)}
              onChange={(mm) => write(field.key, mm)}
              minMm={field.key === 'x' || field.key === 'y' ? 0 : 20}
              ariaLabel={`${def.label} — ${field.label}`}
              className="num w-12 shrink-0 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
            />
            <span className="shrink-0 text-[10px] text-stone-400">ס״מ</span>
          </label>
        ))}
      </div>

      {/* מנין הגובה — רק כשיש בכלל גובה למדוד */}
      {def.fields.some((x) => x.key === 'y') && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-stone-400">הגובה נמדד</span>
          <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5">
            {(['floor', 'ceiling'] as const).map((r) => (
              <button
                key={r}
                onClick={() => onPatch({ heightRef: r })}
                aria-pressed={heightRef === r}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  heightRef === r ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                }`}
              >
                {HEIGHT_REF_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1.5 text-[10px] leading-snug text-stone-400">{def.hint}</p>
    </div>
  );
}
