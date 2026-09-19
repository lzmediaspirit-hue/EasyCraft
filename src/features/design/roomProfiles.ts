import type { CatalogGroup, RoomKind, UnitLevel } from '../../db/types';
import type { Role } from './autoPlan';
import { roomPlanKey } from '../../catalog/roomsRepo';

/**
 * מה מתכננים בחדר הזה.
 *
 * התכנון האוטומטי נבנה למטבח, ובמטבח יש סדר תנועה: מקרר, כיור,
 * כיריים, ומשולש עבודה שמודד את המרחק ביניהם. בחדר ארונות אין
 * משולש עבודה, ובמשרד אין כיור — ולכן להחיל עליהם את הניקוד של
 * המטבח זה למדוד את הדבר הלא נכון ולקרוא לו ציון.
 *
 * מה שכן משותף לכל החדרים: קיר, פתחים, עומק, ורצף של יחידות
 * שממלאות אותו לפי סדר חשיבות. הפרופיל אומר מה הסדר הזה בחדר
 * מסוים, מה נשאל לפניו, ולפי מה נמדדת התוצאה.
 *
 * הבחירה היא מהספרייה של הנגרייה. הפרופיל אינו מחזיק מידות ואינו
 * מחזיק שמות של ארגזים — הוא מחזיק *מה צריך להיות שם*, והספרייה
 * עונה. נגר שבנה ארון תלייה משלו יקבל אותו, ולא העתק שלו.
 */

/** מה שמזהה יחידה מתאימה בספרייה של החדר. */
export interface Pick {
  /**
   * המפלס, או כמה מפלסים שכולם עונים על התפקיד.
   *
   * יחידת מגירות בחדר ארונות יכולה להיות עמודה עם מגירות פנימיות
   * או שידה נמוכה — שתיהן מגירות. הדרישה נכתבה `tall` בלבד,
   * ובספרייה יש בדיוק את הפריט הנכון במפלס `floor`, ולכן כל
   * תכנון של חדר ארונות דיווח "מגירות — אין בספרייה של החדר
   * יחידה כזאת" והוריד ציון על משהו שקיים.
   */
  level: UnitLevel | UnitLevel[];
  group?: CatalogGroup;
  /**
   * האיורים שמצהירים על היכולת.
   *
   * איור הוא הצהרה של הנגר על מה שהארגז עושה — תלייה, מדפים,
   * כיור, נעליים — ולכן הוא מה שנבחר לפיו. שם דומה אינו מספיק:
   * "ארון מדפים" ו"ארון מעילים" נראים דומה ואינם אותו דבר.
   */
  glyphs?: string[];
  /** רוחב מועדף; הרוחב בפועל נגזר מהפריט ומהמקום שנשאר */
  wantMm: number;
  minMm: number;
}

export interface RoomWant {
  /** שם התפקיד, כפי שהוא מופיע בכרטיס וברשימת "לא נכנס" */
  label: string;
  role: Role;
  pick: Pick;
  /** חוזר על עצמו עד שנגמר הקיר — קיר תלייה אינו יחידה אחת */
  repeat?: boolean;
  /** מותנה במה שסומן במסך */
  needs?: string;
  /** יורד בגרסה החסכונית */
  skipWhenPlain?: boolean;
  /**
   * תפקיד שבלעדיו החדר אינו החדר הזה.
   *
   * אמבטיה בלי ארון כיור אינה אמבטיה, וכניסה בלי ארון נעליים אינה
   * כניסה. עד כאן דרישה שלא נמצאה לה יחידה בספרייה נמחקה בשקט
   * לפני הניקוד, ולכן אמבטיה בלי כיור קיבלה 100 עם רשימת ויתורים
   * ריקה. דרישה בסיסית אינה נעלמת: היא נאמרת, והיא מורידה.
   */
  essential?: boolean;
}

export interface RoomOption {
  key: string;
  label: string;
  hint?: string;
  on: boolean;
}

export interface RoomProfile {
  room: RoomKind;
  label: string;
  /** משפט אחד שמסביר מה התכנון עושה כאן */
  intro: string;
  options: RoomOption[];
  wants: RoomWant[];
}

const tall = (glyphs: string[], wantMm: number, minMm = 400): Pick => ({
  level: 'tall', glyphs, wantMm, minMm,
});
/** מה שעומד על הרצפה, בעמודה או בשידה — שניהם עונים על התפקיד. */
const standing = (glyphs: string[], wantMm: number, minMm = 400): Pick => ({
  level: ['tall', 'floor'], glyphs, wantMm, minMm,
});
const base = (glyphs: string[], wantMm: number, minMm = 350): Pick => ({
  level: 'floor', glyphs, wantMm, minMm,
});
const upper = (glyphs: string[], wantMm: number, minMm = 350): Pick => ({
  level: 'wall', glyphs, wantMm, minMm,
});

/**
 * הפרופילים.
 *
 * הסדר ברשימה הוא סדר ההנחה על הקיר: מה שחשוב יותר נכנס ראשון
 * ומקבל את המקום הטוב, ומה שחוזר על עצמו ממלא את מה שנשאר.
 */
export const ROOM_PROFILES: RoomProfile[] = [
  {
    room: 'closet',
    label: 'חדר ארונות',
    intro: 'תלייה לאורך הקירות, ומדפים ומגירות במה שנשאר.',
    options: [
      { key: 'double', label: 'תלייה כפולה', hint: 'שתי קומות חולצות', on: true },
      { key: 'drawers', label: 'מגירות פנימיות', on: true },
      { key: 'shoes', label: 'נעליים', on: true },
      { key: 'island', label: 'אי מגירות', hint: 'באמצע החדר, אם יש מעבר סביבו', on: false },
    ],
    wants: [
      { label: 'תלייה כפולה', role: 'hang', needs: 'double', pick: tall(['hangDouble'], 800, 600) },
      { label: 'תלייה ארוכה', role: 'hang', repeat: true, essential: true, pick: tall(['hang'], 600, 500) },
      { label: 'מגירות', role: 'drawers', needs: 'drawers', pick: standing(['innerDrawers', 'drawers'], 600, 400) },
      { label: 'מדפים', role: 'shelving', repeat: true, pick: tall(['shelves'], 500, 400) },
      { label: 'נעליים', role: 'shoes', needs: 'shoes', pick: tall(['open', 'shoes'], 600, 400) },
    ],
  },
  {
    room: 'bedroom',
    label: 'חדר שינה',
    intro: 'ארון בגדים לאורך הקיר, ושידה ויחידות עליונות סביבו.',
    options: [
      { key: 'double', label: 'תלייה כפולה', on: true },
      { key: 'shelves', label: 'מדפים בארון', on: true },
      { key: 'dresser', label: 'שידת מגירות', on: true },
      { key: 'upper', label: 'יחידות עליונות', hint: 'מעל המיטה', on: false },
    ],
    wants: [
      { label: 'תלייה כפולה', role: 'hang', needs: 'double', pick: tall(['hangDouble'], 800, 600) },
      { label: 'ארון תלייה', role: 'hang', repeat: true, essential: true, pick: tall(['hang'], 600, 500) },
      { label: 'מדפים בארון', role: 'shelving', needs: 'shelves', pick: tall(['shelves'], 500, 400) },
      { label: 'מגירות פנימיות', role: 'drawers', pick: tall(['innerDrawers'], 600, 400) },
      { label: 'שידת מגירות', role: 'store', needs: 'dresser', pick: base(['drawers'], 800, 450) },
      { label: 'יחידה עליונה', role: 'upper', needs: 'upper', skipWhenPlain: true, pick: upper(['doors'], 800, 400) },
    ],
  },
  {
    room: 'bathroom',
    label: 'אמבטיה',
    intro: 'ארון כיור, מראה מעליו, ואחסון במה שנשאר.',
    options: [
      { key: 'mirror', label: 'ארון מראה', on: true },
      { key: 'column', label: 'עמודת שירות', on: true },
      { key: 'laundry', label: 'סל כביסה', on: false },
    ],
    wants: [
      { label: 'ארון כיור', role: 'vanity', essential: true, pick: base(['sink'], 800, 600) },
      { label: 'ארון מראה', role: 'upper', needs: 'mirror', skipWhenPlain: true, pick: upper(['mirror'], 800, 500) },
      { label: 'עמודת שירות', role: 'store', needs: 'column', pick: tall(['doors', 'shelves'], 400, 350) },
      { label: 'סל כביסה', role: 'store', needs: 'laundry', pick: base(['doors'], 450, 400) },
      { label: 'ארון תחתון', role: 'store', repeat: true, pick: base(['drawers', 'doors'], 600, 400) },
    ],
  },
  {
    room: 'children',
    label: 'חדר ילדים',
    intro: 'ארון בגדים, ארונות נמוכים בהישג יד, ומדפים מעליהם.',
    options: [
      { key: 'hang', label: 'ארון תלייה', on: true },
      { key: 'low', label: 'ארונות נמוכים', hint: 'בגובה ילד', on: true },
      { key: 'upper', label: 'ארון תלוי', on: true },
    ],
    wants: [
      { label: 'ארון תלייה', role: 'hang', needs: 'hang', pick: tall(['hang'], 600, 500) },
      { label: 'ארון משולב', role: 'store', essential: true, pick: tall(['doors'], 900, 500) },
      { label: 'ארון נמוך', role: 'store', needs: 'low', repeat: true, pick: base(['doors'], 800, 400) },
      { label: 'יחידת מגירות', role: 'drawers', pick: base(['drawers'], 400, 350) },
      { label: 'ארון תלוי', role: 'upper', needs: 'upper', skipWhenPlain: true, pick: upper(['doors'], 800, 400) },
    ],
  },
  {
    room: 'office',
    label: 'משרד',
    intro: 'ספרייה וארון תיקים לאורך הקיר, ואחסון מתחת לשולחן.',
    options: [
      { key: 'library', label: 'ספרייה גבוהה', on: true },
      { key: 'files', label: 'ארון קלסרים', on: true },
      { key: 'open', label: 'מדפים פתוחים', on: true },
      { key: 'upper', label: 'גשר אחסון', hint: 'מעל השולחן', on: false },
    ],
    wants: [
      { label: 'ספרייה', role: 'shelving', needs: 'library', repeat: true, pick: tall(['shelves'], 800, 500) },
      { label: 'ארון קלסרים', role: 'store', needs: 'files', pick: tall(['doors'], 600, 450) },
      { label: 'יחידת מגירות', role: 'drawers', pick: base(['drawers'], 450, 400) },
      { label: 'ארון נמוך', role: 'store', repeat: true, pick: base(['doors'], 800, 450) },
      { label: 'מדפים פתוחים', role: 'shelving', needs: 'open', pick: base(['open'], 800, 450) },
      { label: 'גשר אחסון', role: 'upper', needs: 'upper', skipWhenPlain: true, pick: upper(['doors'], 1200, 600) },
    ],
  },
  {
    room: 'living',
    label: 'סלון',
    intro: 'מזנון טלוויזיה במרכז הקיר, ואחסון ותצוגה סביבו.',
    options: [
      { key: 'tv', label: 'מזנון טלוויזיה', on: true },
      { key: 'vitrine', label: 'ויטרינה', on: true },
      { key: 'wall', label: 'ארונות קיר תלויים', on: true },
      { key: 'media', label: 'יחידת מדיה פתוחה', on: false },
    ],
    wants: [
      { label: 'מזנון טלוויזיה', role: 'media', needs: 'tv', pick: base(['doors'], 1800, 1200) },
      { label: 'ויטרינה', role: 'display', needs: 'vitrine', pick: tall(['glass'], 600, 500) },
      { label: 'יחידת מדיה', role: 'media', needs: 'media', pick: base(['open'], 1200, 800) },
      { label: 'ארון קיר', role: 'upper', needs: 'wall', skipWhenPlain: true, repeat: true, pick: upper(['doors', 'glass'], 800, 500) },
    ],
  },
  {
    room: 'utility',
    label: 'חדר שירות',
    intro: 'עמודת מכונות, ארון כיור, ואחסון לאורך הקיר.',
    options: [
      { key: 'washer', label: 'עמודת מכונה ומייבש', on: true },
      { key: 'broom', label: 'עמודת מטאטא', on: true },
      { key: 'upper', label: 'ארונות עליונים', on: true },
    ],
    wants: [
      { label: 'עמודת מכונות', role: 'appliance', needs: 'washer', pick: tall(['open'], 650, 600) },
      /*
       * ארון הכיור ירד מכאן לבקשת הבעלים.
       *
       * אין בספרייה של חדר השירות יחידה שמצהירה על כיור, ולכן
       * הדרישה חזרה בכל תכנון כ"לא נכנס" והורידה ציון על משהו
       * שמעולם לא נתבקש. כיור בחדר שירות מונח ביד.
       */
      { label: 'עמודת מטאטא', role: 'store', needs: 'broom', pick: tall(['doors'], 450, 400) },
      { label: 'עמודת מדפים', role: 'shelving', pick: tall(['shelves'], 600, 450) },
      { label: 'ארון תחתון', role: 'store', repeat: true, pick: base(['doors', 'drawers'], 600, 400) },
      { label: 'ארון עליון', role: 'upper', needs: 'upper', skipWhenPlain: true, repeat: true, pick: upper(['doors'], 600, 400) },
    ],
  },
  {
    room: 'entrance',
    label: 'כניסה לבית',
    intro: 'נעליים ומעילים ליד הדלת, וספסל אם יש מקום.',
    options: [
      { key: 'coats', label: 'ארון מעילים', on: true },
      { key: 'bench', label: 'ספסל אחסון', on: true },
      { key: 'upper', label: 'ארון תלוי', on: true },
    ],
    wants: [
      { label: 'ארון נעליים', role: 'shoes', essential: true, pick: base(['shoes'], 800, 500) },
      { label: 'ארון מעילים', role: 'hang', needs: 'coats', pick: tall(['hang'], 600, 500) },
      { label: 'ספסל אחסון', role: 'store', needs: 'bench', pick: base(['doors'], 1000, 600) },
      { label: 'ארון תלוי', role: 'upper', needs: 'upper', skipWhenPlain: true, pick: upper(['shoes', 'doors'], 800, 400) },
    ],
  },
];

/**
 * הפרופיל של החדר, אם יש לו אחד. מטבח מתוכנן במנוע משלו.
 *
 * הזהות של החדר אינה בהכרח מפתח הפרופיל שלו: חדר שהגיע בייבוא
 * נושא מזהה משלו ומצביע על פרופיל קיים. `roomPlanKey` הוא
 * התרגום, והוא נעשה כאן פעם אחת — כך שאף מסך אינו צריך לזכור.
 */
export function roomProfile(room: string | undefined): RoomProfile | undefined {
  const key = roomPlanKey(room);
  return ROOM_PROFILES.find((p) => p.room === key);
}

/** האם התכנון האוטומטי יודע לתכנן את החדר הזה. */
export function autoPlannable(room: string | undefined): boolean {
  return roomPlanKey(room) === 'kitchen' || !!roomProfile(room);
}
