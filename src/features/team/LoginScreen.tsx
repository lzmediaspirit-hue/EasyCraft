import { useEffect, useState } from 'react';
import { teamRepo } from '../../workflow/workflowRepo';
import {
  DEFAULT_ADMIN,
  hasAnyUser,
  login,
  normalizeUsername,
  session,
  setPassword,
  usesDefaultPassword,
} from '../../workflow/auth';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { BoxesIcon } from '../../ui/icons';

/**
 * מסך הכניסה.
 *
 * האפליקציה מגיעה עם חשבון מנהל מוכן, ולכן זו כניסה רגילה עם שם
 * משתמש וסיסמה. מסך יצירת המנהל נשאר למקרה שאין אף משתמש — למשל
 * אחרי מחיקת נתוני האפליקציה.
 */
export function LoginScreen() {
  const [first, setFirst] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword2] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** הסיסמה שמגיעה עם האפליקציה עדיין בתוקף — כדאי להזכיר אותה */
  const [showDefault, setShowDefault] = useState(false);

  useEffect(() => {
    hasAnyUser().then((any) => setFirst(!any));
    teamRepo.list().then(async (members) => {
      const admin = members.find((m) => m.username === DEFAULT_ADMIN.username);
      setShowDefault(!!admin && (await usesDefaultPassword(admin)));
    });
  }, []);

  if (first === null) return null;

  async function createManager() {
    const user = normalizeUsername(username);
    if (!name.trim()) return setError('צריך שם');
    if (user.length < 3) return setError('שם משתמש של 3 תווים לפחות');
    if (password.length < 4) return setError('סיסמה של 4 תווים לפחות');
    if (password !== confirm) return setError('הסיסמאות אינן זהות');
    setBusy(true);
    const id = await teamRepo.save({ name: name.trim(), role: 'manager', username: user });
    await setPassword(id, password);
    session.signIn(id);
  }

  async function signIn() {
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (res.ok) return session.signIn(res.member.id);
    setError(
      res.reason === 'inactive'
        ? 'המשתמש אינו פעיל. פנה למנהל.'
        : 'שם משתמש או סיסמה שגויים',
    );
  }

  return (
    <div className="app-page flex min-h-dvh flex-col justify-center bg-stone-50 px-6">
      <div className="mb-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-oak-100 text-oak-600">
          <BoxesIcon className="size-8" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-stone-900">EasyCraft</h1>
        <p className="mt-1 text-sm text-stone-500">
          {first ? 'התקנה ראשונה — נגדיר את המנהל' : 'ניהול נגרייה'}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (first) createManager();
          else signIn();
        }}
      >
        {first && (
          <Field label="שם מלא">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={selectOnFocus}
              className={inputClass}
            />
          </Field>
        )}

        <Field label="שם משתמש" hint={first ? 'באנגלית, בלי רווחים' : undefined}>
          <input
            autoFocus={!first}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            onFocus={selectOnFocus}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={`${inputClass} num text-start`}
          />
        </Field>

        <Field label="סיסמה" error={first ? null : error}>
          <input
            value={password}
            onChange={(e) => {
              setPassword2(e.target.value);
              setError(null);
            }}
            onFocus={selectOnFocus}
            type="password"
            autoComplete={first ? 'new-password' : 'current-password'}
            className={`${inputClass} num text-start`}
          />
        </Field>

        {first && (
          <Field label="שוב, לאימות" error={error}>
            <input
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
              onFocus={selectOnFocus}
              type="password"
              autoComplete="new-password"
              className={`${inputClass} num text-start`}
            />
          </Field>
        )}

        <div className="pt-2">
          <PrimaryButton disabled={busy} type="submit">
            {first ? 'יצירת מנהל וכניסה' : 'כניסה'}
          </PrimaryButton>
        </div>
      </form>

      {!first && showDefault && (
        <button
          onClick={() => {
            setUsername(DEFAULT_ADMIN.username);
            setPassword2(DEFAULT_ADMIN.password);
            setError(null);
          }}
          className="mt-5 w-full rounded-xl border border-oak-200 bg-oak-50 px-3 py-2.5 text-start"
        >
          <span className="block text-[11px] font-medium text-oak-900">
            כניסת מנהל ראשונה
          </span>
          <span className="num mt-0.5 block text-xs text-oak-800">
            {DEFAULT_ADMIN.username} / {DEFAULT_ADMIN.password}
          </span>
          <span className="mt-1 block text-[10px] leading-snug text-oak-700/70">
            הקש כדי למלא. הסיסמה הזו מגיעה עם האפליקציה וידועה — כדאי
            להחליף אותה במסך הצוות.
          </span>
        </button>
      )}

      <p className="mt-6 text-center text-[11px] leading-snug text-stone-400">
        {first
          ? 'המנהל פותח משתמשים לשאר הצוות, כל אחד עם התפקיד שלו.'
          : 'שכחת סיסמה? רק המנהל יכול לאפס אותה במסך הצוות.'}
      </p>
    </div>
  );
}
