import { useSyncExternalStore } from 'react';

/**
 * מה מוצג במסך ההדמיה.
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
  /** אזהרות אוטומטיות מתחת למחוונים */
  warnings: boolean;
}

export const VIEW_OPTION_LABELS: { key: keyof ViewOptions; label: string; hint?: string }[] = [
  { key: 'wallArea', label: 'שטח הקיר' },
  { key: 'wallHeight', label: 'גובה הקיר' },
  { key: 'floorMeters', label: 'מטר רץ תחתון' },
  { key: 'unitCount', label: 'מספר ארגזים' },
  { key: 'freeSpace', label: 'נשאר על הקיר' },
  { key: 'frontArea', label: 'שטח חזיתות' },
  { key: 'heightLine', label: 'קו גובה על הציור', hint: 'מידת גובה הקיר לצד הציור' },
  { key: 'warnings', label: 'אזהרות', hint: 'חריגה, חפיפה, שקע חסום' },
];

const DEFAULTS: ViewOptions = {
  wallArea: true,
  wallHeight: true,
  floorMeters: true,
  unitCount: true,
  freeSpace: true,
  frontArea: true,
  heightLine: true,
  warnings: true,
};

const KEY = 'easycraft.view';
const listeners = new Set<() => void>();

function read(): ViewOptions {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let value = read();
let snapshot = JSON.stringify(value);

export const viewOptions = {
  get: (): ViewOptions => value,
  toggle(key: keyof ViewOptions) {
    value = { ...value, [key]: !value[key] };
    snapshot = JSON.stringify(value);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {
      // אחסון חסום — הבחירה תחזיק עד רענון
    }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

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
