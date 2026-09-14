import type { CatalogItem, Finish, Material } from '../db/types';

/** פריט ספרייה מוכן, לפני שנזרע — חותמות הזמן נקבעות בזריעה עצמה. */
export type ShippedItem = Omit<CatalogItem, 'createdAt' | 'updatedAt'>;
export type ShippedMaterial = Omit<Material, 'createdAt' | 'updatedAt'>;
export type ShippedFinish = Omit<Finish, 'createdAt' | 'updatedAt'>;

/**
 * הספרייה שמגיעה עם האפליקציה, כשהיא נבנתה בנגרייה ולא נכתבה בקוד.
 *
 * ארגזי התקן שב-`builtins.ts` הם נקודת פתיחה: מידות מקובלות, שמות
 * מקובלים, מה שאפשר להתחיל ממנו ביום הראשון. הספרייה האמיתית של
 * נגרייה נבנית בעבודה — ארגז שנבנה פעם אחת נכון, ומאז מוזמן שוב.
 *
 * מי שבנה אותה מייצא אותה ממסך "גיבוי והעברה", והקובץ הזה נכתב
 * ממנה על ידי `scripts/library-to-seed.mjs`. מרגע שהוא אינו ריק,
 * הוא זה שנזרע — ומה שכתוב ב-`builtins.ts` כבר אינו מוצג.
 *
 * נכתב בכלי, לא ביד.
 */
export const SHIPPED_LIBRARY: ShippedItem[] = [];

/**
 * הלוחות והגוונים שהספרייה הזו מפנה אליהם.
 *
 * ארגז שומר מזהה של גוון, לא את הגוון עצמו. בלי השניים האלה, ספרייה
 * שנבנתה בנגרייה הייתה מגיעה למכשיר חדש עם הפניות לשום דבר: הצבע
 * שנבחר לחזית לא היה קיים, והמחיר לא היה מחושב. הם נזרעים עם
 * המזהים המקוריים שלהם, וזה מה שמחזיק את ההפניות.
 */
export const SHIPPED_MATERIALS: ShippedMaterial[] = [];
export const SHIPPED_FINISHES: ShippedFinish[] = [];
