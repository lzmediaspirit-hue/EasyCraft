/**
 * שמירת קובץ אצל המשתמש.
 *
 * שתי סביבות, שתי דרכים. אפליקציה שנפתחה מקובץ או משרת מורידה
 * קובץ כמו כל דף. אפליקציה שרצה בתוך המציג של claude.ai אינה
 * רשאית להתחיל הורדה בעצמה — קישור הורדה שם אינו עושה דבר, בלי
 * שגיאה ובלי סימן — ולכן הקובץ נמסר שם דרך יכולת `downloads` של
 * המציג, שמראה אישור ושומרת רק אם המשתמש אישר.
 *
 * הכלל החשוב כאן: בתוך המציג לא נוגעים בקישור ההורדה. הוא נכשל
 * בשקט, והקוד היה מדווח "נשמר" על קובץ שלא ירד לשום מקום — בדיוק
 * המצב שבו המשתמש לוחץ שוב ושוב ולא מבין למה אין לו קובץ.
 *
 * מה שחוזר הוא מה שקרה באמת, כדי שהמסך יוכל לומר את זה: "נשמר",
 * "בוטל", או "לא ניתן כאן" — וההבדל חשוב, כי בוטל אינו תקלה.
 */
export type SaveOutcome =
  | { how: 'saved' }
  | { how: 'declined' }
  /**
   * לא נשמר. `why` הוא הקוד שהמציג החזיר — והוא מה שמבדיל בין
   * "לא אישרת" ל"היכולת לא קיימת כאן" ל"הקובץ גדול מדי". בלעדיו
   * כל התקלות נראות אותו דבר על המסך, ואי אפשר לאבחן כלום.
   */
  | { how: 'blocked'; why: string };

/** מה שהמציג של claude.ai מעמיד לרשות הדף, כשהוא קיים. */
interface Viewer {
  use?: (name: string) => Promise<Downloads | null>;
}
interface Downloads {
  save: (r: { filename: string; data: string }) => Promise<{ status: string }>;
}

/** האם הדף רץ בתוך מציג שמנהל את ההורדות בעצמו. */
function viewerOf(): Viewer | null {
  const v = (window as unknown as { claude?: Viewer }).claude;
  return typeof v?.use === 'function' ? v : null;
}

export async function saveFile(filename: string, data: string): Promise<SaveOutcome> {
  const viewer = viewerOf();

  if (viewer) {
    let downloads: Downloads | null = null;
    let failed = '';
    try {
      downloads = await viewer.use!('downloads');
    } catch (e) {
      failed = String((e as { message?: string })?.message ?? e);
    }
    /*
     * אין יכולת הורדה — וכאן אין דרך אחרת. חוזרים "חסום" במקום
     * ליפול לקישור שאינו עובד ולדווח על הצלחה שלא קרתה.
     */
    if (!downloads) {
      return { how: 'blocked', why: failed || 'היכולת לשמור קובץ אינה זמינה בתצוגה הזו' };
    }
    try {
      await downloads.save({ filename, data });
      return { how: 'saved' };
    } catch (e) {
      /* "declined" הוא תשובה של המשתמש ולא תקלה, ולכן הוא נאמר אחרת */
      const err = e as { code?: string; message?: string };
      if (err?.code === 'declined') return { how: 'declined' };
      /*
       * יש תצוגות שבהן המציג עצמו אינו יכול לכתוב קובץ — בטלפון זה
       * קורה. לפני שמוותרים, מנסים את תפריט השיתוף של המכשיר: הוא
       * שייך למערכת ההפעלה ולא לדף, ומשם אפשר לשמור בקבצים, לשלוח
       * לעצמך בוואטסאפ או במייל.
       */
      const shared = await share(filename, data);
      if (shared) return shared;
      return { how: 'blocked', why: REASON[err?.code ?? ''] ?? err?.code ?? String(e) };
    }
  }

  /* דף רגיל: הורדה כמו בכל אתר */
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    /* שחרור מאוחר: דפדפן שעוד לא התחיל לקרוא מהכתובת מאבד אותה */
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { how: 'saved' };
  } catch (e) {
    return { how: 'blocked', why: String(e) };
  }
}

/**
 * תפריט השיתוף של המכשיר, כשהוא מותר כאן.
 *
 * מחזיר null כשאין דרך כזו — ואז הקורא ממשיך לדרך הבאה. ביטול של
 * המשתמש אינו כישלון: הוא "בוטל", כמו כל ביטול אחר.
 */
async function share(filename: string, data: string): Promise<SaveOutcome | null> {
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (!nav.share || !nav.canShare) return null;
  try {
    const file = new File([data], filename, { type: 'application/json' });
    if (!nav.canShare({ files: [file] })) return null;
    await nav.share({ files: [file], title: filename });
    return { how: 'saved' };
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? { how: 'declined' } : null;
  }
}

/** הקודים של המציג, בעברית — כדי שמה שמופיע על המסך יהיה שימושי. */
const REASON: Record<string, string> = {
  not_granted: 'לא ניתן אישור לשמור קבצים בתצוגה הזו',
  capability_disabled: 'שמירת קבצים כבויה בתצוגה הזו',
  capability_removed: 'שמירת קבצים הוסרה מהתצוגה הזו',
  unavailable: 'שמירת קבצים אינה נתמכת בתצוגה הזו',
  rate_limited: 'יש כבר בקשת שמירה פתוחה — סגור אותה ונסה שוב',
  too_large: 'הקובץ גדול מדי לשמירה כאן',
  rejected_extension: 'סוג הקובץ נדחה',
  bad_request: 'בקשת השמירה לא תקינה',
};
