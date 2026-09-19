import { useLiveQuery } from 'dexie-react-hooks';
import { settingsRepo } from '../../materials/materialsRepo';
import { Page, ScreenHeader } from '../../ui/Page';
import { Field, inputClass } from '../../ui/Field';
import { MeasureInput } from '../../ui/MeasureInput';
import { unitLabel } from '../../ui/units';
import { BACK_KINDS, DRAWER_BOXES } from '../../db/types';
import type { ProjectDefaults } from '../../db/types';

/**
 * המידות שחוזרות בכל פרויקט.
 *
 * נגרייה עובדת באותן מידות שוב ושוב: רגליים 10 ס"מ, משטח בגובה 93.
 * עד עכשיו הן היו תקן בקוד, ומי שעובד אחרת תיקן אותן בכל ארגז
 * מחדש — עבודה שחוזרת על עצמה בלי סוף.
 *
 * ומה שהיה כאן קודם היה גרוע מזה: המסך שמר את המידות ואיש לא קרא
 * אותן. גובה משטח, עומק תחתונים, עומק עליונים ותחתית עליון נשמרו
 * ולא השפיעו על אף ארגז, ו"גובה רגליים" חל רק על תבנית ששתקה —
 * כלומר על אף תבנית, כי כל 126 הפריטים נושאים רגליים משלהם. המסך
 * הבטיח תקן ונתן קישוט.
 *
 * מה שנשאר כאן הוא מה שבאמת שולט. עומק ותחתית עליון ירדו ולא
 * הוחלפו בשליטה, כי בספרייה הזאת ההבדלים שם מכוונים: יש בה עומקים
 * מ-25 ועד 90 ס"מ וגבהי תלייה מ-45 ועד 200, ותקן אחד היה מוחק
 * אותם.
 *
 * מה שכבר נבנה לא משתנה: פרויקט קיים הוא החלטה שכבר התקבלה, ומידה
 * שתזוז בו מתחת לידיים היא הפתעה ולא נוחות. מי שכן רוצה להחיל
 * אותן על פרויקט קיים עושה את זה משם, בכפתור מפורש.
 */
export function DefaultsScreen() {
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  if (!settings) return null;
  const d = settings.defaults;

  const set = (patch: Partial<ProjectDefaults>) =>
    settingsRepo.save({ defaults: { ...d, ...patch } });

  const Measure = ({
    label,
    hint,
    value,
    min,
    onChange,
  }: {
    label: string;
    hint?: string;
    value: number;
    min: number;
    onChange: (mm: number) => void;
  }) => (
    <Field label={label} hint={hint ?? unitLabel()}>
      <MeasureInput
        value={value}
        onChange={onChange}
        minMm={min}
        ariaLabel={label}
        className={`${inputClass} num text-end`}
      />
    </Field>
  );

  return (
    <Page>
      <ScreenHeader title="ברירות מחדל לפרויקט" subtitle="המידות שחוזרות בכל עבודה" />

      <main className="flex-1 space-y-6 px-5 pt-4 pb-10">
        <p className="rounded-2xl bg-stone-100 px-4 py-3 text-xs leading-relaxed text-stone-600">
          מה שנקבע כאן חל על ארגזים שמוסיפים מכאן והלאה. פרויקט שכבר נבנה לא
          משתנה — מה שסוכם, סוכם; בהדמיה שלו יש כפתור שמחיל את המידות האלה
          על מה שכבר עומד בו.
        </p>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">ארגז תחתון</h2>
          <div className="grid grid-cols-2 gap-3">
            <Measure
              label="גובה רגליים"
              value={d.socleMm}
              min={0}
              onChange={(mm) => set({ socleMm: mm })}
            />
            <Measure
              label="גובה משטח"
              hint="ראש המשטח מהרצפה"
              value={d.counterTopMm}
              min={600}
              onChange={(mm) => set({ counterTopMm: mm })}
            />
            <Measure
              label="עובי משטח"
              value={d.counterMm}
              min={10}
              onChange={(mm) => set({ counterMm: mm })}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            גובה הגוף נגזר מהשניים: גובה המשטח פחות עוביו. חל על ארגזי מטבח
            שיש להם משטח — ארון כיור אמבטיה נבנה לגובה שלו ואינו נמתח.
          </p>
          <p className="mt-1 text-[11px] leading-snug text-stone-400">
            גובה הרגליים חל על ארגז שיש לו רגליים. מדף, דופן וארגז שנבנה
            בלעדיהן נשארים עומדים על הרצפה.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">קיר חדש</h2>
          <div className="grid grid-cols-2 gap-3">
            <Measure
              label="אורך קיר"
              value={d.wallLengthMm}
              min={300}
              onChange={(mm) => set({ wallLengthMm: mm })}
            />
            <Measure
              label="גובה קיר"
              value={d.wallHeightMm}
              min={1500}
              onChange={(mm) => set({ wallHeightMm: mm })}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            אלה המידות שאשף הפרויקט נפתח בהן. בשטח מודדים ומתקנים.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">בנייה</h2>

          <span className="mb-1.5 block text-[11px] font-medium text-stone-500">סוג הגב</span>
          <div className="flex flex-wrap gap-1.5">
            {BACK_KINDS.map((bk) => (
              <button
                key={bk.key}
                onClick={() => set({ backKind: bk.key })}
                aria-pressed={d.backKind === bk.key}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  d.backKind === bk.key
                    ? 'bg-oak-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {bk.label}
              </button>
            ))}
          </div>

          <span className="mt-3 mb-1.5 block text-[11px] font-medium text-stone-500">
            תיבת מגירה
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DRAWER_BOXES.map((bx) => (
              <button
                key={bx.key}
                onClick={() => set({ drawerBox: bx.key })}
                aria-pressed={d.drawerBox === bx.key}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  d.drawerBox === bx.key
                    ? 'bg-oak-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {bx.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            {DRAWER_BOXES.find((b) => b.key === d.drawerBox)?.hint}
          </p>
        </section>
      </main>
    </Page>
  );
}
