import { MeasureInput } from './MeasureInput';

export const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-oak-500 focus:outline-none';

/**
 * בוחר את כל הטקסט בכניסה לשדה.
 * בנייד הסמן נוחת בצד הלא נכון בשדות מעורבי כיוון, ובחירה מלאה
 * מאפשרת פשוט להקליד את הערך החדש מחדש.
 */
export function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  const input = e.currentTarget;
  input.select();
  requestAnimationFrame(() => input.select());
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

/** כפתור הפעולה הראשית — אחד בכל מסך. */
export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white transition-colors hover:bg-oak-700 disabled:bg-stone-200 disabled:text-stone-400"
    >
      {children}
    </button>
  );
}

/** בחירה בודדת מתוך כמה אפשרויות קצרות. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

/** שדה מידה. נשמר במ"מ, מוצג ונערך בסנטימטרים. */
export function NumField({
  label,
  value,
  onChange,
  minMm = 0,
  inMm = false,
  hint,
}: {
  label: string;
  /** במ"מ */
  value: number;
  /** במ"מ */
  onChange: (mm: number) => void;
  minMm?: number;
  /** הצגה במ"מ במקום בסנטימטרים */
  inMm?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint ?? (inMm ? 'מ״מ' : 'ס״מ')}>
      <MeasureInput
        value={value}
        onChange={onChange}
        minMm={minMm}
        inMm={inMm}
        className={`${inputClass} num text-end`}
      />
    </Field>
  );
}
