import { glyphDef } from './glyphList';
import { APPLIANCES, type ApplianceType } from './appliances';
import { capsProvide, unitCaps, type Capability, type CapSource } from './capabilities';
import { KITCHEN, MATERIAL } from './standards';
import { blindWidthMm, MIN_ZONE_MM, unitZones } from './zones';
import type { Zone } from '../db/types';

/**
 * התאמת ארגז למידות התקן של מה שנכנס אליו.
 *
 * כאן ישבו גם אזהרות הייצור — "חסר מידע לייצור", "השם מבטיח
 * נישת תנור" — והן ירדו לבקשת הבעלים. מה שנשאר הוא הצד המועיל
 * שלהן: החשבון שיודע לבנות נישה, משטח או חלל לקערה במידות תקן,
 * בלי להטיף למי שלא ביקש.
 *
 * מידות המכשירים עצמן אינן "נתוני יצרן" אלא תקן, והן יושבות
 * ב-`appliances.ts`. צנרת ואוורור אינן כאן במפורש: הן אינן מידה
 * של הארגז ואינן נחתכות מפלטה.
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
  /*
   * מכשיר עומד אינו נכנס לארון, ולכן אין בארגז מה להתאים לו.
   *
   * בלי זה נבנתה כאן "נישה" מרשימה ריקה: הארגז קיבל רצועת מגירה
   * אחת ותו לא, והיכולת שביקשו להתאים אותו אליה נשארה כבויה —
   * תיקון שמציע מבנה שאינו עונה על מה שנלחץ.
   */
  if (std.freestanding) return null;

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
