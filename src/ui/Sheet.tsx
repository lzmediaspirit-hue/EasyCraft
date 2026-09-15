import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BackIcon, CloseIcon } from './icons';

/**
 * המגירות הפתוחות, מהתחתונה לעליונה.
 *
 * Escape סוגר את העליונה בלבד. קודם כל מגירה האזינה בעצמה, ולכן
 * הקשה אחת סגרה גם את עורך הארגז וגם את הספרייה שממנה הוא נפתח —
 * והמשתמש איבד את ההקשר שבו עבד.
 */
const open: symbol[] = [];

/** מה שאפשר להגיע אליו ב-Tab */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';


type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** אזור הפעולה הקבוע בתחתית — פעולה ראשית אחת */
  footer?: React.ReactNode;
  /** מגירה גבוהה לתוכן ארוך כמו ספריית מוצרים */
  tall?: boolean;
  /** עוטף בטופס, כדי ש-Enter ישלח */
  onSubmit?: (e: React.FormEvent) => void;
  /** חזרה לשלב הקודם בתוך המגירה */
  onBack?: () => void;
};

/**
 * מגירה שנפתחת מתחתית המסך. מציגה דבר אחד בכל פעם.
 *
 * המגירה נשתלת ישירות ב-body ולא במקום שבו נכתבה. `position: fixed`
 * מתייחס לאב שיש עליו `filter`, `transform` או `backdrop-blur`, וכותרת
 * המסך מטושטשת — כך שמגירה שנפתחה מתוכה נחתכה לגובה הכותרת. השתילה
 * מוציאה אותה מהשרשרת הזו, ומכאן היא תמיד ממלאת את המסך.
 */
export function Sheet({ title, onClose, children, footer, tall, onSubmit, onBack }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const me = Symbol('sheet');
    open.push(me);
    /* מי שפתח — לשם חוזר המיקוד כשהמגירה נסגרת */
    const opener = document.activeElement as HTMLElement | null;
    /*
     * המיקוד נכנס למגירה. בלי זה הוא נשאר על הכפתור שברקע, ו-Tab
     * המשיך לטייל במסך שמאחור בזמן שהמגירה פתוחה.
     */
    if (!box.current?.contains(document.activeElement)) {
      box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      /* רק העליונה מגיבה */
      if (open[open.length - 1] !== me || !box.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const now = document.activeElement;
      const outside = !box.current.contains(now);
      if (e.shiftKey && (now === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (now === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = open.indexOf(me);
      if (i >= 0) open.splice(i, 1);
      opener?.focus?.();
    };
  }, [onClose]);


  const Body = onSubmit ? 'form' : 'div';

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-stone-900/40"
      />
      <Body
        ref={box as React.Ref<HTMLDivElement & HTMLFormElement>}
        onSubmit={onSubmit}
        role="dialog"

        aria-modal="true"
        aria-label={title}
        className={`relative mx-auto flex w-full max-w-lg animate-sheet-in flex-col rounded-t-3xl bg-white shadow-2xl ${
          tall ? 'h-[86dvh]' : 'max-h-[86dvh]'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-1.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="לשלב הקודם"
                className="-ms-2.5 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <BackIcon />
              </button>
            )}
            <h2 className="truncate text-lg font-semibold text-stone-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="-me-2 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-stone-100 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </Body>
    </div>,
    document.body,
  );
}
