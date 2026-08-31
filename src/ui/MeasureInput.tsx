import { useState } from 'react';
import { cmToMm, mmToCm } from './units';

/**
 * שדה מידה. נשמר במ"מ, נערך בסנטימטרים.
 *
 * תוך כדי הקלדה השדה מחזיק את מה שהוקלד ולא את הערך המתוקן — אחרת
 * הדרך למספר גדול נחסמת: הקלדת "1" בדרך ל-"60" הייתה נתקנת מיד
 * למינימום והמספר היה קופץ מתחת לאצבע. התיקון קורה ביציאה מהשדה.
 */
export function MeasureInput({
  value,
  onChange,
  minMm = 0,
  maxMm,
  className = '',
  ariaLabel,
}: {
  /** במ"מ */
  value: number;
  /** במ"מ */
  onChange: (mm: number) => void;
  minMm?: number;
  maxMm?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function clamp(mm: number): number {
    const lo = Math.max(mm, minMm);
    return maxMm === undefined ? lo : Math.min(lo, maxMm);
  }

  return (
    <input
      value={draft ?? String(mmToCm(value))}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setDraft(String(mmToCm(value)));
        const input = e.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = Number(raw);
        // שדה ריק או חצי מוקלד נשאר על המסך, אבל לא נשמר
        if (raw.trim() !== '' && Number.isFinite(n)) onChange(cmToMm(n));
      }}
      onBlur={() => {
        const n = Number(draft);
        onChange(clamp(draft?.trim() && Number.isFinite(n) ? cmToMm(n) : value));
        setDraft(null);
      }}
      type="number"
      inputMode="decimal"
      className={className}
    />
  );
}
