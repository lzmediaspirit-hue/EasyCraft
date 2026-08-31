import { useState } from 'react';
import { settingsRepo } from '../../materials/materialsRepo';
import { Chip, Field, inputClass, selectOnFocus } from '../../ui/Field';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import type { ExtraBasis, ExtraItem, Settings } from '../../db/types';

const BASES: { key: ExtraBasis; label: string }[] = [
  { key: 'door', label: 'לכל דלת' },
  { key: 'drawer', label: 'לכל מגירה' },
  { key: 'cabinet', label: 'לכל ארון' },
  { key: 'lift', label: 'לכל קלאפה' },
  { key: 'handle', label: 'לכל ידית' },
  { key: 'ledMeter', label: 'למטר לד' },
  { key: 'manual', label: 'כמות קבועה' },
];

/**
 * תוספות שהעסק מגדיר בעצמו.
 * כל תוספת יודעת לפי מה היא נספרת, ולכן היא מתעדכנת לבד בכל פרויקט
 * במקום שיצטרכו לספור ידיות או קלאפות בכל פעם מחדש.
 */
export function ExtrasSection({ settings }: { settings: Settings }) {
  const [draft, setDraft] = useState<ExtraItem | null>(null);
  const extras = settings.extras ?? [];

  function save(next: ExtraItem[]) {
    settingsRepo.save({ extras: next });
  }

  function commit() {
    if (!draft || !draft.name.trim()) return;
    const exists = extras.some((x) => x.id === draft.id);
    save(
      exists
        ? extras.map((x) => (x.id === draft.id ? { ...draft, name: draft.name.trim() } : x))
        : [...extras, { ...draft, name: draft.name.trim() }],
    );
    setDraft(null);
  }

  return (
    <>
      {extras.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {extras.map((x) => (
            <li
              key={x.id}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2"
            >
              <button
                onClick={() => setDraft(x)}
                className="min-w-0 flex-1 text-start"
              >
                <span className="block truncate text-sm font-medium text-stone-800">{x.name}</span>
                <span className="block text-[11px] text-stone-400">
                  {BASES.find((b) => b.key === x.per)?.label}
                  {x.per === 'manual' && <span className="num"> · {x.qty ?? 0}</span>}
                </span>
              </button>
              <span className="num shrink-0 text-sm text-stone-600">₪{x.consumerPrice}</span>
              <button
                onClick={() => save(extras.filter((e) => e.id !== x.id))}
                aria-label={`מחיקת ${x.name}`}
                className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <div className="space-y-3 rounded-2xl border border-oak-300 bg-oak-50 p-3">
          <Field label="שם התוספת">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onFocus={selectOnFocus}
              className={inputClass}
              placeholder="למשל: ידית אלומיניום"
            />
          </Field>

          <Field group label="נספרת">
            <div className="flex flex-wrap gap-1.5">
              {BASES.map((b) => (
                <Chip
                  key={b.key}
                  active={draft.per === b.key}
                  onClick={() => setDraft({ ...draft, per: b.key })}
                >
                  {b.label}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            {draft.per === 'manual' && (
              <NumInput
                label="כמות"
                value={draft.qty ?? 0}
                onChange={(v) => setDraft({ ...draft, qty: v })}
              />
            )}
            <NumInput
              label="מחיר במפעל"
              value={draft.factoryPrice}
              onChange={(v) => setDraft({ ...draft, factoryPrice: v })}
            />
            <NumInput
              label="מחיר לצרכן"
              value={draft.consumerPrice}
              onChange={(v) => setDraft({ ...draft, consumerPrice: v })}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={commit}
              disabled={!draft.name.trim()}
              className="flex-1 rounded-xl bg-oak-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oak-700 disabled:bg-stone-200 disabled:text-stone-400"
            >
              שמירה
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-200"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: '',
              per: 'door',
              factoryPrice: 0,
              consumerPrice: 0,
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
        >
          <PlusIcon className="size-4" />
          תוספת חדשה
        </button>
      )}
    </>
  );
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-white px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        placeholder="₪"
        className="num w-full bg-transparent text-base font-medium text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
    </label>
  );
}
