import { subscribers } from '../../ui/store';
import { readPref, writePref } from '../../ui/prefs';
import { useSyncExternalStore } from 'react';

/**
 * מה מוצג במסך ההדמיה.
 *
 * האזהרות אינן כאן, ולא במקרה: הן היו מתג כמו כל מחוון, ומי
 * שכיבה אותו הפסיק לראות ששקע נחסם או שדלת לא תיפתח. בדיקה אינה
 * העדפת תצוגה — היא עובדה על התכנון, והיא תמיד על המסך.
 *
 * לוח המחוונים מתחת לציור התמלא בנתונים שכל אחד צריך משהו אחר
 * ממנו: אחד רוצה לראות מטר רץ, אחר רוצה שטח חזיתות, ומי שרק
 * מסדר ארגזים לא רוצה אף אחד מהם. במקום להחליט בשבילו — הוא בוחר,
 * וההעדפה נשמרת במכשיר.
 */

export interface ViewOptions {
  wallArea: boolean;
  wallHeight: boolean;
  floorMeters: boolean;
  unitCount: boolean;
  freeSpace: boolean;
  frontArea: boolean;
  /** קו מידה אנכי לגובה הקיר, על הציור */
  heightLine: boolean;
  /**
   * סדר המחוונים על המסך.
   *
   * לכל נגר יש מספר אחד שהוא מסתכל עליו קודם — אצל אחד זה מטר רץ,
   * אצל אחר מה שנשאר על הקיר — ולכן הסדר אינו נתון אלא בחירה.
   * מפתח שאינו ברשימה מוצג בסוף, כך שמחוון חדש שנוסף באפליקציה
   * מופיע במקום סביר בלי לדרוס את הסדר שנקבע.
   */
  statOrder: StatKey[];
}

/** המחוונים שמוצגים כאריחים מתחת להדמיה, וניתנים לסידור. */
export type StatKey =
  | 'wallArea'
  | 'wallHeight'
  | 'floorMeters'
  | 'unitCount'
  | 'freeSpace'
  | 'frontArea';

export const STAT_KEYS: StatKey[] = [
  'wallArea',
  'wallHeight',
  'floorMeters',
  'unitCount',
  'freeSpace',
  'frontArea',
];

/** המתגים שמוצגים ב"מה מוצג" — סדר המחוונים אינו מתג ולכן אינו כאן. */
export type ToggleKey = Exclude<keyof ViewOptions, 'statOrder'>;

export const VIEW_OPTION_LABELS: { key: ToggleKey; label: string; hint?: string }[] = [
  { key: 'wallArea', label: 'שטח הקיר' },
  { key: 'wallHeight', label: 'גובה הקיר' },
  { key: 'floorMeters', label: 'מטר רץ תחתון' },
  { key: 'unitCount', label: 'מספר ארגזים' },
  { key: 'freeSpace', label: 'נשאר על הקיר' },
  { key: 'frontArea', label: 'שטח חזיתות' },
  { key: 'heightLine', label: 'קו גובה על הציור', hint: 'מידת גובה הקיר לצד הציור' },
];

const DEFAULTS: ViewOptions = {
  wallArea: true,
  wallHeight: true,
  floorMeters: true,
  unitCount: true,
  freeSpace: true,
  frontArea: true,
  heightLine: true,
  statOrder: STAT_KEYS,
};

const KEY = 'easycraft.view';
const bus = subscribers();

function read(): ViewOptions {
  try {
    const raw = readPref(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    // מה שנשמר אינו JSON תקין — חוזרים לברירת המחדל
    return DEFAULTS;
  }
}

let value = read();
let snapshot = JSON.stringify(value);

function commit(next: ViewOptions) {
  value = next;
  snapshot = JSON.stringify(value);
  writePref(KEY, snapshot);
  bus.notify();
}

export const viewOptions = {
  get: (): ViewOptions => value,
  toggle(key: Exclude<keyof ViewOptions, 'statOrder'>) {
    commit({ ...value, [key]: !value[key] });
  },
  /** קובע את סדר המחוונים. מפתח חסר נוסף בסוף, כדי שלא ייעלם. */
  setStatOrder(order: StatKey[]) {
    const seen = new Set(order);
    commit({ ...value, statOrder: [...order, ...STAT_KEYS.filter((k) => !seen.has(k))] });
  },
  /** מזיז מחוון אחד צעד למעלה או למטה ברשימה. */
  moveStat(key: StatKey, dir: -1 | 1) {
    const order = orderedStats(value);
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    viewOptions.setStatOrder(next);
  },
  subscribe: bus.subscribe,
};

/**
 * המחוונים לפי הסדר שנקבע.
 * מפתח שאינו ברשימה השמורה מצטרף בסוף — כך מחוון שנוסף באפליקציה
 * מופיע בלי לדרוס סדר שכבר נבחר, וכפילות אינה מוצגת פעמיים.
 */
export function orderedStats(v: ViewOptions): StatKey[] {
  const saved = (v.statOrder ?? []).filter((k) => STAT_KEYS.includes(k));
  const seen = new Set(saved);
  return [...saved, ...STAT_KEYS.filter((k) => !seen.has(k))];
}

export function useViewOptions(): ViewOptions {
  /*
   * המנוי מחזיר מחרוזת ולא אובייקט: `useSyncExternalStore` משווה
   * בזהות, ואובייקט חדש בכל קריאה היה מרנדר בלי סוף.
   */
  const raw = useSyncExternalStore(
    viewOptions.subscribe,
    () => snapshot,
    () => JSON.stringify(DEFAULTS),
  );
  return JSON.parse(raw) as ViewOptions;
}
