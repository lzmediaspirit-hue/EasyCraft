import { useSyncExternalStore } from 'react';
import type { UserRole } from '../db/types';

/**
 * מצב תצוגה לפי תפקיד.
 *
 * לפני שיש משתמשים אמיתיים לכל אחד בנגרייה, המנהל צריך לראות מה
 * הנגר יראה ומה התכנת יראה — אחרת אי אפשר לבדוק את זה בלי לפתוח
 * שלושה משתמשים ולהתחבר שוב ושוב.
 *
 * זו תצוגה בלבד, לא הרשאה: היא חיה בזיכרון של המכשיר ולא נשמרת,
 * ומי שנכנס באמת עם תפקיד מוגבל לא יכול להרחיב את עצמו דרכה — כי
 * מותר לרדת בתפקיד ולא לעלות.
 */

const ORDER: UserRole[] = ['manager', 'planner', 'carpenter', 'installer'];

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'מנהל',
  planner: 'תכנת',
  carpenter: 'נגר',
  installer: 'מתקין',
};

let override: UserRole | null = null;
const listeners = new Set<() => void>();

export const viewRole = {
  get: (): UserRole | null => override,
  set(role: UserRole | null) {
    override = role;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** התפקידים שמותר לצפות בהם — התפקיד שלי ומה שמתחתיו. */
export function viewableRoles(real: UserRole | undefined): UserRole[] {
  if (!real) return [];
  return ORDER.slice(ORDER.indexOf(real));
}

/**
 * התפקיד שהמסכים מתנהגים לפיו.
 * מצב התצוגה גובר, אבל רק כלפי מטה: אי אפשר לצפות "כמנהל" ממשתמש
 * שאינו מנהל.
 */
export function useEffectiveRole(real: UserRole | undefined): UserRole | undefined {
  const picked = useSyncExternalStore(viewRole.subscribe, viewRole.get, () => null);
  if (!picked || !real) return real;
  return viewableRoles(real).includes(picked) ? picked : real;
}
