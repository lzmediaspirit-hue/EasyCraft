import { Sheet } from '../../ui/Sheet';
import {
  STAGE_CHAIN,
  canAdvance,
  stageIndex,
  stageOf,
  tracksOf,
  withStage,
} from '../../workflow/unitWork';
import { TRACKS } from '../../workflow/unitWork';
import type { PlacedUnit, UnitWork, UserRole } from '../../db/types';

/**
 * סימון מהיר לכל הקיר.
 *
 * התכנת לא מוציא קבצים לארגז אחד — הוא מוציא את כל הגופים ביחד,
 * ואחר כך את כל החזיתות. ללחוץ על עשרים ארגזים בזה אחר זה זו אותה
 * פעולה עשרים פעם, ובדיוק שם נופלות טעויות.
 *
 * מסומן רק מה שבאמת אפשר: ארגז שאין לו דפנות זרות לא מקבל מסלול
 * כזה, וארגז שכבר עבר את השלב לא נסוג אחורה.
 */
export function BulkWorkSheet({
  units,
  role,
  project,
  shown,
  onApply,
  onClose,
}: {
  units: PlacedUnit[];
  /** מי שנכנס באמת — ממנו נגזרת הסמכות */
  role: UserRole | undefined;
  /** התפקיד שנבחר לצפייה, כשהוא אינו התפקיד האמיתי */
  shown?: UserRole;
  /** הפרויקט — הייצור נפתח רק אחרי המכירה */
  project?: { soldAt?: number };
  onApply: (changes: { id: string; work: UnitWork }[]) => void;
  onClose: () => void;
}) {

  const rows = TRACKS.flatMap((track) =>
    STAGE_CHAIN.map((stage) => {
      const targets = units.filter((u) => {
        const def = tracksOf(u).find((t) => t.key === track.key);
        if (!def) return false;
        /*
         * סימון מהיר מקדם, ולא מחזיר אחורה.
         *
         * הסינון בדק רק "לא באותו שלב", ו-`canAdvance` מרשה תיקון
         * אחורה — ולכן "מוכן לחיתוך" על הקיר החזיר גם ארגז שכבר
         * הורכב אל תחילת הדרך, ואיתו את הפלטות שכבר נצרכו. תיקון
         * לאחור הוא פעולה מכוונת על ארגז אחד, ולא תופעת לוואי של
         * סימון על כולם.
         */
        if (stageIndex(stageOf(u, track.key)) >= stageIndex(stage.key)) return false;
        return canAdvance(u, def, stage.key, role, project, shown).ok;
      });
      return { track, stage, targets };
    }).filter((r) => r.targets.length > 0),
  );

  return (
    <Sheet title="סימון מהיר" onClose={onClose} tall>
      <div className="space-y-4">
        {rows.length === 0 ? (
          <p className="pt-8 text-center text-sm leading-snug text-stone-500">
            אין כרגע סימון שאפשר להחיל על כמה ארגזים בבת אחת — או שהכול
            כבר מסומן, או שהשלב הבא אינו בתפקיד שלך.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={`${r.track.key}:${r.stage.key}`}>
                <button
                  onClick={() => {
                    onApply(
                      r.targets.map((u) => ({
                        id: u.id,
                        work: withStage(u.work, r.track, r.stage.key),
                      })),
                    );
                    onClose();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-start transition-colors hover:border-oak-400"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-800">
                      {r.track.label} — {r.stage.label}
                    </span>
                    <span className="block truncate text-[11px] text-stone-400">
                      {r.track.hint}
                    </span>
                  </span>
                  <span className="num shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                    {r.targets.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs leading-snug text-stone-500">
          המספר הוא כמה ארגזים על הקיר הזה יסומנו. ארגז שכבר עבר את
          השלב, או שהשלב לא שייך לו, לא ייגע.
        </p>
      </div>
    </Sheet>
  );
}
