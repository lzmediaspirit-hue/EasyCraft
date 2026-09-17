import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { SaveError, useSaveGuard } from '../../ui/saveGuard';
import { Field, PrimaryButton, Chip } from '../../ui/Field';
import { MeasureInput } from '../../ui/MeasureInput';
import { inputClass } from '../../ui/Field';
import { fromMm, unitLabel } from '../../ui/units';

const DEPTHS = [300, 320, 350, 400, 450, 500, 560, 580, 600, 650];

/**
 * קביעת עומק אחיד לארונות הפרויקט.
 *
 * העומק כאן הוא העומק הכולל, כולל החזית — כך שמה שנמדד בשטח
 * מקצה הקיר עד פני הדלת הוא בדיוק המספר הזה, וכך גם בעריכה
 * המהירה של ארגז בודד.
 *
 * ומה שהפעולה *אינה* נוגעת בו נאמר כאן ולא מתגלה אחר כך: מכשיר
 * חשמלי נקנה במידת היצרן, ולוח בודד — שהעומק שלו הוא העובי —
 * אינו ארון.
 */
export function DepthSheet({
  currentMm,
  onApply,
  onClose,
}: {
  currentMm: number;
  onApply: (mm: number, onlyFloor: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [depth, setDepth] = useState(currentMm || 580);
  const [onlyFloor, setOnlyFloor] = useState(true);
  const guard = useSaveGuard();

  return (
    <Sheet
      title="עומק אחיד"
      onClose={onClose}
      footer={
        <>
          <SaveError text={guard.error} />
          <PrimaryButton
            disabled={guard.busy}
            onClick={() => guard.run(() => onApply(depth, onlyFloor))}
          >
            החלה על הארונות
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        {/*
          התווית נגזרת מיחידת התצוגה ולא נכתבת קבוע. כשההצגה הייתה
          במ"מ, השדה הראה 600 לצד "ס״מ" — ומי שהקליד 60 לפי התווית
          קיבל 100 מ"מ אחרי ההגבלה התחתונה.
        */}
        <Field label="עומק כולל חזית" hint={unitLabel()}>
          <MeasureInput
            value={depth}
            onChange={setDepth}
            minMm={100}
            className={`${inputClass} num text-end`}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {DEPTHS.map((mm) => (
            <Chip key={mm} active={mm === depth} onClick={() => setDepth(mm)}>
              <span className="num">{fromMm(mm)}</span>
            </Chip>
          ))}
        </div>

        <Field group label="על מה להחיל">
          <div className="flex gap-1.5">
            <Chip active={onlyFloor} onClick={() => setOnlyFloor(true)}>
              רק ארונות רצפה
            </Chip>
            <Chip active={!onlyFloor} onClick={() => setOnlyFloor(false)}>
              כל הארונות
            </Chip>
          </div>
          <span className="mt-1.5 block text-xs text-stone-400">
            ארונות תלויים לרוב רדודים יותר, ולכן ברירת המחדל מדלגת עליהם.
          </span>
        </Field>

        <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
          מכשירי חשמל ולוחות בודדים אינם משתנים: מידת מכשיר היא של היצרן,
          ובלוח בודד העומק הוא העובי.
        </p>
      </div>
    </Sheet>
  );
}
