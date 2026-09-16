import type { CatalogGroup, Room } from '../db/types';
import { CUSTOM_ROOM } from '../db/types';

/** חדר כפי שהוא מגיע עם האפליקציה, לפני שנזרע. */
/* כמו בספרייה: הבעלות נקבעת בזריעה, ואינה חלק מהזרע */
export type SeedRoom = Omit<Room, 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>;

/**
 * החדרים שמגיעים עם האפליקציה.
 *
 * אלה נקודת פתיחה בלבד. החדרים הם נתונים בטבלת `rooms`, והנגר
 * מוסיף לעצמו כל חדר שהוא עובד עליו — חדר שירות, משרד, ממ״ד —
 * ומסדר לו את הכרטיסיות שהוא רוצה לראות.
 */
export const SEED_ROOMS: SeedRoom[] = [
  {
    id: 'kitchen',
    label: 'מטבח',
    hint: 'תחתונים, עליונים, עמודות ומכשירי חשמל',
    icon: 'kitchen',
    groups: ['base', 'upper', 'tall', 'island', 'shelf', 'panel'],
    sortOrder: 10,
    isBuiltin: true,
  },
  {
    id: 'living',
    label: 'סלון',
    hint: 'מזנוני טלוויזיה, ספריות ומדפים',
    icon: 'living',
    groups: ['base', 'upper', 'storage', 'island', 'shelf', 'panel'],
    sortOrder: 20,
    isBuiltin: true,
  },
  {
    id: 'bedroom',
    label: 'חדר שינה',
    hint: 'ארונות בגדים, שידות ויחידות עליונות',
    icon: 'bedroom',
    groups: ['storage', 'base', 'upper', 'shelf', 'panel'],
    sortOrder: 30,
    isBuiltin: true,
  },
  {
    id: 'utility',
    label: 'חדר שירות',
    hint: 'ארון מכונות, כביסה, מדפים ואחסון',
    icon: 'utility',
    groups: ['base', 'upper', 'tall', 'storage', 'island', 'shelf', 'panel'],
    sortOrder: 40,
    isBuiltin: true,
  },
];

/**
 * החדר ללא סוג — הוא אינו בטבלה.
 *
 * זה אינו חדר אלא היעדר חדר: המשתמש נותן לו שם משלו, וכל הספרייה
 * זמינה בו. הוא נשאר בקוד כדי שלא יימחק ולא ישוכפל.
 */
export const CUSTOM_ROOM_DEF: SeedRoom = {
  id: CUSTOM_ROOM,
  label: 'שם חדש',
  hint: 'חדר בהגדרה שלך — כל הספרייה זמינה',
  icon: 'custom',
  groups: ['base', 'upper', 'tall', 'storage', 'island', 'shelf', 'panel'],
  sortOrder: 999,
  isBuiltin: true,
};

export const GROUP_LABELS: Record<CatalogGroup, string> = {
  base: 'תחתונים',
  upper: 'עליונים',
  tall: 'עמודות',
  storage: 'ארונות',
  island: 'איים',
  shelf: 'מדפים',
  panel: 'דפנות ולוחות',
};

/** סדר כרטיסיות ברירת מחדל, כשלחדר אין הגדרה משלו. */
export const GLYPH_GROUPS_FALLBACK: CatalogGroup[] = [
  'base',
  'upper',
  'tall',
  'storage',
  'island',
  'shelf',
  'panel',
];
