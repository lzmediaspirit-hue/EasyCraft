import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { cm, cmToMm, mmToCm } from '../../ui/units';
import { selectOnFocus } from '../../ui/Field';
import { CloseIcon, PencilIcon, TrashIcon } from '../../ui/icons';
import type { PlacedUnit } from '../../db/types';

/**
 * הלוח שנפתח כשארגז נבחר — מחליף את כפתור ההוספה.
 * מוצג רק כשיש ארגז נבחר, ונעלם ברגע שמבטלים את הבחירה.
 */
export function UnitEditor({
  unit,
  wallLengthMm,
  onChange,
  onEdit,
  onRemove,
  onClose,
}: {
  unit: PlacedUnit;
  wallLengthMm: number;
  onChange: (patch: Partial<PlacedUnit>) => void;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  const widths = source?.widthOptionsMm ?? [];
  const locked = unit.floorLocked ?? false;
  const fromEnd = unit.anchorEnd ?? false;

  /** המרחק שמוצג למשתמש — מהקצה שהוא בחר למדוד ממנו. */
  const offsetMm = fromEnd ? wallLengthMm - (unit.xMm + unit.widthMm) : unit.xMm;

  function setOffset(mm: number) {
    const max = Math.max(wallLengthMm - unit.widthMm, 0);
    const x = fromEnd ? wallLengthMm - unit.widthMm - mm : mm;
    onChange({ xMm: Math.round(Math.min(Math.max(x, 0), max)) });
  }

  return (
    <div className="rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)]">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-stone-900">{unit.name}</h2>
        <button
          onClick={onEdit}
          aria-label="עריכת הארגז"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-oak-50 hover:text-oak-700"
        >
          <PencilIcon className="size-5" />
        </button>
        <button
          onClick={onRemove}
          aria-label="הסרת הארגז"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-5" />
        </button>
        <button
          onClick={onClose}
          aria-label="סיום עריכה"
          className="-me-2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      {widths.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {widths.map((w) => (
            <button
              key={w}
              onClick={() => onChange({ widthMm: w })}
              className={`num shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                w === unit.widthMm
                  ? 'bg-oak-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cm(w)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumBox
          label="רוחב"
          value={unit.widthMm}
          onChange={(mm) => onChange({ widthMm: Math.max(mm, 50) })}
        />
        <NumBox
          label="גובה"
          value={unit.heightMm}
          onChange={(mm) => onChange({ heightMm: Math.max(mm, 50) })}
        />
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        <div className="flex shrink-0 flex-col justify-center rounded-xl bg-stone-100 p-1">
          <span className="px-2 pb-1 text-[11px] text-stone-500">נמדד מ־</span>
          <div className="flex gap-1">
            <EdgeChip active={fromEnd} onClick={() => onChange({ anchorEnd: true })}>
              ימין
            </EdgeChip>
            <EdgeChip active={!fromEnd} onClick={() => onChange({ anchorEnd: false })}>
              שמאל
            </EdgeChip>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <NumBox label="מיקום מהקצה" value={offsetMm} onChange={setOffset} />
        </div>
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        <button
          onClick={() =>
            onChange({
              floorLocked: !locked,
              ...(locked ? {} : { yMm: unit.socleMm ?? 0 }),
            })
          }
          aria-pressed={locked}
          className={`flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors ${
            locked ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              locked ? 'bg-white/30' : 'bg-stone-300'
            }`}
          >
            <span
              className={`size-4 rounded-full bg-white transition-transform ${
                locked ? '-translate-x-4' : ''
              }`}
            />
          </span>
          הצמדה לרצפה
        </button>

        {!locked && (
          <div className="min-w-0 flex-1">
            <NumBox
              label="גובה מהרצפה"
              value={unit.yMm}
              onChange={(mm) => onChange({ yMm: Math.max(mm, 0) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EdgeChip({
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
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

/** תיבת מידה קומפקטית. נשמר במ"מ, נערך בסנטימטרים. */
function NumBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (mm: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={mmToCm(value)}
        onChange={(e) => onChange(cmToMm(Number(e.target.value) || 0))}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        className="num w-full bg-transparent text-base font-medium text-stone-900 focus:outline-none"
      />
    </label>
  );
}
