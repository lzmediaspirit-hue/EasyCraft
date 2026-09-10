import { useMemo, useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { CheckIcon, WandIcon } from '../../ui/icons';
import { unitsRepo } from '../projects/projectsRepo';
import { history } from './history';
import { buildPlan } from './plan';
import type { PlanWall } from './plan';
import { planKitchen, placementName, whyNothing } from './autoPlan';
import type { Appliances, AutoInput, Proposal } from './autoPlan';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * תכנון מטבח בלחיצה.
 *
 * שני מסכים ולא יותר: מסמנים מה יש, ומקבלים הצעות. ההצעה נבחרת
 * בהקשה והיא מיד עומדת בהדמיה — השוואה בין שתי הצעות היא הקשה
 * אחת, וזה עדיף על תמונה קטנה שאי אפשר להסתובב בה.
 *
 * המנוע עצמו יושב ב-`autoPlan.ts` ואינו יודע דבר על React; כאן
 * רק השאלות, התצוגה, וההנחה בפועל.
 */

const APPLIANCE_LABELS: { key: keyof Appliances; label: string }[] = [
  { key: 'fridge', label: 'מקרר' },
  { key: 'oven', label: 'תנור' },
  { key: 'hob', label: 'כיריים' },
  { key: 'microwave', label: 'מיקרוגל' },
  { key: 'dishwasher', label: 'מדיח' },
  { key: 'hood', label: 'קולט אדים' },
];

const FINISH_LABELS: { key: AutoInput['finish']; label: string; hint: string }[] = [
  { key: 'plain', label: 'חסכוני', hint: 'דלתות, ארונות רחבים' },
  { key: 'standard', label: 'רגיל', hint: 'מגירות באזור העבודה' },
  { key: 'rich', label: 'מושקע', hint: 'מגירות ואחסון מלא' },
];

const DEFAULT_APPLIANCES: Appliances = {
  fridge: true,
  oven: true,
  hob: true,
  microwave: false,
  dishwasher: true,
  hood: true,
};

export function AutoPlanSheet({
  projectId,
  walls,
  units,
  onClose,
}: {
  projectId: string;
  walls: Wall[];
  units: PlacedUnit[];
  onClose: () => void;
}) {
  const [appliances, setAppliances] = useState<Appliances>(DEFAULT_APPLIANCES);
  const [seating, setSeating] = useState(false);
  const [finish, setFinish] = useState<AutoInput['finish']>('standard');
  const [step, setStep] = useState<'ask' | 'pick'>('ask');
  const [applied, setApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * החדר נקפא ברגע המעבר להצעות.
   *
   * `buildPlan` קורא את עומק הקירות מהארגזים שעומדים עליהם, ולכן
   * הצעה שהונחה הייתה משנה את הקלט ומרעידה את הרשימה מתחת לאצבע.
   * מה שנמדד הוא החדר כפי שהיה לפני הלחיצה, וזה גם מה שנכון:
   * ההצעות נבנו על החדר הזה.
   */
  const [frozen, setFrozen] = useState<PlanWall[] | null>(null);
  const plan = frozen ?? buildPlan(walls, units);
  const proposals = useMemo(
    () => (frozen ? planKitchen({ walls, plan: frozen, appliances, seating, finish }) : []),
    [frozen, walls, appliances, seating, finish],
  );
  const show = () => {
    setFrozen(buildPlan(walls, units));
    setStep('pick');
  };

  async function apply(p: Proposal) {
    if (busy) return;
    setBusy(true);
    /*
     * צילום אחד לפני ההצעה הראשונה בלבד: מעבר בין הצעות אינו
     * צעד חדש בהיסטוריה אלא אותה בחירה שמתחלפת, ו"בטל" צריך
     * להחזיר את מה שהיה על הקיר לפני שנפתחה המגירה.
     */
    if (!applied) await history.capture(projectId, `autoplan:${Date.now()}`);
    await unitsRepo.applyPlan(projectId, p.units);
    setApplied(p.key);
    setBusy(false);
  }

  if (step === 'ask') {
    return (
      <Sheet
        title="תכנון אוטומטי"
        onClose={onClose}
        footer={
          <button
            onClick={show}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white"
          >
            <WandIcon />
            הצגת הצעות
          </button>
        }
      >
        <div className="space-y-6 px-5 py-5">
          <p className="text-sm leading-snug text-stone-500">
            המערכת מסדרת את המטבח לפי מידות החדר, החלונות והדלתות שכבר סימנת.
            צריך רק לומר מה נכנס פנימה.
          </p>

          {units.length > 0 && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900">
              בפרויקט כבר עומדים <span className="num">{units.length}</span> ארגזים.
              הצעה שתיבחר תחליף את כולם — "בטל" במסך ההדמיה מחזיר אותם.
            </p>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-900">מה יש במטבח</h3>
            <div className="grid grid-cols-3 gap-2">
              {APPLIANCE_LABELS.map(({ key, label }) => (
                <Toggle
                  key={key}
                  label={label}
                  on={appliances[key]}
                  onToggle={() => setAppliances((a) => ({ ...a, [key]: !a[key] }))}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-400">כיור נכנס תמיד.</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-900">רמת גימור</h3>
            <div className="grid grid-cols-3 gap-2">
              {FINISH_LABELS.map(({ key, label, hint }) => (
                <button
                  key={key}
                  onClick={() => setFinish(key)}
                  className={`rounded-xl border-2 px-2 py-2.5 text-center transition-colors ${
                    finish === key
                      ? 'border-oak-600 bg-oak-50 text-oak-900'
                      : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-[11px] leading-tight opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-900">ישיבה במטבח</h3>
            <Toggle
              label={seating ? 'כן, כיסאות באי' : 'בלי ישיבה'}
              on={seating}
              onToggle={() => setSeating((v) => !v)}
              wide
            />
            <p className="mt-2 text-xs text-stone-400">
              אי נכנס רק כשיש לו מרווח מלא מכל צד. אם אין — נאמר למה.
            </p>
          </section>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="הצעות לחדר"
      onBack={() => {
        setFrozen(null);
        setStep('ask');
      }}
      onClose={onClose}
      tall
      footer={
        applied ? (
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white"
          >
            סיום ומעבר לעריכה
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3 px-5 py-5">
        {!proposals.length && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900">
            {whyNothing(plan)}
          </p>
        )}
        {applied && (
          <p className="rounded-xl bg-stone-100 px-3 py-2 text-xs leading-snug text-stone-500">
            ההצעה כבר עומדת בהדמיה. הקשה על הצעה אחרת מחליפה אותה, ו"בטל" במסך
            ההדמיה מחזיר את מה שהיה.
          </p>
        )}
        {proposals.map((p) => (
          <ProposalCard
            key={p.key}
            proposal={p}
            active={applied === p.key}
            onPick={() => apply(p)}
          />
        ))}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function Toggle({
  label,
  on,
  onToggle,
  wide,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  wide?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
        wide ? 'w-full' : ''
      } ${on ? 'border-oak-600 bg-oak-50 text-oak-900' : 'border-stone-200 bg-white text-stone-500'}`}
    >
      {on && <CheckIcon className="size-4" />}
      {label}
    </button>
  );
}

/**
 * כרטיס הצעה.
 *
 * שלוש שורות שמספרות מה בפנים: מדדים, מה נכנס, ומה לא נכנס ולמה.
 * המדדים אינם ציון סתמי — משולש עבודה, משטח הכנה ומטר רץ הם בדיוק
 * שלושת הדברים שנגר בודק כשהוא מסתכל על שרטוט מטבח.
 */
function ProposalCard({
  proposal,
  active,
  onPick,
}: {
  proposal: Proposal;
  active: boolean;
  onPick: () => void;
}) {
  const { score } = proposal;
  const counts = new Map<string, number>();
  for (const u of proposal.units) {
    const name = placementName(u);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return (
    <button
      onClick={onPick}
      className={`block w-full rounded-2xl border-2 p-4 text-start transition-colors ${
        active ? 'border-oak-600 bg-oak-50' : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-stone-900">{proposal.title}</span>
        {active ? (
          <span className="flex items-center gap-1 rounded-full bg-oak-600 px-2.5 py-1 text-xs font-semibold text-white">
            <CheckIcon className="size-3.5" />
            מוצג
          </span>
        ) : (
          <span className="num rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
            {score.total}
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        <Metric label="משולש עבודה" value={`${Math.round(score.triangle * 100)}%`} />
        <Metric label="משטח הכנה" value={`${Math.round(score.prepMm / 10)} ס״מ`} />
        <Metric label="מטר רץ" value={`${(score.runMm / 1000).toFixed(2)} מ׳`} />
        <Metric label="ארגזים" value={String(score.boxes)} />
      </dl>

      <p className="mt-3 text-sm leading-snug text-stone-600">
        {[...counts].map(([name, n]) => (n > 1 ? `${n}× ${name}` : name)).join(' · ')}
      </p>

      {proposal.notes.map((n) => (
        <p key={n} className="mt-1.5 text-xs leading-snug text-stone-500">
          {n}
        </p>
      ))}
      {proposal.dropped.map((d) => (
        <p key={d} className="mt-1.5 text-xs leading-snug text-amber-700">
          לא נכנס: {d}
        </p>
      ))}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 py-2">
      <dt className="text-[11px] leading-tight text-stone-400">{label}</dt>
      <dd className="num text-sm font-semibold text-stone-900">{value}</dd>
    </div>
  );
}
