import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, Chip } from '../../ui/Field';
import { MeasureInput } from '../../ui/MeasureInput';
import { inputClass } from '../../ui/Field';

const DEPTHS = [300, 320, 350, 400, 450, 500, 560, 580, 600, 650];

/**
 * קביעת עומק אחיד לכל הארונות בפרויקט.
 * העומק כאן הוא העומק הכולל, כולל החזית — כך שמה שנמדד בשטח
 * מקצה הקיר עד פני הדלת הוא בדיוק המספר הזה.
 */
export function DepthSheet({
  currentMm,
  onApply,
  onClose,
}: {
  currentMm: number;
  onApply: (mm: number, onlyFloor: boolean) => void;
  onClose: () => void;
}) {
  const [depth, setDepth] = useState(currentMm || 580);
  const [onlyFloor, setOnlyFloor] = useState(true);

  return (
    <Sheet
      title="עומק אחיד"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={() => onApply(depth, onlyFloor)}>
          החלה על כל הארונות
        </PrimaryButton>
      }
    >
      <div className="space-y-5">
        <Field label="עומק כולל חזית" hint='ס״מ'>
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
              <span className="num">{mm / 10}</span>
            </Chip>
          ))}
        </div>

        <Field label="על מה להחיל">
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
      </div>
    </Sheet>
  );
}
