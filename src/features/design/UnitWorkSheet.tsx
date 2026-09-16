import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import {
  stagesOf,
  WORK_TONES,
  canAdvance,
  stageOf,
  tracksOf,
  withStage,
  workSummary,
  workTone,
} from '../../workflow/unitWork';
import { cm, unitLabel } from '../../ui/units';
import type { PlacedUnit, UnitWork, UserRole } from '../../db/types';

/**
 * מצב הארגז בייצור.
 *
 * לכל מסלול — גוף, גב, חזיתות, דפנות זרות — שרשרת משלו, ובכל
 * שרשרת רואים איפה היא עומדת ומה השלב הבא. שלב שאינו בתפקיד שלך
 * מוצג ולא נלחץ, כדי שתדע מה כבר נעשה בלי שתוכל לשנות עובדות
 * בשטח של מישהו אחר.
 */
export function UnitWorkSheet({
  unit,
  role,
  shown,
  project,
  onChange,
  onClose,
}: {
  unit: PlacedUnit;
  /** מי שנכנס באמת — ממנו נגזרת הסמכות */
  role: UserRole | undefined;
  /** התפקיד שנבחר לצפייה, כשהוא אינו התפקיד האמיתי */
  shown?: UserRole;
  /** הפרויקט — הייצור נפתח רק אחרי המכירה */
  project?: { soldAt?: number };
  onChange: (work: UnitWork) => void;
  onClose: () => void;
}) {

  const [issue, setIssue] = useState(unit.work?.issue ?? '');
  const tone = WORK_TONES[workTone(unit)];
  const tracks = tracksOf(unit);

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

        {tracks.length === 0 ? (
          <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-snug text-stone-500">
            לפריט הזה אין תהליך ייצור — הוא נקנה או שהוא לוח בודד.
          </p>
        ) : (
          tracks.map((t) => {
            const current = stageOf(unit, t.key);
            /* השרשרת של המסלול הזה — מדף אינו עובר דרך "הורכב" */
            const steps = stagesOf(t);
            const at = steps.findIndex((x) => x.key === current);
            return (
              <section key={t.key}>
                <h3 className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-stone-700">{t.label}</span>
                  <span className="text-[11px] text-stone-400">{t.hint}</span>
                </h3>

                <ol className="flex flex-wrap gap-1.5">
                  {steps.map((step, i) => {
                    const done = i <= at;
                    const check = canAdvance(unit, t, step.key, role, project, shown);

                    return (
                      <li key={step.key}>
                        <button
                          onClick={() => check.ok && onChange(withStage(unit.work, t, step.key))}
                          disabled={!check.ok}
                          aria-pressed={done}
                          title={check.why}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            done
                              ? 'bg-oak-600 text-white'
                              : 'bg-stone-100 text-stone-600 enabled:hover:bg-stone-200'
                          } disabled:opacity-40`}
                        >
                          {step.label}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })
        )}

        {/*
          שאלה או בעיה צובעות את הארגז באדום על הקיר. זה מה שגורם
          למנהל לראות אותה בלי שמישהו יתקשר אליו.
        */}
        <section className="border-t border-stone-100 pt-4">
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
                onChange({ ...unit.work, issue: issue.trim() || undefined });
                onClose();
              }}
            >
              שמירה
            </PrimaryButton>
            {unit.work?.issue && (
              <button
                onClick={() => {
                  setIssue('');
                  onChange({ ...unit.work, issue: undefined });
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
