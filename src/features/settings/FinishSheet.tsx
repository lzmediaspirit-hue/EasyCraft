import { useState } from 'react';
import { finishesRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { SheetFooter } from '../../ui/SheetFooter';
import { Chip, Field, inputClass, selectOnFocus } from '../../ui/Field';
import { CopyIcon, PencilIcon, PlusIcon } from '../../ui/icons';
import { BUILTIN_TEXTURES } from '../../db/types';
import type { Finish, MaterialPrice } from '../../db/types';
import { useMaterialsAndFinishes } from '../../materials/useMaterials';

/**
 * גוון.
 *
 * הגוון הוא מה שהלקוח בוחר ומה שמזמינים לפי שם, והוא חוצה חומרים:
 * אותו "לבן" מוזמן גם כסנדוויץ׳ לגוף וגם כ-MDF לחזיתות, במחיר
 * שונה לגמרי. לכן אין כאן מחיר אחד אלא מחיר לכל חומר — וחומר בלי
 * מחיר פשוט לא מוצע לגוון הזה כשבונים ארגז.
 */
export function FinishSheet({ finish, onClose }: { finish: Finish | null; onClose: () => void }) {
  const { materials, finishes } = useMaterialsAndFinishes();
  const [name, setName] = useState(finish?.name ?? '');
  const [texture, setTexture] = useState<string | undefined>(finish?.texture);
  /** שדה המרקם החדש, נפתח מהעיפרון */
  const [addingTexture, setAddingTexture] = useState(false);
  /** מרקם שהמשתמש הוסיף בעצמו, מעבר לרשימה שמגיעה עם האפליקציה */
  const [newTexture, setNewTexture] = useState('');
  const [copying, setCopying] = useState(false);
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

  /*
   * המרקמים שמוצעים: אלה שמגיעים עם האפליקציה, וכל מרקם שכבר קיים
   * על גוון אחר. כך מרקם שנוסף פעם אחת חוזר מעצמו בגוון הבא, במקום
   * להיכתב שוב ולהתפצל לשתי כתיבות של אותו דבר.
   */
  const known = [
    ...new Set([
      ...BUILTIN_TEXTURES,
      ...(finishes ?? []).flatMap((f) => (f.texture ? [f.texture] : [])),
      ...(texture ? [texture] : []),
    ]),
  ];

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
      texture,
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
        <SheetFooter
          canSave={canSave}
          onSave={save}
          removeLabel="מחיקת הגוון"
          onRemove={
            finish
              ? async () => {
                  await finishesRepo.remove(finish.id);
                  onClose();
                }
              : undefined
          }
        />
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
          מרקם נבחר ולא נכתב: הרשימה חוזרת על עצמה אצל כל ספק, וטקסט
          חופשי היה יוצר חמש כתיבות שונות לאותו דבר. מי שחסר לו מרקם
          מוסיף אותו, והוא נשמר לגוון הזה.

          אחד בלבד: לוח מגיע מהספק במרקם אחד, ולחיצה שנייה על אותו
          שבב מבטלת את הבחירה.
        */}
        <Field group label="מרקם" hint="מרקם אחד ללוח">
          <div className="flex flex-wrap items-center gap-1.5">
            {known.map((t) => (
              <Chip
                key={t}
                active={texture === t}
                onClick={() => setTexture((prev) => (prev === t ? undefined : t))}
              >
                {t}
              </Chip>
            ))}
            {/*
              מרקם חדש נוסף לעיתים רחוקות — פעם בכמה חודשים, כשספק
              מביא משהו אחר. שדה קבוע לצדו תפס מקום בכל פתיחה, ולכן
              הוא מאחורי עיפרון.
            */}
            <button
              onClick={() => setAddingTexture((v) => !v)}
              aria-pressed={addingTexture}
              aria-label="הוספת מרקם"
              title="מרקם חדש"
              className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
                addingTexture
                  ? 'bg-oak-600 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              <PencilIcon className="size-4" />
            </button>
          </div>
          {addingTexture && (
            <div className="mt-2 flex gap-1.5">
              <input
                value={newTexture}
                onChange={(e) => setNewTexture(e.target.value)}
                onFocus={selectOnFocus}
                autoFocus
                aria-label="מרקם חדש"
                placeholder="שם המרקם"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={() => {
                  const t = newTexture.trim();
                  if (!t) return;
                  setTexture(t);
                  setNewTexture('');
                  setAddingTexture(false);
                }}
                disabled={!newTexture.trim()}
                aria-label="שמירת המרקם"
                className="shrink-0 rounded-xl bg-stone-100 px-3 text-stone-600 transition-colors hover:bg-stone-200 disabled:opacity-40"
              >
                <PlusIcon className="size-5" />
              </button>
            </div>
          )}
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
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-700">מחיר לפלטה, לפי ליבה</h3>
            {/*
              רוב הגוונים אצל אותו ספק חולקים מחירון: העתקה מגוון
              קיים חוסכת הקלדה של אותם מספרים שוב ושוב, ומשאירה
              מקום לתקן את מה שבאמת שונה.
            */}
            {(finishes ?? []).some((f) => f.id !== finish?.id) && (
              <button
                onClick={() => setCopying((v) => !v)}
                aria-expanded={copying}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-oak-700"
              >
                <CopyIcon className="size-3.5" />
                העתקה מגוון אחר
              </button>
            )}
          </div>

          {copying && (
            <ul className="mb-3 space-y-1.5 rounded-xl border border-oak-200 bg-oak-50/60 p-2">
              {(finishes ?? [])
                .filter((f) => f.id !== finish?.id)
                .map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => {
                        const next: Record<string, { factory: string; consumer: string }> = {};
                        for (const [id, v] of Object.entries(f.prices ?? {})) {
                          next[id] = {
                            factory: v.factoryPrice !== undefined ? String(v.factoryPrice) : '',
                            consumer: v.consumerPrice !== undefined ? String(v.consumerPrice) : '',
                          };
                        }
                        setPrices(next);
                        setEdgeFactory(
                          f.edgeFactoryPerM !== undefined ? String(f.edgeFactoryPerM) : '',
                        );
                        setEdgeConsumer(
                          f.edgeConsumerPerM !== undefined ? String(f.edgeConsumerPerM) : '',
                        );
                        setCopying(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-start transition-colors hover:ring-1 hover:ring-oak-300"
                    >
                      <span
                        aria-hidden="true"
                        className="size-5 shrink-0 rounded border border-black/10"
                        style={{ background: f.hex }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
                        {f.name}
                      </span>
                      <span className="num shrink-0 text-[11px] text-stone-500">
                        {Object.keys(f.prices ?? {}).length} ליבות
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
          <p className="-mt-1 mb-3 text-xs leading-snug text-stone-500">
            אותו גוון עולה אחרת על כל ליבה. ליבה שנשארה ריקה לא תוצע לגוון
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
