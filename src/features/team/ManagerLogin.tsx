import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { teamRepo, currentMember, managerAuth } from '../../workflow/workflowRepo';
import { ROLE_LABEL } from '../../workflow/stages';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';

/**
 * כניסת מנהל.
 *
 * לניהול הצוות יש מפתח אחד: קוד שהמנהל קובע בהתקנה הראשונה. זו לא
 * אבטחה מול תוקף — הכול יושב על המכשיר וקוד כזה לא מגן על נתונים —
 * אלא מחסום שמונע מנגר בשטח לשנות תפקידים בטעות או להתחזות למנהל
 * כדי לסגור שלב שאינו שלו. אימות אמיתי ייכנס עם השרת.
 */
export function ManagerLogin({
  onCancel,
}: {
  /** יציאה בלי להיכנס. כניסה מוצלחת רק פותחת את המסך שמאחור. */
  onCancel: () => void;
}) {
  const managers = useLiveQuery(() => teamRepo.forRole('manager'), []);
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // אין עדיין קוד — ההתקנה הראשונה קובעת אותו יחד עם המנהל הראשון
  const first = !managerAuth.hasCode();
  const list = managers ?? [];

  async function setup() {
    if (code.trim().length < 4) return setError('קוד של 4 ספרות לפחות');
    if (code !== confirmCode) return setError('הקודים אינם זהים');
    if (!name.trim()) return setError('צריך שם למנהל');
    const id = await teamRepo.save({ name: name.trim(), role: 'manager' });
    managerAuth.setCode(code);
    currentMember.set(id);
    // הפתיחה אחרונה: היא מרנדרת מחדש את המסך שמאחור, כבר פתוח
    managerAuth.unlock();
  }

  function enter(memberId: string) {
    if (!managerAuth.verify(code)) return setError('קוד שגוי');
    currentMember.set(memberId);
    managerAuth.unlock();
  }

  return (
    <Sheet
      title={first ? 'הגדרת מנהל' : 'כניסת מנהל'}
      onClose={onCancel}
      footer={
        first ? (
          <PrimaryButton
            disabled={!name.trim() || code.length < 4 || code !== confirmCode}
            onClick={setup}
          >
            יצירת מנהל
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={!code || list.length === 0} onClick={() => enter(list[0].id)}>
            כניסה
          </PrimaryButton>
        )
      }
    >
      <div className="space-y-5">
        {first ? (
          <>
            <p className="text-sm leading-snug text-stone-500">
              המנהל הוא היחיד שמוסיף אנשי צוות, קובע מחירים וסוגר מכירה.
              בחר קוד — הוא יידרש בכל פעם שנכנסים לניהול הצוות.
            </p>

            <Field label="שם המנהל">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={selectOnFocus}
                className={inputClass}
              />
            </Field>

            <Field label="קוד מנהל" hint="4 ספרות לפחות">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                onFocus={selectOnFocus}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                className={`${inputClass} num text-end`}
              />
            </Field>

            <Field label="שוב, לאימות" error={error}>
              <input
                value={confirmCode}
                onChange={(e) => {
                  setConfirmCode(e.target.value);
                  setError(null);
                }}
                onFocus={selectOnFocus}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                className={`${inputClass} num text-end`}
              />
            </Field>
          </>
        ) : (
          <>
            <p className="text-sm leading-snug text-stone-500">
              ניהול הצוות פתוח למנהל בלבד.
            </p>

            {list.length > 1 && (
              <p className="text-xs text-stone-400">
                נכנסים כ־{list.map((m) => m.name).join(' / ')} — בחר אחרי הכניסה.
              </p>
            )}

            <Field label="קוד מנהל" error={error}>
              <input
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                onFocus={selectOnFocus}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && list.length) enter(list[0].id);
                }}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                className={`${inputClass} num text-end`}
              />
            </Field>

            {list.length === 0 && (
              <p className="text-xs leading-snug text-amber-800">
                אין מנהל רשום. מחיקת נתוני האפליקציה תאפשר הגדרה מחדש.
              </p>
            )}

            <p className="text-[11px] leading-snug text-stone-400">
              הקוד שמור על המכשיר הזה בלבד. הוא מונע שינוי בטעות, ואינו
              מחליף אימות מול שרת — זה ייכנס כשיהיה סנכרון.
            </p>
          </>
        )}

        {!first && list.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <span className="mb-1.5 block text-xs font-medium text-stone-500">מנהלים</span>
            <ul className="space-y-1.5">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => enter(m.id)}
                    className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-start transition-colors hover:border-oak-400"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-stone-400">
                      {ROLE_LABEL[m.role]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
