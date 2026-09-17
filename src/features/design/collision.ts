import { glyphDef } from '../../catalog/glyphList';
import { featureBiteMm, featureDef, featureOverlaps } from '../projects/wallFeatures';
import { boxCorners, featureBox, frontOverhangMm, solidBox } from './placement';
import { unitCaps } from '../../catalog/capabilities';
import type { UnitBox } from './placement';
import type { PlacedUnit } from '../../db/types';
import type { PlanWall } from './plan';

/**
 * מה מותר לשני ארגזים לעשות זה לזה.
 *
 * הבדיקה הישנה עבדה על מלבן חזית: כל חפיפה ברוחב ובגובה נחסמה, גם
 * כשהארגזים עמדו בעומקים שונים ולא נגעו זה בזה כלל. היא גם לא ידעה
 * לאפשר את מה שנגר עושה כל יום — להניח ארגז על ארגז, להצמיד שניים,
 * או להכניס מכשיר לתוך עמודה.
 *
 * החוק כאן הוא פיזיקלי, ולכן הוא אחד:
 *
 *   • נגיעה מותרת. שני ארגזים שחולקים פאה — זו הצמדה, וזה מה
 *     שההצמדה נועדה לעשות.
 *   • הכנסה לתא מארח מותרת. מכשיר שנכנס לנישה שהארון פינה לו הוא
 *     בדיוק מה שהארון נבנה בשבילו.
 *   • כל חפיפה אחרת אסורה. שתי תיבות שנכנסות זו לזו פירושן שדופן
 *     עוברת באמצע תחתית — זה לא נבנה, ולכן זה גם לא מצויר.
 *
 * וזה מה שהשתנה כאן. ההיתר הישן היה "כל תיבה צרה יותר שיושבת
 * כולה בפנים", בלי קשר הרכבה ובלי גבול לבליטה קדימה — ולכן שני
 * ארגזים סגורים בגובה 2,000, אחד ברוחב 1,000 ועומק 600 והשני
 * ברוחב 800 ועומק 2,000, עברו בלי התנגשות אף ששניהם גופים מלאים
 * שחופפים. עכשיו ההיתר דורש תא מארח מוגדר: חלל פנוי שהארון
 * באמת מפנה, במקום שהוא מפנה אותו ובמידות שלו.
 */

/** סובלנות במ"מ: מגע והצמדה אינם חדירה */
const TOUCH = 2;

/** תיבה תלת־ממדית בצירים של עצמה, לבדיקת הכלה */
interface Span {
  lo: number;
  hi: number;
}

/**
 * האם הנחת הארגז כאן פוגעת בארגז אחר.
 *
 * `at` הוא המיקום הנבדק, שאינו בהכרח המיקום השמור — כך אפשר לשאול
 * "אם אניח אותו כאן" בלי לכתוב אותו קודם.
 */
export function blocked(
  unit: PlacedUnit,
  at: UnitBox,
  others: PlacedUnit[],
  plan: PlanWall[],
): boolean {
  if (glyphDef(unit.glyph).cladding) return false;
  if (hitsFeature(unit, at, plan)) return true;
  /* הגוף כולל את החזית הסגורה שבולטת ממנו */
  const mine = grow(unit, at);
  for (const o of others) {
    if (o.id === unit.id || glyphDef(o.glyph).cladding) continue;
    const ob = solidBox(o, plan);
    if (ob && unitsClash({ unit, box: mine }, { unit: o, box: ob })) return true;
  }
  return false;
}

/** הוספת עובי החזית לתיבה שכבר חושבה — לגרירה, שמחשבת מיקום נבדק. */
function grow(u: PlacedUnit, b: UnitBox): UnitBox {
  const front = frontOverhangMm(u);
  if (front <= 0) return b;
  const f = { x: Math.cos(b.facing), z: Math.sin(b.facing) };
  return { ...b, d: b.d + front, cx: b.cx + f.x * (front / 2), cz: b.cz + f.z * (front / 2) };
}

/** ארגז עם התיבה הפיזית שלו, כדי לשאול על השניים יחד. */
export interface Solid {
  unit: PlacedUnit;
  box: UnitBox;
}

/**
 * האם שני הארגזים האלה אינם יכולים לעמוד יחד.
 *
 * שאלה אחת, ולכן תשובה אחת: הגרירה, מבט העל ושער התכנון קוראים
 * לה ואינם יכולים לחלוק.
 */
export function unitsClash(a: Solid, b: Solid): boolean {
  if (!meet(a.box, b.box)) return false;
  /* חפיפה שהיא הכנסה לתא מארח מוגדר אינה התנגשות */
  return !insertedIn(b, a) && !insertedIn(a, b);
}

/**
 * כמה מותר למכשיר לבלוט מפני הנישה שלו.
 *
 * חזית תנור יושבת על פני הארון ובולטת ממנו כעובי חזית ועוד ידית.
 * מה שבולט יותר מזה אינו מכשיר בנישה אלא ארגז שנדחף לתוך ארגז.
 */
const PROTRUDE_MM = 60;

/**
 * האם `inner` נכנס לתא מארח שהארון `outer` באמת מפנה.
 *
 * שלושה תנאים, וכולם על הארון המארח: יש לו חלל פנוי, החלל הזה
 * נמצא בגובה שבו היחידה הפנימית יושבת, והיא נכנסת בו לרוחב
 * ולעומק. גוף ארון מלא אינו מארח דבר, ולכן ארגז רגיל שנדחף
 * לתוך ארגז רגיל נחסם — וזה נכון.
 */
function insertedIn(inner: Solid, outer: Solid): boolean {
  const caps = unitCaps(outer.unit);
  if (!caps.cavities.length) return false;

  /* מידות היחידה הפנימית בצירים של המארחת */
  const f = { x: Math.cos(outer.box.facing), z: Math.sin(outer.box.facing) };
  const side = { x: Math.sin(outer.box.facing), z: -Math.cos(outer.box.facing) };
  const along = spanOn(inner.box, outer.box, side);
  const depth = spanOn(inner.box, outer.box, f);
  const halfW = outer.box.w / 2;
  const halfD = outer.box.d / 2;
  /* הגב חייב להיות בתוך הנישה; מה שבולט קדימה מוגבל */
  if (depth.lo < -halfD - TOUCH) return false;
  if (depth.hi > halfD + PROTRUDE_MM) return false;
  if (along.lo < -halfW - TOUCH || along.hi > halfW + TOUCH) return false;

  const width = along.hi - along.lo;
  const into = depth.hi - depth.lo;
  /* תחתית הגוף של המארח — החללים נמדדים ממנה */
  const base = outer.unit.yMm + (outer.unit.socleMm ?? 0);
  return caps.cavities.some((c) => {
    if (c.widthMm + TOUCH < width) return false;
    if (c.depthMm + PROTRUDE_MM < into) return false;
    /* והגובה: היחידה יושבת בתוך החלל, ולא חוצה אותו */
    const lo = base + c.fromMm;
    return inner.box.y >= lo - TOUCH && inner.box.y + inner.box.h <= lo + c.heightMm + TOUCH;
  });
}

/**
 * האם הארגז עומד על סימון שאי אפשר לבנות לתוכו.
 *
 * דלת וחלון הם פתח, ועמוד הוא בטון. עד היום ההנחה הצליחה והנגר
 * קיבל אזהרה אחריה — אבל אזהרה על מה שממילא לא ייבנה היא רעש:
 * הארגז פשוט לא נכנס לשם, ולכן הוא נעצר כמו מול ארגז אחר.
 *
 * שני מבחנים, כי אלה שתי שאלות שונות. על הקיר של הארגז עצמו די
 * בחפיפת מלבנים: שניהם נמדדים באותה מערכת. עמוד שבולט אל החדר הוא
 * גוף בחלל, והוא חוסם גם ארגז שעומד על הקיר השכן — עמוד בפינת
 * מטבח הוא בדיוק המקרה — ולכן שם נשאלת אותה שאלה שנשאלת על שני
 * ארגזים.
 *
 * שקע ונקודת מים אינם חוסמים: הם נקדחים בגב הארון, וארגז שעומד
 * עליהם הוא הדבר הרגיל ולא התקלה.
 */
function hitsFeature(unit: PlacedUnit, at: UnitBox, plan: PlanWall[]): boolean {
  for (const p of plan) {
    const own = !unit.free && p.wall.id === unit.wallId;
    for (const f of p.wall.features) {
      if (!featureDef(f.kind).blocks) continue;
      if (own) {
        if (featureOverlaps(unit, f)) return true;
        continue;
      }
      /*
       * הסימון נבדק כגוף בחלל, בלי היתר ההכלה.
       *
       * עמוד שנכנס כולו לתוך ארגז חופשי נחשב עד כאן "מוכל", כמו
       * תנור בתוך עמודה — ולכן הוא לא חסם. בטון אינו מכשיר: ארגז
       * שבלע עמוד אינו ניתן לבנייה דווקא משום שהוא בלע אותו.
       *
       * ופתח אינו בולט לחדר, ולכן לא היה לו גוף כלל: אי שעמד
       * מול חלון לא נחסם. הפתח מקבל נפח גישה דק מפני הקיר
       * פנימה — מי שעומד בו חוסם אותו, בין אם הוא תלוי על הקיר
       * ובין אם הוא עומד ברצפה מולו.
       */
      const depth = featureBlockMm(f);
      if (depth > 0 && boxesMeet(at, featureBox(f, p, depth))) return true;
    }
  }
  return false;
}

/**
 * כמה עומק יש לסימון כשבודקים אותו מול ארגז שאינו על הקיר שלו.
 *
 * עמוד ומדרגה בולטים, ולכן העומק הוא שלהם. פתח — חלון או דלת —
 * אינו בולט, אבל גם אינו מקום שאפשר להעמיד בו: הרצועה הדקה
 * שלפניו היא מה שחייב להישאר פנוי. זו אינה בדיקת מרחב פתיחת
 * דלת; זו רק "לא לעמוד בפתח".
 */
const OPENING_CLEAR_MM = 100;

function featureBlockMm(f: Parameters<typeof featureBiteMm>[0]): number {
  const bite = featureBiteMm(f);
  return bite > 0 ? bite : bite < 0 ? 0 : OPENING_CLEAR_MM;
}

/** חפיפה פיזית בין שני גופים, בשמה המוכר למי שקורא לה על מעטפת. */
export function boxesMeet(a: UnitBox, b: UnitBox): boolean {
  return meet(a, b);
}

/**
 * האם שתי תיבות נפגשות בפועל — בלי שאלת ההרכבה.
 *
 * זו השאלה הפיזית בלבד, והיא זהה ל-`boxesMeet`. מי ששואל על שני
 * ארגזים שואל את `unitsClash`, שמכיר גם את הנישות שלהם.
 */
export function clash(a: UnitBox, b: UnitBox): boolean {
  return meet(a, b);
}

/** מפגש בשלושת הצירים: גובה, ואז רצפה מסובבת. */
function meet(a: UnitBox, b: UnitBox): boolean {
  if (a.y + a.h <= b.y + TOUCH || b.y + b.h <= a.y + TOUCH) return false;
  return floorsMeet(a, b);
}

/**
 * חפיפה בין שתי רצפות מסובבות, בשיטת הצירים המפרידים.
 * מגע קצה בקצה אינו חפיפה — זו הצמדה.
 */
function floorsMeet(a: UnitBox, b: UnitBox): boolean {
  const pa = boxCorners(a);
  const pb = boxCorners(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (len < 1e-6) continue;
      const n = { x: -(p2.y - p1.y) / len, y: (p2.x - p1.x) / len };
      const [minA, maxA] = project(pa, n);
      const [minB, maxB] = project(pb, n);
      if (maxA <= minB + TOUCH || maxB <= minA + TOUCH) return false;
    }
  }
  return true;
}

/** הטווח שהתיבה הפנימית תופסת על ציר של החיצונית, ביחס למרכזו. */
function spanOn(inner: UnitBox, outer: UnitBox, axis: { x: number; z: number }): Span {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of boxCorners(inner)) {
    const v = (c.x - outer.cx) * axis.x + (c.y - outer.cz) * axis.z;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return { lo, hi };
}

function project(poly: { x: number; y: number }[], n: { x: number; y: number }): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = p.x * n.x + p.y * n.y;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return [min, max];
}
