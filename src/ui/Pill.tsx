/**
 * בורר קטן: מספר או מילה שנבחרים מתוך שורה.
 *
 * עורך הארגז, עורך הפנים וגיליון הספרייה ציירו אותו שלוש פעמים,
 * באותה התנהגות. מה שנבדל ביניהם — הגודל, ותווית ארוכה שצריכה
 * להיחתך במקום לדחוף את השורה — הוא פרופ.
 */
export function Pill({
  active,
  onClick,
  size = 'md',
  ariaLabel,
  wide = false,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** אפשרות שאינה קיימת במצב הנוכחי — מוצגת ואינה נלחצת */
  disabled?: boolean;
  size?: 'md' | 'sm';
  /** תווית ארוכה — נמתחת עד סוף השורה ונחתכת, במקום לדחוף אותה */
  wide?: boolean;
  /** שם לקורא מסך, כשהמספר לבדו אינו אומר במה מדובר */
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      /* בורר ולא מתג, אבל קורא מסך צריך לדעת מה נבחר */
      aria-pressed={active}
      className={`font-medium transition-colors ${
        wide ? 'max-w-full truncate' : 'num shrink-0'
      } ${
        size === 'md'
          ? 'min-w-9 rounded-lg px-3 py-1.5 text-sm'
          : 'min-w-7 rounded-md px-2.5 py-1.5 text-[11px]'
      } ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}
