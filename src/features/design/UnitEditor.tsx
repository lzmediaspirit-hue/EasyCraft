import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { cm, cmToMm, mmToCm } from '../../ui/units';
import { CloseIcon, TrashIcon } from '../../ui/icons';
import type { PlacedUnit } from '../../db/types';

/**
 * הלוח שנפתח כשארגז נבחר — מחליף את כפתור ההוספה.
 * מוצג רק כשיש ארגז נבחר, ונעלם ברגע שמבטלים את הבחירה.
 */
export function UnitEditor({
  unit,
  maxWidthMm,
  onChange,
  onRemove,
  onClose,
}: {
  unit: PlacedUnit;
  maxWidthMm: number;
  onChange: (patch: Partial<PlacedUnit>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  const widths = source?.widthOptionsMm ?? [];

  return (
    <div className="rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)]">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-stone-900">{unit.name}</h2>
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

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumBox
          label="רוחב"
          value={mmToCm(unit.widthMm)}
          onChange={(v) => onChange({ widthMm: Math.max(cmToMm(v), 50) })}
        />
        <NumBox
          label="גובה"
          value={mmToCm(unit.heightMm)}
          onChange={(v) => onChange({ heightMm: Math.max(cmToMm(v), 50) })}
        />
        <NumBox
          label="מיקום מהקצה"
          value={mmToCm(unit.xMm)}
          onChange={(v) =>
            onChange({
              xMm: Math.min(Math.max(cmToMm(v), 0), Math.max(maxWidthMm - unit.widthMm, 0)),
            })
          }
        />
      </div>
    </div>
  );
}

function NumBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        type="number"
        inputMode="numeric"
        className="num w-full bg-transparent text-base font-medium text-stone-900 focus:outline-none"
      />
    </label>
  );
}
