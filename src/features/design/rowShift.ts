import { glyphDef } from '../../catalog/glyphList';
import { featureDef } from '../projects/wallFeatures';
import { blocked } from './collision';
import { unitBox } from './placement';
import { alongWallMm } from '../../db/types';
import type { PlanWall } from './plan';
import type { PlacedUnit } from '../../db/types';

/**
 * שורה שנותנת מקום.
 *
 * ארגז שעומד בין שני שכנים לא זז. כל מקום שהאצבע לקחה אותו אליו
 * היה תפוס, ההנחה נדחתה, והארגז נשאר — ובקיר מלא, שזה רוב
 * הקירות, אי אפשר היה להזיז דבר. הבדיקה הזאת נכונה פיזיקלית
 * ושגויה בשולחן: נגר שמזיז ארון בשורה דוחף את מה שלידו, הוא
 * אינו מרים אותו באוויר ומחפש חור.
 *
 * כאן נשאלת השאלה השנייה: אם הארגז יעמוד שם, לאן צריכים לזוז
 * השכנים כדי שכולם עדיין יעמדו בשורה. התשובה היא רשימת הזזות,
 * או `null` כשאין — שורה שנדחפת אל מעבר לקצה הקיר אינה שורה.
 *
 * מה שאין כאן במכוון הוא בדיקת ההתנגשות. כאן נבנית הצעה לאורך
 * הקיר בלבד; מי שקורא מאמת אותה ב-`blocked`, כי דחיפה עלולה
 * להכניס שכן לתוך חלון, לתוך עמוד, או לתוך ארגז שעומד במפלס
 * אחר — וזה אותו חוק שחל על הארגז שביד.
 */

/** ארגז שהשורה הזיזה, והמקום החדש שלו לאורך הקיר. */
export interface Shift {
  id: string;
  xMm: number;
}

/** מה שהשורה מאפשרת: המקום שהארגז שביד באמת מגיע אליו, ומי זז בשבילו. */
export interface Row {
  xMm: number;
  shifts: Shift[];
}

/**
 * מי נדחף כשהארגז הזה עומד כאן, ולאן.
 *
 * כיוון הנסיעה נגזר מהבקשה עצמה ואינו נמסר: הוא הצד שאליו
 * הארגז הולך, ולכן הוא תמיד סימן ההפרש בין המקום שביקשו למקום
 * שהיה. קריאה שמסרה כיוון סותר בנתה שרשרת אל הצד שאיש לא נסע
 * אליו, ודחפה שכן שלא היה בדרך.
 *
 * שורה שאין לה לאן להידחף אינה נפסלת אלא נעצרת: `xMm` שחוזר הוא
 * המקום הרחוק ביותר שבו כולם עדיין על הקיר, ולא בהכרח זה שהאצבע
 * ביקשה. זו אותה תנועה שהנגר עושה בשטח — דוחף עד שנוגע — ובלעדיה
 * גרירה ארוכה מדי לא עשתה כלום במקום לעשות את מה שאפשר.
 */
export function shiftRow(input: {
  /** הארגז שביד */
  unit: PlacedUnit;
  /** המקום שהוא מבקש לאורך הקיר */
  xMm: number;
  /** הארגזים האחרים על אותו קיר */
  mates: PlacedUnit[];
  wallLengthMm: number;
}): Row | null {
  const { unit, mates, wallLengthMm } = input;
  /* אי אינו נמדד מהקיר, ולכן אין לו שורה */
  if (unit.free) return null;
  /* ארגז שאינו זז לשום כיוון אינו דוחף איש */
  if (input.xMm === unit.xMm) return null;
  const dir: 1 | -1 = input.xMm > unit.xMm ? 1 : -1;

  const row = mates
    .filter((o) => o.id !== unit.id && pushable(o) && o.level === unit.level)
    .sort((a, b) => (a.xMm - b.xMm) * dir);

  const width = alongWallMm(unit);
  let xMm = input.xMm;

  /*
   * הרשימה נבנית מחדש אחרי כל קיצוץ: ארגז שנעצר מוקדם יותר דוחף
   * פחות שכנים, והרוחב שצריך להתפנה קטן איתו. השרשרת מתקצרת בכל
   * סיבוב, ולכן הלולאה נעצרת.
   */
  for (let round = 0; round <= row.length; round++) {
    const chain = chainFrom(row, xMm, width, dir);
    const need = chain.reduce((sum, o) => sum + alongWallMm(o), 0);
    /* הקצה הרחוק ביותר שבו הארגז שביד וכל מי שאחריו עוד נכנסים */
    const limit = dir > 0 ? wallLengthMm - width - need : need;
    const capped = dir > 0 ? Math.min(xMm, limit) : Math.max(xMm, limit);
    if (capped === xMm) {
      /* השורה שנדחקה אל מעבר לקצה אינה שורה, גם אחרי הקיצוץ */
      if (xMm < 0 || xMm + width > wallLengthMm) return null;
      let frontier = dir > 0 ? xMm + width : xMm;
      const shifts: Shift[] = [];
      for (const other of chain) {
        const w = alongWallMm(other);
        const to = dir > 0 ? frontier : frontier - w;
        if (to < 0 || to + w > wallLengthMm) return null;
        shifts.push({ id: other.id, xMm: Math.round(to) });
        frontier = dir > 0 ? to + w : to;
      }
      return { xMm: Math.round(xMm), shifts };
    }
    xMm = capped;
  }
  return null;
}

/** מי חייב לזוז כשהארגז שביד עומד ב-`xMm`, בסדר הנסיעה. */
function chainFrom(
  row: PlacedUnit[],
  xMm: number,
  width: number,
  dir: 1 | -1,
): PlacedUnit[] {
  let frontier = dir > 0 ? xMm + width : xMm;
  const out: PlacedUnit[] = [];
  for (const other of row) {
    const w = alongWallMm(other);
    const p = other.xMm;
    /* מי שנמצא כולו מאחורי הארגז שביד אינו חלק מהשרשרת */
    if (dir > 0 ? p + w <= xMm : p >= xMm + width) continue;
    /*
     * ומי שכבר פנוי מהקצה עוצר אותה. הרשימה ממוינת לכיוון הנסיעה,
     * ולכן מי שאחריו רחוק עוד יותר — ואין טעם להמשיך.
     */
    if (dir > 0 ? p >= frontier : p + w <= frontier) break;
    out.push(other);
    frontier = dir > 0 ? frontier + w : frontier - w;
  }
  return out;
}

/**
 * ארגז שהשורה רשאית לדחוף.
 *
 * חיפוי אינו גוף. ארגז פינתי מעוגן לקצה הקיר — הוא נבנה בדיוק
 * למקום הזה, ודחיפה שלו ממנו הופכת אותו לארגז שאי אפשר להרכיב.
 * ואי אינו על הקיר בכלל.
 */
function pushable(u: PlacedUnit): boolean {
  if (u.free) return false;
  if (u.corner) return false;
  return !glyphDef(u.glyph).cladding;
}

/**
 * הזזת השורה, אחרי שהיא אומתה מול חוקי החדר.
 *
 * `shiftRow` יודעת לאורך הקיר בלבד. דחיפה עלולה להכניס שכן אל
 * תוך חלון, אל תוך עמוד, או אל תוך ארגז שעומד במפלס אחר — ולכן
 * כל מי שזז נבדק כאן באותה `blocked` שחלה על הארגז שביד. שורה
 * שמישהו בה אינו יכול לעמוד במקומו החדש אינה נדחפת בכלל.
 *
 * `null` = השורה אינה פותרת את החסימה, ומי שקרא נשאר עם התשובה
 * שהייתה לו. רשימה ריקה אינה תשובה: אם איש לא צריך לזוז, מה
 * שחסם אינו השורה.
 */
export function rowGivesWay(input: {
  unit: PlacedUnit;
  xMm: number;
  yMm: number;
  mates: PlacedUnit[];
  all: PlacedUnit[];
  plan: PlanWall[];
  wallLengthMm: number;
}): Row | null {
  const { unit, yMm, mates, all, plan, wallLengthMm } = input;
  const row = shiftRow({ unit, xMm: input.xMm, mates, wallLengthMm });
  if (!row?.shifts.length) return null;

  const moved = new Map(row.shifts.map((s) => [s.id, s.xMm]));
  const me = { ...unit, xMm: row.xMm, yMm };
  const world = all.map((u) => {
    if (u.id === unit.id) return me;
    const to = moved.get(u.id);
    return to === undefined ? u : { ...u, xMm: to };
  });

  for (const u of world) {
    if (u.id !== unit.id && !moved.has(u.id)) continue;
    const box = unitBox(u, plan);
    if (!box) return null;
    if (blocked(u, box, world.filter((o) => o.id !== u.id), plan)) return null;
  }
  return row;
}

/** איפה הארגז באמת נחת, ומי זז בשבילו. */
export interface Landing {
  xMm: number;
  yMm: number;
  shifts: Shift[];
}

/**
 * לאן ארגז נוחת על קיר — התשובה היחידה, לשני המסכים.
 *
 * ציור החזית והתלת־ממד שאלו את זה כל אחד בקוד משלו, והתשובות
 * נפרדו: ההחלקה עד המגע נוספה לתלת־ממד ולא לחזית, ולכן אותה
 * גרירה בדיוק הצליחה במסך אחד ולא בשני. מה שמחושב בשני מקומות
 * מתחיל להיות שני דברים שונים, ולכן הוא מחושב כאן.
 *
 * הסדר הוא הסדר של מי שמזיז ארון בשטח:
 *
 *   1. המקום שביקשו, אם הוא פנוי.
 *   2. אחרת — דוחפים את השורה. זה מה שנגר עושה בקיר מלא.
 *   3. ואם גם היא אינה זזה — מחליקים עד הדופן הקרובה, של שכן
 *      או של פתח, כלומר עד המקום הקרוב ביותר שבו הארגז באמת
 *      נכנס.
 *   4. ורק אז נשארים.
 *
 * והכול בתוך הקיר שנמסר: `wallLengthMm` הוא גבול ולא קישוט.
 *
 * ההחלקה אחרי הדחיפה ולא לפניה: "להישאר במקום" הוא תמיד מועמד
 * חוקי בהחלקה — הדופן של השכן היא בדיוק המקום שממנו יצאנו —
 * ולכן החלקה ראשונה הייתה בולעת כל דחיפה.
 */
export function landOnWall(input: {
  /** הארגז כפי שהיה בתחילת המחווה */
  unit: PlacedUnit;
  /** הקיר שאליו הוא הולך — לא בהכרח זה שממנו יצא */
  wallId: string;
  wallLengthMm: number;
  /** המקום שביקשו, אחרי הצמדה */
  xMm: number;
  yMm: number;
  mates: PlacedUnit[];
  all: PlacedUnit[];
  plan: PlanWall[];
  /** ציר נעול: אין בו דחיפה ואין בו החלקה — יעד תפוס מחזיר למקום */
  locked?: boolean;
}): Landing {
  const { unit, wallId, wallLengthMm, xMm, yMm, mates, all, plan, locked } = input;
  const others = all.filter((u) => u.id !== unit.id);
  const none: Shift[] = [];

  /*
   * ארגז שכבר חופף במקום שהוא עומד בו הוא היוצא מן הכלל: חסימה
   * שם הייתה נועלת אותו שם לתמיד, ודווקא ממנו צריך לצאת.
   */
  const hereBox = unitBox(unit, plan);
  const stuck = !!hereBox && blocked(unit, hereBox, others, plan);
  const ok = (px: number, py: number): boolean => {
    const probe = { ...unit, wallId, xMm: px, yMm: py };
    const b = unitBox(probe, plan);
    return !!b && (stuck || !blocked(probe, b, others, plan));
  };

  /*
   * הקיר שמקבל את הארגז הוא גם הגבול שלו.
   *
   * `wallLengthMm` נמסר ולא נקרא: המקום שביקשו הוחזר כפי שהוא,
   * ולכן ארגז ברוחב 800 שביקשו לו 3,500 בקיר של 4,000 נחת עם
   * 300 מ"מ באוויר. שני המסכים חתכו את המידה בעצמם לפני הקריאה,
   * וזו בדיוק הכפילות שהפונקציה הזאת באה לבטל.
   */
  const reachMm = Math.max(wallLengthMm - alongWallMm(unit), 0);
  const want = Math.round(Math.min(Math.max(xMm, 0), reachMm));

  if (ok(want, yMm)) return { xMm: want, yMm, shifts: none };
  if (locked) return { xMm: unit.xMm, yMm: unit.yMm, shifts: none };

  if (!stuck && want !== unit.xMm) {
    const row = rowGivesWay({
      unit: { ...unit, wallId },
      xMm: want,
      yMm,
      mates,
      all,
      plan,
      wallLengthMm,
    });
    if (row) return { xMm: row.xMm, yMm, shifts: row.shifts };
  }

  /*
   * ארגז שנתקל בשכן נעצר עליו, ולא נשאר במקום.
   *
   * המידה שנבחרת היא הקרובה ביותר שבה הוא באמת נכנס: זו בדיוק
   * הדופן של השכן, וזו גם התנועה שעושים בשטח — דוחפים עד שנוגע.
   */
  const stops = [want];
  for (const other of mates) {
    if (other.id === unit.id || other.level !== unit.level) continue;
    stops.push(other.xMm + alongWallMm(other), other.xMm - alongWallMm(unit));
  }
  /*
   * ודלת היא דופן.
   *
   * ההחלקה עצרה על ארגז שכן בלבד, ולכן ארגז שנגרר אל פתח לא זז
   * כלל: המקום שביקשו היה תפוס, לא היה את מי לדחוף, ולא היה שום
   * יעד קרוב שהוא באמת נכנס בו. בשטח דוחפים עד המשקוף ומשאירים
   * שם — ולכן גם שפות הפתחים והעמודים הן יעד.
   */
  for (const f of plan.find((q) => q.wall.id === wallId)?.wall.features ?? []) {
    if (!featureDef(f.kind).blocks) continue;
    stops.push(f.xMm - alongWallMm(unit), f.xMm + f.widthMm);
  }
  const near = stops
    .map((v) => Math.round(Math.min(Math.max(v, 0), reachMm)))
    .sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
  const slid = near.find((v) => ok(v, yMm)) ?? near.find((v) => ok(v, unit.yMm));

  if (slid !== undefined && ok(slid, yMm)) return { xMm: slid, yMm, shifts: none };
  if (slid !== undefined) return { xMm: slid, yMm: unit.yMm, shifts: none };
  if (ok(unit.xMm, yMm)) return { xMm: unit.xMm, yMm, shifts: none };
  return { xMm: unit.xMm, yMm: unit.yMm, shifts: none };
}
