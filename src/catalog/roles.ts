import type { CatalogItem } from '../db/types';

/*
 * יכולת נדרשת: מה שאי אפשר להחליף בארגז דומה.
 *
 * זו ידיעה על הקטלוג ולא על התכנון, ולכן היא יושבת כאן: גם
 * המתכנן האוטומטי שואל אותה ("האם הארגז הזה ממלא את התפקיד"),
 * וגם כללי הבנייה ("האם התבנית מקיימת את מה שהשם מבטיח").
 */

/**
 * תפקיד שדורש יכולת פיזית, ולא רק קטגוריה ומפלס.
 *
 * ארגז כיור אינו ארגז דלתות עם שם אחר: יש בו חיתוך, אין בו מדף
 * עליון, והאינסטלציה עוברת דרכו. תנור צריך נישה ואוורור, כיריים
 * צריכות חיתוך במשטח וקולט אדים צריך תעלה. הדירוג נתן לכל ארגז
 * מאותה קטגוריה ניקוד חיובי, ולכן בספרייה בלי ארגז כיור נבחר ארגז
 * דלתות — והמטבח יצא בלי כיור, בשקט.
 *
 * מה שנחשב הצהרה על יכולת: האיור שנבחר, או מילת התפקיד בשם.
 * שניהם נכתבו בידי הנגר. האפליקציה אינה ממציאה יכולת ואינה
 * מסירה אותה — שינוי שם אינו הופך ארגז לארגז כיור, ואינו מבטל
 * ארגז כיור שצויר ככזה.
 */
export interface RoleNeed {
  /** איך קוראים לזה למשתמש */
  label: string;
  /** איורים שמצהירים על היכולת */
  glyphs: string[];
  /** מילים בשם שמצהירות עליה */
  words: string[];
}

export const ROLE_NEEDS: Record<string, RoleNeed> = {
  sink: { label: 'ארגז כיור', glyphs: ['sink'], words: ['כיור'] },
  hob: { label: 'ארגז כיריים', glyphs: ['hob'], words: ['כיריים', 'כיריה'] },
  oven: { label: 'עמודת תנור', glyphs: ['oven', 'ovenMicro'], words: ['תנור'] },
  ovenMicro: {
    label: 'עמודת תנור ומיקרוגל',
    glyphs: ['ovenMicro', 'oven'],
    words: ['תנור', 'מיקרוגל'],
  },
  fridge: { label: 'עמודת מקרר', glyphs: ['fridge'], words: ['מקרר'] },
  dishwasher: { label: 'ארגז מדיח', glyphs: ['dishwasher'], words: ['מדיח'] },
  hood: { label: 'ארון קולט אדים', glyphs: ['hood'], words: ['אדים', 'קולט'] },
  micro: { label: 'ארון מיקרוגל', glyphs: ['ovenMicro'], words: ['מיקרוגל'] },
};

/** לאיזה תפקיד כל מפתח בהצעה שייך. מפתח שאינו כאן הוא ארגז רגיל. */
export const ROLE_OF_KEY: Record<string, RoleNeed> = {
  'k-base-sink': ROLE_NEEDS.sink,
  'k-base-hob': ROLE_NEEDS.hob,
  'k-base-dw': ROLE_NEEDS.dishwasher,
  'k-tall-oven': ROLE_NEEDS.oven,
  'k-tall-ovenmicro': ROLE_NEEDS.ovenMicro,
  'k-tall-fridge': ROLE_NEEDS.fridge,
  'k-up-hood': ROLE_NEEDS.hood,
  'k-up-micro': ROLE_NEEDS.micro,
};

/** האם הארגז הזה מצהיר על היכולת שהתפקיד דורש. */
export function roleCapable(item: CatalogItem, need: RoleNeed): boolean {
  if (need.glyphs.includes(item.glyph)) return true;
  const name = item.name;
  return need.words.some((w) => name.includes(w));
}

/**
 * התפקיד שהשם מבטיח, אם יש כזה.
 *
 * "ארון תנור עם מגירה" מבטיח נישת תנור. אם האיור אינו מצהיר על
 * היכולת, מה שיש הוא ארגז מגירות עם שם של ארגז תנור — וזה בדיוק
 * ההבדל בין תצוגה נכונה לבין ארגז בר־בנייה.
 */
export function promisedRole(name: string): RoleNeed | undefined {
  return Object.values(ROLE_NEEDS).find((need) => need.words.some((w) => name.includes(w)));
}
