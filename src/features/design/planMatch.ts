import { SEED_CATALOG } from '../../catalog/builtins';
import type { CatalogItem } from '../../db/types';

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
 */
export function matchCatalog(
  key: string,
  items: CatalogItem[],
  widthMm?: number,
): CatalogItem | undefined {
  const exact = items.find((i) => i.id === key);
  if (exact) return exact;

  const seed = SEED_CATALOG.find((s) => s.key === key);
  if (!seed) return undefined;

  const want = widthMm ?? seed.w;
  const scored = items
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
   */
  if (item.name.trim() === seed.name.trim()) n += 40;
  if (item.glyph === seed.glyph) n += 20;
  if (item.widthOptionsMm.includes(wantMm)) n += 5;
  /* הפרש רוחב מוריד עד 4 נקודות, כך שהוא אף פעם לא גובר על האיור */
  n += Math.max(0, 4 - Math.abs(item.defaultWidthMm - wantMm) / 250);
  return n;
}
