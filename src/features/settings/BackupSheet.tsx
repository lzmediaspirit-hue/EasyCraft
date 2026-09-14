import { useRef, useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Pill } from '../../ui/Pill';
import { catalogRepo } from '../../catalog/catalogRepo';
import {
  exportAll,
  exportLibrary,
  importAll,
  importLibrary,
  readBackup,
} from '../../db/backup';
import type { ImportResult } from '../../db/backup';

/**
 * להוציא את הנתונים מהמכשיר, ולהחזיר אותם אליו.
 *
 * הכול נשמר מקומית, ולכן הוא גם כלוא מקומית: הוא לא עובר למכשיר
 * שני, ואם הדפדפן ינוקה הוא ייעלם. כאן הוא יוצא כטקסט.
 *
 * טקסט ולא הורדת קובץ, כי זה מה שעובד בכל מקום: באפליקציה שנפתחה
 * מקישור, בטלפון, ובדפדפן שחוסם הורדות. מעתיקים, ושולחים לעצמך
 * בוואטסאפ או במייל — וזה גם הגיבוי.
 */
export function BackupSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [what, setWhat] = useState<'library' | 'all' | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  async function show(kind: 'library' | 'all') {
    setProblem(null);
    setNote(null);
    const backup = kind === 'library' ? await exportLibrary() : await exportAll();
    setText(JSON.stringify(backup));
    setWhat(kind);
    const n = backup.tables.catalog?.length ?? 0;
    setNote(
      kind === 'library'
        ? `${n} ארגזים בספרייה. העתק את הטקסט ושמור אותו אצלך.`
        : 'הכול חוץ מקבצים מצורפים. העתק את הטקסט ושמור אותו אצלך.',
    );
  }

  async function copy() {
    const el = box.current;
    if (!el) return;
    el.select();
    try {
      await navigator.clipboard.writeText(el.value);
      setNote('הועתק. שלח את זה לעצמך, וזה הגיבוי.');
    } catch {
      /* דפדפן שחוסם גישה ללוח — הטקסט כבר מסומן, ואפשר להעתיק ביד */
      setNote('הטקסט מסומן — העתק אותו ידנית.');
    }
  }

  /** מה שהודבק, אחרי בדיקה שהוא באמת קובץ גיבוי */
  function parse(): ReturnType<typeof readBackup> | null {
    const raw = box.current?.value.trim();
    if (!raw) {
      setProblem('אין מה לייבא — הדבק כאן את הטקסט של הגיבוי');
      return null;
    }
    const res = readBackup(raw);
    if ('error' in res) {
      setProblem(res.error);
      return null;
    }
    return res;
  }

  async function bringLibrary() {
    setProblem(null);
    const res = parse();
    if (!res || 'error' in res) return;
    if (!res.backup.tables.catalog?.length) {
      setProblem('אין ארגזים בקובץ הזה');
      return;
    }
    setBusy(true);
    try {
      const r: ImportResult = await importLibrary(res.backup, mode);
      setNote(summary(r));
      setProblem(unresolvedNote(r));

    } catch (e) {
      setProblem(failure(e));
    } finally {
      // גם כשהייבוא נפל: בלי זה הכפתורים נשארים מושבתים עד סגירת המגירה
      setBusy(false);
    }
  }

  async function bringAll() {
    setProblem(null);
    const res = parse();
    if (!res || 'error' in res) return;
    if (res.backup.kind !== 'all') {
      setProblem('זה גיבוי של הספרייה בלבד — השתמש בכפתור הספרייה');
      return;
    }
    setBusy(true);
    try {
      await importAll(res.backup);
      setNote('הכול שוחזר. הקבצים המצורפים נשארו במכשיר שממנו הגיע הגיבוי.');
    } catch (e) {
      setProblem(failure(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="גיבוי והעברה" onClose={onClose} tall>
      <div className="space-y-5">
        <p className="text-xs leading-snug text-stone-500">
          הנתונים נשמרים במכשיר הזה בלבד. כאן מוציאים אותם כטקסט — לגיבוי, למעבר
          למכשיר אחר, או כדי לשלוח את הספרייה למישהו.
        </p>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">להוציא</h3>
          <div className="flex flex-wrap gap-1.5">
            <Pill wide active={what === 'library'} onClick={() => show('library')}>
              הספרייה
            </Pill>
            <Pill wide active={what === 'all'} onClick={() => show('all')}>
              הכול
            </Pill>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            הספרייה היא הארגזים בלבד, בלי לקוחות ובלי פרויקטים.
          </p>
        </section>

        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          dir="ltr"
          placeholder="כאן יופיע הגיבוי. אפשר גם להדביק לכאן גיבוי קיים."
          className="h-40 w-full rounded-2xl border border-stone-200 bg-white p-3 font-mono text-[11px] break-all text-stone-700 focus:border-oak-500 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={copy}
            disabled={!text}
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400"
          >
            העתקה
          </button>
          <button
            onClick={() => {
              setText('');
              setWhat(null);
              setNote(null);
              setProblem(null);
            }}
            className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200"
          >
            ניקוי
          </button>
        </div>

        {note && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-snug text-emerald-800">
            {note}
          </p>
        )}
        {problem && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-snug text-red-900">
            {problem}
          </p>
        )}

        <section className="border-t border-stone-100 pt-5">
          <h3 className="mb-2 text-sm font-semibold text-stone-700">להכניס</h3>
          {/*
            שתי דרכים, ולא אחת. מיזוג מוסיף את מה שאין — ככה מעבירים
            ארגז בודד בין מכשירים. החלפה מוחקת את מה שיש ושמה את
            החדש במקומו, וזו פעולה שעושים פעם אחת: כשהספרייה שבנית
            היא הספרייה.
          */}
          <div className="flex flex-wrap gap-1.5">
            <Pill wide active={mode === 'merge'} onClick={() => setMode('merge')}>
              מיזוג
            </Pill>
            <Pill wide active={mode === 'replace'} onClick={() => setMode('replace')}>
              החלפה מלאה
            </Pill>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            {mode === 'merge'
              ? 'מוסיף את מה שאין ומעדכן את מה שיש. כלום לא נמחק.'
              : 'מוחק את הספרייה הקיימת ושם את זו שבטקסט במקומה.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={bringLibrary}
              disabled={busy}
              className="rounded-xl bg-oak-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oak-700 disabled:opacity-50"
            >
              ייבוא ספרייה
            </button>
            <button
              onClick={bringAll}
              disabled={busy}
              className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:border-red-200 hover:text-red-700 disabled:opacity-50"
            >
              שחזור מלא
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-stone-400">
            שחזור מלא מוחק את מה שיש במכשיר ושם את הגיבוי במקומו. פרויקטים קיימים
            אינם נפגעים מייבוא ספרייה — ארגז שהונח על קיר שמר את המידות שלו בעצמו.
          </p>
        </section>

        {/*
          החזרת מה שמגיע עם האפליקציה. מי שהחליף את הספרייה בשלו ורוצה
          לראות שוב את ארגזי התקן — זו הדרך חזרה, והיא לא מוחקת כלום.
        */}
        <button
          onClick={async () => {
            await catalogRepo.reseed();
            setNote('ארגזי התקן שמגיעים עם האפליקציה חזרו לספרייה.');
          }}
          className="text-xs text-stone-500 underline underline-offset-2 hover:text-oak-700"
        >
          החזרת ארגזי התקן שמגיעים עם האפליקציה
        </button>
      </div>
    </Sheet>
  );
}

/** מה קרה, במספרים. */
function summary(r: ImportResult): string {
  const parts = [];
  if (r.added) parts.push(`${r.added} נוספו`);
  if (r.replaced) parts.push(`${r.replaced} עודכנו`);
  if (r.removed) parts.push(`${r.removed} הוסרו`);
  if (r.deps) parts.push(`${r.deps} לוחות וגוונים הגיעו איתם`);
  return parts.length ? parts.join(' · ') : 'הכול כבר היה מעודכן';
}

/**
 * אזהרה על ארגזים שהגיעו עם הפניה לגוון או ללוח שאינם כאן.
 * זה קורה בקובץ מגרסה ישנה, שנשא את הארגזים בלי התלויות שלהם.
 */
function unresolvedNote(r: ImportResult): string | null {
  if (!r.unresolved) return null;
  return `${r.unresolved} ארגזים מפנים לגוון או ללוח שאינם במכשיר הזה — הם ייראו ויתומחרו לפי ברירת המחדל של הפרויקט. בקש קובץ ספרייה מגרסה עדכנית, שנושא איתו גם את הלוחות והגוונים.`;
}


/** תקלה מבסיס הנתונים, כמשפט שאפשר לקרוא ולא כאובייקט שנזרק. */
function failure(e: unknown): string {
  return `הייבוא נכשל ולא הושלם: ${e instanceof Error ? e.message : String(e)}`;
}
