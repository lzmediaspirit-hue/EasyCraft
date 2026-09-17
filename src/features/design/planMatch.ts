import { SEED_CATALOG } from '../../catalog/builtins';
export { ROLE_NEEDS, ROLE_OF_KEY, roleCapable, type RoleNeed } from '../../catalog/roles';
import type { CatalogItem, RoomKind } from '../../db/types';

/**
 * מהתפקיד שהמתכנן ביקש אל הארגז שבאמת קיים בספרייה.
 *
 * המתכנן חושב בתפקידים — "עמודת תנור", "ארגז כיור", "עליון שתי
 * דלתות" — וכותב אותם כמפתחות של ארגזי התקן. זה עבד כל עוד ארגזי
 * התקן היו הספרייה. נגר שהחליף את הספרייה בשלו קיבל הצעה יפה על
 * המסך ואפס ארגזים על הקיר, כי אף מפתח לא נמצא.
 *
 * כאן התפקיד מתורגם לארגז: קודם לפי המזהה עצמו, ואם אין — לארגז
 * הקרוב ביותר בספרייה. "קרוב" הוא אותה קטגוריה ואותו מפלס, ואחר
 * כך אותו איור ואותו רוחב — כלומר ארגז שממלא את אותו תפקיד.
 *
 * `room` הוא גבול ולא העדפה: ספרייה שיש בה גם חדר שינה וגם מטבח
 * מחזיקה "עמודה" בשני החדרים, ובלעדיו ארון בגדים זכה בתפקיד של
 * עמודת מזווה — הצעה למטבח שיש בה שידת לילה.
 */
export function matchCatalog(
  key: string,
  items: CatalogItem[],
  widthMm?: number,
  room?: RoomKind,
): CatalogItem | undefined {
  const here = room ? items.filter((i) => i.rooms.includes(room)) : items;
  const exact = here.find((i) => i.id === key);
  if (exact) return exact;

  const seed = SEED_CATALOG.find((s) => s.key === key);
  if (!seed) return undefined;

  const want = widthMm ?? seed.w;
  const scored = here
    .map((i) => ({ i, score: score(i, seed, want) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.i;
}

/**
 * כמה הארגז הזה מתאים לתפקיד. אפס = לא מתאים בכלל.
 *
 * המפלס והקטגוריה הם התנאי: ארגז עליון לא ימלא תפקיד של תחתון
 * גם אם כל השאר מתאים. מעליהם השם, אחריו האיור, ואז קרבת הרוחב —
 * שהיא שובר שוויון ולא שיקול בפני עצמו.
 */
function score(
  item: CatalogItem,
  seed: { group: string; level: string; glyph: string; name: string; w: number },
  wantMm: number,
): number {
  if (item.level !== seed.level) return 0;
  if (item.group !== seed.group) return 0;
  let n = 10;
  /*
   * השם קודם לאיור. נגר קורא לארגז הכיריים שלו "ארגז כיריים" גם
   * כשהוא מצייר אותו כמגירות, והשם הוא מה שאומר מה התפקיד שלו.
   *
   * וגם כשהוא קורא לו "ארון כיריים עם מגירות": המילה שאומרת את
   * התפקיד — כיריים, כיור, מזווה — היא מה שמשותף, ולא הניסוח סביבה.
   * בלי זה "ארון כיריים עם מגירות" ו"ארון תחתון מגירות" נראים אותו
   * דבר למתכנן, והמטבח יצא בלי כיריים.
   */
  if (item.name.trim() === seed.name.trim()) n += 40;
  else {
    const has = new Set(roleWords(item.name));
    const shared = roleWords(seed.name).filter((w) => has.has(w)).length;
    if (shared) n += 25 + shared * 5;
  }
  if (item.glyph === seed.glyph) n += 20;
  if (item.widthOptionsMm.includes(wantMm)) n += 5;
  /* הפרש רוחב מוריד עד 4 נקודות, כך שהוא אף פעם לא גובר על האיור */
  n += Math.max(0, 4 - Math.abs(item.defaultWidthMm - wantMm) / 250);
  return n;
}

/**
 * המילים בשם שאומרות מה תפקיד הארגז.
 *
 * "ארגז", "ארון", "עמודת", "תחתון" — אלה אומרים איפה הוא יושב, וזה
 * כבר נבדק דרך הקטגוריה והמפלס. מה שנשאר הוא מה שהוא עושה.
 */
function roleWords(name: string): string[] {
  return name
    .split(/[\s—·,/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !SHAPE_WORDS.has(w));
}

const SHAPE_WORDS = new Set([
  'ארגז', 'ארון', 'ארונות', 'עמודה', 'עמודת', 'יחידה', 'יחידת', 'שידה', 'שידת',
  'תחתון', 'תחתונים', 'עליון', 'עליונים', 'גבוה', 'גבוהה', 'נמוך', 'נמוכה',
  'עם', 'ללא', 'של', 'ואת', 'מטבח',
]);
