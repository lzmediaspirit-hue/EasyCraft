import type { ShippedItem } from './shipped';

/**
 * מוצרים שמגיעים עם האפליקציה עצמה.
 *
 * הספרייה ב-`shipped.ts` היא של הנגרייה והיא נכתבת בכלי; שני אלה
 * הם חלק מהאפליקציה, ולכן הם חיים כאן ונוסעים לצד כל ספרייה.
 *
 * המזהה והמק״ט קבועים ולא אקראיים, וזה מה שמונע שכפול: זריעה
 * שנייה, ייבוא חוזר או סנכרון מוצאים את אותו מזהה ומעדכנים אותו
 * במקום ליצור עותק. תבנית אחת — ומתוכה אפשר להוסיף כמה מופעים
 * שרוצים, וכל מופע נערך בנפרד כמו כל ארגז.
 */
export const SHIPPED_PRODUCTS: ShippedItem[] = [
  {
    id: 'product-island',
    code: 'I-101',
    rooms: ['kitchen', 'living'],
    group: 'island',
    name: 'אי',
    glyph: 'doors',
    doors: 2,
    /* מה שהופך אותו לאי: הוא נוחת בחדר ולא על קיר */
    island: true,
    backKind: 'carcass',
    level: 'floor',
    defaultWidthMm: 1200,
    widthOptionsMm: [900, 1200, 1500, 1800, 2100],
    defaultHeightMm: 880,
    defaultDepthMm: 900,
    defaultYMm: 0,
    socleMm: 100,
    counterMm: 30,
    common: true,
    isBuiltin: true,
    sortOrder: 1000,
    note: 'תבנית אחת. אפשר להוסיף ממנה כמה איים, וכל אחד נערך בנפרד.',
  },
  {
    id: 'product-shelf',
    code: 'P-107',
    rooms: ['kitchen', 'living', 'bedroom'],
    group: 'shelf',
    name: 'מדף צף',
    /* לוח מונח: אין לו דפנות, תחתית, גב או רגליים */
    glyph: 'slab',
    level: 'wall',
    defaultWidthMm: 800,
    widthOptionsMm: [400, 600, 800, 1000, 1200],
    /* גובהו של לוח מונח הוא עוביו — וזו גם המידה שלפיה הוא נחתך */
    defaultHeightMm: 30,
    defaultDepthMm: 250,
    defaultYMm: 1400,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1010,
    note: 'עובי המדף הוא גובהו. הרוחב והעומק הם הלוח עצמו.',
  },
];
