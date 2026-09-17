import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { saveFile } from '../../ui/saveFile';
import { Pill } from '../../ui/Pill';
import { applyLibraryUpdate, catalogRepo, libraryUpdate } from '../../catalog/catalogRepo';
import {
  hasLibraryUpdate,
  type LibraryChange,
  type LibraryUpdate,
} from '../../catalog/libraryRelease';
import { exportCabinets, importCabinets, packManifest, readPack } from '../../db/cabinetPack';
import type { CabinetPack, ImportResult } from '../../db/cabinetPack';

/**
 * להוציא ארגזים מהמכשיר, ולהכניס ארגזים אליו.
 *
 * הלקוחות, הפרויקטים והמלאי הם נתונים של העסק, והם יישבו בשרת.
 * ארגז הוא דבר אחר: הוא נבנה פעם אחת ועובר הלאה — לנגר שני,
 * למכשיר שני, או בחזרה לאפליקציה עצמה כברירת מחדל. לזה נשאר
 * הקובץ.
 *
 * קובץ ולא טקסט: ספרייה שלמה היא מאות אלפי תווים, והעתקה שלה
 * מתיבת טקסט נקטעת באמצע בדיוק כשצריך אותה. קובץ נשמר, נשלח,
 * ונכנס חזרה כמו שהוא.
 *
 * הטקסט נשאר כדלת אחורית אחת: יש סביבות שחוסמות הורדה שהדף מתחיל
 * בעצמו, ושם הקובץ פשוט לא יורד. במקרה כזה אפשר עדיין להעתיק.
 */
export function CabinetsSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [picked, setPicked] = useState<{ name: string; pack: CabinetPack } | null>(null);
  /* קובץ שנבחר ונדחה — הסיבה נשמרת, כדי לחזור עליה בלחיצה על ייבוא */
  const [rejected, setRejected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  /* עדכון הספרייה: מה שמוצע, ומה שסומן לקבלה */
  const [update, setUpdate] = useState<LibraryUpdate | null>(null);
  const [take, setTake] = useState<Set<string>>(new Set());
  useEffect(() => {
    void libraryUpdate().then((u) => {
      setUpdate(u);
      /*
       * ברירת המחדל מקבלת את מה שאין מחלוקת עליו: תבנית חדשה,
       * ותבנית שלא נגעו בה כאן. תבנית שנערכה בנגרייה נשארת שלה
       * אלא אם המשתמש סימן אותה במפורש.
       */
      setTake(new Set(
        u.changes
          .filter((c) => c.kind === 'added' || c.kind === 'changed')
          .map((c) => c.shipped!.id),
      ));
    });
  }, []);

  /** שם שאומר מה יש בקובץ ומתי הוא נוצר */
  function fileName(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `easycraft-cabinets-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  }

  async function save() {
    setProblem(null);
    setNote(null);
    setShowText(false);
    const pack = await exportCabinets();
    const json = JSON.stringify(pack);
    setText(json);

    const n = pack.tables.catalog?.length ?? 0;
    const name = fileName();
    const done = await saveFile(name, json);
    if (done.how === 'saved') {
      setNote(`${n} ארגזים ירדו לקובץ ${name}. שמור אותו אצלך — אלה הארגזים שלך.`);
    } else if (done.how === 'declined') {
      setNote('השמירה בוטלה.');
    } else {
      /*
       * אין שמירת קובץ בתצוגה הזו — קורה בטלפון. החבילה היא מאות
       * אלפי תווים, וסימון ידני שלהם אינו פתרון, ולכן היא נכנסת
       * ללוח בלחיצה אחת. ההודעה מובילה במה שכן אפשר לעשות, ולא
       * במה שנכשל: מה שנכשל הוא שורה קטנה מתחת.
       */
      setShowText(true);
      try {
        await navigator.clipboard.writeText(json);
        setNote(
          `הארגזים הועתקו ללוח (${size(json)}) — הדבק אותם בהודעה לעצמך, בפתק או במייל. ` +
            `הסיבה שאין כאן קובץ: ${done.why}. ממחשב זה יורד כקובץ רגיל.`,
        );
      } catch {
        setProblem(
          `${done.why}, וגם ההעתקה ללוח נחסמה. הטקסט למטה הוא אותם ארגזים — סמן, העתק ושמור אצלך. ` +
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
      setNote('הועתק. שלח את זה למי שצריך לקבל את הארגזים.');
    } catch {
      /* דפדפן שחוסם גישה ללוח — הטקסט כבר מסומן, ואפשר להעתיק ביד */
      setNote('הטקסט מסומן — העתק אותו ידנית.');
    }
  }

  /** קובץ שנבחר, אחרי בדיקה שהוא באמת קובץ ארגזים */
  async function pick(f: File | undefined) {
    setProblem(null);
    setNote(null);
    setPicked(null);
    setRejected(null);
    if (!f) return;
    const res = readPack(await f.text());
    if ('error' in res) {
      setProblem(res.error);
      setRejected(res.error);
      return;
    }
    setPicked({ name: f.name, pack: res.pack });

    /*
     * מה יש בקובץ, לפני שמייבאים אותו.
     *
     * "בחר קובץ ולחץ ייבוא" הוא קפיצה לתוך מעטפה סגורה: אחרי
     * ההחלפה כבר אי אפשר לדעת מה היה שם. המניפסט נקרא כאן, והנגר
     * רואה כמה ארגזים, על כמה לוחות וגוונים הם נשענים, ומאיזו
     * מהדורה — ורק אז מחליט אם למזג או להחליף.
     *
     * החתימה היא מה שמאפשר לומר "אלה אותם ארגזים". שתי חבילות
     * שיצאו בשני ימים ממכשיר אחד נבדלות בתאריך אבל לא בחתימה,
     * ולכן אפשר לדעת שאין מה לייבא — במקום לייבא ולראות "0 נוספו".
     */
    const m = packManifest(res.pack);
    const when = new Date(m.revision || res.pack.at).toLocaleDateString('he-IL');
    setNote(
      `${f.name} — ${m.items} ארגזים, ${m.finishes} גוונים ו-${m.materials} לוחות. ` +
        `מהדורה ${when}, חתימה ${m.fingerprint.slice(0, 8)}. ` +
        `בחר מיזוג או החלפה, ולחץ "ייבוא ארגזים".`,
    );
  }

  /**
   * החבילה שעליה פועלים: הקובץ שנבחר, ואם אין כזה — מה שהודבק.
   * הטקסט נשאר קביל, כדי שמי שקיבל ארגזים בהודעה לא ייתקע.
   */
  function chosen(): CabinetPack | null {
    if (picked) return picked.pack;
    /* הקובץ שנבחר נדחה — הסיבה היא הסיבה, ולא "אין מה לייבא" */
    if (rejected) {
      setProblem(rejected);
      return null;
    }
    const raw = box.current?.value.trim();
    if (!raw) {
      setProblem('אין מה לייבא — בחר קובץ ארגזים');
      return null;
    }
    const res = readPack(raw);
    if ('error' in res) {
      setProblem(res.error);
      return null;
    }
    return res.pack;
  }

  async function bring() {
    setProblem(null);
    const pack = chosen();
    if (!pack) return;
    if (!pack.tables.catalog?.length) {
      setProblem('אין ארגזים בקובץ הזה');
      return;
    }
    setBusy(true);
    try {
      const r: ImportResult = await importCabinets(pack, mode);
      setNote(summary(r));
      setProblem(unresolvedNote(r));
    } catch (e) {
      setProblem(failure(e));
    } finally {
      // גם כשהייבוא נפל: בלי זה הכפתורים נשארים מושבתים עד סגירת המגירה
      setBusy(false);
    }
  }

  return (
    <Sheet title="ארגזים: שמירה והעברה" onClose={onClose} tall>
      <div className="space-y-5">
        <p className="text-xs leading-snug text-stone-500">
          ארגז שנבנה כאן יכול לצאת לקובץ ולעבור הלאה — למכשיר אחר, לנגר אחר, או
          בחזרה אליך. לקוחות ופרויקטים אינם כאן.
        </p>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">להוציא לקובץ</h3>
          <button
            onClick={save}
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            שמירת הארגזים לקובץ
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            הארגזים בלבד, עם הלוחות והגוונים שהם נשענים עליהם.
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
            aria-label="בחירת קובץ ארגזים"
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

          <div className="mt-3">
            <button
              onClick={bring}
              disabled={busy}
              className="rounded-xl bg-oak-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oak-700 disabled:opacity-50"
            >
              ייבוא ארגזים
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-stone-400">
            פרויקטים קיימים אינם נפגעים — ארגז שהונח על קיר שמר את המידות שלו
            בעצמו, והוא אינו קורא מהספרייה.
          </p>
        </section>

        {/*
          הדלת האחורית: סביבה שחוסמת הורדה, או ארגזים שהגיעו בהודעה
          ולא כקובץ. לא הדרך הראשית, ולכן היא מתחת לקו ומקופלת.
        */}
        <section className="border-t border-stone-100 pt-4">
          <button
            onClick={() => setShowText((v) => !v)}
            aria-expanded={showText}
            className="text-xs text-stone-500 underline underline-offset-2 hover:text-oak-700"
          >
            {showText ? 'סגירת הטקסט' : 'ההורדה נחסמה? ארגזים כטקסט'}
          </button>

          {showText && (
            <>
              <textarea
                ref={box}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                dir="ltr"
                placeholder="כאן יופיעו הארגזים. אפשר גם להדביק לכאן ארגזים שקיבלת."
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
          עדכון ספרייה: מה השתנה בגרסה, ומה מתוכו להחיל.

          שינוי בתבניות שמגיעות עם האפליקציה אינו מגיע להתקנה
          קיימת מעצמו — זריעה חוזרת הייתה מוחקת התאמות אישיות
          ומחזירה מה שנמחק בכוונה. כאן זה מוצג לפני שזה קורה,
          ומוחל רק על מה שסומן.
        */}
        {update && hasLibraryUpdate(update) && (
          <section className="rounded-2xl border border-oak-200 bg-oak-50/60 p-3">
            <h3 className="mb-1 text-sm font-semibold text-stone-700">
              עדכון לספרייה שמגיעה עם האפליקציה
            </h3>
            <p className="mb-2 text-[11px] leading-snug text-stone-500">
              גרסה {update.release} · אצלך {update.have}. ארגזים שכבר הונחו
              בפרויקטים אינם משתנים.
            </p>
            <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto">
              {update.changes
                .filter((c) => c.kind !== 'removed')
                .map((c) => (
                  <li key={c.shipped!.id}>
                    <label className="flex items-start gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        checked={take.has(c.shipped!.id)}
                        onChange={(e) => {
                          const next = new Set(take);
                          if (e.target.checked) next.add(c.shipped!.id);
                          else next.delete(c.shipped!.id);
                          setTake(next);
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="num text-stone-400">{c.code}</span> {c.name}
                        <span className="ms-1 text-[11px] text-stone-400">{changeLabel(c)}</span>
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const n = await applyLibraryUpdate([...take]);
                  setProblem(null);
                  setNote(n ? `${n} תבניות עודכנו.` : 'לא נבחר דבר לעדכון.');
                  setUpdate(await libraryUpdate());
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
            >
              החלת מה שסומן
            </button>
          </section>
        )}

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

/** מה קרה לתבנית הזאת בשחרור, במילה. */
function changeLabel(c: LibraryChange): string {
  if (c.kind === 'added') return '· חדש';
  if (c.kind === 'changed') return '· עודכן בגרסה';
  return '· נערך כאן — סימון ידרוס את השינוי שלך';
}

/** גודל החבילה במילים של בני אדם. */
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
  /* התנגשות זהות אינה שקטה: מי שקיבל שם או מק״ט חדש — נאמר כמה */
  if (r.renamed) parts.push(`${r.renamed} קיבלו שם פנוי`);
  if (r.recoded) parts.push(`${r.recoded} קיבלו מק״ט פנוי`);
  /* חדר שנכנס בשם של חדר קיים אינו חדר שני — נאמר כמה אוחדו */
  if (r.roomsMerged) parts.push(`${r.roomsMerged} חדרים אוחדו עם חדר קיים באותו שם`);
  return parts.length ? parts.join(' · ') : 'הכול כבר היה מעודכן';
}

/**
 * אזהרה על ארגזים שהגיעו עם הפניה לגוון או ללוח שאינם כאן.
 * זה קורה בקובץ מגרסה ישנה, שנשא את הארגזים בלי התלויות שלהם.
 */
function unresolvedNote(r: ImportResult): string | null {
  if (!r.unresolved) return null;
  return `${r.unresolved} ארגזים מפנים לגוון או ללוח שאינם במכשיר הזה — הם ייראו ויתומחרו לפי ברירת המחדל של הפרויקט. בקש קובץ ארגזים מגרסה עדכנית, שנושא איתו גם את הלוחות והגוונים.`;
}

/** תקלה מבסיס הנתונים, כמשפט שאפשר לקרוא ולא כאובייקט שנזרק. */
function failure(e: unknown): string {
  return `הייבוא נכשל ולא הושלם: ${e instanceof Error ? e.message : String(e)}`;
}
