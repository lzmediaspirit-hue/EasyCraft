import { useRef, useState } from 'react';
import {
  HARDWARE_CURRENCIES,
  HARDWARE_REPLACES,
  HARDWARE_UNITS,
  fromSpec,
  hardwareSpecs,
  missingFacts,
} from '../../catalog/hardware';
import { ChevronIcon, TrashIcon } from '../../ui/icons';
import { Chip } from '../../ui/Field';
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
  /* איזו שורה פתוחה לפרטים — אחת בכל רגע, כדי שהרשימה תישאר קצרה */
  const [open, setOpen] = useState<string | null>(null);
  const specs = hardwareSpecs(settings);

  /*
   * העריכה נשענת על מה שיצא אחרון מכאן, ולא על מה שחזר מהמסד.
   *
   * כל שינוי עושה דרך ארוכה — כתיבה, שאילתה חיה, רינדור — ושתי
   * עריכות בזו אחר זו נשענו שתיהן על אותו צילום ישן: מילוי הספק
   * ומיד אחריו הדגם הותיר רק את הדגם. מה שנכתב מכאן הוא האמת עד
   * שהוא חוזר, ואז הצילום מהמסד מקבל שוב את התפקיד.
   */
  const sent = useRef<Hardware[] | null>(null);
  if (sent.current && JSON.stringify(sent.current) === JSON.stringify(rows)) sent.current = null;
  /*
   * ומה שיצא אחרון נקרא ברגע הכתיבה, ולא ברגע הרינדור.
   *
   * `base` נלכד פעם אחת לכל רינדור, ושתי עריכות שקרו לפני
   * הרינדור הבא נשענו שתיהן על אותו צילום: מילוי הספק, ומיד
   * אחריו מעבר לשדה הדגם, נתן ערך אחד שנכתב ומיד נדרס — הדגם
   * נשמר והספק חזר לערכו הקודם. שמונה מתוך עשרה סבבים במדידה.
   *
   * ההפרדה כאן היא בין מה שמצויר למה שנכתב: הציור צריך צילום
   * יציב, הכתיבה צריכה את האחרון שיש.
   */
  const latest = () => sent.current ?? rows;
  const base = latest();

  const write = (next: Hardware[]) => {
    sent.current = next;
    onChange(next);
  };

  const patch = (id: string, next: Partial<Hardware>) =>
    write(latest().map((r) => (r.id === id ? { ...r, ...next } : r)));

  return (
    <div className="mt-2 space-y-2">
      {base.map((row) => {
        const missing = canPrice ? missingFacts(row) : missingFacts(row).filter((m) => m !== 'מחיר');
        return (
          <div key={row.id} className="rounded-xl border border-stone-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <Text
                bare
                label="שם הפרזול"
                value={row.name}
                onChange={(v) => patch(row.id, { name: v ?? '' })}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-stone-900 focus:outline-none"
              />
              {/* היחידה נבחרת: זוג צירים אינו שתי יחידות, והזמנה לפי יחידה שגויה היא משלוח שגוי */}
              <select
                value={row.unit}
                onChange={(e) => patch(row.id, { unit: e.target.value as Hardware['unit'] })}
                aria-label={`יחידת המידה של ${row.name}`}
                className="num shrink-0 rounded-lg bg-stone-100 px-1.5 py-1 text-xs text-stone-600 focus:outline-none"
              >
                {HARDWARE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                onClick={() => write(latest().filter((r) => r.id !== row.id))}
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

            {/*
              פרטי ההזמנה.

              הם היו קיימים בנתונים ולא במסך: המשתמש ראה "חסר ספק"
              ולא היה לו איפה למלא אותו, ו-`replaces` — מה שמונע
              חיוב כפול — עבד רק כשמישהו הזריק אותו מבחוץ. כאן הוא
              נבחר ביד.
            */}
            <button
              onClick={() => setOpen(open === row.id ? null : row.id)}
              aria-expanded={open === row.id}
              className="mt-1.5 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:bg-stone-50"
            >
              פרטי הזמנה
              <ChevronIcon
                className={`size-3.5 transition-transform ${open === row.id ? '-rotate-90' : ''}`}
              />
            </button>

            {open === row.id && (
              <div className="mt-1 space-y-2 rounded-lg bg-stone-50 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <Text
                    label="ספק"
                    value={row.supplier}
                    onChange={(v) => patch(row.id, { supplier: v })}
                  />
                  <Text label="דגם" value={row.model} onChange={(v) => patch(row.id, { model: v })} />
                </div>

                {canPrice && (
                  <label className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[11px] text-stone-500">מטבע</span>
                    <select
                      value={row.currency ?? ''}
                      onChange={(e) =>
                        patch(row.id, { currency: e.target.value || undefined })
                      }
                      aria-label={`מטבע של ${row.name}`}
                      className="rounded-lg bg-white px-2 py-1 text-sm text-stone-800 ring-1 ring-stone-200 focus:outline-none"
                    >
                      {HARDWARE_CURRENCIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/*
                  מה שהשורה הזאת מחליפה. בלעדיה מנגנון שנבחר ביד
                  נספר פעמיים — פעם בשורה האוטומטית ופעם כאן.
                */}
                <div>
                  <p className="text-[11px] text-stone-500">במקום הספירה האוטומטית של</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Chip
                      small
                      active={!row.replaces}
                      onClick={() => patch(row.id, { replaces: undefined })}
                    >
                      לא מחליף
                    </Chip>
                    {HARDWARE_REPLACES.map((r) => (
                      <Chip
                        small
                        key={r.key}
                        active={row.replaces === r.key}
                        onClick={() => patch(row.id, { replaces: r.key })}
                      >
                        {r.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                  write([...latest(), fromSpec(spec)]);
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
                write([
                  ...latest(),
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

/**
 * טקסט חופשי קצר: שם, ספק, דגם.
 *
 * מה שמוקלד נשמר מקומית ונכתב ביציאה מהשדה, ולא בכל תו. מאחורי
 * השדה הזה יושב בסיס נתונים, והערך חוזר ממנו דרך שאילתה חיה —
 * ולכן הקלדה מהירה עקפה את החזרה והתווים הראשונים אבדו. מה
 * שנראה על המסך נלקח מהטיוטה, וזו אותה דרך שבה עובד שדה המידה.
 *
 * ריק נשמר כריק ולא כמחרוזת ריקה: "לא הוזן" ו"הוזן ריק" הם אותו
 * דבר כאן, ושניהם אינם ספק.
 */
function Text({
  label,
  value,
  onChange,
  className = 'w-full bg-transparent text-sm text-stone-900 focus:outline-none',
  bare,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  className?: string;
  /** בלי המסגרת והתווית — לשם השורה, שיושב בכותרת שלה */
  bare?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const field = (
    <input
      value={draft ?? value ?? ''}
      placeholder="—"
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) onChange(draft.trim() || undefined);
        setDraft(null);
      }}
      className={className}
    />
  );
  if (bare) return field;
  return (
    <label className="block rounded-lg bg-white px-2 py-1.5 ring-1 ring-stone-200">
      <span className="block text-[11px] text-stone-500">{label}</span>
      {field}
    </label>
  );
}

