import { useState } from 'react';
import { stockRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { SheetFooter } from '../../ui/SheetFooter';
import { selectOnFocus } from '../../ui/Field';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import { cm, toMm, unitLabel } from '../../ui/units';
import type { Finish, Material, Offcut } from '../../db/types';

/**
 * פחתים — השאריות שנשארו מפלטות קודמות.
 *
 * פחת אינו פלטה ולכן אינו נספר ככזו, אבל הוא גם לא אפס: מי שיודע
 * שמונחת אצלו חצי פלטה בגוון הזה לא מזמין חדשה בשביל דלת אחת.
 * לכן נשמרות המידות עצמן — "יש פחת" בלי מידה הוא מידע שאי אפשר
 * לעשות איתו כלום.
 */
export function OffcutsSheet({
  finish,
  material,
  offcuts,
  onClose,
}: {
  finish: Finish;
  material: Material;
  offcuts: Offcut[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Offcut[]>(offcuts);

  const add = () =>
    setRows((prev) => [...prev, { id: crypto.randomUUID(), widthMm: 0, heightMm: 0 }]);
  const patch = (id: string, next: Partial<Offcut>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  const drop = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  async function save() {
    /* שורה בלי מידה אינה פחת אלא שורה שנפתחה ולא מולאה */
    const clean = rows.filter((r) => r.widthMm > 0 && r.heightMm > 0);
    await stockRepo.set(finish.id, material.id, { offcuts: clean.length ? clean : [] });
    onClose();
  }

  const total = rows
    .filter((r) => r.widthMm > 0 && r.heightMm > 0)
    .reduce((a, r) => a + (r.widthMm * r.heightMm * (r.qty ?? 1)) / 1_000_000, 0);

  return (
    <Sheet
      title="פחתים"
      onClose={onClose}
      footer={<SheetFooter canSave onSave={save} />}
    >
      <div className="space-y-4">
        <p className="text-xs leading-snug text-stone-500">
          {finish.name} · {material.name}
          {total > 0 && (
            <span className="num">
              {' · '}
              {total.toFixed(2)} מ״ר בסך הכול
            </span>
          )}
        </p>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">
            אין פחתים רשומים ללוח הזה.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5">
                <Size
                  label="רוחב"
                  value={r.widthMm}
                  onChange={(mm) => patch(r.id, { widthMm: mm })}
                />
                <span aria-hidden="true" className="text-stone-400">
                  ×
                </span>
                <Size
                  label="אורך"
                  value={r.heightMm}
                  onChange={(mm) => patch(r.id, { heightMm: mm })}
                />
                <label className="flex items-center gap-1">
                  <span className="text-[11px] text-stone-400">×</span>
                  <input
                    value={r.qty ?? 1}
                    onChange={(e) =>
                      patch(r.id, { qty: Math.max(Number(e.target.value) || 1, 1) })
                    }
                    onFocus={selectOnFocus}
                    type="number"
                    inputMode="numeric"
                    aria-label="כמות"
                    className="num w-12 rounded-lg bg-stone-100 py-2 text-center text-sm font-medium text-stone-900 focus:bg-white focus:ring-1 focus:ring-oak-400 focus:outline-none"
                  />
                </label>
                <button
                  onClick={() => drop(r.id)}
                  aria-label="מחיקת הפחת"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
        >
          <PlusIcon className="size-4" />
          פחת נוסף
        </button>
      </div>
    </Sheet>
  );
}

/** מידה אחת של הפחת, ביחידה שנבחרה במסך ההגדרות. */
function Size({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (mm: number) => void;
}) {
  return (
    <label className="min-w-0 flex-1">
      <input
        value={value ? cm(value) : ''}
        onChange={(e) => onChange(toMm(Number(e.target.value) || 0))}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        aria-label={`${label} · ${unitLabel()}`}
        placeholder={label}
        className="num w-full rounded-lg bg-stone-100 py-2 text-center text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-1 focus:ring-oak-400 focus:outline-none"
      />
    </label>
  );
}
