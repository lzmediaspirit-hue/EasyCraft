import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../ui/Sheet';
import { CheckIcon, WandIcon } from '../../ui/icons';
import { unitsRepo } from '../projects/projectsRepo';
import { history } from './history';
import { buildPlan } from './plan';
import type { PlanWall } from './plan';
import { planKitchen, placementName, whyNothing } from './autoPlan';
import { resolvePlan, type ResolvedPlan } from './planResolve';
import { planRoom, roomPlacementName } from './planRoom';
import { roomProfile } from './roomProfiles';
import { catalogRepo } from '../../catalog/catalogRepo';
import { settingsRepo } from '../../materials/materialsRepo';
import { projectsRepo } from '../projects/projectsRepo';
import { PlanThumb } from './PlanThumb';
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
  roomKind,
  walls,
  units,
  onClose,
}: {
  projectId: string;
  /** החדר שמתוכנן. מטבח נבנה במנוע משלו; לשאר יש פרופיל. */
  roomKind: string;
  walls: Wall[];
  units: PlacedUnit[];
  onClose: () => void;
}) {
  /*
   * החדר קובע מה נשאל ומה נבנה.
   *
   * הכפתור היה של המטבח בלבד, ולכן כל השאלות היו על מכשירי חשמל
   * ועל משולש עבודה. בחדר ארונות אין מקרר ואין משולש — יש תלייה,
   * מדפים ומגירות, והפרופיל הוא מה שאומר את זה.
   */
  const profile = roomProfile(roomKind);
  const [roomOptions, setRoomOptions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((profile?.options ?? []).map((o) => [o.key, o.on])),
  );
  const [appliances, setAppliances] = useState<Appliances>(DEFAULT_APPLIANCES);
  const [seating, setSeating] = useState(false);
  const [finish, setFinish] = useState<AutoInput['finish']>('standard');
  const [step, setStep] = useState<'ask' | 'pick'>('ask');
  const [applied, setApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
  const items = useLiveQuery(() => catalogRepo.all(), [], []);
  /* רק הספרייה של החדר: ארון בגדים אינו ממלא תפקיד במטבח */
  const roomItems = useMemo(
    () => items.filter((i) => i.rooms.includes(roomKind)),
    [items, roomKind],
  );
  const proposals = useMemo(() => {
    if (!frozen) return [];
    if (!profile) return planKitchen({ walls, plan: frozen, appliances, seating, finish });
    return planRoom({
      room: roomKind,
      walls,
      plan: frozen,
      items: roomItems,
      options: roomOptions,
    });
  }, [frozen, walls, appliances, seating, finish, profile, roomKind, roomItems, roomOptions]);
  const show = () => {
    setFrozen(buildPlan(walls, units));
    setStep('pick');
  };

  /*
   * הספרייה האמיתית, ההגדרות והחדר — מה שההצעה נפתרת מולו.
   *
   * הכרטיס צייר מארגזי התקן והשמירה בחרה מהספרייה של הנגרייה,
   * ולכן מה שנראה בכרטיס לא היה מה שהונח. עכשיו שניהם קוראים
   * את אותה פתירה.
   */
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const project = useLiveQuery(() => projectsRepo.get(projectId), [projectId]);
  const resolved = useMemo(() => {
    const map = new Map<string, ResolvedPlan>();
    if (!settings || !items.length) return map;
    for (const p of proposals) {
      map.set(
        p.key,
        resolvePlan({
          placements: p.units,
          items,
          walls,
          defaults: settings.defaults,
          room: project?.roomKind,
          nameOf: (pl) => (profile ? roomPlacementName(pl, roomItems) : placementName(pl)),
        }),
      );
    }
    return map;
  }, [proposals, items, walls, settings, project, profile, roomItems]);

  async function apply(p: Proposal) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    /*
     * כישלון אינו משאיר את המסך תקוע.
     *
     * `busy` נדלק לפני הצילום וההחלפה, וכובה רק בהצלחה: חריגה
     * באמצע השאירה את הכפתורים מושבתים בלי שום הודעה, ורק רענון
     * הדף שחרר אותם. `finally` הוא מה שמחזיר את המסך למשתמש.
     */
    try {
      /*
       * צילום אחד לפני ההצעה הראשונה בלבד: מעבר בין הצעות אינו
       * צעד חדש בהיסטוריה אלא אותה בחירה שמתחלפת, ו"בטל" צריך
       * להחזיר את מה שהיה על הקיר לפני שנפתחה המגירה.
       */
      if (!applied) await history.capture(projectId, `autoplan:${Date.now()}`);
      const res = await unitsRepo.applyPlan(projectId, p.units);
      if (res.ok) setApplied(p.key);
      else setProblem(res.issues.map((i) => i.text).join(' '));
    } catch (e) {
      setProblem(
        e instanceof Error && e.message
          ? `ההצעה לא הונחה: ${e.message}`
          : 'ההצעה לא הונחה. הפרויקט נשאר כפי שהיה.',
      );
    } finally {
      setBusy(false);
    }
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
            {profile
              ? `${profile.intro} התכנון לפי מידות החדר, החלונות והדלתות שכבר סימנת.`
              : 'המערכת מסדרת את המטבח לפי מידות החדר, החלונות והדלתות שכבר סימנת. צריך רק לומר מה נכנס פנימה.'}
          </p>

          {units.length > 0 && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900">
              בפרויקט כבר עומדים <span className="num">{units.length}</span> ארגזים.
              הצעה שתיבחר תחליף את כולם — "בטל" במסך ההדמיה מחזיר אותם.
            </p>
          )}

          {/*
            חדר שאינו מטבח נשאל את השאלות שלו.
            "מקרר, תנור, כיריים" אינן שאלות על חדר ארונות, ותשובה
            להן שם היא רעש.
          */}
          {profile ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-900">מה נכנס ל{profile.label}</h3>
              <div className="grid grid-cols-2 gap-2">
                {profile.options.map((o) => (
                  <Toggle
                    key={o.key}
                    label={o.hint ? `${o.label} · ${o.hint}` : o.label}
                    on={!!roomOptions[o.key]}
                    onToggle={() =>
                      setRoomOptions((prev) => ({ ...prev, [o.key]: !prev[o.key] }))
                    }
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-stone-400">
                מה שאין לו יחידה מתאימה בספרייה של החדר — נאמר, ולא מדולג בשקט.
              </p>
            </section>
          ) : (
          <>
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
          </>
          )}
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
        {problem && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900">
            {problem}
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
            walls={walls}
            resolved={resolved.get(p.key)}
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
  walls,
  resolved,
  active,
  onPick,
}: {
  proposal: Proposal;
  walls: Wall[];
  /** ההצעה כארגזים אמיתיים מהספרייה — אותם אלה שיישמרו */
  resolved?: ResolvedPlan;
  active: boolean;
  onPick: () => void;
}) {
  const { score } = proposal;
  /*
   * מה שמצויר הוא מה שיונח.
   *
   * הכרטיס צייר מארגזי התקן ולא מהספרייה של הנגרייה, ולכן גובה,
   * עומק ואיור בתמונה היו של ארגז אחר. עד שהפתירה מגיעה אין מה
   * לצייר — וזה עדיף על לצייר משהו אחר.
   */
  const preview = resolved?.units.map((r) => r.unit) ?? [];
  const issues = resolved?.issues ?? [];
  const blocked = issues.length > 0;
  /*
   * השם מהפתירה, ולא מטבלת שמות של ארגזי תקן.
   *
   * בחדר שאינו מטבח היחידה *היא* פריט מהספרייה, ולכן השם שלה הוא
   * השם שהנגר נתן לה. "ארגז" לכל דבר אינו רשימה.
   */
  const counts = new Map<string, number>();
  for (const [i, u] of proposal.units.entries()) {
    const name = resolved?.units[i]?.item.name ?? placementName(u);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return (
    <button
      onClick={onPick}
      /*
       * הצעה שיש בה חסם אינה נבחרת.
       *
       * קודם היא הוצגה עם ציון 99, ורק אחרי ההנחה התגלו ההתנגשויות.
       * מה שאי אפשר להניח אינו מוצע — והסיבה כתובה על הכרטיס.
       */
      disabled={blocked}
      aria-disabled={blocked}
      /* ההצעה שנבחרה מסומנת גם למי שלא רואה את המסגרת הכתומה */
      aria-pressed={active}
      className={`block w-full rounded-2xl border-2 p-4 text-start transition-colors ${
        blocked
          ? 'border-red-200 bg-red-50/40'
          : active
            ? 'border-oak-600 bg-oak-50'
            : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      {/*
        תמונה של המטבח, מאותו מנוע שמצייר את ההדמיה הגדולה. כרטיס
        שמתאר מטבח במילים מבקש מהנגר לדמיין אותו; כרטיס שמראה אותו
        לא מבקש כלום.
      */}
      <PlanThumb walls={walls} units={preview} className="mb-3 h-32 w-full" />

      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-stone-900">
            {proposal.title}
          </span>
          <span className="block text-xs text-stone-400">{proposal.layoutName}</span>
        </span>
        {blocked ? (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
            לא ניתן להניח
          </span>
        ) : active ? (
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
        {/* משולש עבודה אינו נמדד כשחסרה תחנה — אין ממה למדוד אותו */}
        <Metric
          label="משולש עבודה"
          value={score.missing ? '—' : `${Math.round(score.triangle * 100)}%`}
        />
        <Metric label="משטח הכנה" value={`${Math.round(score.prepMm / 10)} ס״מ`} />
        <Metric label="מטר רץ" value={`${(score.runMm / 1000).toFixed(2)} מ׳`} />
        <Metric label="ארגזים" value={String(score.boxes)} />
      </dl>

      <p className="mt-3 text-sm leading-snug text-stone-600">
        {[...counts].map(([name, n]) => (n > 1 ? `${n}× ${name}` : name)).join(' · ')}
      </p>

      {score.missing > 0 && (
        <p className="mt-2 text-xs leading-snug text-amber-700">
          חסרות <span className="num">{score.missing}</span> תחנות ממה שביקשת — ראה למטה.
        </p>
      )}
      {issues.map((it, i) => (
        <p key={`i${i}`} className="mt-1.5 text-xs leading-snug text-red-800">
          {it.text}
        </p>
      ))}
      {proposal.notes.map((n, i) => (
        <p key={`n${i}`} className="mt-1.5 text-xs leading-snug text-stone-500">
          {n}
        </p>
      ))}
      {proposal.dropped.map((d, i) => (
        <p key={`d${i}`} className="mt-1.5 text-xs leading-snug text-amber-700">
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
