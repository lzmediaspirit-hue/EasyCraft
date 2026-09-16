import { subscribers } from '../../ui/store';
import { useSyncExternalStore } from 'react';
import { db } from '../../db/db';
import { syncConsumption } from '../../materials/consumption';
import type { PlacedUnit } from '../../db/types';

/**
 * ביטול וחזרה בהדמיה.
 *
 * ההיסטוריה שומרת תצלום של כל הארגזים בפרויקט לפני כל שינוי, ולא
 * רשימת פעולות הפיכות. זה בזבזני יותר בזיכרון ונכון יותר בשטח:
 * גרירה, הוספה, מחיקה ושינוי מידה חוזרות אחורה באותה דרך בדיוק,
 * ואין פעולה שנשכח לכתוב לה הפוך.
 *
 * ההיסטוריה חיה בזיכרון בלבד. היא שייכת לישיבת העבודה הנוכחית —
 * "בטל" אחרי רענון דף היה מחזיר שינוי שהמשתמש כבר שכח ממנו.
 */

const LIMIT = 40;
/**
 * רצף שינויים על אותו דבר בתוך החלון הזה נחשב פעולה אחת.
 *
 * זו רשת ביטחון לכפתור שנלחץ פעמיים, ולא הגדרת גבול הפעולה:
 * גבול אמיתי מוכרז ב-`begin`/`end`. חלון זמן לבדו לא הספיק —
 * גרירת קבוצה כותבת לכל ארגז בתורו, התגיות התחלפו זו בזו, וכל
 * חילוף פתח צעד חדש. תנועה אחת של היד הפכה לעשרות "בטל".
 */
const COALESCE_MS = 900;

interface Stack {
  past: PlacedUnit[][];
  future: PlacedUnit[][];
  lastTag: string;
  lastAt: number;
  /** מחווה פתוחה: כל מה שנכתב בתוכה הוא צעד אחד */
  gesture: string | null;
}

const stacks = new Map<string, Stack>();
const bus = subscribers();

function stackOf(projectId: string): Stack {
  let s = stacks.get(projectId);
  if (!s) {
    s = { past: [], future: [], lastTag: '', lastAt: 0, gesture: null };
    stacks.set(projectId, s);
  }
  return s;
}

const emit = bus.notify;

const snapshot = (projectId: string) => db.units.where('projectId').equals(projectId).toArray();

/**
 * מחזיר את הארגזים למצב שבתצלום, ומיישר אחריהם את המלאי.
 *
 * סימוני העבודה נשמרים בתוך הארגז, ולכן "בטל" מחזיר גם אותם — ואיתם
 * את הפלטות שהופחתו מהמלאי בעקבותיהם. בלי היישור כאן הארגז חוזר
 * להיות "מוכן לחיתוך" בזמן שהמלאי ממשיך לספור אותו כנחתך.
 */
async function restore(projectId: string, units: PlacedUnit[]): Promise<void> {
  await db.transaction('rw', db.units, async () => {
    await db.units.where('projectId').equals(projectId).delete();
    if (units.length) await db.units.bulkAdd(units);
  });
  await syncConsumption(projectId);
}

export const history = {
  /**
   * פתיחת מחווה: מכאן ועד `end` הכול צעד אחד.
   *
   * זה הגבול האמיתי של פעולה — תנועה אחת של היד, ולא חלון זמן.
   * גרירה שנוגעת בכמה ארגזים כותבת לכל אחד בתורו, ובלי הכרזה
   * כזאת כל מעבר בין ארגז לארגז נראה כפעולה חדשה.
   */
  async begin(projectId: string, tag: string): Promise<void> {
    const s = stackOf(projectId);
    if (s.gesture) return;
    s.gesture = tag;
    s.lastTag = tag;
    s.lastAt = Date.now();
    s.past.push(await snapshot(projectId));
    if (s.past.length > LIMIT) s.past.shift();
    s.future = [];
    emit();
  },

  /** סגירת המחווה. מה שייכתב מכאן והלאה הוא פעולה חדשה. */
  end(projectId: string): void {
    const s = stackOf(projectId);
    s.gesture = null;
    s.lastTag = '';
  },

  /**
   * מצלם את המצב לפני שינוי.
   * `tag` מאחד רצף שינויים לפעולה אחת — שינוי מידה מחוזק בקרוסלה
   * הוא צעד לכל מידה.
   */
  async capture(projectId: string, tag: string): Promise<void> {
    const s = stackOf(projectId);
    /* בתוך מחווה פתוחה כבר צולם, והשאר הוא אותה פעולה */
    if (s.gesture) return;
    const now = Date.now();
    if (s.lastTag === tag && now - s.lastAt < COALESCE_MS) {
      s.lastAt = now;
      return;
    }
    s.lastTag = tag;
    s.lastAt = now;
    s.past.push(await snapshot(projectId));
    if (s.past.length > LIMIT) s.past.shift();
    // פעולה חדשה מוחקת את מה שבוטל: אין שני עתידים
    s.future = [];
    emit();
  },

  async undo(projectId: string): Promise<void> {
    const s = stackOf(projectId);
    const prev = s.past.pop();
    if (!prev) return;
    s.future.push(await snapshot(projectId));
    s.lastTag = '';
    s.gesture = null;
    await restore(projectId, prev);
    emit();
  },

  async redo(projectId: string): Promise<void> {
    const s = stackOf(projectId);
    const next = s.future.pop();
    if (!next) return;
    s.past.push(await snapshot(projectId));
    s.lastTag = '';
    s.gesture = null;
    await restore(projectId, next);
    emit();
  },

  state(projectId: string): { canUndo: boolean; canRedo: boolean } {
    const s = stacks.get(projectId);
    return { canUndo: !!s?.past.length, canRedo: !!s?.future.length };
  },

  subscribe: bus.subscribe,
};

/** האם יש מה לבטל ומה להחזיר, כמצב שמתעדכן מעצמו. */
export function useHistory(projectId: string): { canUndo: boolean; canRedo: boolean } {
  /*
   * המנוי מחזיר מחרוזת ולא אובייקט במכוון: `useSyncExternalStore`
   * משווה בזהות, ואובייקט חדש בכל קריאה היה מרנדר בלי סוף.
   */
  const key = useSyncExternalStore(
    history.subscribe,
    () => {
      const s = stacks.get(projectId);
      return `${s?.past.length ?? 0}:${s?.future.length ?? 0}`;
    },
    () => '0:0',
  );
  const [past, future] = key.split(':').map(Number);
  return { canUndo: past > 0, canRedo: future > 0 };
}
