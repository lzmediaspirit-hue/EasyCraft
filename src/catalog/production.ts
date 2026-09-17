import { glyphDef } from './glyphList';
import { APPLIANCES, CUTOUTS, type ApplianceType } from './appliances';
import {
  CAPABILITY_LABELS,
  capsProvide,
  promisedByGlyph,
  unitCaps,
  type Capability,
  type CapSource,
} from './capabilities';
import { promisedRole } from './roles';

/**
 * מה שהתבנית אינה יודעת לבנות.
 *
 * ארגז יכול להיראות נכון בכל התצוגות ועדיין לא להיות בר־ייצור:
 * "ארון תנור עם מגירה" שהוא אזור מגירה אחד בגובה 800 מ״מ אינו
 * ארון תנור — אין בו נישה שהתנור נכנס אליה — ו"ארון פינה L"
 * שנחתך ומצויר כתיבה מלבנית אינו פינה.
 *
 * מה שהשתנה כאן: הבדיקה נגזרת מהמבנה ולא מהשם. שינוי שם של
 * EC-057 ל־Custom cabinet היה מעלים את האזהרה בלי לשנות לוח אחד;
 * עכשיו השם אינו חלק מהשאלה, ולכן הוא גם אינו יכול לענות עליה.
 *
 * ומה שירד מכאן במפורש: צנרת ואוורור. הם אינם מידה של הארגז,
 * הם אינם נחתכים מפלטה, והנגר מקדח אותם באתר — ולכן הם אינם
 * חוסמים ייצור. מידות המכשירים עצמם אינן "נתוני יצרן" אלא תקן,
 * והן יושבות ב-`appliances.ts`.
 */
export function productionGap(u: CapSource): string | null {
  /*
   * מכשיר שנקנה שלם אינו נבנה, ולכן אין בו מה לחסר. מה שחסר הוא
   * דווקא בארגז שכן נבנה סביב מכשיר או סביב שירות.
   */
  const def = glyphDef(u.glyph);
  if (def.standalone) return null;
  if (u.corner === 'lShape' || def.key === 'lShape') {
    return 'הפינה מצוירת כ-L והגוף נחתך כתיבה מלבנית. מידות ההחזרה והחזיתות חסרות.';
  }
  /*
   * מה שהאיור או הסוג מבטיחים, והמבנה אינו מספק.
   *
   * כאן נבדק המבנה בלבד: נישה במידות התקן של המכשיר, או משטח
   * וחלל פנוי מתחתיו לחיתוך. ארגז שמקיים את זה מוכן לייצור ואינו
   * נושא אזהרה, וארגז שאינו מקיים אותו נושא אותה גם אחרי שינוי שם.
   */
  const promised = promisedByGlyph(u);
  if (promised && !capsProvide(unitCaps(u), promised)) {
    return `${CAPABILITY_LABELS[promised]}: המבנה אינו מפנה ${gapDetail(promised)}.`;
  }
  return null;
}

/**
 * אי־התאמה בין השם לבין מה שנבנה.
 *
 * זו שאלה אחרת מהאזהרה שלמעלה, ולכן היא נפרדת ממנה. "ארון כיור
 * מגירות" שהוא שלוש מגירות ואין בו חלל לקערה אינו ארון כיור, ומי
 * שרואה את השם ברשימה מצפה לאחד. כאן השם *כן* חלק מהשאלה, ולכן
 * כאן שינוי שם *כן* מתקן — וזה נכון: מי ששינה את השם ל"ארון
 * מגירות" תיאר נכון את מה שיש לו.
 *
 * מה שאינו משתנה בשינוי שם הוא `productionGap`: שם אינו בונה
 * נישה ואינו הורס אותה.
 */
export function nameMismatch(u: CapSource): string | null {
  if (!u.name) return null;
  if (glyphDef(u.glyph).standalone) return null;
  const promised = promisedRole(u.name);
  if (!promised) return null;
  if (promisedByGlyph(u) === promised.cap) return null;
  if (capsProvide(unitCaps(u), promised.cap)) return null;
  return `השם מבטיח ${promised.label}, והמבנה מתאר משהו אחר.`;
}

/** מה בדיוק חסר, במידות — כדי שאפשר יהיה לתקן ולא רק לדעת. */
function gapDetail(cap: Capability): string {
  if (cap === 'sink' || cap === 'hob') {
    const cut = CUTOUTS[cap];
    return `משטח וחלל פנוי מתחתיו לחיתוך ${cut.widthMm}×${cut.depthMm} מ״מ`;
  }
  const std = APPLIANCES[cap as ApplianceType];
  if (!std) return 'את מה שנדרש';
  return std.niches
    .map((n) => `נישה ${n.widthMm}×${n.heightMm}×${n.depthMm} מ״מ`)
    .join(' ו-');
}
