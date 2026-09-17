import { useState } from 'react';

/**
 * שמירה שנחסמה אומרת למה, והטופס נשאר כפי שהוא.
 *
 * שער השמירה זורק `BuildError` עם משפט בעברית, ואף מסך לא תפס
 * אותו: הלחיצה על "שמירה" לא עשתה כלום ולא אמרה כלום, והמשתמש
 * נשאר מול טופס מלא בלי לדעת מה קרה — ובלי לדעת שהוא עדיין שם.
 *
 * `busy` הוא גם מנעול: לחיצה כפולה על שמירה יצרה שני ארגזים.
 */
export function useSaveGuard() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(save: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await save();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה לא הצליחה');
    } finally {
      setBusy(false);
    }
  }

  return { error, busy, run };
}

/** מה שמנע את השמירה, ליד הכפתור שניסה אותה. */
export function SaveError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
      {text}
    </p>
  );
}
