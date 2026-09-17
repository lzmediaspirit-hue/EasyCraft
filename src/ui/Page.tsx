import { nav } from '../nav/navigation';
import { BackIcon } from './icons';

/**
 * המעטפת של מסך שלם.
 *
 * אותו `<div>` בדיוק פתח תשעה מסכים, ומחרוזת שחוזרת תשע פעמים היא
 * תשע הזדמנויות שהיא תשתנה בשמונה מהן. `app-page` היא מה שגרסת
 * המחשב נתלית בו, וגובה מלא ורקע הם מה שמונע פס לבן בגלילה —
 * שלושתם החלטה אחת, ולכן הם יושבים במקום אחד.
 */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="app-page flex min-h-dvh flex-col bg-stone-50">{children}</div>;
}

/** כותרת מסך עם כפתור חזרה קטן. */
export function ScreenHeader({
  title,
  subtitle,
  count,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  /** שורה נוספת מתחת לכותרת, למשל חיפוש או לשוניות */
  children?: React.ReactNode;
  /** פעולה קטנה בקצה הכותרת */
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-5 pt-4 pb-3 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => nav.back()}
          aria-label="חזרה"
          className="-ms-2.5 shrink-0 rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800"
        >
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-xl font-bold text-stone-900">{title}</h1>
            {count !== undefined && count > 0 && (
              <span className="num shrink-0 text-sm font-medium text-stone-400">{count}</span>
            )}
          </div>
          {subtitle && <p className="truncate text-sm text-stone-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}
