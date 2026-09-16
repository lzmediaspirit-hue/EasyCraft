import { Sheet } from '../../ui/Sheet';
import { WARN_ORDER } from './analysis';
import type { WallWarning, WarnLevel } from './analysis';

/**
 * כל מה שלא בסדר בחדר, במקום אחד.
 *
 * עד כאן האזהרות היו רשימה מתחת למחוונים, מאחורי מתג "מה מוצג":
 * מי שכיבה אותו לא ראה עוד ששקע נחסם, ומי שהשאיר אותו דלוק קיבל
 * שורה שטוחה שבה ארגז שחורג מהחדר וארגז שקצת גבוה מדי נראים
 * אותו דבר. כאן הן מסודרות לפי חומרה, נספרות, ולחיצה עליהן
 * מדליקה על הציור את שני העצמים שהאזהרה מדברת עליהם — מה שנפתח
 * ומה שעומד בדרך.
 */

const LEVELS: Record<WarnLevel, { label: string; hint: string; tone: string; dot: string }> = {
  block: {
    label: 'לא ייבנה',
    hint: 'הארגז לא נכנס למקום שהוא עומד בו',
    tone: 'border-red-200 bg-red-50 text-red-900',
    dot: 'bg-red-500',
  },
  warn: {
    label: 'ייבנה, אבל יעבוד רע',
    hint: 'אפשר להרכיב — ויהיו בעיות בשימוש',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    dot: 'bg-amber-500',
  },
  info: {
    label: 'חסרים נתונים',
    hint: 'הבדיקה לא נכשלה — היא לא יכלה לרוץ',
    tone: 'border-stone-200 bg-stone-50 text-stone-700',
    dot: 'bg-stone-400',
  },
};

export function warnLevelTone(level: WarnLevel): string {
  return LEVELS[level].dot;
}

export function WarningsSheet({
  warnings,
  onPick,
  onClose,
}: {
  warnings: WallWarning[];
  /** מדליק על הציור את העצמים שהאזהרה מדברת עליהם */
  onPick: (w: WallWarning) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="בדיקת התכנון" onClose={onClose} tall>
      {warnings.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-stone-500">
          הכול נכנס, והכול נפתח. אין מה לתקן בחדר הזה.
        </p>
      ) : (
        <div className="space-y-5">
          {WARN_ORDER.map((level) => {
            const rows = warnings.filter((w) => w.level === level);
            if (!rows.length) return null;
            const def = LEVELS[level];
            return (
              <section key={level}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <span className={`size-2 rounded-full ${def.dot}`} />
                  {def.label}
                  <span className="num text-xs font-normal text-stone-400">{rows.length}</span>
                </h3>
                <p className="mt-0.5 mb-2 text-xs text-stone-400">{def.hint}</p>
                <ul className="space-y-1.5">
                  {rows.map((w) => (
                    /* המפתח כולל את העצמים: שני ארגזים באותו שם מייצרים
                       בדיוק את אותו משפט, ובלעדיהם השני נעלם */
                    <li key={`${w.text}|${w.unitIds.join(',')}|${(w.featureIds ?? []).join(',')}`}>
                      <button
                        onClick={() => {
                          onPick(w);
                          onClose();
                        }}
                        className={`w-full rounded-xl border p-3 text-start text-sm leading-snug transition-opacity hover:opacity-80 ${def.tone}`}
                      >
                        {w.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
