import { useRef, useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { saveFile } from '../../ui/saveFile';
import { Pill } from '../../ui/Pill';
import { catalogRepo } from '../../catalog/catalogRepo';
import {
  exportAll,
  exportLibrary,
  importAll,
  importLibrary,
  libraryManifest,
  readBackup,
} from '../../db/backup';
import type { Backup, ImportResult } from '../../db/backup';

/**
 * להוציא את הנתונים מהמכשיר, ולהחזיר אותם אליו.
 *
 * הכול נשמר מקומית, ולכן הוא גם כלוא מקומית: הוא לא עובר למכשיר
 * שני, ואם הדפדפן ינוקה הוא ייעלם. כאן הוא יוצא כקובץ.
 *
 * קובץ ולא טקסט: ספרייה שלמה היא מאות אלפי תווים, והעתקה שלה מתיבת
 * טקסט נקטעת באמצע בדיוק כשצריך אותה. קובץ נשמר, נשלח, ונכנס חזרה
 * כמו שהוא.
 *
 * הטקסט נשאר כדלת אחורית אחת: יש סביבות שחוסמות הורדה שהדף מתחיל
 * בעצמו, ושם הקובץ פשוט לא יורד. במקרה כזה אפשר עדיין להעתיק.
 */
export function BackupSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [what, setWhat] = useState<'library' | 'all' | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [picked, setPicked] = useState<{ name: string; backup: Backup } | null>(null);
  /* קובץ שנבחר ונדחה — הסיבה נשמרת, כדי לחזור עליה בלחיצה על ייבוא */
  const [rejected, setRejected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  /** שם שאומר מה יש בקובץ ומתי הוא נוצר */
  function fileName(kind: 'library' | 'all'): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `easycraft-${kind === 'library' ? 'library' : 'backup'}-${stamp}.json`;
  }

  async function save(kind: 'library' | 'all') {
    setProblem(null);
    setNote(null);
    setShowText(false);
    const backup = kind === 'library' ? await exportLibrary() : await exportAll();
    const json = JSON.stringify(backup);
    setText(json);
    setWhat(kind);

    const n = backup.tables.catalog?.length ?? 0;
    const name = fileName(kind);
    const done = await saveFile(name, json);
    if (done.how === 'saved') {
      setNote(
        kind === 'library'
          ? `${n} ארגזים ירדו לקובץ ${name}. שמור אותו אצלך — זו הספרייה.`
          : `הכול ירד לקובץ ${name}, חוץ מקבצים מצורפים.`,
      );
    } else if (done.how === 'declined') {
      setNote('השמירה בוטלה.');
    } else {
      /*
       * אין שמירת קובץ בתצוגה הזו — קורה בטלפון. הגיבוי הוא מאות
       * אלפי תווים, וסימון ידני שלהם אינו פתרון, ולכן הוא נכנס
       * ללוח בלחיצה אחת. ההודעה מובילה במה שכן אפשר לעשות, ולא
       * במה שנכשל: מה שנכשל הוא שורה קטנה מתחת.
       */
      setShowText(true);
      try {
        await navigator.clipboard.writeText(json);
        setNote(
          `הגיבוי הועתק ללוח (${size(json)}) — הדבק אותו בהודעה לעצמך, בפתק או במייל, וזה הגיבוי. ` +
            `הסיבה שאין כאן קובץ: ${done.why}. ממחשב זה יורד כקובץ רגיל.`,
        );
      } catch {
        setProblem(
          `${done.why}, וגם ההעתקה ללוח נחסמה. הטקסט למטה הוא אותו גיבוי — סמן, העתק ושמור אצלך. ` +
            `ממחשב זה יורד כקובץ רגיל.`,
        );
      }
    }
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

  /** קובץ שנבחר, אחרי בדיקה שהוא באמת קובץ גיבוי */
  async function pick(f: File | undefined) {
    setProblem(null);
    setNote(null);
    setPicked(null);
    setRejected(null);
    if (!f) return;
    const res = readBackup(await f.text());
    if ('error' in res) {
      setProblem(res.error);
      setRejected(res.error);
      return;
    }
    setPicked({ name: f.name, backup: res.backup });
    if (res.backup.kind !== 'library') return setNote(`${f.name} — גיבוי מלא.`);

    /*
     * מה יש בקובץ, לפני שמייבאים אותו.
     *
     * "בחר קובץ ולחץ ייבוא" הוא קפיצה לתוך מעטפה סגורה: אחרי
     * ההחלפה כבר אי אפשר לדעת מה היה שם. המניפסט נקרא כאן, והנגר
     * רואה כמה ארגזים, על כמה לוחות וגוונים הם נשענים, ומאיזו
     * מהדורה — ורק אז מחליט אם למזג או להחליף.
     */
    const m = libraryManifest(res.backup);
    const when = new Date(m.revision || res.backup.at).toLocaleDateString('he-IL');
    /*
     * החתימה היא מה שמאפשר לומר "זו אותה ספרייה". שתי חבילות
     * שיצאו בשני ימים ממכשיר אחד נבדלות בתאריך אבל לא בחתימה,
     * ולכן אפשר לדעת שאין מה לייבא — במקום לייבא ולראות "0 נוספו".
     */
    setNote(
      `${f.name} — ${m.items} ארגזים, ${m.finishes} גוונים ו-${m.materials} לוחות. ` +
        `מהדורה ${when}, חתימה ${m.fingerprint.slice(0, 8)}. ` +
        `בחר מיזוג או החלפה, ולחץ "ייבוא ספרייה".`,
    );
  }

  /**
   * הגיבוי שעליו פועלים: הקובץ שנבחר, ואם אין כזה — מה שהודבק.
   * הטקסט נשאר קביל, כדי שמי שקיבל גיבוי בהודעה לא ייתקע.
   */
  function chosen(): Backup | null {
    if (picked) return picked.backup;
    /* הקובץ שנבחר נדחה — הסיבה היא הסיבה, ולא "אין מה לייבא" */
    if (rejected) {
      setProblem(rejected);
      return null;
    }
    const raw = box.current?.value.trim();
    if (!raw) {
      setProblem('אין מה לייבא — בחר קובץ גיבוי');
      return null;
    }
    const res = readBackup(raw);
    if ('error' in res) {
      setProblem(res.error);
      return null;
    }
    return res.backup;
  }

  async function bringLibrary() {
    setProblem(null);
    const backup = chosen();
    if (!backup) return;
    if (!backup.tables.catalog?.length) {
      setProblem('אין ארגזים בקובץ הזה');
      return;
    }
    setBusy(true);
    try {
      const r: ImportResult = await importLibrary(backup, mode);
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
    const backup = chosen();
    if (!backup) return;
    if (backup.kind !== 'all') {
      setProblem('זה גיבוי של הספרייה בלבד — השתמש בכפתור הספרייה');
      return;
    }
    setBusy(true);
    try {
      await importAll(backup);
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
          הנתונים נשמרים במכשיר הזה בלבד. כאן מוציאים אותם לקובץ — לגיבוי, למעבר
          למכשיר אחר, או כדי לשלוח את הספרייה למישהו.
        </p>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">להוציא לקובץ</h3>
          <div className="flex flex-wrap gap-1.5">
            <Pill wide active={what === 'library'} onClick={() => save('library')}>
              הספרייה
            </Pill>
            <Pill wide active={what === 'all'} onClick={() => save('all')}>
              הכול
            </Pill>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            הספרייה היא הארגזים בלבד, בלי לקוחות ובלי פרויקטים. ארגזים שהוסרו
            אינם יוצאים איתה.
          </p>
        </section>

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
          <h3 className="mb-2 text-sm font-semibold text-stone-700">להכניס מקובץ</h3>

          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            aria-label="בחירת קובץ גיבוי"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              /* אותו קובץ נבחר פעמיים ברצף חייב לירות שוב את השינוי */
              e.target.value = '';
            }}
            className="w-full rounded-xl border border-stone-200 bg-white p-2.5 text-xs text-stone-600 file:me-3 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
          />

          {/*
            שתי דרכים, ולא אחת. מיזוג מוסיף את מה שאין ומעדכן את מה
            שיש לפי המק״ט — ככה מוסיפים ארגזים חדשים לספרייה בלי
            לפגוע בקיים. החלפה מוחקת את מה שיש ושמה את החדש במקומו.
          */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill wide active={mode === 'merge'} onClick={() => setMode('merge')}>
              מיזוג
            </Pill>
            <Pill wide active={mode === 'replace'} onClick={() => setMode('replace')}>
              החלפה מלאה
            </Pill>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            {mode === 'merge'
              ? 'מוסיף את מה שאין ומעדכן לפי המק״ט את מה שיש. כלום לא נמחק.'
              : 'מוחק את הספרייה הקיימת ושם את זו שבקובץ במקומה.'}
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
          הדלת האחורית: סביבה שחוסמת הורדה, או גיבוי שהגיע בהודעה
          ולא כקובץ. לא הדרך הראשית, ולכן היא מתחת לקו ומקופלת.
        */}
        <section className="border-t border-stone-100 pt-4">
          <button
            onClick={() => setShowText((v) => !v)}
            aria-expanded={showText}
            className="text-xs text-stone-500 underline underline-offset-2 hover:text-oak-700"
          >
            {showText ? 'סגירת הטקסט' : 'ההורדה נחסמה? גיבוי כטקסט'}
          </button>

          {showText && (
            <>
              <textarea
                ref={box}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                dir="ltr"
                placeholder="כאן יופיע הגיבוי. אפשר גם להדביק לכאן גיבוי קיים."
                className="mt-3 h-40 w-full rounded-2xl border border-stone-200 bg-white p-3 font-mono text-[11px] break-all text-stone-700 focus:border-oak-500 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
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
            </>
          )}
        </section>

        {/*
          החזרת הספרייה שמגיעה עם האפליקציה. מי שמחק ארגזים ורוצה
          אותם בחזרה — זו הדרך, והיא לא מוחקת ולא דורסת כלום.
        */}
        <button
          onClick={async () => {
            const back = await catalogRepo.reseed();
            setProblem(null);
            setNote(
              back
                ? `${back} ארגזים חזרו לספרייה.`
                : 'כל ארגזי הספרייה כבר כאן — לא היה מה להחזיר.',
            );
          }}
          className="text-xs text-stone-500 underline underline-offset-2 hover:text-oak-700"
        >
          החזרת ארגזי הספרייה שמגיעה עם האפליקציה
        </button>
      </div>
    </Sheet>
  );
}

/** גודל הגיבוי במילים של בני אדם. */
function size(json: string): string {
  const kb = Math.round(json.length / 1024);
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} מ״ב` : `${kb} ק״ב`;
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
