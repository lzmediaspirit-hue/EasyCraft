import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { WORK_TONES, flagsFor, mayFlag, workSummary, workTone } from '../../workflow/unitWork';
import { cm, unitLabel } from '../../ui/units';
import type { PlacedUnit, UnitWork, UserRole } from '../../db/types';

/**
 * מצב הארגז בייצור.
 *
 * מי שפותח את המגירה רואה קודם איפה הארגז עומד, ואז מה מותר לו
 * לסמן — התכנת מסמן שהקבצים מוכנים, הנגר מסמן קנטים, הרכבה
 * והתקנה, והמנהל יכול לתקן הכול. סימון שאינו שלי מוצג ולא נלחץ,
 * כדי שאדע מה כבר נעשה בלי שאוכל לשנות עובדות בשטח של מישהו אחר.
 */
export function UnitWorkSheet({
  unit,
  role,
  onChange,
  onClose,
}: {
  unit: PlacedUnit;
  role: UserRole | undefined;
  onChange: (work: UnitWork) => void;
  onClose: () => void;
}) {
  const work = unit.work ?? {};
  const [issue, setIssue] = useState(work.issue ?? '');
  const tone = WORK_TONES[workTone(unit)];

  const set = (patch: Partial<UnitWork>) => onChange({ ...work, ...patch });

  return (
    <Sheet title={unit.name} onClose={onClose} tall>
      <div className="space-y-5">
        <div
          className="rounded-2xl border p-4"
          style={{ background: tone.fill, borderColor: tone.stroke }}
        >
          <span className="block text-sm font-semibold text-stone-900">{tone.label}</span>
          <span className="mt-0.5 block text-xs leading-snug text-stone-600">
            {workSummary(unit)}
          </span>
          <span className="num mt-1 block text-[11px] text-stone-500">
            {cm(unit.widthMm)}×{cm(unit.heightMm)}×{cm(unit.depthMm)} {unitLabel()}
          </span>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">מה נעשה</h3>
          <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {flagsFor(unit).map((f) => {
              const on = !!work[f.key];
              const mine = mayFlag(f, role);
              return (
                <li key={f.key}>
                  <button
                    onClick={() => mine && set({ [f.key]: !on })}
                    disabled={!mine}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors enabled:hover:bg-stone-50 disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-800">{f.label}</span>
                      <span className="block text-[11px] leading-snug text-stone-400">
                        {mine ? f.hint : 'לא בתפקיד שלך'}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        on ? 'bg-oak-600' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`size-4 rounded-full bg-white transition-transform ${
                          on ? '-translate-x-4' : ''
                        }`}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/*
          שאלה או בעיה צובעות את הארגז באדום על הקיר. זה מה שגורם
          למנהל לראות אותה בלי שמישהו יתקשר אליו.
        */}
        <section>
          <Field label="שאלה או בעיה" hint="צובע את הארגז באדום">
            <input
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              onFocus={selectOnFocus}
              placeholder="למשל: המידה בשטח לא תואמת"
              className={inputClass}
            />
          </Field>
          <div className="mt-2 flex gap-2">
            <PrimaryButton
              onClick={() => {
                set({ issue: issue.trim() || undefined });
                onClose();
              }}
            >
              שמירה
            </PrimaryButton>
            {work.issue && (
              <button
                onClick={() => {
                  setIssue('');
                  set({ issue: undefined });
                }}
                className="shrink-0 rounded-2xl border border-stone-200 px-4 text-sm font-medium text-stone-600 transition-colors hover:border-oak-300"
              >
                נפתר
              </button>
            )}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
