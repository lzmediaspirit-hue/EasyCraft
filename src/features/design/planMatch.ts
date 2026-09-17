import { SEED_CATALOG } from '../../catalog/builtins';
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

/* ------------------------------------------------------------------ */
/* יכולת נדרשת: מה שאי אפשר להחליף בארגז דומה                          */
/* ------------------------------------------------------------------ */

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
