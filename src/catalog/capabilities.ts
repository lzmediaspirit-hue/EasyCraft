import { MATERIAL } from './standards';
import { glyphDef } from './glyphList';
import { blindWidthMm, unitZones, zoneBands, zoneCells } from './zones';
import { applianceOf, nicheFits, CUTOUTS, APPLIANCES, type ApplianceType, type Niche } from './appliances';
import type { PlacedUnit, Zone } from '../db/types';

/**
 * מה הארגז באמת יודע להחזיק — לפי מה שנבנה בו, לא לפי שמו.
 *
 * עד כאן התפקיד נקבע מהאיור ומהשם: שינוי שם של ארגז דלתות ל״כיור״
 * הפך אותו לארגז כיור, ואייקון תנור לבדו סיפק גם תנור וגם מיקרוגל.
 * זה הפוך מהדרך שהנגרייה עובדת בה — הבעלים בונה ארגז בעורך
 * הדו־ממדי, והתכנון צריך להבין את מה שנבנה.
 *
 * לכן היכולת נגזרת כאן מהמבנה: החללים הפנויים שהארגז מפנה, המשטח
 * שאפשר לחתוך בו, המוט, המדפים והמגירות. שם ואייקון יכולים להציע
 * ערך בעורך, אבל הם אינם מוכיחים דבר.
 *
 * מה שאין כאן במכוון: צנרת ואוורור. הם אינם נגזרים מהמבנה ואינם
 * נחתכים מפלטה, ולכן הם אינם תנאי ליכולת ואינם חוסמים ייצור.
 */

/** חלל פנוי בתוך הארגז, במידות נקיות. */
export interface Cavity extends Niche {
  /** גובה תחתית החלל מתחתית הגוף */
  fromMm: number;
}

/** מה שהארגז מספק בפועל. */
export interface UnitCaps {
  /** החללים הפנויים, מהגדול לקטן */
  cavities: Cavity[];
  /** אפשר לחתוך במשטח שמעליו, ויש חלל מתחת לחיתוך */
  worktop: boolean;
  /** הפתח שאפשר לחתוך במשטח — רוחב ועומק החלל שמתחתיו */
  cutWidthMm: number;
  cutDepthMm: number;
  rods: number;
  shelves: number;
  drawers: number;
}

/** מה שצריך לדעת על ארגז כדי לגזור ממנו יכולת. */
export type CapSource = Pick<PlacedUnit, 'glyph' | 'widthMm' | 'heightMm' | 'depthMm'> &
  Partial<Pick<PlacedUnit, 'zones' | 'doors' | 'drawers' | 'drawerCols' | 'shelves' |
    'socleMm' | 'counterMm' | 'corner' | 'blindMm' | 'backKind' | 'shelfGapsMm' |
    'applianceType' | 'level' | 'name'>>;

/**
 * החלל הנקי של תא אחד.
 *
 * הרוחב הוא מה שנשאר בין הדפנות ואחרי פינה מתה, והעומק הוא מה
 * שנשאר לפני הגב. הגובה הוא גובה התא פחות לוח אחד — המדף או
 * התחתית שמפרידים אותו מהתא הבא.
 */
function cavityOf(u: CapSource, zone: Zone, fromMm: number, share: number): Cavity {
  const inner = Math.max(u.widthMm - 2 * MATERIAL.carcassMm - blindWidthMm({ ...u }), 0);
  const back = u.backKind === 'none' ? 0 : MATERIAL.backMm;
  return {
    fromMm,
    widthMm: Math.max(inner * share - (share < 1 ? MATERIAL.carcassMm : 0), 0),
    heightMm: Math.max(zone.heightMm - MATERIAL.carcassMm, 0),
    depthMm: Math.max(u.depthMm - back, 0),
  };
}

/**
 * מה שהארגז מפנה ומה שהוא מחזיק.
 *
 * הפונקציה טהורה ונגזרת מהמפרט עצמו, ולכן אותה תשובה מגיעה לתכנון
 * האוטומטי, לאזהרות הייצור ולכרטיס בספרייה — אי אפשר שאחד מהם
 * יחשוב אחרת.
 */
export function unitCaps(u: CapSource): UnitCaps {
  const def = glyphDef(u.glyph);
  const empty: UnitCaps = {
    cavities: [], worktop: false, cutWidthMm: 0, cutDepthMm: 0, rods: 0, shelves: 0, drawers: 0,
  };
  /* מכשיר שנקנה שלם ולוח בודד אינם גוף ארון, ואין בהם חלל לבנות בו */
  if (def.standalone || def.noCarcass) return empty;

  const body = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  const zones = unitZones({
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

  const out: UnitCaps = { ...empty, cavities: [] };
  for (const { zone, top, bottom } of zoneBands(zones, body)) {
    /* הגבהים בציור נמדדים מלמעלה; החלל נמדד מתחתית הגוף */
    const fromMm = body - bottom;
    const cells = zoneCells(zone);
    for (const cell of cells) {
      const c = cell.content;
      if (c.kind === 'rod') out.rods += 1;
      if (c.kind === 'shelves') out.shelves += c.shelves ?? 0;
      if (c.kind === 'drawers') out.drawers += c.drawers ?? 0;
      /*
       * חלל פנוי הוא נישה בכוח: תא שאין בו מדף, מוט או מגירה הוא
       * המקום שמכשיר נכנס אליו. תא עם מדף אינו נישה — המדף בדרך.
       */
      if (c.kind === 'empty') {
        out.cavities.push(
          cavityOf(u, { ...zone, heightMm: bottom - top }, fromMm, cell.share),
        );
      }
    }
  }
  out.cavities.sort((a, b) => b.heightMm * b.widthMm - a.heightMm * a.widthMm);

  /*
   * חיתוך במשטח דורש שני דברים: משטח שיושב על הארגז, וחלל מתחתיו
   * שהכיור או הכיריים נכנסים אליו. ארגז מגירות מלא אינו ארגז כיור
   * גם כשקוראים לו כך — אין לאן להכניס את הקערה.
   */
  const counter = (u.counterMm ?? 0) > 0;
  const topCavity = out.cavities.find((c) => c.fromMm + c.heightMm >= body - MATERIAL.carcassMm - 1);
  out.worktop = counter && !!topCavity;
  out.cutWidthMm = topCavity ? topCavity.widthMm : 0;
  out.cutDepthMm = topCavity ? topCavity.depthMm : 0;
  return out;
}

/** התפקידים שהמבנה מספק. */
export type Capability =
  | ApplianceType
  | 'sink'
  | 'rod'
  | 'shelf'
  | 'drawer';

export const CAPABILITY_LABELS: Record<Capability, string> = {
  sink: 'ארגז כיור',
  hob: 'ארגז כיריים',
  oven: 'נישת תנור',
  micro: 'נישת מיקרוגל',
  ovenMicro: 'נישת תנור ומיקרוגל',
  fridge: 'נישת מקרר',
  dishwasher: 'נישת מדיח',
  hood: 'ארון קולט אדים',
  rod: 'מוט תלייה',
  shelf: 'מדפים',
  drawer: 'מגירות',
};

/**
 * האם המבנה מספק את התפקיד.
 *
 * תפקיד משולב דורש שתי נישות נפרדות, ולא חלל אחד גדול: תנור
 * ומיקרוגל בחלל אחד הם מכשיר אחד שנשען על השני.
 */
export function capsProvide(caps: UnitCaps, role: Capability): boolean {
  if (role === 'rod') return caps.rods > 0;
  if (role === 'shelf') return caps.shelves > 0;
  if (role === 'drawer') return caps.drawers > 0;
  if (role === 'sink' || role === 'hob') {
    /*
     * הקערה נופלת דרך הפתח אל תוך הארון, ולכן החלל שמתחת למשטח
     * הוא מה שקובע. השוליים נמדדים על המשטח עצמו, והוא רחב
     * מהארון ובולט מעליו — ולכן הם אינם תנאי על הגוף.
     */
    const cut = CUTOUTS[role];
    return caps.worktop && caps.cutWidthMm >= cut.widthMm && caps.cutDepthMm >= cut.depthMm;
  }
  const std = APPLIANCES[role];
  if (!std) return false;
  /* כל נישה נתפסת פעם אחת: שתי דרישות אינן מתמלאות באותו חלל */
  const left = [...caps.cavities];
  for (const need of std.niches) {
    const i = left.findIndex((c) => nicheFits(c, need));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

/** האם הארגז הזה, כפי שנבנה, ממלא את התפקיד. */
export function unitProvides(u: CapSource, role: Capability): boolean {
  return capsProvide(unitCaps(u), role);
}

/**
 * התפקיד שהמכשיר שבאיור מבטיח — כדי שאפשר יהיה לבדוק אותו מול
 * המבנה. מכשיר עצמאי אינו מבטיח נישה: הוא עצמו המכשיר.
 */
export function promisedByGlyph(u: CapSource): Capability | undefined {
  const def = glyphDef(u.glyph);
  if (def.standalone) return undefined;
  if (u.glyph === 'sink') return 'sink';
  const std = applianceOf(u);
  return std?.type;
}
