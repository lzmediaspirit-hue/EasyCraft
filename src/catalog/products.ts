import type { RoomKind } from '../db/types';
import type { ShippedItem } from './shipped';

/**
 * מוצרים שמגיעים עם האפליקציה עצמה.
 *
 * הספרייה ב-`shipped.ts` היא של הנגרייה והיא נכתבת בכלי; אלה
 * חלק מהאפליקציה, ולכן הם חיים כאן ונוסעים לצד כל ספרייה.
 *
 * המזהה והמק״ט קבועים ולא אקראיים, וזה מה שמונע שכפול: זריעה
 * שנייה, ייבוא חוזר או סנכרון מוצאים את אותו מזהה ומעדכנים אותו
 * במקום ליצור עותק. תבנית אחת — ומתוכה אפשר להוסיף כמה מופעים
 * שרוצים, וכל מופע נערך בנפרד כמו כל ארגז.
 */
/**
 * הדור של מוצרי המערכת.
 *
 * 3 — כל המכשירים החשמליים בקטגוריה משלהם בספרייה: לתנור, למדיח
 *     ולמקרר שכבר היו נוספו מיקרוגל, תנור ומיקרוגל, קולט אדים
 *     וכיריים, ושבעתם עברו מ"תחתונים"/"עמודות" ל"מכשירי חשמל".
 *
 * מי שהתקין לפני שהאי והמדף נוספו לא קיבל אותם: הזריעה רצה פעם אחת
 * בהתקנה, והספרייה כבר סומנה כ"נזרעה". דור שעולה אומר "יש כאן מוצר
 * שלא היה", ובלי לשחזר את כל ספריית ההדגמה ובלי להחזיר מה שנמחק
 * בכוונה. כשמוסיפים מוצר מערכת חדש — מעלים את המספר.
 */
export const PRODUCTS_GENERATION = 3;

/**
 * הלוחות הבודדים: מזהה, מק״ט, שם, רוחב, רוחבים, גובה, עובי.
 *
 * דופן, מדף, גב, חיפוי, קרניז וסוקל אינם ארגז שנבנה בנגרייה אלא
 * לוח שנחתך ומורכב, והם אותם שישה בכל נגרייה. הם יושבים במדור
 * "דפנות ולוחות" שלהם, ולא בספרייה של אף חדר — ולכן הם חלק
 * מהאפליקציה, כמו האי והמדף.
 */
const BOARDS: [string, string, string, number, number[], number, number][] = [
  ['panel-side', 'P-101', 'דופן צד', 580, [400, 450, 500, 560, 580, 600, 650], 720, 18],
  ['panel-shelf', 'P-102', 'מדף בודד', 800, [300, 400, 500, 600, 800, 1000, 1200], 300, 18],
  ['panel-back', 'P-103', 'לוח גב', 600, [400, 500, 600, 800, 900, 1200], 720, 5],
  ['panel-cover', 'P-104', 'חיפוי קיר', 1200, [600, 900, 1200, 1500, 1800, 2400], 2400, 18],
  ['panel-cornice', 'P-105', 'קרניז', 2000, [1000, 1500, 2000, 2500, 3000], 60, 18],
  ['panel-plinth', 'P-106', 'סוקל', 2000, [1000, 1500, 2000, 2500, 3000], 150, 18],
];

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

  /*
   * תנור, מקרר ומדיח.
   *
   * מכשיר חשמלי נכנס למטבח מוכן: אין לו דפנות שנחתכות, אין לו מדפים
   * וגב, ואין לו מגירות שמזמינים — מה שנקבע לו הוא המידה והמקום.
   * לכן הוא מוצר של המערכת ולא ארגז של הנגרייה, והוא אינו נספר
   * בייצור. הארגז שנבנה *סביבו* — עמודת תנור, ארון תנור תחתון —
   * הוא ארגז לכל דבר, והוא כן נספר.
   *
   * המזהים הם אלה שהיו להם כשהגיעו בתוך הספרייה, כדי שמכשיר שכבר
   * יש לו אותם יזהה את אותה שורה במקום לקבל עותק שני.
   */
  {
    id: 'k-base-oven',
    code: 'B-110',
    rooms: ['kitchen'],
    group: 'appliance',
    name: 'תנור',
    glyph: 'oven',
    level: 'floor',
    defaultWidthMm: 600,
    widthOptionsMm: [600],
    defaultHeightMm: 720,
    defaultDepthMm: 580,
    defaultYMm: 150,
    socleMm: 150,
    counterMm: 30,
    common: true,
    isBuiltin: true,
    sortOrder: 1020,
    note: 'נישת תנור בילד אין: כ-560×590 מ״מ',
  },
  {
    id: 'k-base-dw',
    code: 'B-109',
    rooms: ['kitchen'],
    group: 'appliance',
    name: 'מדיח',
    glyph: 'dishwasher',
    level: 'floor',
    defaultWidthMm: 600,
    widthOptionsMm: [300, 450, 600, 750, 900],
    defaultHeightMm: 870,
    defaultDepthMm: 580,
    defaultYMm: 0,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1030,
    note: 'נישת מדיח: רוחב 600, גובה 820 מ״מ',
  },
  {
    id: 'k-tall-fridge',
    code: 'T-103',
    rooms: ['kitchen'],
    group: 'appliance',
    name: 'מקרר',
    glyph: 'fridge',
    level: 'tall',
    defaultWidthMm: 700,
    widthOptionsMm: [600, 700, 800, 900],
    defaultHeightMm: 2050,
    defaultDepthMm: 650,
    defaultYMm: 150,
    socleMm: 150,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1040,
    note: 'לבדוק עומק המקרר בפועל — לרוב 650–700 מ״מ',
  },

  {
    id: 'appliance-micro',
    code: 'A-104',
    rooms: ['kitchen', 'utility', 'office'],
    group: 'appliance',
    name: 'מיקרוגל',
    glyph: 'micro',
    level: 'wall',
    defaultWidthMm: 595,
    widthOptionsMm: [500, 595, 600],
    defaultHeightMm: 388,
    defaultDepthMm: 390,
    defaultYMm: 1500,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1050,
    note: 'נישת מיקרוגל: 560×380×380 מ״מ. מרווח פתיחה 400 מ״מ.',
  },
  {
    id: 'appliance-oven-micro',
    code: 'A-105',
    rooms: ['kitchen'],
    group: 'appliance',
    name: 'תנור ומיקרוגל',
    glyph: 'ovenMicro',
    level: 'tall',
    defaultWidthMm: 595,
    widthOptionsMm: [595, 600],
    defaultHeightMm: 1010,
    defaultDepthMm: 550,
    defaultYMm: 700,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1060,
    note: 'שתי נישות נפרדות: תנור 560×590 ומיקרוגל 560×380 מ״מ.',
  },
  {
    id: 'appliance-hood',
    code: 'A-106',
    rooms: ['kitchen'],
    group: 'appliance',
    name: 'קולט אדים',
    glyph: 'hood',
    level: 'wall',
    defaultWidthMm: 600,
    widthOptionsMm: [600, 700, 800, 900],
    defaultHeightMm: 400,
    defaultDepthMm: 500,
    defaultYMm: 1500,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1070,
    note: 'נתלה 650–750 מ״מ מעל הכיריים. הארובה נמדדת עד התקרה.',
  },
  {
    id: 'appliance-cooktop',
    code: 'A-107',
    rooms: ['kitchen'],
    group: 'appliance',
    name: 'כיריים',
    glyph: 'cooktop',
    level: 'floor',
    defaultWidthMm: 590,
    widthOptionsMm: [300, 450, 590, 750, 900],
    defaultHeightMm: 50,
    defaultDepthMm: 520,
    /* מונחות במשטח: גובה העבודה פחות עובי הכיריים */
    defaultYMm: 880,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1080,
    note: 'חיתוך במשטח: 560×490 מ״מ, עם 50 מ״מ שוליים מכל צד.',
  },

  /* הלוחות הבודדים — ראה `BOARDS` מתחת */
  ...BOARDS.map(([id, code, name, w, widths, h, d], n) => ({
    id,
    code,
    rooms: ['kitchen', 'living', 'bedroom'] as RoomKind[],
    group: 'panel' as const,
    name,
    /* לוח מונח: אין לו דפנות, תחתית, גב או רגליים */
    glyph: 'plain',
    level: 'floor' as const,
    defaultWidthMm: w,
    widthOptionsMm: widths,
    defaultHeightMm: h,
    defaultDepthMm: d,
    defaultYMm: 0,
    socleMm: 0,
    counterMm: 0,
    common: true,
    isBuiltin: true,
    sortOrder: 1100 + n * 10,
  })),
];
