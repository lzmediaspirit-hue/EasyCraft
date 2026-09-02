import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { boardsRepo, finishesRepo } from '../../materials/materialsRepo';
import { FinishSheet } from './FinishSheet';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import { BOARD_MATERIALS, SHEET_HEIGHTS_MM, SHEET_WIDTH_MM } from '../../db/types';
import { cm } from '../../ui/units';
import type { Board, BoardMaterial, Finish } from '../../db/types';


/** הגדרת לוח גלם וקטלוג הגוונים שלו. */
export function BoardSheet({
  board,
  onSaved,
  onClose,
}: {
  board: Board | null;
  /** מזהה הלוח שנשמר — כדי שהמסך שפתח יוכל להמשיך לגוונים שלו */
  onSaved?: (boardId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(board?.name ?? '');
  const [catalogNumber, setCatalogNumber] = useState(board?.catalogNumber ?? '');
  const [material, setMaterial] = useState<BoardMaterial>(board?.material ?? 'sandwich');
  const [sheetHeight, setSheetHeight] = useState(board?.sheetHeightMm ?? SHEET_HEIGHTS_MM[0]);
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
      material,
      sheetWidthMm: SHEET_WIDTH_MM,
      sheetHeightMm: sheetHeight,
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

          {/*
            הלוח אינו שייך לחלק מסוים בארון — אותו MDF משמש גם לחזית
            וגם לגוף. מה שמבדיל לוח מלוח הוא החומר והמידה, והחלק
            נקבע לפי הגוון שנבחר לו בהדמיה.
          */}
          <Field group label="סוג החומר">
            <div className="flex flex-wrap gap-1.5">
              {BOARD_MATERIALS.map((m) => (
                <Chip key={m.key} active={m.key === material} onClick={() => setMaterial(m.key)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </Field>

          {/*
            מידת הפלטה היא מאפיין של המוצר ולא של החישוב, ולכן היא
            נקבעת פעם אחת ביצירת הלוח. הרוחב תמיד 122 ס"מ; הגובה
            משתנה בין ספקים, ולכן הוא נבחר מהגבהים שקיימים בשוק.
          */}
          {!board ? (
            <Field group label="מידת הפלטה" hint={`רוחב ${cm(SHEET_WIDTH_MM)} ס״מ תמיד`}>
              <div className="flex flex-wrap gap-1.5">
                {SHEET_HEIGHTS_MM.map((h) => (
                  <Chip key={h} active={h === sheetHeight} onClick={() => setSheetHeight(h)}>
                    <span className="num">
                      {cm(SHEET_WIDTH_MM)}×{cm(h)}
                    </span>
                  </Chip>
                ))}
              </div>
            </Field>
          ) : (
            <p className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
              מידת הפלטה:{' '}
              <span className="num font-medium text-stone-900">
                {cm(board.sheetWidthMm)}×{cm(board.sheetHeightMm)}
              </span>{' '}
              ס״מ
              <span className="mt-0.5 block text-[11px] text-stone-400">
                נקבעת ביצירת הלוח. לוח במידה אחרת הוא לוח אחר אצל הספק.
              </span>
            </p>
          )}

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
