import { useState } from 'react';
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
  help,
  error,
  group,
  children,
}: {
  label: string;
  hint?: string;
  /** הסבר קצר שנפתח בלחיצה על סימן שאלה, למונח שאינו מובן מאליו */
  help?: string;
  error?: string | null;
  /**
   * קבוצת כפתורים ולא שדה קלט יחיד.
   * label שעוטף כמה כפתורים גורם לכל אחד מהם לבלוע את שם השדה,
   * ואז מקריא המסך מכריז על כולם באותו שם ארוך.
   */
  group?: boolean;
  children: React.ReactNode;
}) {
  const Wrapper = group ? 'div' : 'label';
  return (
    <Wrapper className="block" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {help && <HelpDot label={label} text={help} />}
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-red-600">{error}</span>}
    </Wrapper>
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

/**
 * שדה מחיר עם תווית מעליו.
 *
 * שני מסכי הגדרות ציירו אותו פעמיים, ונבדלו רק ברקע — אחד יושב על
 * לוח לבן והשני על אפור. הרקע הוא ההבדל היחיד, ולכן הוא פרופ.
 */
export function PriceField({
  label,
  value,
  onChange,
  tone = 'sunken',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** על רקע אפור (sunken) או על לוח לבן (raised) */
  tone?: 'sunken' | 'raised';
}) {
  return (
    <label className={`block rounded-xl px-3 py-2 ${tone === 'raised' ? 'bg-white' : 'bg-stone-100'}`}>
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        placeholder="₪"
        className="num w-full bg-transparent text-base font-medium text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
    </label>
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
      /* השבב הוא מתג, ובלי aria-pressed מי שמקשיב למסך לא שומע אם הוא דלוק */
      aria-pressed={active}
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
  help,
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
  help?: string;
}) {
  return (
    <Field label={label} hint={hint ?? (inMm ? 'מ״מ' : 'ס״מ')} help={help}>
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

/**
 * סימן שאלה שפותח הסבר קצר.
 *
 * מונחים כמו "שקע הגב בחריץ" ברורים לנגר ותיק ולא לכל אחד, וההסבר
 * שייך לצד השדה — לא במדריך נפרד שאף אחד לא פותח.
 *
 * למה span ולא button: הסימן יושב בתוך ה-<label> של השדה, וכפתור
 * הוא איבר שתווית יודעת לסמן. כשהוא הראשון בתוך התווית — וכך
 * הוא מסודר על המסך — התווית נצמדת אליו במקום אל שדה הקלט,
 * והשדה נשאר בלי שם. span אינו איבר שמסמנים, ולכן התווית
 * מדלגת עליו ומגיעה לקלט. התפקיד והמקלדת מושלמים כאן ביד.
 */
function HelpDot({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          /* בלי זה הלחיצה ממשיכה לתווית וקופצת לשדה הקלט */
          e.preventDefault();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={open}
        aria-label={`מה זה ${label}`}
        className={`grid size-4 shrink-0 cursor-pointer place-items-center rounded-full text-[10px] font-bold transition-colors ${
          open ? 'bg-oak-600 text-white' : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
        }`}
      >
        ?
      </span>
      {open && (
        <span className="mt-1 block w-full basis-full rounded-lg bg-stone-100 px-2.5 py-2 text-[11px] leading-snug font-normal text-stone-600">
          {text}
        </span>
      )}
    </>
  );
}
