import { useState } from 'react';
import { projectsRepo } from './projectsRepo';
import { PRICING_LABEL, paymentStatus, projectQuote } from '../../costing/pricing';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { shekels } from '../../ui/units';
import { CheckIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import type { PaymentPlan, Payment, PlacedUnit, PricingMode, Project } from '../../db/types';
import type { ProjectCosting } from '../../costing/boards';

const MODES: PricingMode[] = ['materials', 'perUnit', 'perMeter', 'manual'];

/**
 * מכירה: איך הפרויקט מתומחר, ומתי הכסף מגיע.
 *
 * חישוב החומרים הוא מה שהאפליקציה יודעת; המחיר ללקוח הוא החלטה
 * עסקית, ולכן המנהל בוחר שיטה — או פשוט כותב מספר. סימון "נמכר"
 * הוא מה שפותח את תהליך העבודה: לפניו אין מה לחתוך.
 */
export function SaleSheet({
  project,
  units,
  costing,
  isManager,
  onClose,
}: {
  project: Project;
  units: PlacedUnit[];
  costing?: ProjectCosting;
  isManager: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PricingMode>(project.pricingMode ?? 'materials');
  const [manual, setManual] = useState(String(project.manualPrice ?? ''));
  const [perUnit, setPerUnit] = useState(String(project.perUnitRate ?? ''));
  const [perMeter, setPerMeter] = useState(String(project.perMeterRate ?? ''));
  const [plan, setPlan] = useState<PaymentPlan>(project.paymentPlan ?? 'single');
  const [payments, setPayments] = useState<Payment[]>(project.payments ?? []);
  const [busy, setBusy] = useState(false);

  const draft: Project = {
    ...project,
    pricingMode: mode,
    manualPrice: Number(manual) || 0,
    perUnitRate: Number(perUnit) || 0,
    perMeterRate: Number(perMeter) || 0,
  };
  const quote = projectQuote(draft, units, costing);
  const status = paymentStatus({ ...draft, payments });
  const sold = !!project.soldAt;

  async function save(alsoSell: boolean) {
    if (busy) return;
    setBusy(true);
    await projectsRepo.update(project.id, {
      pricingMode: mode,
      manualPrice: Number(manual) || undefined,
      perUnitRate: Number(perUnit) || undefined,
      perMeterRate: Number(perMeter) || undefined,
      paymentPlan: plan,
      payments,
    });
    if (alsoSell) await projectsRepo.markSold(project.id);
    onClose();
  }

  /** תשלום אחד = כל הסכום; בתשלומים = מקדמה ויתרה, כברירת מחדל. */
  function applyPlan(next: PaymentPlan) {
    setPlan(next);
    if (next === 'single') {
      setPayments([{ id: crypto.randomUUID(), amount: quote.amount, label: 'תשלום מלא' }]);
    } else {
      const half = Math.round(quote.amount / 2);
      setPayments([
        { id: crypto.randomUUID(), amount: half, label: 'מקדמה' },
        { id: crypto.randomUUID(), amount: quote.amount - half, label: 'בסיום' },
      ]);
    }
  }

  return (
    <Sheet
      title={sold ? 'מכירה ותשלומים' : 'מכירה'}
      onClose={onClose}
      tall
      footer={
        <div className="space-y-2">
          {!sold && isManager && (
            <PrimaryButton disabled={busy || quote.amount <= 0} onClick={() => save(true)}>
              סימון כנמכר — פתיחת תהליך העבודה
            </PrimaryButton>
          )}
          <button
            onClick={() => save(false)}
            disabled={busy}
            className={
              !sold && isManager
                ? 'w-full rounded-2xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50'
                : 'w-full rounded-2xl bg-stone-900 py-4 text-base font-semibold text-white transition-colors hover:bg-stone-800'
            }
          >
            שמירה
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* המחיר, גדול — זה מה שאומרים ללקוח */}
        <div className="rounded-2xl bg-stone-900 px-4 py-3 text-white">
          <span className="text-xs text-white/60">מחיר ללקוח</span>
          <span className="num block text-3xl font-bold">{shekels(quote.amount)}</span>
          <span className="block text-xs text-white/50">{quote.basis}</span>
          {quote.mode !== 'materials' && quote.materialsAmount > 0 && (
            <span className="num mt-1 block text-[11px] text-white/40">
              חישוב חומרים: {shekels(quote.materialsAmount)}
            </span>
          )}
        </div>

        <Field group label="שיטת תמחור" hint={isManager ? undefined : 'רק מנהל משנה'}>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <Chip key={m} active={m === mode} onClick={() => isManager && setMode(m)}>
                {PRICING_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>

        {mode === 'perUnit' && (
          <Field label="מחיר למ״ר חזית" hint="ארגז גדול עולה יותר">
            <input
              value={perUnit}
              onChange={(e) => setPerUnit(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="decimal"
              placeholder="₪"
              className={`${inputClass} num text-end`}
            />
          </Field>
        )}

        {mode === 'perMeter' && (
          <Field label="מחיר למטר רץ" hint="לפי רוחב הארונות התחתונים">
            <input
              value={perMeter}
              onChange={(e) => setPerMeter(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="decimal"
              placeholder="₪"
              className={`${inputClass} num text-end`}
            />
          </Field>
        )}

        {mode === 'manual' && (
          <Field label="מחיר הפרויקט" hint="גובר על כל חישוב">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="decimal"
              placeholder="₪"
              className={`${inputClass} num text-end`}
            />
          </Field>
        )}

        <div className="border-t border-stone-100 pt-5">
          <Field group label="תשלום">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={plan === 'single'} onClick={() => applyPlan('single')}>
                תשלום אחד
              </Chip>
              <Chip active={plan === 'installments'} onClick={() => applyPlan('installments')}>
                בתשלומים
              </Chip>
            </div>
          </Field>

          {payments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 ${
                    p.paidAt ? 'border-oak-300 bg-oak-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <button
                    onClick={() =>
                      setPayments((list) =>
                        list.map((x) =>
                          x.id === p.id ? { ...x, paidAt: x.paidAt ? undefined : Date.now() } : x,
                        ),
                      )
                    }
                    aria-pressed={!!p.paidAt}
                    aria-label={`סימון ${p.label ?? 'תשלום'} כשולם`}
                    className={`grid size-7 shrink-0 place-items-center rounded-full transition-colors ${
                      p.paidAt ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <CheckIcon className="size-4" />
                  </button>

                  <input
                    value={p.label ?? ''}
                    onChange={(e) =>
                      setPayments((list) =>
                        list.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    aria-label="שם התשלום"
                    className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 focus:outline-none"
                    placeholder="תשלום"
                  />

                  <input
                    value={p.amount || ''}
                    onChange={(e) =>
                      setPayments((list) =>
                        list.map((x) =>
                          x.id === p.id ? { ...x, amount: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                    onFocus={selectOnFocus}
                    type="number"
                    inputMode="decimal"
                    aria-label="סכום"
                    className="num w-20 shrink-0 rounded-lg bg-stone-100 px-2 py-1 text-end text-sm font-medium text-stone-900 focus:outline-none"
                  />

                  <button
                    onClick={() => setPayments((list) => list.filter((x) => x.id !== p.id))}
                    aria-label="הסרת התשלום"
                    className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() =>
              setPayments((list) => [
                ...list,
                { id: crypto.randomUUID(), amount: Math.max(quote.amount - status.total, 0) },
              ])
            }
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-3.5" />
            תשלום נוסף
          </button>

          {payments.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="סך התשלומים" value={shekels(status.total)} />
              <Stat label="שולם" value={shekels(status.paid)} tone="ok" />
              <Stat
                label="נותר"
                value={shekels(status.due)}
                tone={status.due > 0 ? 'due' : 'ok'}
              />
            </div>
          )}

          {payments.length > 0 && Math.abs(status.total - quote.amount) > 1 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
              סך התשלומים אינו שווה למחיר הפרויקט — הפרש של{' '}
              <span className="num">{shekels(Math.abs(status.total - quote.amount))}</span>.
            </p>
          )}
        </div>

        {sold && (
          <p className="num text-xs text-stone-400">
            נמכר ב־{new Date(project.soldAt!).toLocaleDateString('he-IL')}
          </p>
        )}
        {!sold && !isManager && (
          <p className="text-xs leading-snug text-stone-400">
            רק מנהל יכול לסמן פרויקט כנמכר ולפתוח את תהליך העבודה.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'due' }) {
  return (
    <div
      className={`rounded-xl px-2.5 py-2 ${
        tone === 'ok' ? 'bg-oak-50' : tone === 'due' ? 'bg-amber-50' : 'bg-stone-50'
      }`}
    >
      <span className="block text-[10px] text-stone-500">{label}</span>
      <span className="num block text-sm font-semibold text-stone-900">{value}</span>
    </div>
  );
}
