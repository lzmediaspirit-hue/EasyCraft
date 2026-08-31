import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { EqualizeIcon } from '../../ui/icons';

/**
 * טבלת המרווחים בין המדפים.
 *
 * המרווחים תמיד מסתכמים לגובה הארגז. כששדה אחד משתנה, ההפרש מתחלק
 * שווה בשווה בין שאר המרווחים — כך שאי אפשר להגיע למצב שהמדפים לא
 * מסתדרים בתוך הארון.
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
  if (shelves < 1) return null;

  const slots = shelves + 1;
  const current = normalize(gaps, slots, heightMm);
  const equal = current.every((g) => Math.abs(g - heightMm / slots) < 1);

  function setGap(index: number, value: number) {
    const clamped = Math.min(Math.max(value, 20), heightMm - 20 * (slots - 1));
    const rest = heightMm - clamped;
    const others = current.filter((_, i) => i !== index);
    const othersTotal = others.reduce((a, b) => a + b, 0);

    const next = current.map((g, i) => {
      if (i === index) return clamped;
      // שומרים על היחס בין שאר המרווחים ומחלקים ביניהם את מה שנשאר
      const share = othersTotal > 0 ? g / othersTotal : 1 / others.length;
      return Math.max(Math.round(rest * share), 20);
    });
    onChange(next);
  }

  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-medium text-stone-500">מרווח בין מדפים</span>
        <button
          onClick={() => onChange(undefined)}
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
          <li key={i} className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-1.5">
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
