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
import { KITCHEN, MATERIAL } from './standards';
import { blindWidthMm, MIN_ZONE_MM, unitZones } from './zones';
import type { Zone } from '../db/types';

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
    /*
     * זו האזהרה היחידה שאין ממנה כפתור, וזה נכון: אין מידות תקן
     * לגוף L כי אין גוף כזה. מה שיש הוא שני גופים מלבניים —
     * וזה מה שנאמר כאן, כדי שהאזהרה תהיה הוראה ולא מבוי סתום.
     */
    return (
      'הפינה מצוירת כ-L והגוף נחתך כתיבה מלבנית. ' +
      'בנה אותה כשני ארגזים — רגל לאורך הקיר ורגל שחוזרת ניצב לה.'
    );
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

/**
 * מה לשנות בארגז כדי שהוא באמת יספק את מה שהוא מבטיח.
 *
 * אזהרה שאי אפשר לפעול לפיה היא באג. במסך יצירת ארגז זה היה
 * המצב: מי שבחר את איור הכיור קיבל מיד "המבנה אינו מפנה משטח
 * וחלל פנוי", ובטופס לא היה אף פקד שמסיר את זה; מי שהקליד
 * "ארון תנור" קיבל "השם מבטיח נישת תנור", ונישה אי אפשר היה
 * לבנות שם בכלל.
 *
 * כאן נגזר התיקון מאותן מידות תקן שמהן נגזרת האזהרה, ולכן הוא
 * מסיר אותה בהגדרה ולא במקרה. מה שהוא מחזיר הוא טלאי על המפרט,
 * לא כתיבה למסד: מי שקרא לו מחליט אם להחיל אותו.
 *
 * הוא אינו מוחק את הארגז שנבנה: לכיור מתפנה התא העליון בלבד, ולנישת
 * מכשיר נבנית פריסה שהשארית שלה יורדת למטה כמגירה. הוא כן מגדיל את
 * הארגז כשהמידה אינה מספיקה:
 * מקרר בגובה 1772 אינו נכנס לארגז תחתון, וארגז שמתיימר להכיל
 * אותו הוא מידה שגויה במסור.
 */
export function fitCapability(u: CapSource, cap: Capability): Partial<CapSource> | null {
  if (glyphDef(u.glyph).standalone) return null;

  /*
   * כיור וכיריים אינם נישה אלא חיתוך: משטח, ומתחתיו חלל שהקערה
   * או גוף הכיריים יורדים אליו. לכן מה שחסר הוא המשטח, והתא
   * העליון — ולא גובה אחר.
   */
  if (cap === 'sink' || cap === 'hob') {
    const counterMm = (u.counterMm ?? 0) > 0 ? u.counterMm! : KITCHEN.counterH;
    if (capsProvide(unitCaps({ ...u, counterMm }), cap)) return { counterMm };
    /*
     * רק התא העליון מתפנה, והשאר נשאר.
     *
     * הקערה יורדת מתחת למשטח, ולכן מה שחוסם אותה הוא התא שמתחתיו
     * בלבד. ארון כיור מגירות הוא ארון אמיתי — EC-003 הוא בדיוק
     * זה — ולמחוק את המגירות שלו בדרך למשטח היה מוחק את הארגז
     * שהמשתמש בנה.
     *
     * הפריסה נקראת דרך `unitZones` ולא מ-`u.zones` ישירות, כי
     * מסך היצירה מתאר ארגז בשדות שטוחים: שלוש מגירות שם אינן
     * אזור, והקריאה הישירה הייתה מוחקת אותן בלי לראות אותן.
     */
    const body = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
    const current = unitZones({
      glyph: u.glyph,
      heightMm: u.heightMm,
      socleMm: u.socleMm,
      zones: u.zones,
      doors: u.doors,
      drawers: u.drawers,
      drawerCols: u.drawerCols,
      shelves: u.shelves,
      shelfGapsMm: u.shelfGapsMm,
    } as never);
    return { counterMm, ...bowlOver(current, body) };
  }

  const std = APPLIANCES[cap as ApplianceType];
  if (!std) return null;

  /* הנישות עצמן: גובה התא הוא הנישה ועוד הלוח שמפריד אותה מהבא */
  const niches: Zone[] = std.niches.map((n, i) => ({
    id: `niche${i}`,
    heightMm: n.heightMm + MATERIAL.carcassMm,
    kind: 'empty' as const,
    fixedHeight: true,
  }));
  const need = niches.reduce((sum, z) => sum + z.heightMm, 0);

  const socleMm = u.socleMm ?? 0;
  /* ארגז שאינו גבוה מספיק גדל; ארגז גבוה יותר שומר על גובהו */
  const heightMm = Math.max(u.heightMm, need + socleMm + MIN_ZONE_MM);
  const spare = heightMm - socleMm - need;

  /*
   * גם לרוחב ולעומק, ומאותו חשבון שבו נמדד החלל.
   *
   * החלל הנקי צר מהארגז בשתי דפנות, ורדוד ממנו בגב — ולכן ארגז
   * ברוחב הנישה אינו מכיל אותה. מדיח בנישה של 600 מ״מ הוא הדוגמה
   * החדה: ארגז 600 מפנה 564, והמדיח אינו נכנס. בלי זה התיקון היה
   * מציע מבנה שהאזהרה שלו נשארת.
   */
  const clear = std.niches.reduce(
    (m, n) => ({ w: Math.max(m.w, n.widthMm), d: Math.max(m.d, n.depthMm) }),
    { w: 0, d: 0 },
  );
  const backMm = u.backKind === 'none' ? 0 : MATERIAL.backMm;
  const widthMm = Math.max(
    u.widthMm,
    clear.w + 2 * MATERIAL.carcassMm + blindWidthMm({ ...u, widthMm: u.widthMm }),
  );
  const depthMm = Math.max(u.depthMm, clear.d + backMm);

  /*
   * השארית יורדת מתחת לנישות, כי מכשיר נכנס בגובה עבודה ולא
   * ברצפה. רצועה שיש בה מקום למגירה היא מגירה; צרה מזה — תא.
   */
  const filler: Zone[] =
    spare >= MIN_ZONE_MM
      ? [{
          id: 'filler',
          heightMm: spare,
          ...(spare >= DRAWER_BAND_MM
            ? { kind: 'drawers' as const, drawers: 1, drawerStyle: 'outer' as const }
            : { kind: 'empty' as const }),
        }]
      : [];

  const zones = [...filler, ...niches];
  return {
    widthMm,
    heightMm,
    depthMm,
    applianceType: cap as ApplianceType,
    zones,
    /*
     * גם מספר שורות המגירות, כדי שהמספר בטופס יתאר את מה שנבנה.
     * בלעדיו הטופס הראה שלוש והמבנה הכיל אחת, והשמירה הבאה הייתה
     * כותבת את השלוש אל תוך הרצועה שמתחת לנישה.
     */
    drawers: drawerRowsIn(zones),
  };
}

/** כמה שורות מגירות יש בפריסה שנבנתה. */
function drawerRowsIn(zones: Zone[]): number {
  return zones.reduce((n, z) => n + (z.kind === 'drawers' ? z.drawers ?? 0 : 0), 0);
}

/** רצועה שאין בה גובה למגירה אמיתית נשארת תא ריק. */
const DRAWER_BAND_MM = 180;

/**
 * חלל לקערה מתחת למשטח, בלי למחוק את הארגז שמתחתיו.
 *
 * התא העליון הוא מה שחוסם את הקערה, והוא שמתפנה. כשהוא תא יחיד
 * שיש בו תוכן — שלוש מגירות שהוקלדו בטופס הן בדיוק זה — הוא אינו
 * מתרוקן אלא *נחתך*: רצועת הקערה יורדת מגובהו, והשאר נשאר מה
 * שהיה. רק כשלא נשאר מספיק לתא אמיתי מתחת, הגוף כולו מתפנה.
 */
function bowlOver(zones: Zone[], bodyMm: number): { zones: Zone[]; drawers: number } {
  const all = (out: Zone[]) => ({ zones: out, drawers: drawerRowsIn(out) });
  const open = [{ id: 'main', heightMm: bodyMm, kind: 'empty' as const }];
  if (!zones.length) return all(open);

  const top = zones[zones.length - 1];
  const rest = zones.slice(0, -1);
  if (top.kind === 'empty') return all(zones);

  /* התא העליון מתחלק: מה שנשאר ממנו, ורצועת הקערה מעליו */
  const left = top.heightMm - BOWL_MM;
  if (left < MIN_ZONE_MM) {
    /* אין מקום לשניים — אבל אם יש אזורים אחרים, רק העליון מתפנה */
    return all(rest.length ? [...rest, { ...top, kind: 'empty' as const }] : open);
  }
  return all([
    ...rest,
    { ...top, heightMm: left },
    { id: 'bowl', heightMm: BOWL_MM, kind: 'empty' as const },
  ]);
}

/** הגובה שקערה תקנית תופסת מתחת למשטח — כמו ב-EC-003. */
const BOWL_MM = 250;
