import { subscribers } from '../ui/store';
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
const bus = subscribers();

export const viewRole = {
  get: (): UserRole | null => override,
  set(role: UserRole | null) {
    override = role;
    bus.notify();
  },
  subscribe: bus.subscribe,
};

/** התפקידים שמותר לצפות בהם — התפקיד שלי ומה שמתחתיו. */
export function viewableRoles(real: UserRole | undefined): UserRole[] {
  if (!real) return [];
  return ORDER.slice(ORDER.indexOf(real));
}

/**
 * התפקיד שהמסכים **נראים** לפיו.
 *
 * זו תצוגה ולא הרשאה, וזו ההבחנה שנשברה: התפקידים סודרו כסולם
 * יורד, אבל היכולות שלהם אינן מוכלות זו בזו. תכנת מכין קבצים
 * לחיתוך; נגר מסמן שנחתך. לכן "צפייה כנגר" נתנה לתכנת בדיוק את
 * מה שאין לו — והסולם דווקא הרשה את זה, כי נגר נמצא מתחת לתכנת.
 *
 * מה שמותר נקבע לפי המשתמש שנכנס, ולא לפי מה שהוא בחר לראות.
 * המסכים משתמשים בפונקציה הזאת; הרשאות משתמשות ב-`me.role` עצמו.
 */
export function useEffectiveRole(real: UserRole | undefined): UserRole | undefined {
  const picked = useSyncExternalStore(viewRole.subscribe, viewRole.get, () => null);
  if (!picked || !real) return real;
  return viewableRoles(real).includes(picked) ? picked : real;
}
