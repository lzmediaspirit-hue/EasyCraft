import { Sheet } from './Sheet';

/**
 * שאלה לפני מחיקה.
 *
 * מחיקה היא פעולה שאי אפשר לבטל, ולכן היא נשאלת — ולא נלקחת
 * מלחיצה אחת על אייקון פח. השאלה אומרת מה נמחק בשמו, ומה זה
 * אומר: נגר שמוחק ארגז מהספרייה צריך לדעת שהפרויקטים הקיימים
 * אינם נוגעים בזה, ומי שמוחק ארגז מקיר צריך לדעת שהוא זה שיורד.
 *
 * "ביטול" אינו משנה דבר, וזו כל התכלית שלו.
 */
export function ConfirmSheet({
  title,
  what,
  impact,
  confirmLabel = 'כן, למחוק',
  onConfirm,
  onClose,
}: {
  title: string;
  /** מה בדיוק נמחק — שם, מק״ט, או "3 ארגזים" */
  what: string;
  /** מה זה אומר, במשפט */
  impact: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-sm font-semibold text-stone-900">{what}</p>
      <p className="mt-1.5 text-xs leading-snug text-stone-600">{impact}</p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          {confirmLabel}
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200"
        >
          ביטול
        </button>
      </div>
    </Sheet>
  );
}
