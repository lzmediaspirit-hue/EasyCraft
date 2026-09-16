import { useSyncExternalStore } from 'react';
import { subscribers } from '../../ui/store';
import type { PlacedUnit } from '../../db/types';

/**
 * מה שהאצבע מחזיקה, לפני שהוא נכתב.
 *
 * גרירה כתבה עד כאן לבסיס הנתונים בכל תזוזה של המצביע. כל כתיבה
 * העירה את השאילתה החיה, שקראה מחדש את כל ארגזי הפרויקט, בנתה
 * מחדש את הסצנה וחישבה מחדש את הניתוח — ועשרים ארגזים על הקיר
 * הפכו תנועה אחת לשרשרת של עבודה. במדידות המבקר הפער בין פריימים
 * עלה מ-13 מ״ש לארגז אחד ל-320 מ״ש לעשרים.
 *
 * כאן התנועה חיה בזיכרון בלבד. הציור קורא את הארגזים דרך
 * `withPreview`, ולכן הוא רואה את המקום החדש מיד; בסיס הנתונים
 * רואה אותו פעם אחת, בסוף התנועה. מה שנכתב בסוף הוא בדיוק מה
 * שהוצג — אין כאן חישוב שני.
 */

const patches = new Map<string, Partial<PlacedUnit>>();
const bus = subscribers();
/** מונה שינויים: `useSyncExternalStore` משווה בזהות, ומפה אינה משתנה */
let version = 0;

export const preview = {
  /** מה שארגז אחד מקבל בזמן התנועה */
  set(id: string, patch: Partial<PlacedUnit>): void {
    patches.set(id, { ...patches.get(id), ...patch });
    version++;
    bus.notify();
  },

  /** כל מה שהצטבר, לכתיבה אחת בסוף */
  drain(): [string, Partial<PlacedUnit>][] {
    const all = [...patches];
    patches.clear();
    version++;
    bus.notify();
    return all;
  },

  active(): boolean {
    return patches.size > 0;
  },

  version(): number {
    return version;
  },

  subscribe: bus.subscribe,
};

/** הארגזים כפי שהם נראים עכשיו: מה שבמסד, ועליו מה שביד. */
export function withPreview(units: PlacedUnit[]): PlacedUnit[] {
  if (!patches.size) return units;
  return units.map((u) => {
    const patch = patches.get(u.id);
    return patch ? { ...u, ...patch } : u;
  });
}

/** המונה, כדי שהמסך יצויר מחדש בכל תזוזה */
export function usePreview(): number {
  return useSyncExternalStore(preview.subscribe, preview.version, () => 0);
}
