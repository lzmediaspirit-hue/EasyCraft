import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { finishesRepo, materialsRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { TrashIcon } from '../../ui/icons';
import type { Finish, MaterialPrice } from '../../db/types';

/**
 * גוון.
 *
 * הגוון הוא מה שהלקוח בוחר ומה שמזמינים לפי שם, והוא חוצה חומרים:
 * אותו "לבן" מוזמן גם כסנדוויץ׳ לגוף וגם כ-MDF לחזיתות, במחיר
 * שונה לגמרי. לכן אין כאן מחיר אחד אלא מחיר לכל חומר — וחומר בלי
 * מחיר פשוט לא מוצע לגוון הזה כשבונים ארגז.
 */
export function FinishSheet({ finish, onClose }: { finish: Finish | null; onClose: () => void }) {
  const materials = useLiveQuery(() => materialsRepo.list(), []);
  const [name, setName] = useState(finish?.name ?? '');
  const [note, setNote] = useState(finish?.note ?? '');
  const [hex, setHex] = useState(finish?.hex ?? '#d9b483');
  const [hasGrain, setHasGrain] = useState(finish?.hasGrain ?? false);
  const [prices, setPrices] = useState<Record<string, { factory: string; consumer: string }>>(() => {
    const out: Record<string, { factory: string; consumer: string }> = {};
    for (const [id, p] of Object.entries(finish?.prices ?? {})) {
      out[id] = {
        factory: p.factoryPrice !== undefined ? String(p.factoryPrice) : '',
        consumer: p.consumerPrice !== undefined ? String(p.consumerPrice) : '',
      };
    }
    return out;
  });
  const [edgeFactory, setEdgeFactory] = useState(
    finish?.edgeFactoryPerM !== undefined ? String(finish.edgeFactoryPerM) : '',
  );
  const [edgeConsumer, setEdgeConsumer] = useState(
    finish?.edgeConsumerPerM !== undefined ? String(finish.edgeConsumerPerM) : '',
  );

  const canSave = name.trim().length > 0;

  const set = (materialId: string, field: 'factory' | 'consumer', value: string) =>
    setPrices((p) => {
      const row = p[materialId] ?? { factory: '', consumer: '' };
      return { ...p, [materialId]: { ...row, [field]: value } };
    });

  async function save() {
    /*
     * חומר נחשב "קיים לגוון" רק אם הוזן לו מחיר כלשהו. שורה ריקה
     * לגמרי נמחקת, ולכן הדרך להוריד גוון מחומר היא פשוט לרוקן את
     * המחיר שלו — בלי מתג נוסף שצריך להסביר.
     */
    const out: Record<string, MaterialPrice> = {};
    for (const [id, v] of Object.entries(prices)) {
      const factory = v.factory.trim() ? Number(v.factory) : undefined;
      const consumer = v.consumer.trim() ? Number(v.consumer) : undefined;
      if (factory === undefined && consumer === undefined) continue;
      out[id] = { factoryPrice: factory, consumerPrice: consumer };
    }
    await finishesRepo.save({
      id: finish?.id,
      name: name.trim(),
      note: note.trim() || undefined,
      hex,
      hasGrain,
      prices: out,
      edgeFactoryPerM: edgeFactory.trim() ? Number(edgeFactory) : undefined,
      edgeConsumerPerM: edgeConsumer.trim() ? Number(edgeConsumer) : undefined,
    });
    onClose();
  }

  return (
    <Sheet
      title={finish ? 'עריכת גוון' : 'גוון חדש'}
      onClose={onClose}
      tall
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

        <Field label="תיאור קצר" hint="לא חובה">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
            placeholder="למשל: מט, גוון חם"
          />
        </Field>

        {/*
          כיוון הסיבים הוא מאפיין של הגוון ולא של החומר: אותו MDF
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

        <section className="border-t border-stone-100 pt-5">
          <h3 className="text-sm font-semibold text-stone-700">מחיר לפלטה, לפי חומר</h3>
          <p className="mt-0.5 mb-3 text-xs leading-snug text-stone-500">
            אותו גוון עולה אחרת על כל חומר. חומר שנשאר ריק לא יוצע לגוון
            הזה כשבונים ארגז.
          </p>

          <ul className="space-y-2">
            {(materials ?? []).map((m) => (
              <li key={m.id} className="rounded-xl border border-stone-200 bg-white p-3">
                <span className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-stone-800">{m.name}</span>
                  {m.thicknessMm !== undefined && (
                    <span className="num text-[11px] text-stone-400">{m.thicknessMm} מ״מ</span>
                  )}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <PriceBox
                    label="מפעל"
                    value={prices[m.id]?.factory ?? ''}
                    onChange={(v) => set(m.id, 'factory', v)}
                  />
                  <PriceBox
                    label="צרכן"
                    value={prices[m.id]?.consumer ?? ''}
                    onChange={(v) => set(m.id, 'consumer', v)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/*
          קנט תואם ללוח הוא המצב הרגיל, ולכן המחיר שלו שייך לגוון:
          מטר קנט של גוון יקר עולה אחרת ממטר של גוון זול.
        */}
        <section className="border-t border-stone-100 pt-5">
          <h3 className="text-sm font-semibold text-stone-700">קנט תואם</h3>
          <p className="mt-0.5 mb-3 text-xs leading-snug text-stone-500">
            מחיר למטר רץ. ריק = המחיר הכללי שבהגדרות.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <PriceBox label="מפעל" value={edgeFactory} onChange={setEdgeFactory} />
            <PriceBox label="צרכן" value={edgeConsumer} onChange={setEdgeConsumer} />
          </div>
        </section>
      </div>
    </Sheet>
  );
}

function PriceBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-lg bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        placeholder="₪"
        aria-label={`מחיר ${label}`}
        className="num w-full bg-transparent text-base font-medium text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
    </label>
  );
}
