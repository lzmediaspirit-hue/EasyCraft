import { glyphDef, type GlyphDef } from './glyphList';

/**
 * מה אפשר לבנות בארגז — להבדיל מהאיור שנבחר להציג אותו.
 *
 * האיור היה גם ההגדרה: מי שבחר לארגז שלו איור של מדפים גילה
 * שהמגירות שהגדיר נעלמו מהטופס, ומי שבחר איור של תלייה איבד את
 * הדלתות. איור הוא תמונה קטנה ברשימה, והוא לא אמור להחליט מה
 * הנגר יכול לבנות.
 *
 * מה שכן מחליט הוא סוג המוצר: מכשיר שנקנה שלם ולוח בודד אינם
 * גוף ארון, ובהם באמת אין דלתות, מגירות או מדפים לשאול עליהם.
 * כל השאר הוא גוף ארון, ובגוף ארון אפשר הכול.
 */
export function constructionCaps(glyph: string): GlyphDef {
  const def = glyphDef(glyph);
  return def.standalone || def.noCarcass
    ? def
    : { ...def, doors: true, drawers: true, shelves: true };
}

/**
 * מספר מדפים סביר לגובה נתון, כשלא הוגדר מספר במפורש.
 *
 * זהו חשבון ולא ציור, והוא ישב במנוע האיורים: `zones` ייבא ממנו,
 * והוא ייבא מ-`zones` בחזרה. מעגל ייבוא בין שני מודולים שנטענים
 * זה מתוך זה הוא פצצת השהיה — מי שנטען ראשון ראה את השני חצי
 * מאותחל. הכלל אינו שייך לאף אחד מהם, אלא לכללי הבנייה.
 */
export function autoShelves(h: number): number {
  return Math.max(0, Math.round(h / 400) - 1);
}

/** ארגז כפי שהוא מותקן: תחתית, רגליים וגובה כולל. */
export interface Installation {
  /** גובה תחתית הארגז מהרצפה */
  yMm: number;
  /** גובה הרגליים, כלול בתוך `heightMm` */
  socleMm: number;
  /** גובה כולל — גוף ועוד רגליים */
  heightMm: number;
  /** האם הארגז עומד על הרצפה */
  floorLocked: boolean;
}

/**
 * הצמדה לרצפה והשחרור ממנה, בלי לשנות את גוף הארון.
 *
 * הרגליים כלולות ב-`heightMm`, ולכן הורדתן בלי לגעת בגובה אינה
 * מורידה רגליים אלא מאריכה את הגוף באותה מידה. והצמדה חוזרת
 * שמחזירה את גובה ברירת המחדל מקצרת את הגוף בגובה שהעסק עובד בו
 * ולא בגובה שהיה כאן — ולכן `remembered` הוא מה שהוסר, ולא קבוע.
 *
 * הכלל יושב כאן ולא במסך, כי הוא כלל על הארגז: מי שכתב אותו
 * במסך אחד כתב אותו אחרת במסך השני.
 */
export function floorToggle(
  u: Pick<Installation, 'socleMm' | 'heightMm' | 'floorLocked'>,
  { fallbackSocleMm, remembered }: { fallbackSocleMm: number; remembered?: number | null },
): Partial<Installation> {
  const socle = u.socleMm ?? 0;
  if (u.floorLocked) {
    return { floorLocked: false, socleMm: 0, heightMm: u.heightMm - socle };
  }
  const back = remembered ?? fallbackSocleMm;
  return { floorLocked: true, yMm: 0, socleMm: back, heightMm: u.heightMm + back };
}

/**
 * האם ארגז שנוחת עומד על הרצפה.
 *
 * המפלס לבדו אמר "תחתון, לכן נעול", וכך ארגז שנשמר מרחף ננעל
 * לרצפה שהוא אינו נוגע בה. נעול = באמת עומד עליה.
 */
export function landsOnFloor(level: string, yMm: number | undefined): boolean {
  return level !== 'wall' && (yMm ?? 0) === 0;
}
