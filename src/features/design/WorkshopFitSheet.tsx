import { Sheet } from '../../ui/Sheet';
import { SaveError, useSaveGuard } from '../../ui/saveGuard';
import { PrimaryButton } from '../../ui/Field';
import { cmWith } from '../../ui/units';
import type { ProjectDefaults } from '../../db/types';

/**
 * החלת תקן הנגרייה על פרויקט שכבר נבנה.
 *
 * ברירות המחדל חלות על ארגז שנולד מכאן והלאה, ופרויקט קיים אינו
 * זז מתחת לידיים — מידה שמשתנה בעבודה שכבר תומחרה ונוסרה היא
 * הפתעה ולא נוחות. אבל יש גם את המקרה ההפוך: הנגרייה עברה ממשטח
 * 2 ס״מ ל-3, והפרויקט שעל השולחן הוא בדיוק זה שצריך להתעדכן.
 *
 * לכן זו פעולה מפורשת, והיא אומרת מראש מה בדיוק היא נוגעת בו.
 * מה שהיא *אינה* נוגעת בו חשוב לא פחות: רוחב, עומק, גובה תלייה
 * ומידות שנקבעו ביד לארגז אחד נשארים.
 */
export function WorkshopFitSheet({
  defaults,
  roomKind,
  onApply,
  onClose,
}: {
  defaults: ProjectDefaults;
  roomKind?: string;
  onApply: () => Promise<void>;
  onClose: () => void;
}) {
  const guard = useSaveGuard();
  const kitchen = roomKind === 'kitchen';

  return (
    <Sheet
      title="החלת מידות התקן"
      onClose={onClose}
      footer={
        <>
          <SaveError text={guard.error} />
          <PrimaryButton disabled={guard.busy} onClick={() => guard.run(onApply)}>
            החלה על הפרויקט
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4 text-sm text-stone-700">
        <p className="leading-relaxed">
          מיישר את הארגזים שכבר עומדים בפרויקט לתקן שנקבע בהגדרות. פעולה אחת,
          ואפשר לבטל אותה.
        </p>

        <ul className="space-y-2 rounded-2xl bg-stone-100 px-4 py-3 text-[13px] leading-relaxed">
          <li>
            גובה רגליים <span className="num font-semibold">{cmWith(defaults.socleMm)}</span> —
            לארגז שיש לו רגליים. מדף, דופן וארגז שנבנה בלעדיהן נשארים כפי שהם.
          </li>
          {kitchen ? (
            <li>
              משטח בגובה <span className="num font-semibold">{cmWith(defaults.counterTopMm)}</span>{' '}
              ובעובי <span className="num font-semibold">{cmWith(defaults.counterMm)}</span> —
              לארגז שיש לו משטח. גובה הגוף נגזר מההפרש.
            </li>
          ) : (
            <li>
              גובה המשטח הוא תקן של מטבח, והפרויקט הזה אינו מטבח — ארגזי המשטח
              שבו נשארים במידות שלהם.
            </li>
          )}
        </ul>

        <p className="text-[12px] leading-relaxed text-stone-500">
          רוחב, עומק, גובה תלייה ומידה שנקבעה ביד לארגז מסוים אינם משתנים.
        </p>
      </div>
    </Sheet>
  );
}
