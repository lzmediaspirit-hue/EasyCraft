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
