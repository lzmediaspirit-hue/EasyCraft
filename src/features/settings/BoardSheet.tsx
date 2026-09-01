import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { boardsRepo, finishesRepo } from '../../materials/materialsRepo';
import { FinishSheet } from './FinishSheet';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import type { Board, BoardRole, Finish } from '../../db/types';

const ROLES: { role: BoardRole; label: string; hint: string }[] = [
  { role: 'carcass', label: 'גוף', hint: 'צדדים, מדפים ותחתיות' },
  { role: 'front', label: 'חזית', hint: 'דלתות, מגירות ודפנות זרות' },
  { role: 'back', label: 'גב', hint: 'לוח דק מאחורי הארון' },
];

/** הגדרת לוח גלם וקטלוג הגוונים שלו. */
export function BoardSheet({
  board,
  initialRole,
  onSaved,
  onClose,
}: {
  board: Board | null;
  /** תפקיד פותח ללוח חדש, כשפותחים אותו מתוך בחירת גוון */
  initialRole?: BoardRole;
  /** מזהה הלוח שנשמר — כדי שהמסך שפתח יוכל להמשיך לגוונים שלו */
  onSaved?: (boardId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(board?.name ?? '');
  const [catalogNumber, setCatalogNumber] = useState(board?.catalogNumber ?? '');
  const [role, setRole] = useState<BoardRole>(board?.role ?? initialRole ?? 'carcass');
  const [hasGrain, setHasGrain] = useState(board?.hasGrain ?? false);
  const [factoryPrice, setFactoryPrice] = useState(String(board?.factoryPrice ?? 0));
  const [consumerPrice, setConsumerPrice] = useState(String(board?.consumerPrice ?? 0));
  const [editingFinish, setEditingFinish] = useState<Finish | 'new' | null>(null);

  const finishes = useLiveQuery(
    () => (board ? finishesRepo.listForBoard(board.id) : Promise.resolve([])),
    [board?.id],
  );

  const canSave = name.trim().length > 0;

  async function save() {
    const id = await boardsRepo.save({
      id: board?.id,
      name: name.trim(),
      catalogNumber: catalogNumber.trim() || undefined,
      role,
      hasGrain,
      factoryPrice: Number(factoryPrice) || 0,
      consumerPrice: Number(consumerPrice) || 0,
    });
    onSaved?.(id);
    onClose();
  }

  return (
    <>
      <Sheet
        title={board ? 'עריכת לוח' : 'לוח חדש'}
        onClose={onClose}
        tall
        footer={
          <div className="flex items-center gap-2">
            {board && (
              <button
                onClick={async () => {
                  await boardsRepo.remove(board.id);
                  onClose();
                }}
                aria-label="מחיקת הלוח"
                className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon />
              </button>
            )}
            <div className="flex-1">
              <PrimaryButton disabled={!canSave} onClick={save}>
                שמירה
              </PrimaryButton>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <Field label="שם הלוח">
            <input
              autoFocus={!board}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={selectOnFocus}
              className={inputClass}
              placeholder="למשל: סנדוויץ׳ 18"
            />
          </Field>

          <Field label="מספר קטלוגי" hint="לא חובה">
            <input
              value={catalogNumber}
              onChange={(e) => setCatalogNumber(e.target.value)}
              onFocus={selectOnFocus}
              className={`${inputClass} num text-end`}
            />
          </Field>

          <Field group label="תפקיד בארון">
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <Chip key={r.role} active={r.role === role} onClick={() => setRole(r.role)}>
                  {r.label}
                </Chip>
              ))}
            </div>
            <span className="mt-1.5 block text-xs text-stone-400">
              {ROLES.find((r) => r.role === role)?.hint}
            </span>
          </Field>

          <button
            onClick={() => setHasGrain((v) => !v)}
            aria-pressed={hasGrain}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-start text-sm font-medium transition-colors ${
              hasGrain ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span
              className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                hasGrain ? 'bg-white/30' : 'bg-stone-300'
              }`}
            >
              <span
                className={`size-4 rounded-full bg-white transition-transform ${
                  hasGrain ? '-translate-x-4' : ''
                }`}
              />
            </span>
            <span className="flex-1">
              כיוון סיבים
              <span
                className={`block text-[11px] font-normal ${
                  hasGrain ? 'text-white/70' : 'text-stone-400'
                }`}
              >
                מחייב ניסור בכיוון קבוע ומעלה את הפחת
              </span>
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-5">
            <PriceField label="מחיר במפעל" value={factoryPrice} onChange={setFactoryPrice} />
            <PriceField label="מחיר לצרכן" value={consumerPrice} onChange={setConsumerPrice} />
          </div>
          <p className="text-xs text-stone-400">המחיר הוא לפלטה שלמה.</p>

          {board && (
            <div className="border-t border-stone-100 pt-5">
              <h3 className="mb-2 text-sm font-semibold text-stone-700">קטלוג גוונים</h3>

              {finishes && finishes.length > 0 && (
                <ul className="mb-2 space-y-1.5">
                  {finishes.map((f) => (
                    <li key={f.id}>
                      <button
                        onClick={() => setEditingFinish(f)}
                        className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-start transition-colors hover:border-oak-300"
                      >
                        <span
                          className="size-7 shrink-0 rounded-lg border border-stone-200"
                          style={{ background: f.hex }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-800">
                            {f.name}
                          </span>
                          {f.code && (
                            <span className="num block truncate text-[11px] text-stone-400">
                              {f.code}
                            </span>
                          )}
                        </span>
                        {f.consumerPrice !== undefined && (
                          <span className="num shrink-0 text-xs text-stone-500">
                            ₪{f.consumerPrice}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => setEditingFinish('new')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
              >
                <PlusIcon className="size-4" />
                גוון חדש
              </button>
            </div>
          )}

          {!board && (
            <p className="text-xs leading-snug text-stone-500">
              אחרי שמירת הלוח אפשר יהיה להוסיף לו גוונים.
            </p>
          )}
        </div>
      </Sheet>

      {editingFinish && board && (
        <FinishSheet
          boardId={board.id}
          finish={editingFinish === 'new' ? null : editingFinish}
          onClose={() => setEditingFinish(null)}
        />
      )}
    </>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} hint="₪ לפלטה">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        className={`${inputClass} num text-end`}
      />
    </Field>
  );
}
