import { useState } from 'react';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { EqualizeIcon, LockIcon, UnlockIcon } from '../../ui/icons';

/**
 * טבלת המרווחים בין המדפים.
 *
 * המרווחים תמיד מסתכמים לגובה האזור, אז שינוי באחד חייב לבוא על חשבון
 * האחרים. נעילה על מרווח מוציאה אותו מהחלוקה הזו — כך אפשר לקבע מרווח
 * שכבר נכון ולשנות רק את השאר.
 */
export function ShelfGaps({
  shelves,
  heightMm,
  gaps,
  onChange,
}: {
  shelves: number;
  heightMm: number;
  gaps?: number[];
  onChange: (gaps: number[] | undefined) => void;
}) {
  const slots = shelves + 1;
  const [locked, setLocked] = useState<boolean[]>([]);

  if (shelves < 1) return null;

  const current = normalize(gaps, slots, heightMm);
  const isLocked = (i: number) => locked[i] ?? false;
  const equal = current.every((g) => Math.abs(g - heightMm / slots) < 1);

  function toggleLock(i: number) {
    setLocked((prev) => {
      const next = [...prev];
      next[i] = !(next[i] ?? false);
      return next;
    });
  }

  function setGap(index: number, value: number) {
    // המרווחים הנעולים ומזה שנערך נשארים; ההפרש מתחלק בין הנותרים
    const free = current.map((_, i) => i !== index && !isLocked(i));
    const freeCount = free.filter(Boolean).length;
    if (freeCount === 0) return;

    const fixed = current.reduce((sum, g, i) => (free[i] ? sum : sum + (i === index ? 0 : g)), 0);
    const maxForEdited = heightMm - fixed - 20 * freeCount;
    const clamped = Math.min(Math.max(value, 20), Math.max(maxForEdited, 20));

    const rest = heightMm - fixed - clamped;
    const freeTotal = current.reduce((sum, g, i) => (free[i] ? sum + g : sum), 0);

    onChange(
      current.map((g, i) => {
        if (i === index) return clamped;
        if (!free[i]) return g;
        const share = freeTotal > 0 ? g / freeTotal : 1 / freeCount;
        return Math.max(Math.round(rest * share), 20);
      }),
    );
  }

  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-medium text-stone-500">מרווח בין מדפים</span>
        <button
          onClick={() => {
            setLocked([]);
            onChange(undefined);
          }}
          disabled={equal}
          aria-label="השוואת המרווחים"
          title="השוואת המרווחים"
          className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-oak-700 disabled:opacity-30"
        >
          <EqualizeIcon className="size-4" />
        </button>
      </span>

      <ul className="space-y-1">
        {current.map((gap, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg bg-stone-100 px-2 py-1.5">
            <button
              onClick={() => toggleLock(i)}
              aria-label={isLocked(i) ? `שחרור מרווח ${i + 1}` : `נעילת מרווח ${i + 1}`}
              aria-pressed={isLocked(i)}
              className={`shrink-0 rounded-md p-1 transition-colors ${
                isLocked(i)
                  ? 'bg-oak-600 text-white'
                  : 'text-stone-400 hover:bg-stone-200 hover:text-stone-700'
              }`}
            >
              {isLocked(i) ? <LockIcon className="size-3.5" /> : <UnlockIcon className="size-3.5" />}
            </button>

            <span className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
              {i === 0 ? 'תחתית' : `מדף ${i}`} ← {i === shelves ? 'תקרה' : `מדף ${i + 1}`}
            </span>

            <MeasureInput
              value={gap}
              onChange={(mm) => setGap(i, mm)}
              minMm={20}
              ariaLabel={`מרווח ${i + 1}`}
              className="num w-14 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
            />
            <span className="shrink-0 text-[10px] text-stone-400">ס״מ</span>
          </li>
        ))}
      </ul>

      <p className="mt-1 text-[10px] text-stone-400">
        סך המרווחים: <span className="num">{cm(heightMm)}</span> ס״מ
      </p>
    </div>
  );
}

/** משלים מערך מרווחים חסר או לא תואם למרווחים שווים. */
function normalize(gaps: number[] | undefined, slots: number, heightMm: number): number[] {
  if (gaps && gaps.length === slots) {
    const total = gaps.reduce((a, b) => a + b, 0);
    if (total > 0) {
      // מותחים לגובה הנוכחי, כדי שגם אחרי שינוי גובה הארגז הסכום נכון
      return gaps.map((g) => Math.round((g / total) * heightMm));
    }
  }
  return Array.from({ length: slots }, () => Math.round(heightMm / slots));
}
