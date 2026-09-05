import { Sheet } from '../../ui/Sheet';
import { Field, inputClass, selectOnFocus } from '../../ui/Field';
import { MeasureInput } from '../../ui/MeasureInput';
import { VIEW_OPTION_LABELS, viewOptions, useViewOptions } from './viewOptions';
import { unitLabel } from '../../ui/units';
import { wallName } from '../projects/wallLayouts';
import { WallFeaturesDesigner } from '../projects/WallFeaturesDesigner';
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
                onChange={(mm) => onChange({ heightMm: mm })}
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
          <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {VIEW_OPTION_LABELS.map((o) => (
              <li key={o.key}>
                <button
                  onClick={() => viewOptions.toggle(o.key)}
                  aria-pressed={view[o.key]}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-stone-50"
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
