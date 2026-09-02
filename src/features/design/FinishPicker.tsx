import { PlusIcon } from '../../ui/icons';
import type { Finish } from '../../db/types';

/**
 * בחירת גוון לחלק מסוים בארגז.
 * לצד הבחירה יש קיצור שמחיל את אותו גוון על כל הארונות בפרויקט —
 * כי בפועל הגוף כולו מגוון אחד, והחזיתות מגוון אחר.
 */
export function FinishPicker({
  label,
  finishes,
  value,
  onChange,
  onApplyAll,
  onAddBoard,
}: {
  label: string;
  finishes: Finish[];
  value?: string;
  onChange: (finishId: string | undefined) => void;
  onApplyAll: (finishId: string | undefined) => void;
  /** פתיחת לוח חדש לתפקיד הזה, כשהגוון שצריך עוד לא קיים */
  onAddBoard: () => void;
}) {
  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-medium text-stone-500">{label}</span>
        <button
          onClick={() => onApplyAll(value)}
          className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-oak-700"
        >
          לכל הפרויקט
        </button>
        {/* גוון חדש מתחיל בלוח — ולכן אפשר להוסיף אותו בלי לצאת מהעריכה */}
        <button
          onClick={onAddBoard}
          aria-label={`הוספת לוח ל${label}`}
          className="flex items-center gap-0.5 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-oak-700"
        >
          <PlusIcon className="size-3" />
          לוח חדש
        </button>
      </span>

      {/*
        אין "ללא": כל חלק נבנה מחומר כלשהו, ולכן חייב גוון. בלעדיו
        החישוב היה נופל לברירת מחדל בשקט, והנגר לא היה יודע ממה
        בדיוק הוא מזמין.
      */}
      <div className="flex flex-wrap gap-1.5">
        {finishes.map((f) => (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            title={f.code ? `${f.name} · ${f.code}` : f.name}
            className={`flex items-center gap-1.5 rounded-lg py-1 pe-2.5 ps-1 text-sm font-medium transition-colors ${
              value === f.id ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span
              className="size-5 shrink-0 rounded border border-black/10"
              style={{ background: f.hex }}
            />
            <span className="max-w-20 truncate">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
