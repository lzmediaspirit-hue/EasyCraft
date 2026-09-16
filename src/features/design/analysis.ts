import { alongWallMm, bodyHeightMm, intoRoomMm } from '../../db/types';
import type { PlacedUnit, Wall } from '../../db/types';
import { featureBiteMm, featureDef, featureOverlaps } from '../projects/wallFeatures';
import { MAX_BODY_MM, blindSide, blindWidthMm } from '../../catalog/zones';
import { BLIND_CORNER } from '../../catalog/kitchenRules';
import { glyphDef } from '../../catalog/glyphList';
import { cm } from '../../ui/units';
import { envelopeClashes, envelopeOwnerLabel, roomEnvelopes } from './envelope';
import type { Envelope } from './envelope';
import type { PlanWall } from './plan';

/**
 * התראה אחת, ומי היא מדברת עליו.
 *
 * התראה בלי ארגז היא טקסט שצריך לחפש לפיו על הקיר. `unitIds` הוא
 * מה שהופך אותה לכפתור: לוחצים, והארגז שיש בו הבעיה נבחר.
 */
export interface WallWarning {
  text: string;
  unitIds: string[];
  /**
   * כמה זה חמור.
   *
   * רשימה שטוחה נקראת כאילו הכול שווה: ארגז שחורג מהקיר וארגז
   * שגבוה מדי להרמה הופיעו זה לצד זה באותו צהוב. `block` הוא מה
   * שלא ייבנה, `warn` הוא מה שייבנה אבל יעבוד רע, ו-`info` הוא
   * נתון חסר — אין בעיה, פשוט אין עדיין תשובה.
   */
  level: WarnLevel;
  /** סימוני קיר שהאזהרה מדברת עליהם — דלת, חלון */
  featureIds?: string[];
}

/** חומרת האזהרה. */
export type WarnLevel = 'block' | 'warn' | 'info';

/** מהחמור לקל — לסידור הרשימה ולבחירת צבע האייקון. */
export const WARN_ORDER: WarnLevel[] = ['block', 'warn', 'info'];

/** החמור מבין כמה אזהרות, או ריק כשאין אף אחת. */
export function worstLevel(warnings: WallWarning[]): WarnLevel | null {
  for (const level of WARN_ORDER) if (warnings.some((w) => w.level === level)) return level;
  return null;
}

export interface WallAnalysis {
  /** אורך תפוס על הרצפה (תחתונים ועמודות) */
  floorUsedMm: number;
  /** אורך תפוס במפלס העליון */
  wallUsedMm: number;
  freeMm: number;
  warnings: WallWarning[];
}

/**
 * בדיקות שהנגר היה עושה בראש: חריגה מהקיר, ארגזים שנוגעים זה בזה,
 * ושקעים או נקודות מים שנעלמים מאחורי ארגז.
 */
export function analyzeWall(
  wall: Wall,
  units: PlacedUnit[],
  /** ארונות שחודרים בפועל לתוך ארון אחר בחדר */
  clashing: { id: string; name: string }[] = [],
  /** הארגזים של הקירות השכנים, אחד לכל קצה */
  neighbours?: { start: PlacedUnit[]; end: PlacedUnit[] },
): WallAnalysis {
  /*
   * אי אינו על הקיר, ולכן הוא אינו נמדד בחשבונות שלו: הוא לא תופס
   * מטר רץ, לא חורג מקצהו ולא חופף לשכניו עליו. הוא כן נספר
   * בארגזים ובשטח החזיתות — הוא חלק מהעבודה.
   */
  const onWall = units.filter((u) => !u.free);
  const floor = onWall.filter((u) => u.level !== 'wall');
  const upper = onWall.filter((u) => u.level === 'wall');

  const floorUsedMm = floor.reduce((sum, u) => sum + alongWallMm(u), 0);
  const wallUsedMm = upper.reduce((sum, u) => sum + alongWallMm(u), 0);
  const warnings: WallWarning[] = [];
  /** מי חורג בפועל מקצה הקיר — אליו מצביעה ההתראה */
  const past = (group: PlacedUnit[]) =>
    group.filter((u) => u.xMm + alongWallMm(u) > wall.lengthMm + 1);

  /*
   * החריגה נמדדת לפי המקום של הארגז ולא לפי סכום הרוחבים.
   *
   * ארגז שעומד בקצה קיר שקוצר יוצא ממנו החוצה גם כשסכום הרוחבים
   * עדיין נכנס, ואז לא הייתה שום התראה — הקיר נראה תקין על המסך
   * והבעיה התגלתה בהתקנה. מה שמעניין הוא איפה נגמר הארגז האחרון.
   */
  const overflow = (group: PlacedUnit[], label: string) => {
    const over = past(group);
    if (!over.length) return;
    const end = Math.max(...over.map((u) => u.xMm + alongWallMm(u)));
    warnings.push({
      text: `${label} חורגים מהקיר ב-${cm(end - wall.lengthMm)} ס"מ`,
      unitIds: over.map((u) => u.id),
      level: 'block',
    });
  };
  overflow(floor, 'התחתונים');
  overflow(upper, 'העליונים');

  /*
   * הקצה השני של אותה שאלה.
   *
   * חריגה נבדקה רק בסוף הקיר, ולכן ארגז שהתחיל ב-מינוס 50 לא
   * הוציא מילה: הוא יצא מהחדר בצד שאיש לא הסתכל בו. וגבול
   * הגובה לא נבדק כלל — ארגז שראשו מעל התקרה עבר בשקט.
   */
  const before = onWall.filter((u) => u.xMm < -1);
  if (before.length) {
    const out = Math.max(...before.map((u) => -u.xMm));
    warnings.push({
      text: `יוצאים מתחילת הקיר ב-${cm(out)} ס"מ`,
      unitIds: before.map((u) => u.id),
      level: 'block',
    });
  }

  const tall = onWall.filter((u) => u.yMm + u.heightMm > wall.heightMm + 1);
  if (tall.length) {
    const over = Math.max(...tall.map((u) => u.yMm + u.heightMm - wall.heightMm));
    warnings.push({
      text: `עוברים את גובה הקיר ב-${cm(over)} ס"מ`,
      unitIds: tall.map((u) => u.id),
      level: 'block',
    });
  }

  const sunk = onWall.filter((u) => u.yMm < -1);
  if (sunk.length) {
    warnings.push({
      text: `יורדים מתחת לרצפה ב-${cm(Math.max(...sunk.map((u) => -u.yMm)))} ס"מ`,
      unitIds: sunk.map((u) => u.id),
      level: 'block',
    });
  }

  for (const f of wall.features) {
    const label = featureDef(f.kind).label;

    // שקע או נקודת מים שנבלעים לגמרי מאחורי ארגז
    if (f.kind === 'socket' || f.kind === 'water') {
      const covered = onWall.find((u) => contains(u, f));
      if (covered)
        warnings.push({
          text: `${label} מוסתר מאחורי ארגז`,
          unitIds: [covered.id],
          featureIds: [f.id],
          level: 'warn',
        });
      continue;
    }

    const blocking = onWall.find((u) => featureOverlaps(u, f));
    if (!blocking) continue;

    /*
     * עמוד ומדרגה הם ההפך מחלון: לא הארגז חוסם אותם, אלא הם
     * גונבים ממנו עומק. הנגר שקורא "הארגז חוסם את העמוד" מחפש מה
     * הוא עשה לא בסדר; מה שהוא צריך לדעת הוא כמה סנטימטרים ייעלמו
     * לו מהגוף אם הארגז יישאר שם.
     */
    const bite = featureBiteMm(f);
    if (bite > 0) {
      warnings.push({
        text: `ה${label} בולט ${cm(bite)} ס"מ אל תוך ${blocking.name}`,
        unitIds: [blocking.id],
        featureIds: [f.id],
        level: 'warn',
      });
      continue;
    }

    // חלון, דלת או נישה שארגז נכנס לתוכם — גם חפיפה חלקית היא בעיה
    warnings.push({
      text: `${blocking.name} חוסם את ה${label}`,
      unitIds: [blocking.id],
      featureIds: [f.id],
      level: 'block',
    });
  }

  // ארון גבוה מדי — קשה להרים, להוביל ולהתקין
  for (const u of units) {
    const bodyH = bodyHeightMm(u);
    if (bodyH > MAX_BODY_MM) {
      warnings.push({
        text: `${u.name} בגובה ${cm(bodyH)} ס"מ — מעל ${cm(MAX_BODY_MM)} עדיף לפצל`,
        unitIds: [u.id],
        level: 'warn',
      });
    }
  }

  /*
   * פינה מתה שלא תיפתח בשטח.
   *
   * מה שחוסם את הדלת אינו הארגז שנוגע בפינה אלא עומק השורה על
   * הקיר הניצב: הדלת נפתחת אל תוך החדר, ובדיוק שם עומדת השורה
   * ההיא. מעליו נכנס גם לוח הסתימה — אחרת הדלת של הארון הזה
   * והמגירה של הניצב לו נפגשות באוויר. פינה שנמדדה בלי שני אלה
   * נראית נכון על המסך, והנגר מגלה אותה רק כשהוא מנסה לפתוח.
   */
  if (neighbours) {
    for (const u of onWall) {
      const side = blindSide(u);
      if (!side) continue;
      const isUpper = u.level === 'wall';
      const taken = (side === 'blindStart' ? neighbours.start : neighbours.end)
        .filter((n) => !n.free && (n.level === 'wall') === isUpper)
        .reduce((max, n) => Math.max(max, intoRoomMm(n)), 0);
      if (!taken) continue;
      const need = taken + BLIND_CORNER.fillerMm;
      if (blindWidthMm(u) + 1 < need) {
        warnings.push({
          text: `${u.name}: הפינה המתה ${cm(blindWidthMm(u))} ס"מ, וצריך ${cm(need)} כדי שהדלת תיפתח`,
          unitIds: [u.id],
          level: 'warn',
        });
      }
    }
  }

  /*
   * חדירה אמיתית, ולא "נכנס לאזור שסומן".
   * הפינה פתוחה לכל ארגז, הנחה זה על זה מותרת, וארגז שנכנס כולו
   * לתוך אחר הוא מכשיר בעמודה. מה שאסור הוא שדופן תעבור באמצע
   * תחתית — וזה נמדד על התיבות עצמן, במרחב החדר.
   */
  for (const c of clashing) {
    warnings.push({ text: `${c.name} חודר לתוך ארון אחר`, unitIds: [c.id], level: 'block' });
  }

  return { floorUsedMm, wallUsedMm, freeMm: wall.lengthMm - floorUsedMm, warnings };
}

function contains(u: PlacedUnit, f: Wall['features'][number]): boolean {
  return (
    u.xMm <= f.xMm &&
    u.xMm + alongWallMm(u) >= f.xMm + f.widthMm &&
    u.yMm <= f.yMm &&
    u.yMm + u.heightMm >= f.yMm + f.heightMm
  );
}

/** המיקום הפנוי הבא במפלס מסוים — כדי שארגז חדש יינחת צמוד לשורה. */
export function nextFreeX(units: PlacedUnit[], level: PlacedUnit['level']): number {
  const sameLine = units.filter((u) => (level === 'wall' ? u.level === 'wall' : u.level !== 'wall'));
  return sameLine.reduce((end, u) => Math.max(end, u.xMm + alongWallMm(u)), 0);
}

/**
 * הרווח שהארגז יושב בתוכו, בציר נתון: איפה הוא מתחיל וכמה הוא גדול.
 *
 * זו התשובה ל"קיר בגובה 3 מטר, ארגז של 240 — כמה נשאר למעלה":
 * הארגז שמונח מעליו נכנס בדיוק לרווח שנשאר, 60, בלי לחסר בראש.
 * מוחזר גם ההתחלה ולא רק הגודל, כי השלמה שמותירה את הארגז במקום
 * שאליו נגרר בערך היא חצי עבודה — הוא נכנס לרווח ומתיישב עליו.
 *
 * מי שנמצא מעל ומי שמתחת נקבע לפי מרכז הארגז, ולא לפי קצותיו: כך
 * גם ארגז שנגרר וחופף מעט לשכנו יודע לאיזה רווח הוא מכוון.
 */
export function fillSpan(
  unit: PlacedUnit,
  units: PlacedUnit[],
  wall: { lengthMm: number; heightMm: number },
  axis: 'w' | 'h',
): { startMm: number; sizeMm: number } {
  const others = units.filter((u) => u.id !== unit.id && !glyphDef(u.glyph).cladding);

  if (axis === 'h') {
    // רק מי שחולק איתו רוחב יכול לחסום אותו לגובה
    const same = others.filter(
      (u) => u.xMm < unit.xMm + alongWallMm(unit) && u.xMm + alongWallMm(u) > unit.xMm,
    );
    const mid = unit.yMm + unit.heightMm / 2;
    const start = same
      .filter((u) => u.yMm + u.heightMm <= mid)
      .reduce((n, u) => Math.max(n, u.yMm + u.heightMm), 0);
    const end = same
      .filter((u) => u.yMm >= mid)
      .reduce((n, u) => Math.min(n, u.yMm), wall.heightMm);
    return { startMm: start, sizeMm: Math.max(end - start, 0) };
  }

  // ברוחב חוסמים רק שכנים באותו מפלס, כמו בהצמדה
  const same = others.filter((u) => (u.level === 'wall') === (unit.level === 'wall'));
  const mid = unit.xMm + alongWallMm(unit) / 2;
  const start = same
    .filter((u) => u.xMm + alongWallMm(u) <= mid)
    .reduce((n, u) => Math.max(n, u.xMm + alongWallMm(u)), 0);
  const end = same
    .filter((u) => u.xMm >= mid)
    .reduce((n, u) => Math.min(n, u.xMm), wall.lengthMm);
  return { startMm: start, sizeMm: Math.max(end - start, 0) };
}

/*
 * אזהרות הפתיחה — מה שלא ייפתח בשטח.
 *
 * הן נבנות על החדר כולו ולא על קיר אחד: דלת החדר יושבת בקיר אחד
 * והארון שחוסם אותה עומד על השני, וקיר בודד לעולם לא היה רואה את
 * זה. לכן זו פונקציה נפרדת, והמסך מצרף את שתי הרשימות.
 *
 * ולכל אזהרה כאן יש שני עצמים: מה שנפתח ומה שעומד בדרך. הנגר
 * צריך לראות את שניהם על הציור, לא רק את אחד מהם.
 */
export function openingWarnings(units: PlacedUnit[], plan: PlanWall[]): WallWarning[] {
  const envelopes = roomEnvelopes(units, plan);
  const featureIds = new Set(plan.flatMap((p) => p.wall.features.map((f) => f.id)));
  const out: WallWarning[] = [];

  /** מזהי הבעלים כשהם ארגז — סימון קיר אינו ארגז ואינו נבחר כך */
  const ownerUnits = (e: Envelope) => (featureIds.has(e.ownerId) ? [] : [e.ownerId]);
  const ownerFeatures = (e: Envelope) => (featureIds.has(e.ownerId) ? [e.ownerId] : []);

  for (const c of envelopeClashes(envelopes, units, plan)) {
    out.push({
      text: `${envelopeOwnerLabel(c.envelope)} לא תיפתח — ${c.blockerName} עומד בדרך`,
      unitIds: [...ownerUnits(c.envelope), c.blockerId],
      featureIds: ownerFeatures(c.envelope),
      level: 'warn',
    });
  }

  /*
   * ומה שאין עליו נתון. זו אינה תקלה אלא שאלה פתוחה, ולכן היא
   * `info`: הבדיקה לא נכשלה — היא לא יכלה לרוץ.
   */
  for (const e of envelopes) {
    if (!e.missing) continue;
    out.push({
      text: `${envelopeOwnerLabel(e)}: חסר ${e.missing}`,
      unitIds: ownerUnits(e),
      featureIds: ownerFeatures(e),
      level: 'info',
    });
  }

  return out;
}
