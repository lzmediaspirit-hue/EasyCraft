import { Stat } from '../../ui/Stat';
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
  const [inclVat, setInclVat] = useState(project.priceIncludesVat ?? true);
  const [busy, setBusy] = useState(false);

  const draft: Project = {
    ...project,
    pricingMode: mode,
    manualPrice: Number(manual) || 0,
    perUnitRate: Number(perUnit) || 0,
    perMeterRate: Number(perMeter) || 0,
    priceIncludesVat: inclVat,
  };
  const quote = projectQuote(draft, units, costing);
  const status = paymentStatus({ ...draft, payments }, quote.amount);
  const sold = !!project.soldAt;
  /* שיטה שבה נגר מקליד מספר — שם השאלה "כולל מע״מ?" רלוונטית */
  const typedPrice = mode !== 'materials';

  async function save(alsoSell: boolean) {
    if (busy) return;
    setBusy(true);
    await projectsRepo.update(project.id, {
      pricingMode: mode,
      manualPrice: Number(manual) || undefined,
      perUnitRate: Number(perUnit) || undefined,
      perMeterRate: Number(perMeter) || undefined,
      priceIncludesVat: inclVat,
      paymentPlan: plan,
      payments,
    });
    if (alsoSell) await projectsRepo.markSold(project.id);
    onClose();
  }

  /**
   * תשלום אחד = כל הסכום; בתשלומים = מקדמה ויתרה, כברירת מחדל.
   *
   * תשלום שכבר התקבל אינו נבנה מחדש: לחיצה על התוכנית שכבר פעילה
   * החליפה כסף שנכנס בהבטחה חדשה שלא שולמה, והנתון הזה אבד בשמירה.
   * מה ששולם נשאר, והפריסה נבנית על מה שנשאר לגבות.
   */
  function applyPlan(next: PaymentPlan) {
    /* התוכנית שכבר פעילה ויש לה שורות — אין מה לבנות מחדש */
    if (next === plan && payments.length) return;
    setPlan(next);

    const kept = payments.filter((p) => p.paidAt);
    const left = Math.max(quote.amount - kept.reduce((n, p) => n + p.amount, 0), 0);
    if (!left) {
      setPayments(kept);
      return;
    }
    const first = kept.length ? 'יתרה' : 'תשלום מלא';
    if (next === 'single') {
      setPayments([...kept, { id: crypto.randomUUID(), amount: left, label: first }]);
      return;
    }
    const half = Math.round(left / 2);
    setPayments([
      ...kept,
      { id: crypto.randomUUID(), amount: half, label: kept.length ? 'תשלום ביניים' : 'מקדמה' },
      { id: crypto.randomUUID(), amount: left - half, label: 'בסיום' },
    ]);
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
          <span className="text-xs text-white/60">מחיר ללקוח, כולל מע״מ</span>
          <span className="num block text-3xl font-bold">{shekels(quote.amount)}</span>
          <span className="block text-xs text-white/50">{quote.basis}</span>
          {/*
            הפירוק גלוי, כי זה מה שנגר צריך להוציא חשבונית: כמה לפני
            מע״מ וכמה המע״מ. המספר הגדול הוא מה שהלקוח משלם, והוא
            אותו מספר שמופיע במסך החומרים וממנו נבנים התשלומים.
          */}
          {quote.vatPct > 0 && quote.amount > 0 && (
            <span className="num mt-1 block text-[11px] text-white/50">
              {shekels(quote.beforeVat)} + מע״מ {quote.vatPct}% ({shekels(quote.vatAmount)})
            </span>
          )}
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

        {/*
          מספר שנגר מקליד הוא מה שהוא אמר ללקוח, ואצל רוב הנגרים זה
          כבר המחיר הסופי. כאן זה נקבע במפורש במקום להיות ניחוש.
        */}
        {typedPrice && (
          <Field group label="המחיר שהזנתי" hint="כדי שהמע״מ לא ייספר פעמיים ולא ייעלם">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={inclVat} onClick={() => isManager && setInclVat(true)}>
                כולל מע״מ
              </Chip>
              <Chip active={!inclVat} onClick={() => isManager && setInclVat(false)}>
                לפני מע״מ
              </Chip>
            </div>
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

          {/*
            "נותר" נמדד מול מחיר המכירה ולא מול מה שנפרס: פרויקט מכור
            בלי פריסת תשלומים הראה "נותר 0", כאילו הלקוח אינו חייב.
          */}
          {(payments.length > 0 || sold) && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat variant="flat" size="sm" label="נפרס" value={shekels(status.scheduled)} />
              <Stat variant="flat" size="sm" label="שולם" value={shekels(status.paid)} tone="ok" />
              <Stat
                variant="flat"
                size="sm"
                label="נותר"
                value={shekels(status.due)}
                tone={status.due > 0 ? 'due' : 'ok'}
              />
            </div>
          )}

          {(payments.length > 0 || sold) && Math.abs(status.scheduled - quote.amount) > 1 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
              {status.scheduled < quote.amount ? (
                <>
                  עוד לא נפרסו{' '}
                  <span className="num">{shekels(quote.amount - status.scheduled)}</span> ממחיר
                  הפרויקט. מה שנותר לגבות נמדד מול המחיר, לא מול הפריסה.
                </>
              ) : (
                <>
                  סך התשלומים גדול ממחיר הפרויקט ב־
                  <span className="num">{shekels(status.scheduled - quote.amount)}</span>.
                </>
              )}
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

