import { Sheet } from '../../ui/Sheet';
import { Field, inputClass, selectOnFocus } from '../../ui/Field';
import { MeasureInput } from '../../ui/MeasureInput';
import { ChevronIcon } from '../../ui/icons';
import {
  STAT_KEYS,
  VIEW_OPTION_LABELS,
  orderedStats,
  viewOptions,
  useViewOptions,
  type StatKey,
  type ToggleKey,
} from './viewOptions';
import { unitLabel } from '../../ui/units';
import { wallName } from '../projects/wallLayouts';
import { WallFeaturesDesigner } from '../projects/WallFeaturesDesigner';
import { growToCeiling } from '../projects/wallFeatures';
import type { Wall } from '../../db/types';

/**
 * מידות הקיר ומה מוצג עליו.
 *
 * שניהם דברים ששייכים לקיר עצמו ולא לארגז, ולכן הם יושבים באותה
 * מגירה: קיר שנמדד לא נכון בשטח מתוקן כאן, בלי לחזור לאשף היצירה,
 * ומה שמוצג עליו נבחר כאן, בלי להצטופף בכותרת.
 */
export function WallToolsSheet({
  wall,
  index,
  onChange,
  onClose,
}: {
  wall: Wall;
  index: number;
  onChange: (patch: Partial<Wall>) => void;
  onClose: () => void;
}) {
  const view = useViewOptions();
  /*
   * המחוונים לפי הסדר שנקבע, ואחריהם מה שאינו מחוון — קו הגובה
   * והאזהרות. השניים האחרונים אינם אריחים ואין להם מקום בסדר.
   */
  const stats = orderedStats(view);
  const labelOf = (key: ToggleKey) =>
    VIEW_OPTION_LABELS.find((o) => o.key === key)!;
  const rows = [
    ...stats.map((key) => ({ ...labelOf(key), stat: key as StatKey })),
    ...VIEW_OPTION_LABELS.filter((o) => !STAT_KEYS.includes(o.key as StatKey)).map((o) => ({
      ...o,
      stat: undefined as StatKey | undefined,
    })),
  ];
  const statCount = stats.length;

  return (
    <Sheet title={`${wallName(index)} — מידות ותצוגה`} onClose={onClose} tall>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">מידות הקיר</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="אורך" hint={unitLabel()}>
              <MeasureInput
                value={wall.lengthMm}
                onChange={(mm) => onChange({ lengthMm: mm })}
                minMm={300}
                ariaLabel="אורך הקיר"
                className={`${inputClass} num text-end`}
              />
            </Field>
            <Field label="גובה" hint={unitLabel()}>
              <MeasureInput
                value={wall.heightMm}
                /*
                  עמוד ומדרגה עולים עד התקרה, ולכן הם עולים עם הקיר.
                  מי שקבע להם גובה משלו שומר עליו.
                */
                onChange={(mm) =>
                  onChange({
                    heightMm: mm,
                    features: growToCeiling(wall.features, wall.heightMm, mm),
                  })
                }
                minMm={1500}
                ariaLabel="גובה הקיר"
                className={`${inputClass} num text-end`}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs leading-snug text-stone-500">
            הארגזים לא זזים כשהקיר משתנה. מי שחורג מהקיר החדש יסומן
            באזהרה.
          </p>
        </section>

        {/*
          חלון או שקע לא תמיד ידועים ביצירת הפרויקט — לפעמים מגלים
          אותם רק במדידה בשטח. אותו עורך גרירה יושב גם כאן, כדי
          שאפשר יהיה להוסיף אותם בלי לחזור לאשף.
        */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">מה יש על הקיר</h3>
          <WallFeaturesDesigner
            features={wall.features}
            wallLengthMm={wall.lengthMm}
            wallHeightMm={wall.heightMm}
            onAdd={(f) => onChange({ features: [...wall.features, f] })}
            onPatch={(id, patch) =>
              onChange({
                features: wall.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
              })
            }
            onRemove={(id) => onChange({ features: wall.features.filter((f) => f.id !== id) })}
          />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">מה מוצג</h3>
          {/*
            המחוונים מופיעים לפי הסדר שנקבע להם, והחיצים מזיזים אותם.
            לכל נגר יש מספר אחד שהוא מסתכל עליו קודם, וסדר קבוע הכריח
            אותו לחפש אותו בכל פעם באותו מקום שלישי.
          */}
          <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {rows.map((o, i) => (
              <li key={o.key} className="flex items-center">
                <button
                  onClick={() => viewOptions.toggle(o.key)}
                  aria-pressed={!!view[o.key]}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-stone-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-800">{o.label}</span>
                    {o.hint && (
                      <span className="block text-[11px] text-stone-400">{o.hint}</span>
                    )}
                  </span>
                  <span
                    className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      view[o.key] ? 'bg-oak-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`size-4 rounded-full bg-white transition-transform ${
                        view[o.key] ? '-translate-x-4' : ''
                      }`}
                    />
                  </span>
                </button>
                {o.stat && (
                  <span className="flex shrink-0 flex-col pe-2">
                    <button
                      onClick={() => viewOptions.moveStat(o.stat!, -1)}
                      disabled={i === 0}
                      aria-label={`${o.label} — למעלה`}
                      className="grid size-6 place-items-center rounded text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25"
                    >
                      <ChevronIcon className="size-3.5 rotate-90" />
                    </button>
                    <button
                      onClick={() => viewOptions.moveStat(o.stat!, 1)}
                      disabled={i === statCount - 1}
                      aria-label={`${o.label} — למטה`}
                      className="grid size-6 place-items-center rounded text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25"
                    >
                      <ChevronIcon className="size-3.5 -rotate-90" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">שם הקיר</h3>
          <input
            value={wall.name ?? ''}
            onChange={(e) => onChange({ name: e.target.value || undefined })}
            onFocus={selectOnFocus}
            placeholder={wallName(index)}
            aria-label="שם הקיר"
            className={inputClass}
          />
          <p className="mt-2 text-xs leading-snug text-stone-500">
            שם משלך — "קיר הכיור", "מול החלון" — קל יותר לזכור מ״קיר ב׳״.
          </p>
        </section>
      </div>
    </Sheet>
  );
}
