/**
 * מספר אחד עם שם.
 *
 * ארבעה מסכים ציירו את אותו הקופסה הזאת בארבע וריאציות שנבדלו
 * בגובה הכתב וברקע. השוני היה מקרי ולא כוונה, ולכן הוא הפך לשתי
 * אפשרויות: כרטיס עם מסגרת או משטח שטוח, בגודל גדול או קטן.
 */
export function Stat({
  label,
  value,
  unit,
  tone = 'plain',
  variant = 'card',
  size = 'lg',
}: {
  label: string;
  value: string | number;
  unit?: string;
  /** צבע המספר או הרקע — לפי מה שהמספר אומר */
  tone?: 'plain' | 'bad' | 'ok' | 'due';
  variant?: 'card' | 'flat';
  size?: 'lg' | 'sm';
}) {
  const box =
    variant === 'card'
      ? 'rounded-xl border border-stone-200 bg-white px-3 py-2'
      : `rounded-xl px-2.5 py-2 ${
          tone === 'ok' ? 'bg-oak-50' : tone === 'due' ? 'bg-amber-50' : 'bg-stone-50'
        }`;

  return (
    <div className={box}>
      <span className={`block text-stone-500 ${size === 'lg' ? 'text-[11px]' : 'text-[10px]'}`}>
        {label}
      </span>
      <span
        className={`flex items-baseline gap-1 font-semibold ${
          size === 'lg' ? 'text-lg' : 'text-sm'
        } ${tone === 'bad' ? 'text-red-600' : 'text-stone-900'}`}
      >
        <span className="num">{value}</span>
        {unit && <span className="text-xs font-normal text-stone-400">{unit}</span>}
      </span>
    </div>
  );
}
