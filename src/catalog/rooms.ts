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
 *
 * `groups` הוא **סדר** ולא רשימת היתר: המסך מציג רק קטגוריות שיש
 * בהן ארגז, אבל גם מסנן לפי הסדר הזה — ולכן קטגוריה שאינה כתובה
 * כאן נעלמת מהחדר גם כשיש בה ארגזים. לכן כל חדר נושא את כל
 * הקטגוריות, וההבדל ביניהם הוא במה שבא ראשון.
 */
export const SEED_ROOMS: SeedRoom[] = [
  {
    id: 'kitchen',
    label: 'מטבח',
    hint: 'תחתונים, עליונים, עמודות ומכשירי חשמל',
    icon: 'kitchen',
    groups: ['base', 'upper', 'tall', 'island', 'shelf', 'storage'],
    sortOrder: 10,
    isBuiltin: true,
  },
  {
    id: 'living',
    label: 'סלון',
    hint: 'מזנוני טלוויזיה, ספריות ומדפים',
    icon: 'living',
    groups: ['base', 'upper', 'tall', 'shelf', 'island', 'storage'],
    sortOrder: 20,
    isBuiltin: true,
  },
  {
    id: 'bedroom',
    label: 'חדר שינה',
    hint: 'ארונות בגדים, שידות ויחידות עליונות',
    icon: 'bedroom',
    groups: ['tall', 'base', 'upper', 'shelf', 'storage', 'island'],
    sortOrder: 30,
    isBuiltin: true,
  },
  {
    id: 'utility',
    label: 'חדר שירות',
    hint: 'ארון מכונות, כביסה, מדפים ואחסון',
    icon: 'utility',
    groups: ['base', 'upper', 'tall', 'storage', 'shelf', 'island'],
    sortOrder: 40,
    isBuiltin: true,
  },
  /*
   * חמשת החדרים שהגיעו עם הספרייה החדשה.
   *
   * המזהה הוא סלאג ולא UUID: הוא נוסע עם כל ארגז שמשויך לחדר,
   * הוא מה שמתאים אותו לאייקון, והוא מה שקוראים כשמסתכלים על
   * שורה במסד. מזהה אקראי בקוד אינו ניתן לקריאה ואינו ניתן
   * להתאמה.
   *
   * הקובץ שהגיע ביקש גם `appliance`, שאינה קטגוריה קיימת כאן —
   * מכשיר חשמלי הוא מוצר של המערכת, והארגז שנבנה סביבו יושב
   * בקטגוריה של הארגז.
   */
  {
    id: 'bathroom',
    label: 'אמבטיה',
    hint: 'ארונות כיור, מראה ועמודות שירות',
    icon: 'bathroom',
    groups: ['base', 'upper', 'tall', 'shelf', 'storage', 'island'],
    sortOrder: 50,
    isBuiltin: true,
  },
  {
    id: 'closet',
    label: 'חדר ארונות',
    hint: 'תלייה, מדפים, מגירות ואי',
    icon: 'closet',
    groups: ['tall', 'base', 'upper', 'shelf', 'storage', 'island'],
    sortOrder: 60,
    isBuiltin: true,
  },
  {
    id: 'children',
    label: 'חדר ילדים',
    hint: 'ארונות נמוכים, שולחן ומדפים',
    icon: 'children',
    groups: ['base', 'upper', 'tall', 'shelf', 'storage', 'island'],
    sortOrder: 70,
    isBuiltin: true,
  },
  {
    id: 'entrance',
    label: 'כניסה לבית',
    hint: 'ארון נעליים, מושב ותלייה',
    icon: 'entrance',
    groups: ['base', 'upper', 'tall', 'shelf', 'storage', 'island'],
    sortOrder: 80,
    isBuiltin: true,
  },
  {
    id: 'office',
    label: 'משרד',
    hint: 'שולחנות, ספריות וארונות תיקים',
    icon: 'office',
    groups: ['base', 'upper', 'tall', 'shelf', 'storage', 'island'],
    sortOrder: 90,
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
  groups: ['base', 'upper', 'tall', 'storage', 'island', 'shelf'],
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

/**
 * סדר כרטיסיות ברירת מחדל, כשלחדר אין הגדרה משלו.
 *
 * `panel` אינו כאן: דפנות ולוחות אינם שייכים לחדר אלא למסך משלהם,
 * והספרייה של חדר מסננת אותם החוצה בכל מקרה.
 */
export const GLYPH_GROUPS_FALLBACK: CatalogGroup[] = [
  'base',
  'upper',
  'tall',
  'storage',
  'island',
  'shelf',
];
