import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { projectPricesRepo, settingsRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { TagIcon } from '../../ui/icons';
import { selectOnFocus } from '../../ui/Field';
import { cm, shekels } from '../../ui/units';

/**
 * חישוב חומרים ומחיר לפרויקט.
 * המחיר לפלטה ניתן לדריסה כאן, וההגדרה חלה על הפרויקט הזה בלבד —
 * כדי שמחיר מיוחד ללקוח לא ישנה את המחירון של העסק.
 */
export function MaterialsSheet({
  projectId,
  onStart,
  onClose,
}: {
  projectId: string;
  /** מעבר למכירה ולפתיחת תהליך העבודה */
  onStart?: () => void;
  onClose: () => void;
}) {
  const costing = useLiveQuery(() => projectsRepo.costing(projectId), [projectId]);
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const overrides = useLiveQuery(() => projectPricesRepo.listForProject(projectId), [projectId]);

  if (!costing || !settings) return null;

  const hasPrices = costing.consumerTotal > 0 || costing.factoryTotal > 0;

  return (
    <Sheet title="חישוב פרויקט" onClose={onClose} tall>
      {costing.units === 0 ? (
        <p className="pt-10 text-center text-stone-500">אין עדיין ארגזים בפרויקט.</p>
      ) : (
        <div className="space-y-6">
          {costing.unpricedParts > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
              <span className="num">{costing.unpricedParts}</span> חלקים לא שויכו לשום
              חומר, ולכן הם לא נספרים כאן. צריך להגדיר חומרים בהגדרות.
            </p>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">פלטות</h3>
            <ul className="space-y-2">
              {costing.lines.map((line) => {
                const override = overrides?.find((o) => o.lineKey === line.key);
                return (
                  <li key={line.key} className="rounded-2xl border border-stone-200 bg-white p-3">
                    <div className="flex items-baseline gap-2">
                      {line.finish && (
                        <span
                          aria-hidden="true"
                          className="size-4 shrink-0 rounded border border-black/10"
                          style={{ background: line.finish.hex }}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-semibold text-stone-900">
                        {line.finish?.name ?? 'בלי גוון'}
                        <span className="font-normal text-stone-500"> · {line.material.name}</span>
                      </span>
                      <span className="num shrink-0 text-lg font-semibold text-stone-900">
                        {line.sheets}
                      </span>
                      <span className="shrink-0 text-xs text-stone-400">
                        {line.sheets === 1 ? 'פלטה' : 'פלטות'}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-stone-500">
                      <span className="num">{line.areaM2.toFixed(2)}</span> מ״ר חלקים
                      {line.finish?.note && <span> · {line.finish.note}</span>}
                    </p>

                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <PriceCell
                        label="מפעל"
                        perSheet={line.factoryPrice}
                        total={line.factoryTotal}
                        onChange={(v) =>
                          projectPricesRepo.set(projectId, line.key, {
                            factoryPrice: v,
                            consumerPrice: override?.consumerPrice,
                          })
                        }
                        overridden={override?.factoryPrice !== undefined}
                      />
                      <PriceCell
                        label="צרכן"
                        perSheet={line.consumerPrice}
                        total={line.consumerTotal}
                        onChange={(v) =>
                          projectPricesRepo.set(projectId, line.key, {
                            factoryPrice: override?.factoryPrice,
                            consumerPrice: v,
                          })
                        }
                        overridden={override?.consumerPrice !== undefined}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-stone-400">
              כמות הפלטות נספרת מפריסה אמיתית על הלוח, עם כרסום{' '}
              <span className="num">{settings.kerfMm}</span> מ״מ ובכיוון הסיבים —
              אותה פריסה שמוצגת במסך הניסור.
            </p>
          </section>

          {costing.glass.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">זכוכית</h3>
              <ul className="space-y-1.5">
                {costing.glass.map((g) => (
                  <li
                    key={`${g.label} ${g.widthMm}x${g.heightMm}`}
                    className="flex items-baseline gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
                      {g.label}
                      <span className="num ms-1.5 text-stone-500">
                        {cm(g.widthMm)}×{cm(g.heightMm)}
                      </span>
                    </span>
                    <span className="num text-sm font-semibold text-stone-900">{g.qty}</span>
                    <span className="text-[11px] text-stone-400">יח׳</span>
                    <span className="num w-16 text-end text-sm text-stone-600">
                      {g.consumerTotal > 0 ? shekels(g.consumerTotal) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
                זכוכית נספרת לפי שטח ולא נכללת בכמות הפלטות.
                המחיר למ״ר נקבע בהגדרות.
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">אביזרים</h3>

            {costing.accessories.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {costing.accessories.map((a) => (
                  <li
                    key={a.label}
                    className="flex items-baseline gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
                      {a.label}
                    </span>
                    <span className="num text-sm font-semibold text-stone-900">
                      {Number.isInteger(a.qty) ? a.qty : a.qty.toFixed(1)}
                    </span>
                    <span className="text-[11px] text-stone-400">{a.unit}</span>
                    <span className="num w-16 text-end text-sm text-stone-600">
                      {a.consumerTotal > 0 ? shekels(a.consumerTotal) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Stat label="דלתות" value={costing.doors} />
              <Stat label="דפנות זרות" value={costing.exposedPanels} />
              {costing.handles > 0 && <Stat label="ידיות" value={costing.handles} />}
              {costing.glassAreaM2 > 0 && (
                <Stat label="זכוכית" value={costing.glassAreaM2.toFixed(2)} unit='מ״ר' />
              )}
            </div>

            {costing.accessories.every((a) => a.consumerPrice === 0) && (
              <p className="mt-2 text-[11px] leading-snug text-stone-400">
                מחירי אביזרים נקבעים בהגדרות — מגירה, מטר לד ומנגנון קלאפה.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-stone-900 p-4 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/70">סה״כ פלטות</span>
              <span className="num text-lg font-semibold">{costing.totalSheets}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-2">
              <span className="text-sm text-white/70">לוחות</span>
              <span className="num text-sm">
                {hasPrices ? shekels(costing.boardsConsumerTotal) : '—'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm text-white/70">אביזרים</span>
              <span className="num text-sm">
                {hasPrices
                  ? shekels(costing.consumerTotal - costing.boardsConsumerTotal)
                  : '—'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-2">
              <span className="text-sm text-white/70">עלות במפעל</span>
              <span className="num text-lg font-semibold">
                {hasPrices ? shekels(costing.factoryTotal) : '—'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm text-white/70">מחיר לצרכן</span>
              <span className="num text-sm">
                {hasPrices ? shekels(costing.consumerTotal) : '—'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="num text-sm text-white/70">מע״מ {costing.vatPct}%</span>
              <span className="num text-sm">
                {hasPrices ? shekels(costing.vatAmount) : '—'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-2">
              <span className="text-sm font-medium">לתשלום</span>
              <span className="num text-2xl font-bold">
                {hasPrices ? shekels(costing.consumerWithVat) : '—'}
              </span>
            </div>
            {!hasPrices && (
              <p className="mt-2 text-xs leading-snug text-white/60">
                עדיין לא הוגדרו מחירי פלטות. אפשר להזין אותם כאן לפרויקט הזה,
                או בהגדרות לכל הפרויקטים.
              </p>
            )}
          </section>

          <p className="text-xs leading-snug text-stone-500">
            הסכום מכסה חומר גלם ואביזרים. עבודה ורווח נקבעים במסך המכירה,
            שם גם נסגר המחיר ללקוח.
          </p>

          {/*
            מכאן ממשיכים: אחרי שרואים מה זה עולה, פותחים את המכירה
            ואת תהליך העבודה. זו הנקודה שבה הצעה הופכת לייצור.
          */}
          {onStart && (
            <button
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
            >
              <TagIcon />
              מכירה והתחלת עבודה
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function PriceCell({
  label,
  perSheet,
  total,
  onChange,
  overridden,
}: {
  label: string;
  perSheet: number;
  total: number;
  onChange: (value: number | undefined) => void;
  overridden: boolean;
}) {
  return (
    <label
      className={`block rounded-xl px-3 py-2 ${
        overridden ? 'bg-oak-50 ring-1 ring-oak-300' : 'bg-stone-100'
      }`}
    >
      <span className="flex items-baseline justify-between">
        <span className="text-[11px] text-stone-500">{label}</span>
        <span className="num text-[11px] text-stone-400">{total > 0 ? shekels(total) : ''}</span>
      </span>
      <input
        value={perSheet || ''}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === '' ? undefined : Number(raw));
        }}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        placeholder="₪ לפלטה"
        className="num w-full bg-transparent text-base font-medium text-stone-900 placeholder:text-xs placeholder:text-stone-400 focus:outline-none"
      />
    </label>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="num text-lg font-semibold text-stone-900">{value}</span>
        {unit && <span className="text-xs text-stone-400">{unit}</span>}
      </span>
    </div>
  );
}
