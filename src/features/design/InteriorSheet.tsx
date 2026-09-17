import { Sheet } from '../../ui/Sheet';
import { cm, unitLabel } from '../../ui/units';
import { interiorDims } from './interior';
import type { BuildContext } from '../../catalog/saveGate';
import type { PlacedUnit } from '../../db/types';

/**
 * המידות הפנימיות של הארגז הנבחר.
 *
 * זה לא מה שכפתור המדידה עשה: הוא החליף בין רוחב, גובה ועומק של
 * הארגז כולו. מה שנגר צריך לדעת לפני שהוא מזמין סל, מגירה או מדף
 * הוא מה נשאר *בפנים* — בין הדפנות, בין המדפים, ובתוך תיבת
 * המגירה.
 *
 * כל מספר כאן נגזר מאותו מפרט שממנו נחתכים החלקים, ולכן אין פער
 * בין מה שמוצג לבין מה שיֵצא מהמסור. ראה `interior.ts`.
 */
export function InteriorSheet({
  unit,
  build,
  onClose,
}: {
  unit: PlacedUnit;
  build: BuildContext;
  onClose: () => void;
}) {
  const rows = interiorDims(unit, build);
  return (
    <Sheet title={`מידות פנימיות — ${unit.name}`} onClose={onClose} tall>
      <p className="mb-3 text-xs leading-snug text-stone-500">
        המידות הנקיות, ב{unitLabel()}. הן נגזרות מעובי הלוחות ומהאזורים
        שהוגדרו בארגז — אותם מספרים שמהם נחתכים החלקים.
      </p>
      <ul className="divide-y divide-stone-100">
        {rows.map((r, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-sm text-stone-700">
              {r.label}
              {r.note && (
                <span className="block text-[11px] leading-snug text-stone-400">{r.note}</span>
              )}
            </span>
            <span className="num shrink-0 text-sm font-semibold text-stone-900">{cm(r.mm)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
