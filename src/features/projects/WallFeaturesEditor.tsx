import {
  FEATURE_DEFS,
  HEIGHT_REF_LABEL,
  SIDE_LABEL,
  featureDef,
  featureX,
  featureXToMm,
  featureY,
  featureYToMm,
  newFeature,
} from './wallFeatures';
import { MeasureInput } from '../../ui/MeasureInput';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import type { HeightRef, WallFeature, WallFeatureKind, WallSide } from '../../db/types';

/**
 * סימונים על קיר אחד.
 *
 * כל סימון מבקש בדיוק את המידות שמודדים לו בשטח: שקע נמדד למרכז
 * ולגובה, דלת נמדדת לקצה הפתח ולגובה הפתח. הקצה שממנו מודדים
 * והמנין לגובה נבחרים בכפתור, כי בשטח מודדים מהצד שנוח להגיע אליו.
 */
export function WallFeaturesEditor({
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
  return (
    <>
      <div className="space-y-2">
        {features.map((f) => {
          const def = featureDef(f.kind);
          const side: WallSide = f.fromSide ?? 'start';
          const heightRef: HeightRef = f.heightRef ?? 'floor';

          const value = (key: 'x' | 'width' | 'height' | 'y') =>
            key === 'x'
              ? featureX(f, wallLengthMm)
              : key === 'y'
                ? featureY(f, wallHeightMm)
                : key === 'width'
                  ? f.widthMm
                  : f.heightMm;

          const write = (key: 'x' | 'width' | 'height' | 'y', mm: number) => {
            if (key === 'x') return onPatch(f.id, { xMm: featureXToMm(f, mm, wallLengthMm) });
            if (key === 'y') return onPatch(f.id, { yMm: featureYToMm(f, mm, wallHeightMm) });
            if (key === 'width') return onPatch(f.id, { widthMm: mm });
            // שינוי הגובה מזיז גם את התחתית, כשהמידה נמדדת מהתקרה
            const yMm =
              heightRef === 'ceiling' && !def.xToCenter
                ? Math.max(f.yMm + f.heightMm - mm, 0)
                : f.yMm;
            return onPatch(f.id, { heightMm: mm, yMm });
          };

          return (
            <div key={f.id} className="rounded-xl border border-stone-200 bg-white p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: def.tone }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                  {def.label}
                </span>

                {/* מאיזה קצה של הקיר מודדים */}
                <div className="flex shrink-0 gap-0.5 rounded-lg bg-stone-100 p-0.5">
                  {(['start', 'end'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onPatch(f.id, { fromSide: s })}
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
                  onClick={() => onRemove(f.id)}
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
                      {field.key === 'y'
                        ? `${field.label} ${HEIGHT_REF_LABEL[heightRef]}`
                        : field.label}
                    </span>
                    <MeasureInput
                      value={value(field.key)}
                      onChange={(mm) => write(field.key, mm)}
                      minMm={field.key === 'width' || field.key === 'height' ? 20 : 0}
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
                        onClick={() => onPatch(f.id, { heightRef: r })}
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
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {FEATURE_DEFS.map((def) => (
          <button
            key={def.kind}
            onClick={() => onAdd(newFeature(def.kind as WallFeatureKind))}
            className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-3" />
            {def.label}
          </button>
        ))}
      </div>
    </>
  );
}
