import { useState } from 'react';
import { fromSpec, hardwareSpecs, missingFacts } from '../../catalog/hardware';
import { TrashIcon } from '../../ui/icons';
import type { Hardware, Settings } from '../../db/types';

/**
 * הפרזול של הארגז.
 *
 * זו רשימת הזמנה ולא רשימת קטלוג: כל שורה נושאת את המחיר שהיה
 * כשהיא נבחרה, ועדכון מחיר ברשימת העסק אינו משנה הצעה שכבר יצאה.
 *
 * מה שאיננו יודעים נאמר ולא מומצא. "מנגנון מיקרו" הוא השם שנמסר,
 * ואין לו כאן ספק, דגם או מידת התקנה — נגר שיקבל מספר שאיש לא
 * בדק יזמין לפיו.
 *
 * מחיר אפס שנקבע בכוונה אינו מחיר חסר: פרזול שמגיע בחינם מהספק
 * הוא מקרה אמיתי, והוא אינו "לא הוזן".
 */
export function HardwareRows({
  rows,
  settings,
  canPrice,
  onChange,
}: {
  rows: Hardware[];
  settings?: Pick<Settings, 'hardware'>;
  /** מי שאינו רואה כסף אינו רואה מחיר ואינו עורך אותו */
  canPrice: boolean;
  onChange: (rows: Hardware[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const specs = hardwareSpecs(settings);

  const patch = (id: string, next: Partial<Hardware>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));

  return (
    <div className="mt-2 space-y-2">
      {rows.map((row) => {
        const missing = canPrice ? missingFacts(row) : missingFacts(row).filter((m) => m !== 'מחיר');
        return (
          <div key={row.id} className="rounded-xl border border-stone-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <input
                value={row.name}
                onChange={(e) => patch(row.id, { name: e.target.value })}
                aria-label="שם הפרזול"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-stone-900 focus:outline-none"
              />
              <span className="num text-xs text-stone-400">{row.unit}</span>
              <button
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                aria-label={`מחיקת ${row.name}`}
                className="rounded-lg p-1 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>

            <div className={`mt-2 grid gap-2 ${canPrice ? 'grid-cols-3' : 'grid-cols-1'}`}>
              <Num
                label="כמות"
                value={row.qty}
                onChange={(n) => patch(row.id, { qty: Math.max(n ?? 0, 0) })}
              />
              {canPrice && (
                <>
                  <Num
                    label="עלות"
                    value={row.factoryPrice}
                    onChange={(n) => patch(row.id, { factoryPrice: n })}
                  />
                  <Num
                    label="ללקוח"
                    value={row.consumerPrice}
                    onChange={(n) => patch(row.id, { consumerPrice: n })}
                  />
                </>
              )}
            </div>

            {!!missing.length && (
              <p className="mt-1.5 text-[11px] leading-snug text-amber-700">
                חסרים נתוני התאמה: {missing.join(', ')}.
              </p>
            )}
            {row.note && (
              <p className="mt-1 text-[11px] leading-snug text-stone-400">{row.note}</p>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-xl bg-stone-100 p-2.5">
          <p className="mb-1.5 text-[11px] text-stone-500">מהרשימה של העסק:</p>
          <div className="flex flex-wrap gap-1.5">
            {specs.map((spec) => (
              <button
                key={spec.id}
                onClick={() => {
                  onChange([...rows, fromSpec(spec)]);
                  setAdding(false);
                }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200 transition-colors hover:ring-oak-400"
              >
                {spec.name}
              </button>
            ))}
            {/* פריט שאינו ברשימה — שם ומחיר, בלי להמציא ספק ודגם */}
            <button
              onClick={() => {
                onChange([
                  ...rows,
                  { id: crypto.randomUUID(), name: 'פרזול משלי', qty: 1, unit: 'יח׳' },
                ]);
                setAdding(false);
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-oak-700 ring-1 ring-oak-200 transition-colors hover:ring-oak-400"
            >
              פריט משלי
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
        >
          הוספת פרזול
        </button>
      )}
    </div>
  );
}

/**
 * מספר פשוט: כמות או מחיר.
 *
 * שדה ריק אינו אפס — הוא "לא הוזן", וזו ההבחנה שכל השורה נשענת
 * עליה. לכן `undefined` נשמר כ-`undefined` ולא נדרס באפס.
 */
function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        placeholder="—"
        aria-label={label}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === '' ? undefined : Number(raw));
        }}
        className="num w-full bg-transparent text-base font-medium text-stone-900 focus:outline-none"
      />
    </label>
  );
}
