import { useState } from 'react';
import { finishesRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { TrashIcon } from '../../ui/icons';
import type { Finish } from '../../db/types';

/** גוון בקטלוג של לוח מסוים. */
export function FinishSheet({
  boardId,
  finish,
  onClose,
}: {
  boardId: string;
  finish: Finish | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(finish?.name ?? '');
  const [hex, setHex] = useState(finish?.hex ?? '#d9b483');
  const [hasGrain, setHasGrain] = useState(finish?.hasGrain ?? false);
  const [factoryPrice, setFactoryPrice] = useState(
    finish?.factoryPrice !== undefined ? String(finish.factoryPrice) : '',
  );
  const [consumerPrice, setConsumerPrice] = useState(
    finish?.consumerPrice !== undefined ? String(finish.consumerPrice) : '',
  );

  const canSave = name.trim().length > 0;

  async function save() {
    await finishesRepo.save({
      id: finish?.id,
      boardId,
      name: name.trim(),
      hex,
      hasGrain,
      factoryPrice: factoryPrice.trim() ? Number(factoryPrice) : undefined,
      consumerPrice: consumerPrice.trim() ? Number(consumerPrice) : undefined,
    });
    onClose();
  }

  return (
    <Sheet
      title={finish ? 'עריכת גוון' : 'גוון חדש'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {finish && (
            <button
              onClick={async () => {
                await finishesRepo.remove(finish.id);
                onClose();
              }}
              aria-label="מחיקת הגוון"
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
        <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4">
          <label className="relative shrink-0">
            <span
              className="block size-16 rounded-xl border border-stone-200"
              style={{ background: hex }}
            />
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              aria-label="בחירת צבע"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <p className="text-sm leading-snug text-stone-500">
            הצבע הזה יופיע על חזיתות הארגזים בהדמיה, כדי שהלקוח יראה את הגוון
            שבחר על הקיר שלו.
          </p>
        </div>

        <Field label="שם הגוון">
          <input
            autoFocus={!finish}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
            placeholder="למשל: אלון טבעי"
          />
        </Field>

        {/*
          כיוון הסיבים הוא מאפיין של הגוון ולא של הלוח: אותו MDF
          מגיע גם בלכה חלקה וגם בפורניר עם סיבים, ורק השני מחייב
          ניסור בכיוון קבוע ומעלה את הפחת.
        */}
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
          <Field label="מחיר במפעל" hint="אם שונה">
            <input
              value={factoryPrice}
              onChange={(e) => setFactoryPrice(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="decimal"
              placeholder="—"
              className={`${inputClass} num text-end placeholder:text-stone-300`}
            />
          </Field>
          <Field label="מחיר לצרכן" hint="אם שונה">
            <input
              value={consumerPrice}
              onChange={(e) => setConsumerPrice(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="decimal"
              placeholder="—"
              className={`${inputClass} num text-end placeholder:text-stone-300`}
            />
          </Field>
        </div>
        <p className="text-xs text-stone-400">
          שדות ריקים מקבלים את מחיר הלוח הבסיסי.
        </p>
      </div>
    </Sheet>
  );
}
