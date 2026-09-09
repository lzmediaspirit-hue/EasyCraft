/**
 * בורר קטן: מספר או מילה שנבחרים מתוך שורה.
 *
 * עורך הארגז ועורך הפנים ציירו אותו פעמיים, באותה התנהגות ובשני
 * גדלים. הגודל הוא ההבדל היחיד, ולכן הוא פרופ.
 */
export function Pill({
  active,
  onClick,
  size = 'md',
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  size?: 'md' | 'sm';
  /** שם לקורא מסך, כשהמספר לבדו אינו אומר במה מדובר */
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      /* בורר ולא מתג, אבל קורא מסך צריך לדעת מה נבחר */
      aria-pressed={active}
      className={`num shrink-0 font-medium transition-colors ${
        size === 'md'
          ? 'min-w-9 rounded-lg px-3 py-1.5 text-sm'
          : 'min-w-7 rounded-md px-2.5 py-1.5 text-[11px]'
      } ${active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
    >
      {children}
    </button>
  );
}
