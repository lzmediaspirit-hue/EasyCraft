import { alongWallMm, physicalHeightMm } from '../../db/types';
import { boxCorners } from './placement';
import type { UnitBox } from './placement';
import type { PlanWall } from './plan';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * גבול החדר: מה שבתוכו נבנה, ומה שמחוצה לו לא.
 *
 * עד כאן בדיקת ההנחה ידעה על שני דברים בלבד — ארגז אחר, וסימון על
 * הקיר. היא לא ידעה על החדר עצמו. בחדר מלבני זה לא נראה: הגבלת
 * המידה לאורך הקיר הספיקה כמעט תמיד. בחדר משורטט — משולש, טרפז,
 * צורה קעורה — "בתוך אורך הקיר" אינו "בתוך החדר": ארגז ברוחב 800
 * שהונח ב-3,200 על קיר של 4,000 עומד בגבולות הקיר בדיוק, ופינתו
 * הקדמית יושבת מטר מעבר לקיר המשופע שסוגר את החדר. הוא נשמר, צויר
 * והוצע בתכנון אוטומטי, כי איש לא נשאל.
 *
 * שרשרת פתוחה — קיר אחד, פינה, צורת ח — אינה מגדירה פנים וחוץ,
 * ולכן היא אינה מגבילה דבר. זו הבחנה מכוונת: נגר ששרטט שני קירות
 * מתאר את מה שהוא בונה עליו, ולא חדר סגור.
 */

/** סובלנות במ״מ: ארגז שנשען על הקיר יושב על הגבול, ולא מחוצה לו */
const EDGE_MM = 3;

/**
 * כמה רחוק מותר לסוף שרשרת הקירות ליפול מתחילתה ועדיין להיקרא חדר
 * סגור.
 *
 * מ״מ אחד היה הסף, והוא נכשל על חדר משורטט: זוויות שנשמרות
 * במעלות שלמות מחזירות משולש 4/2.5/2.5 מטר לנקודה שרחוקה כשבעה
 * מ״מ מזו שיצא ממנה. סנטימטר אינו מבלבל בין חדר סגור לשרשרת
 * פתוחה, ובכל זאת אינו פוסל סגירה שהמשתמש התכוון אליה.
 */
const CLOSE_MM = 10;

/** שרשרת הקירות חוזרת לנקודת ההתחלה — כלומר יש לה פנים וחוץ. */
export function planCloses(plan: PlanWall[]): boolean {
  if (plan.length < 3) return false;
  const a = plan[0].start;
  const b = plan[plan.length - 1].end;
  return Math.hypot(b.x - a.x, b.y - a.y) <= CLOSE_MM;
}

/** מצולע רצפת החדר, או `null` כששרשרת הקירות אינה סוגרת חדר. */
export function roomPolygon(plan: PlanWall[]): { x: number; y: number }[] | null {
  return planCloses(plan) ? plan.map((p) => p.start) : null;
}

/**
 * האם הגוף הזה חורג מהחדר.
 *
 * שתי שאלות, ושתיהן נחוצות. הפינות — כי גוף שפינתו בחוץ יצא. וגם
 * הצלעות — כי בחדר קעור אפשר שכל ארבע הפינות בפנים והגוף בכל זאת
 * חוצה קיר שנכנס פנימה. פינות לבדן הן מבחן חלקי, ובחדר קעור הוא
 * פשוט לא נכון.
 */
export function boxOutside(box: UnitBox, plan: PlanWall[]): boolean {
  const poly = roomPolygon(plan);
  if (!poly) return false;
  const corners = boxCorners(box);
  for (const c of corners) if (!insideOrOn(c, poly)) return true;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j];
      const q = poly[(j + 1) % poly.length];
      if (crosses(a, b, p, q)) return true;
    }
  }
  return false;
}

type Pt = { x: number; y: number };

/** נקודה בתוך המצולע, או על הגבול שלו בכדי סובלנות. */
function insideOrOn(pt: Pt, poly: Pt[]): boolean {
  if (nearEdge(pt, poly)) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y) {
      const at = a.x + ((pt.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (pt.x < at) inside = !inside;
    }
  }
  return inside;
}

/** המרחק מהנקודה אל הקו הסגור קטן מהסובלנות — כלומר היא נשענת עליו. */
function nearEdge(pt: Pt, poly: Pt[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (distToSeg(pt, poly[i], poly[(i + 1) % poly.length]) <= EDGE_MM) return true;
  }
  return false;
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

/**
 * חיתוך של ממש בין שני קטעים.
 *
 * "של ממש" הוא כל העניין: הגב של כל ארגז שעומד על קיר שוכב בדיוק
 * על הקיר, ומגע או קו משותף אינם חציית קיר. לכן הצד נמדד במרחק
 * מ״מ ולא בסימן המכפלה — מה שקרוב לקו נחשב עליו, ורק מה שבאמת
 * עובר מצד לצד נספר.
 */
function crosses(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const s1 = side(a1, a2, b1);
  const s2 = side(a1, a2, b2);
  const s3 = side(b1, b2, a1);
  const s4 = side(b1, b2, a2);
  return s1 !== 0 && s1 === -s2 && s3 !== 0 && s3 === -s4;
}

/** באיזה צד של הקו נמצאת הנקודה, כשקרוב לקו נחשב עליו. */
function side(p: Pt, q: Pt, r: Pt): number {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  if (len < 1e-6) return 0;
  const away = ((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / len;
  return Math.abs(away) <= EDGE_MM ? 0 : Math.sign(away);
}

/**
 * חריגה מהקיר שהארגז עומד עליו, בשמה — או `null` כשהכול בגבולות.
 *
 * הגרירה תמיד קיצצה את המידה לאורך הקיר, ולכן היא לא יכלה לחרוג.
 * העריכה המספרית לא: ארגז 600 שעמד ב-300 על קיר של 900 נגמר בדיוק
 * בקצה, ובחירת "רוחב 100 ס״מ" שמרה אותו כ-1,000 — 400 מ״מ אל מעבר
 * לקיר, בלי שגיאה ובלי סימן. שער הבנייה שואל אם אפשר *לחתוך* את
 * הארגז; הוא אינו שואל אם יש לו מקום.
 */
export function outOfWall(u: PlacedUnit, walls: Wall[]): string | null {
  /* אי אינו עומד על קיר, ולכן גבולותיו הם המצולע ולא אורך הקיר */
  if (u.free) return null;
  const wall = walls.find((w) => w.id === u.wallId);
  if (!wall) return null;
  if (u.xMm < -EDGE_MM) return 'במידה הזאת הארגז מתחיל לפני תחילת הקיר';
  const along = alongWallMm(u);
  if (u.xMm + along > wall.lengthMm + EDGE_MM) {
    return `במידה הזאת הארגז חורג מקצה הקיר — ${Math.round(u.xMm + along)} מ״מ מתוך ${wall.lengthMm}`;
  }
  if (u.yMm < -EDGE_MM) return 'במידה הזאת הארגז יורד מתחת לרצפה';
  /* הגובה כולל את משטח העבודה: הוא מה שנוגע בתקרה */
  if (u.yMm + physicalHeightMm(u) > wall.heightMm + EDGE_MM) {
    return `במידה הזאת הארגז חורג מגובה החדר — ${Math.round(u.yMm + physicalHeightMm(u))} מ״מ מתוך ${wall.heightMm}`;
  }
  return null;
}
