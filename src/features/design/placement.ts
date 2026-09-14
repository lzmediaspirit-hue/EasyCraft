import { alongWallMm, intoRoomMm } from '../../db/types';
import type { PlacedUnit, WallFeature } from '../../db/types';
import type { PlanWall } from './plan';

/**
 * איפה הארגז עומד בחדר, ולאן הוא פונה.
 *
 * זו התשובה היחידה לשאלה הזאת. עד היום כל מבט חישב אותה מחדש: מבט
 * העל בנה ארבע פינות מהקיר ומהנורמל, התלת־ממד בנה מסגרת בארבעה
 * מקרים לפי הסיבוב, ובדיקת ההתנגשות עבדה על מלבן חזית שלא ידע על
 * עומק בכלל. שלושתם ענו על אותה שאלה בשלוש שפות, ולכן הם יכלו לא
 * להסכים — וזה בדיוק מה שקרה.
 *
 * הארגז עצמו תמיד נמדד באותה צורה: `w` לרוחב הדלת, `d` מהגב אל
 * החזית, `h` מהתחתית מעלה. מה שמשתנה הוא איפה הריבוע הזה מונח
 * ברצפת החדר ולאן הוא מסובב.
 */
export interface UnitBox {
  /** מרכז הארגז ברצפת החדר */
  cx: number;
  cz: number;
  /** רוחב הארגז — לרוחב החזית */
  w: number;
  /** עומק הארגז — מהגב אל החזית */
  d: number;
  /** תחתית הארגז מהרצפה, וגובהו */
  y: number;
  h: number;
  /** לאן פונה החזית, ברדיאנים, ביחס לציר האופקי של החדר */
  facing: number;
}

/**
 * לאן פונה החזית של ארגז שעומד על קיר.
 *
 * קיר שכיוונו `heading` מפנה את הארגזים שעליו אל תוך החדר, כלומר
 * תשעים מעלות ממנו. הסיבוב של הארגז מתווסף לזה, ולכן ארבעת המצבים
 * הם חשבון אחד ולא ארבעה מקרים.
 */
function wallFacingDeg(headingDeg: number, rotationDeg = 0): number {
  return headingDeg + 90 + rotationDeg;
}

/** התיבה של ארגז אחד. `plan` דרוש רק לארגז שעומד על קיר. */
export function unitBox(u: PlacedUnit, plan: PlanWall[]): UnitBox | null {
  const common = { w: u.widthMm, d: u.depthMm, y: u.yMm, h: u.heightMm };

  /* אי: המיקום נמדד ברצפת החדר עצמה, ואין לו קיר להיתלות עליו */
  if (u.free) {
    return { ...common, cx: u.free.xMm, cz: u.free.zMm, facing: rad(u.free.headingDeg) };
  }

  const p = plan.find((q) => q.wall.id === u.wallId);
  if (!p) return null;
  const a = rad(p.headingDeg);
  const dir = { x: Math.cos(a), z: Math.sin(a) };
  const normal = { x: -Math.sin(a), z: Math.cos(a) };
  /* מה שהארגז תופס על הקיר, ומה שהוא נכנס לחדר — תלוי בסיבוב */
  const along = alongWallMm(u);
  const into = intoRoomMm(u);
  return {
    ...common,
    cx: p.start.x + dir.x * (u.xMm + along / 2) + normal.x * (into / 2),
    cz: p.start.y + dir.z * (u.xMm + along / 2) + normal.z * (into / 2),
    facing: rad(wallFacingDeg(p.headingDeg, u.rotationDeg)),
  };
}

/**
 * המקום שסימון על הקיר תופס בחדר.
 *
 * עמוד ומדרגה אינם ציור על הקיר אלא גוף שעומד בחלל, ולכן הם נמדדים
 * באותה מערכת שבה נמדד ארגז — ואפשר לשאול עליהם את אותה שאלה.
 * סימון שטוח, כמו חלון או שקע, אינו תופס עומק ולכן אינו כאן.
 */
export function featureBox(f: WallFeature, p: PlanWall, biteMm: number): UnitBox {
  const a = rad(p.headingDeg);
  const dir = { x: Math.cos(a), z: Math.sin(a) };
  const normal = { x: -Math.sin(a), z: Math.cos(a) };
  return {
    w: f.widthMm,
    d: biteMm,
    y: f.yMm,
    h: f.heightMm,
    cx: p.start.x + dir.x * (f.xMm + f.widthMm / 2) + normal.x * (biteMm / 2),
    cz: p.start.y + dir.z * (f.xMm + f.widthMm / 2) + normal.z * (biteMm / 2),
    facing: rad(wallFacingDeg(p.headingDeg)),
  };
}

/**
 * המרה מהמידות של הארגז עצמו אל רצפת החדר.
 *
 * `lx` רץ לרוחב החזית מ-0 עד `w`, ו-`lz` מהגב אל החזית מ-0 עד `d`.
 * זו מסגרת מסתובבת ולא משוקפת: ציר הרוחב הוא ציר החזית מסובב ברבע
 * שעון, וכך ארגז מסובב נשאר אותו ארגז — לא תמונת ראי שלו.
 */
export function unitFrame(b: UnitBox): (lx: number, lz: number) => [number, number] {
  const f = { x: Math.cos(b.facing), z: Math.sin(b.facing) };
  const side = { x: Math.sin(b.facing), z: -Math.cos(b.facing) };
  const ox = b.cx - side.x * (b.w / 2) - f.x * (b.d / 2);
  const oz = b.cz - side.z * (b.w / 2) - f.z * (b.d / 2);
  return (lx, lz) => [ox + side.x * lx + f.x * lz, oz + side.z * lx + f.z * lz];
}

/** ארבע פינות הרצפה של הארגז, לפי הסדר. */
export function boxCorners(b: UnitBox): { x: number; y: number }[] {
  const at = unitFrame(b);
  return [
    [0, 0],
    [b.w, 0],
    [b.w, b.d],
    [0, b.d],
  ].map(([lx, lz]) => {
    const [x, y] = at(lx, lz);
    return { x, y };
  });
}

/**
 * הצל של הארגז על קיר מסוים: איפה הוא נופל על ציר הקיר, וכמה הוא
 * רחוק ממנו.
 *
 * אי אינו עומד על שום קיר, אבל בציור החזית הוא עדיין צריך להיראות
 * — אחרת הוא נעלם ממי שעובד בחזית. הצל הוא המקום ההגיוני היחיד
 * לצייר אותו, והמרחק הוא מה שאומר שהוא לא באמת שם.
 */
export function wallShadow(b: UnitBox, p: PlanWall): { xMm: number; widthMm: number; awayMm: number } {
  const a = rad(p.headingDeg);
  const dir = { x: Math.cos(a), z: Math.sin(a) };
  const normal = { x: -Math.sin(a), z: Math.cos(a) };
  let lo = Infinity;
  let hi = -Infinity;
  let near = Infinity;
  for (const c of boxCorners(b)) {
    const rx = c.x - p.start.x;
    const rz = c.y - p.start.y;
    const along = rx * dir.x + rz * dir.z;
    lo = Math.min(lo, along);
    hi = Math.max(hi, along);
    near = Math.min(near, rx * normal.x + rz * normal.z);
  }
  return { xMm: lo, widthMm: hi - lo, awayMm: near };
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}
