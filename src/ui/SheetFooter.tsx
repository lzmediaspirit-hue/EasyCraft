import { PrimaryButton } from './Field';
import { TrashIcon } from './icons';

/**
 * התחתית של גיליון עריכה: שמירה, ולצידה מחיקה של מה שנערך.
 *
 * שלושה גיליונות — משתמש, חומר וגוון — ציירו את אותה שורה בדיוק,
 * ונבדלו רק בתווית המחיקה. הם עורכים דברים שונים, אבל שואלים את
 * אותה שאלה: לשמור, או להיפטר מזה.
 *
 * המחיקה שמאלית וקטנה, השמירה תופסת את השאר: זו הפעולה שמגיעים
 * אליה, והשנייה היא יציאת חירום ולא בחירה שקולה.
 */
export function SheetFooter({
  canSave,
  onSave,
  onRemove,
  removeLabel,
}: {
  canSave: boolean;
  onSave: () => void;
  /** ריק = אין מה למחוק, כי זה פריט חדש */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={removeLabel}
          className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon />
        </button>
      )}
      <div className="flex-1">
        <PrimaryButton disabled={!canSave} onClick={onSave}>
          שמירה
        </PrimaryButton>
      </div>
    </div>
  );
}
