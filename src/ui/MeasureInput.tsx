import { useEffect, useRef, useState } from 'react';
import { fromMm, toMm } from './units';

/**
 * שדה מידה. נשמר במ"מ, נערך בסנטימטרים.
 *
 * תוך כדי הקלדה השדה מחזיק את מה שהוקלד ולא את הערך המתוקן — אחרת
 * הדרך למספר גדול נחסמת: הקלדת "1" בדרך ל-"60" הייתה נתקנת מיד
 * למינימום והמספר היה קופץ מתחת לאצבע. התיקון קורה ביציאה מהשדה.
 *
 * הערך נשמר החוצה אחרי רגע של שקט ולא בכל תו. מאחורי השדה הזה
 * יושבים בסיס נתונים, בניית החדר וציור של מאות לוחות, וכולם רצו
 * שלוש פעמים בדרך מ-"6" ל-"600" — זה מה שהרגיש כבד תחת האצבע.
 * מה שנראה על המסך אינו מחכה: הוא נלקח מהטיוטה המקומית.
 */
const SETTLE_MS = 180;
export function MeasureInput({
  value,
  onChange,
  minMm = 0,
  maxMm,
  inMm = false,
  className = '',
  ariaLabel,
  onFocus,
  autoFocus,
}: {
  /** במ"מ */
  value: number;
  /** במ"מ */
  onChange: (mm: number) => void;
  minMm?: number;
  maxMm?: number;
  /** הצגה במ"מ במקום בסנטימטרים — לערכים קטנים כמו עובי כרסום */
  inMm?: boolean;
  className?: string;
  ariaLabel?: string;
  /** נקרא בנוסף לבחירת הטקסט — למשל כדי לסמן את הציר שנערך */
  onFocus?: () => void;
  /** מיקוד מיידי — לשדה שנפתח בלחיצה מפורשת, ולכן המקלדת מבוקשת */
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = null;
  };
  // שדה שיצא מהמסך באמצע הקלדה לא ישאיר טיימר שיורה אל תוך הריק
  useEffect(() => stop, []);
  // `inMm` הוא שדה שתמיד במ"מ (כרסום, עובי); השאר לפי יחידת התצוגה
  const show = (mm: number) => String(inMm ? mm : fromMm(mm));
  const parse = (v: number) => (inMm ? Math.round(v) : toMm(v));

  function clamp(mm: number): number {
    const lo = Math.max(mm, minMm);
    return maxMm === undefined ? lo : Math.min(lo, maxMm);
  }

  return (
    <input
      value={draft ?? show(value)}
      aria-label={ariaLabel}
      onFocus={(e) => {
        onFocus?.();
        setDraft(show(value));
        const input = e.currentTarget;
        // בחירה מיידית, ושוב בפריים הבא — בנייד המיקוד לפעמים מאפס
        // את הבחירה, והקלדה מהירה הייתה מתווספת במקום להחליף
        input.select();
        requestAnimationFrame(() => input.select());
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = Number(raw);
        stop();
        // שדה ריק או חצי מוקלד נשאר על המסך, אבל לא נשמר
        if (raw.trim() !== '' && Number.isFinite(n)) {
          settle.current = setTimeout(() => onChange(parse(n)), SETTLE_MS);
        }
      }}
      onBlur={() => {
        stop();
        const n = Number(draft);
        onChange(clamp(draft?.trim() && Number.isFinite(n) ? parse(n) : value));
        setDraft(null);
      }}
      type="number"
      inputMode="decimal"
      autoFocus={autoFocus}
      className={className}
    />
  );
}
