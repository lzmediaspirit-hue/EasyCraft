/**
 * מידות התקן של מכשירי החשמל.
 *
 * עד כאן כל נישה הייתה "דורש מידות יצרן": האפליקציה סירבה לדעת
 * כמה מקום צריך תנור, ולכן כל ארון תנור בספרייה נשא אזהרה שאי
 * אפשר להסיר. אבל מכשירי בילד־אין אינם נעלם — הם מיוצרים לפי תקן
 * אירופי אחד, וכל נגר בונה לפיו: תנור 60, מדיח 60 או 45, מקרר
 * אינטגרלי 56 נטו. מי שקונה דגם חריג מזין את מידותיו בארגז עצמו.
 *
 * לכן המספרים כאן הם ברירת מחדל מקצועית ולא הנחה: הם מה שהארון
 * נבנה לפיו כשלא נאמר אחרת, והם מה שהופך "ארון תנור" מהבטחה
 * לנישה שאפשר למדוד.
 *
 * מה שאין כאן במכוון: צנרת ואוורור. הם אינם מידה של המכשיר אלא
 * של הבניין, הם אינם נחתכים מפלטה, והם אינם חוסמים ייצור של
 * ארגז — הנגר מקדח את מה שצריך באתר.
 */

/** סוג המכשיר, בנפרד מהאיור שנבחר לצייר אותו. */
export type ApplianceType =
  | 'oven'
  | 'micro'
  | 'ovenMicro'
  | 'fridge'
  | 'dishwasher'
  | 'hood'
  | 'hob';

/** נישה: החלל הנקי שהארון חייב לפנות למכשיר. */
export interface Niche {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /**
   * מינימום בלבד — בלי תקרה.
   *
   * נישה רגילה היא מידה: מכשיר בילד־אין מיוצר לפי תקן, וחלל שגבוה
   * ממנו בהרבה אינו נישה אלא עמודה ריקה. מקרר אינו כזה — הוא עומד
   * *בתוך* ארגז מקרר, והוא זה שנבחר לפי הארגז ולא להפך. לכן שם
   * נדרש רק שיהיה מספיק גדול.
   */
  atLeast?: true;
}

export interface ApplianceStd {
  type: ApplianceType;
  label: string;
  /**
   * המכשיר עומד בעצמו על הרצפה, בגובה הארגזים שלצידו.
   *
   * תנור ומדיח אינם נכנסים לארון: הם ניצבים בשורה בין הארגזים,
   * והמשטח עובר מעליהם. עד כאן הם נדרשו נישה, ולכן כל מטבח נזקק
   * ל"עמודת תנור" שאיש לא בנה — ובספרייה שאין בה אחת, התכנון
   * האוטומטי לא הצליח למלא את התחנה.
   */
  freestanding?: true;
  /** המכשיר עצמו — מה שנראה בחזית */
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** רוחבי תקן נוספים שהמכשיר מיוצר בהם */
  widthOptionsMm: number[];
  /**
   * הנישות שהארון חייב לפנות. תנור ומיקרוגל הם שתיים, ולכן זו
   * רשימה: תפקיד משולב אינו מתמלא בנישה אחת גדולה.
   */
  niches: Niche[];
  /** המרווח שהפתיחה סוחפת לפני המכשיר */
  openClearanceMm: number;
}

/**
 * סובלנות הנישה.
 *
 * נישה שגבוהה בסנטימטרים ספורים מהמכשיר היא נישה; חלל בגובה שני
 * מטר אינו נישה אלא עמודה ריקה — אין בו מדף שהתנור נח עליו. זה
 * ההבדל בין ארון שנבנה למכשיר לבין ארון שהמכשיר הונח בו.
 */
export const NICHE_SLACK_MM = 80;

const OVEN_NICHE: Niche = { widthMm: 560, heightMm: 590, depthMm: 550 };
const MICRO_NICHE: Niche = { widthMm: 560, heightMm: 380, depthMm: 380 };

export const APPLIANCES: Record<ApplianceType, ApplianceStd> = {
  oven: {
    type: 'oven',
    label: 'תנור',
    freestanding: true,
    widthMm: 595,
    heightMm: 720,
    depthMm: 580,
    widthOptionsMm: [600],
    /* עומד בשורה בין הארגזים, ולכן אין ארון שמארח אותו */
    niches: [],
    /* דלת תנור נופלת קדימה לאורך גובהה */
    openClearanceMm: 600,
  },
  micro: {
    type: 'micro',
    label: 'מיקרוגל בנוי',
    widthMm: 595,
    heightMm: 388,
    depthMm: 390,
    widthOptionsMm: [600],
    niches: [MICRO_NICHE],
    openClearanceMm: 400,
  },
  /*
   * עמודת תנור ומיקרוגל — ושם התנור כן בנוי.
   *
   * זה אינו סותר את `oven` שמעליו: תנור *עומד* הוא מכשיר בפני
   * עצמו בגובה הארגזים, ותנור בילד־אין הוא מה שנכנס לעמודה
   * שנבנתה לו. מי שבוחר בעמודה בוחר בשני מכשירים מובנים.
   */
  ovenMicro: {
    type: 'ovenMicro',
    label: 'תנור ומיקרוגל',
    widthMm: 595,
    heightMm: 983,
    depthMm: 550,
    widthOptionsMm: [600],
    /* שתי נישות נפרדות, ולא חלל אחד בגובה שתיהן */
    niches: [OVEN_NICHE, MICRO_NICHE],
    openClearanceMm: 600,
  },
  fridge: {
    type: 'fridge',
    label: 'מקרר',
    widthMm: 595,
    heightMm: 1772,
    depthMm: 550,
    widthOptionsMm: [600, 700, 800, 900],
    /*
     * המקרר עומד בתוך ארגז מקרר, ומידתו נגזרת ממנו.
     *
     * לכן זה מינימום ולא מידה: ארגז מקרר הוא תיבה גבוהה ופנויה,
     * והמקרר שנכנס אליה קטן ממנה בכדי `FRIDGE_CLEAR_MM`. דרישה
     * למידת תקן קבועה פסלה ארגז מקרר של 170 ס״מ — שהוא ארגז מקרר
     * לכל דבר, רק לדגם אחר.
     */
    niches: [{ widthMm: 500, heightMm: 1200, depthMm: 500, atLeast: true }],
    /* דלת מקרר מסתובבת כרוחבה */
    openClearanceMm: 600,
  },
  dishwasher: {
    type: 'dishwasher',
    label: 'מדיח כלים',
    freestanding: true,
    widthMm: 598,
    heightMm: 818,
    depthMm: 570,
    widthOptionsMm: [450, 600],
    /* גם הוא עומד בשורה, בגובה הארגזים, ומתחת למשטח */
    niches: [],
    /* דלת מדיח נופלת קדימה, והסל נשלף מעליה */
    openClearanceMm: 550,
  },
  hood: {
    type: 'hood',
    label: 'קולט אדים',
    widthMm: 600,
    heightMm: 400,
    depthMm: 500,
    widthOptionsMm: [600, 900],
    niches: [{ widthMm: 560, heightMm: 300, depthMm: 300 }],
    /* קולט נשלף או נפתח כלפי מטה בלבד */
    openClearanceMm: 100,
  },
  hob: {
    type: 'hob',
    label: 'כיריים',
    widthMm: 590,
    heightMm: 50,
    depthMm: 520,
    widthOptionsMm: [600, 750, 900],
    /* כיריים אינן יושבות בנישה אלא בחיתוך במשטח */
    niches: [],
    openClearanceMm: 0,
  },
};

/**
 * חיתוך במשטח.
 *
 * כיור וכיריים אינם נכנסים לתוך הארון אלא לתוך המשטח שמעליו: מה
 * שהארון חייב לספק הוא חלל פנוי מתחת לחיתוך ומשטח לחתוך בו.
 * המידות הן של הפתח, ולכן הן תמיד קטנות מרוחב הארון.
 */
export interface Cutout {
  /** מה נחתך */
  label: string;
  /** הפתח עצמו */
  widthMm: number;
  depthMm: number;
  /** כמה חומר חייב להישאר מכל צד של הפתח */
  marginMm: number;
}

export const CUTOUTS = {
  hob: { label: 'חיתוך לכיריים', widthMm: 560, depthMm: 490, marginMm: 50 },
  sink: { label: 'חיתוך לכיור', widthMm: 490, depthMm: 430, marginMm: 50 },
} as const satisfies Record<string, Cutout>;

/** המכשיר שהאיור מתאר, כשלא נבחר סוג במפורש. */
const GLYPH_TYPE: Record<string, ApplianceType> = {
  oven: 'oven',
  ovenMicro: 'ovenMicro',
  fridge: 'fridge',
  dishwasher: 'dishwasher',
  hood: 'hood',
  hob: 'hob',
  /* המכשיר עצמו, להבדיל מהארגז שנבנה סביבו */
  micro: 'micro',
};

/**
 * סוג המכשיר של יחידה.
 *
 * השדה המפורש קודם, והאיור הוא רק ברירת מחדל: מי שצייר מקרר וכתב
 * שזה מקפיא מקבל מקפיא. כך הציור מפסיק להיות ההגדרה.
 */
export function applianceOf(
  u: { applianceType?: ApplianceType; glyph: string },
): ApplianceStd | undefined {
  const key = u.applianceType ?? GLYPH_TYPE[u.glyph];
  return key ? APPLIANCES[key] : undefined;
}

/** האם הנישה שהארון מפנה מכילה את מה שהמכשיר דורש. */
export function nicheFits(have: Niche, need: Niche): boolean {
  if (have.widthMm < need.widthMm) return false;
  if (have.depthMm < need.depthMm) return false;
  if (have.heightMm < need.heightMm) return false;
  /* מינימום בלבד: החלל מחזיק את המכשיר, ואינו נמדד לפיו */
  return need.atLeast === true || have.heightMm <= need.heightMm + NICHE_SLACK_MM;
}

/**
 * המרווח שהמכשיר קטן בו מהחלל שהוא עומד בו.
 *
 * מקרר שנכנס לארגז מקרר אינו ממלא אותו עד הדופן: צריך אוויר
 * מאחוריו ואצבע מכל צד. המספר הזה הוא מה שמפריד בין "נכנס"
 * לבין "נדחק".
 */
export const FRIDGE_CLEAR_MM = 20;

/** מידות המכשיר שעומד בתוך החלל הזה — החלל, פחות המרווח. */
export function applianceInCavity(cavity: Niche): Niche {
  return {
    widthMm: Math.max(cavity.widthMm - FRIDGE_CLEAR_MM * 2, 0),
    heightMm: Math.max(cavity.heightMm - FRIDGE_CLEAR_MM, 0),
    depthMm: Math.max(cavity.depthMm - FRIDGE_CLEAR_MM, 0),
  };
}
