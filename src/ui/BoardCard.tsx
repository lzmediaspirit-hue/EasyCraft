import { boardSpec } from '../materials/boardSpec';
import { cm, shekels, unitLabel } from './units';
import type { Finish, Material, PartRole } from '../db/types';

/**
 * כרטיס הלוח שנבחר.
 *
 * הנגר בוחר גוון ורואה ריבוע צבע ושם. מה שהוא באמת צריך לדעת לפני
 * שהוא מזמין הוא הלוח כולו: איזו ליבה, באיזה עובי, באיזו מידת
 * פלטה, עם או בלי כיוון סיבים, ובאיזה מחיר — ואם בכלל יש מחיר.
 * המספרים האלה היו פזורים בין מסך החומרים למסך הגוונים, ומי שבחר
 * חזית לא ראה אף אחד מהם.
 *
 * הכרטיס אינו בוחר ואינו שומר: הוא מציג את מה שכבר נבחר.
 */
export function BoardCard({
  finish,
  material,
  role,
}: {
  finish: Finish | undefined;
  material: Material | undefined;
  /** לאיזה חלק בארגז זה נבחר — גוף, חזית, דופן זרה או גב */
  role?: PartRole;
}) {
  const s = boardSpec(finish, material, role);

  /* שורות שיש להן תוכן בלבד: שדה ריק בכרטיס נראה כמו תקלה */
  const rows: [string, string][] = [];
  if (s.coreLabel) rows.push(['ליבה', [s.coreLabel, s.coreColor].filter(Boolean).join(' · ')]);
  if (s.thicknessMm) rows.push(['עובי', `${s.thicknessMm} מ״מ`]);
  if (s.sheetWidthMm && s.sheetHeightMm) {
    rows.push(['פלטה', `${cm(s.sheetWidthMm)}×${cm(s.sheetHeightMm)} ${unitLabel()}`]);
  }
  rows.push(['סיבים', s.hasGrain ? 'כיוון קבוע' : 'חופשי']);
  if (s.texture) rows.push(['מרקם', s.texture]);
  if (s.roleLabel) rows.push(['משמש ל', s.roleLabel]);

  return (
    <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-9 shrink-0 rounded-lg border border-black/10"
          style={{ background: s.finishHex }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-stone-800">{s.finishName}</span>
          {s.materialName && (
            <span className="block truncate text-[11px] text-stone-500">{s.materialName}</span>
          )}
        </span>
        <PriceTag spec={s} />
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <span key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-[10px] text-stone-400">{label}</dt>
            <dd className="truncate text-[11px] font-medium text-stone-700">{value}</dd>
          </span>
        ))}
      </dl>
    </div>
  );
}

/**
 * המצב המסחרי, ולא רק המחיר.
 *
 * "זמין בלי מחיר" ו"לא מגיע על הלוח הזה" הם שני דברים שונים, ועד
 * עכשיו שניהם נראו אותו דבר — שורה ריקה. מי שראה ריק הבין "אין",
 * ולוח אמיתי שרק לא תומחר נעלם מהבחירה.
 */
function PriceTag({ spec }: { spec: ReturnType<typeof boardSpec> }) {
  if (spec.status === 'missing') {
    return (
      <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-500">
        לא על הלוח הזה
      </span>
    );
  }
  if (spec.status === 'unpriced') {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
        מחיר חסר
      </span>
    );
  }
  const price = spec.price?.consumerPrice ?? spec.price?.factoryPrice ?? 0;
  return (
    <span className="shrink-0 text-end">
      <span className="num block text-sm font-semibold text-stone-800">{shekels(price)}</span>
      <span className="block text-[10px] text-stone-400">לפלטה</span>
    </span>
  );
}
