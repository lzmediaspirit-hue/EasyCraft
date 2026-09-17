import { glyphDef, type GlyphDef } from './glyphList';
import type { RoomKind } from '../db/types';

/**
 * האיורים שבאמת נבחרים בחדר מסוים.
 *
 * שלושים וארבעה איורים ברשת אחת הם רשימה שמחפשים בה ולא בוחרים
 * ממנה: מי שבנה ארון מטבח עבר בדרך על נעליים, מראה ותלייה כפולה.
 * כאן יושבת רשימה קצרה לכל חדר — מה שנגר באמת בונה שם — וכל השאר
 * נשאר במרחק לחיצה אחת, ולא נעלם.
 *
 * הרשימות הן העדפת תצוגה בלבד. הן אינן מגבילות מה אפשר לבנות,
 * ואינן משפיעות על מה שנשמר: `constructionCaps` הוא שמחליט מה
 * אפשר לכוונן בארגז, והאיור הוא תמונה.
 */
const COMMON: Record<string, string[]> = {
  kitchen: ['doors', 'drawers', 'doorDrawer', 'sink', 'hob', 'corner', 'open', 'glass'],
  bathroom: ['doors', 'drawers', 'sink', 'mirror', 'open', 'shelves'],
  bedroom: ['hang', 'hangDouble', 'drawers', 'shelves', 'nightstand', 'doors', 'sliding', 'open'],
  children: ['hang', 'shelves', 'drawers', 'doors', 'open', 'desk'],
  closet: ['hang', 'hangDouble', 'shelves', 'drawers', 'shoes', 'sliding', 'innerDrawers', 'doors'],
  entrance: ['shoes', 'hang', 'doors', 'shelves', 'mirror', 'open'],
  living: ['tv', 'shelves', 'open', 'doors', 'drawers', 'glass', 'slab'],
  office: ['desk', 'shelves', 'open', 'doors', 'drawers', 'slab'],
  utility: ['doors', 'shelves', 'open', 'drawers', 'pantry', 'plain'],
};

/**
 * מה שמוצג בלי חדר ידוע, ובחדר שהנגר הוסיף בעצמו: הארגזים
 * שנבנים בכל חדר.
 */
const ANY = ['doors', 'drawers', 'doorDrawer', 'open', 'shelves', 'hang', 'glass', 'plain'];

/** האיורים הנפוצים בחדר, לפי הסדר שבו הם מוצגים. */
export function commonGlyphs(room?: RoomKind): GlyphDef[] {
  const keys = (room && COMMON[room]) || ANY;
  return keys.map(glyphDef);
}

/** האם האיור הזה נמצא ברשימה הקצרה של החדר. */
export function isCommonGlyph(glyph: string, room?: RoomKind): boolean {
  return commonGlyphs(room).some((g) => g.key === glyph);
}
