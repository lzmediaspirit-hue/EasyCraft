/**
 * האיורים הזמינים כשבונים או עורכים ארגז.
 *
 * לכל איור מוגדר מה בכלל אפשר לכוונן בו — כך שבטופס העריכה מופיעות
 * רק ההגדרות שרלוונטיות לארגז שנבחר.
 */
export interface GlyphDef {
  key: string;
  label: string;
  /**
   * לאיזו משפחה הוא שייך, בבורר האיורים.
   *
   * שלושים ואחד איורים ברשת אחת הם רשימה שמחפשים בה, ולא בוחרים
   * ממנה: מי שמחפש כיור עבר בדרך על מראה, נעליים ותלייה כפולה.
   * ריק = ארון רגיל, שהוא הרוב.
   */
  family?: GlyphFamily;
  /** לארגז יש חזית דלתות שאפשר לקבוע את מספרן */
  doors?: boolean;
  /** לארגז יש מגירות — שורות, ואפשר גם עמודות זו לצד זו */
  drawers?: boolean;
  /** לארגז יש מדפים פנימיים */
  shelves?: boolean;
  /**
   * אין כאן גוף ארון אמיתי אלא לוח בודד.
   * 'horizontal' — לוח שוכב, שטחו רוחב על עומק (מדף צף, משטח שולחן).
   * 'vertical' — לוח עומד, שטחו רוחב על גובה (פאנל, מרווח).
   */
  noCarcass?: 'horizontal' | 'vertical';
  /**
   * לוח דק: המידה הדקה שלו היא עובי, ולכן יש לה תקרה.
   *
   * שולחן אינו מסומן כך, ולא מפני שהוא אינו פלטה — הוא כן. פלטת
   * השולחן בספרייה תוקנה ל-30 מ״מ בגובה 720, כי קודם נשמר בה 750
   * בשדה העובי: פלטה בעובי 75 ס״מ על הרצפה. אבל התיקון חל על
   * התקנה חדשה בלבד; מי שכבר עובד עם האפליקציה מחזיק במכשיר את
   * השורה הישנה, ולפסול לו את הספרייה בגלל מידה שהוא לא הזין
   * גרוע מלא לבדוק אותה.
   */
  thinBoard?: boolean;
  /**
   * נישה למכשיר. הגוף אמיתי ונבנה מלוחות, אבל החזית היא המכשיר
   * עצמו — ולכן אין כאן דלת לחשב, וגם לא מדפים שנכנסים מאליהם.
   */
  appliance?: boolean;
  /**
   * המוצר עצמו, ולא ארגז שנבנה סביבו.
   * מקרר, תנור, מדיח וקולט אדים תופסים מקום על הקיר אבל לא נחתכים
   * מפלטות — הם נקנים. לכן הם לא נספרים בחומר.
   */
  standalone?: boolean;
  /**
   * ויטרינה: ארון שרואים לתוכו, ולכן אפשר לעשות לו גם צד זכוכית.
   * בארון אטום צד זכוכית הוא סתירה — אין מה לראות דרכו.
   */
  vitrine?: boolean;
  /**
   * חיפוי קיר: לוח שנצמד לקיר ויושב מאחורי הארגזים.
   * הוא מכסה קיר, ולא ניצב לפניו, ולכן גם בציור הוא מצויר ראשון.
   */
  cladding?: boolean;
}

/** המשפחות בבורר האיורים, לפי הסדר שבו הן מוצגות. */
export type GlyphFamily = 'cabinet' | 'corner' | 'appliance' | 'board';

export const GLYPH_FAMILIES: { key: GlyphFamily; label: string }[] = [
  { key: 'cabinet', label: 'ארונות' },
  { key: 'corner', label: 'פינות' },
  { key: 'appliance', label: 'מטבח ומכשירים' },
  { key: 'board', label: 'לוחות ומשטחים' },
];

/** האיורים של משפחה אחת, לפי סדר הרשימה. */
export function glyphsOf(family: GlyphFamily): GlyphDef[] {
  return GLYPHS.filter((g) => (g.family ?? 'cabinet') === family);
}

export const GLYPHS: GlyphDef[] = [
  { key: 'doors', label: 'דלתות', doors: true, shelves: true },
  { key: 'drawers', label: 'מגירות', drawers: true },
  { key: 'doorDrawer', label: 'דלת ומגירה', doors: true, drawers: true, shelves: true },
  { key: 'open', label: 'פתוח', shelves: true },
  { key: 'shelves', label: 'מדפים', shelves: true },
  { key: 'glass', label: 'ויטרינה', doors: true, shelves: true, vitrine: true },
  { key: 'lift', label: 'קלאפה', shelves: true },
  { key: 'shutter', label: 'תריס', shelves: true },
  { key: 'corner', family: 'corner', label: 'פינתי', doors: true, shelves: true },
  { key: 'carousel', family: 'appliance', label: 'סחרחרה', appliance: true },
  { key: 'sink', family: 'appliance', label: 'כיור', appliance: true },
  { key: 'hob', family: 'appliance', label: 'כיריים', drawers: true, appliance: true },
  { key: 'oven', family: 'appliance', label: 'תנור', appliance: true, standalone: true },
  { key: 'ovenMicro', family: 'appliance', label: 'תנור ומיקרוגל', appliance: true, standalone: true },
  { key: 'fridge', family: 'appliance', label: 'מקרר', appliance: true, standalone: true },
  { key: 'dishwasher', family: 'appliance', label: 'מדיח', appliance: true, standalone: true },
  { key: 'hood', family: 'appliance', label: 'קולט אדים', appliance: true, standalone: true },
  /*
   * מיקרוגל וכיריים כמכשיר, ולא כארגז שנבנה סביבם.
   *
   * `hob` הקיים הוא ארגז הכיריים — גוף שנחתך, עם משטח וחיתוך —
   * ולכן הוא אינו `standalone`, ואי אפשר לתאר בו את הכיריים
   * עצמן. `cooktop` הוא המכשיר: לוח שמונח במשטח ונקנה שלם.
   */
  { key: 'micro', family: 'appliance', label: 'מיקרוגל', appliance: true, standalone: true },
  { key: 'cooktop', family: 'appliance', label: 'כיריים', appliance: true, standalone: true },
  { key: 'pantry', label: 'מזווה', shelves: true },
  { key: 'hang', label: 'תלייה' },
  { key: 'hangDouble', label: 'תלייה כפולה' },
  { key: 'sliding', label: 'הזזה', shelves: true },
  { key: 'shoes', label: 'נעליים' },
  { key: 'innerDrawers', label: 'מגירות פנימיות', drawers: true },
  { key: 'mirror', label: 'מראה', shelves: true },
  { key: 'nightstand', label: 'שידה', drawers: true },
  { key: 'blindStart', family: 'corner', label: 'פינה מתה שמאל', doors: true, shelves: true },
  { key: 'blindEnd', family: 'corner', label: 'פינה מתה ימין', doors: true, shelves: true },
  { key: 'lShape', family: 'corner', label: 'פינתי במפגש', doors: true, shelves: true },
  { noCarcass: 'vertical', key: 'plain', family: 'board', thinBoard: true, label: 'לוח בודד' },
  { noCarcass: 'horizontal', key: 'desk', family: 'board', label: 'שולחן' },
  { key: 'tv', label: 'טלוויזיה', doors: true, drawers: true },
  { noCarcass: 'vertical', key: 'panel', family: 'board', thinBoard: true, label: 'פאנל', cladding: true },
  { noCarcass: 'horizontal', key: 'slab', family: 'board', thinBoard: true, label: 'מדף צף' },
  { noCarcass: 'vertical', key: 'spacer', family: 'board', thinBoard: true, label: 'מרווח' },
];

export function glyphDef(key: string): GlyphDef {
  return GLYPHS.find((g) => g.key === key) ?? GLYPHS[0];
}
