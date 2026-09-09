import { shade } from '../../ui/color';
import type { PlanWall } from './plan';

/**
 * הגיאומטריה של המבט התלת־ממדי.
 *
 * ההיטל, המסגרת של ארגז, התיבה, ורצפת החדר — כל מה שמחשב "איפה
 * זה על המסך" בלי לדעת דבר על React, על מגע או על SVG.
 *
 * זה יצא מרכיב הציור כי אלה שתי עבודות שונות: מי שמתקן זווית מבט
 * או סיבוב של ארגז לא צריך לעבור דרך מטפלי אצבע ולוחות מגירה, ומי
 * שמתקן כפתור לא צריך לקרוא מתמטיקה.
 */

export const COS30 = Math.cos(Math.PI / 6);

/**
 * עובי הקיר בהדמיה, ועומק החדר כשיש קיר אחד בלבד.
 *
 * שתי המידות האלה הן תצוגה ותו לא: הן לא נכנסות לשום חישוב, לא
 * לחומרים ולא לניסור. חדר בלי עובי קיר נראה כמו מישור מרחף, וקיר
 * בודד בלי עומק נראה כמו קיר בלי חדר — ולכן יש להן ערך קבוע, ולא
 * שדה שמישהו צריך למלא.
 */
export const WALL_MM = 100;
const LONE_ROOM_MM = 1800;

/** זווית המבט: סיבוב סביב הציר האנכי, והגובה שממנו מסתכלים. */
export interface IsoView {
  /** מעלות. 0 = המבט ההתחלתי */
  yawDeg: number;
  /**
   * שיטוח המישור האופקי, בין מבט כמעט מהצד למבט כמעט מלמעלה.
   * 0.5 הוא ההיטל האיזומטרי המוכר.
   */
  rise: number;
}

export const DEFAULT_VIEW: IsoView = { yawDeg: 0, rise: 0.5 };
export const MIN_RISE = 0.12;
export const MAX_RISE = 0.95;

/** מרחק בפיקסלים שמעליו הגרירה היא סיבוב מבט ולא בחירת ארון. */
export const ORBIT_SLOP = 6;

/**
 * בונה את פונקציית ההיטל לזווית מבט נתונה.
 * הסיבוב נעשה סביב הציר האנכי לפני ההיטל, ולכן החדר מסתובב והמידות
 * נשארות נכונות — זו עדיין הטלה מקבילה ולא פרספקטיבה.
 */
export function projector(view: IsoView) {
  const rad = (view.yawDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const project = (x: number, y: number, z: number): [number, number] => {
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;
    return [(rx - rz) * COS30, (rx + rz) * view.rise - y];
  };
  /** המרחק מהצופה במישור הרצפה — לפיו קיר הוא רקע או חסימה */
  const toward = (x: number, z: number): number => x * (cos + sin) + z * (cos - sin);
  /*
   * המרחק מהצופה בשלושת הממדים.
   *
   * קו המבט בהיטל הזה הוא הכיוון (1, 2·rise, 1) במערכת המסובבת:
   * מה שקדימה, ימינה ולמעלה — קרוב יותר. בלי המרכיב האנכי ארון
   * עליון וארון תחתון שנפגשים על המסך היו מסודרים לפי מזל.
   */
  const depth = (x: number, y: number, z: number): number =>
    toward(x, z) + 2 * view.rise * y;
  /*
   * ההצללה: כמה הפאה מוארת, לפי הנורמל שלה בלבד.
   *
   * האור בא מלמעלה ומעט מעבר לכתף של הצופה — הכיוון (sin, cos)
   * במישור הרצפה, שהוא כיוון המבט מסובב ב-45°. בזווית ההתחלה הוא
   * נופל ישר על החזית, ולכן חזית בהירה, צד כהה ותקרה הבהירה מכולן;
   * וכשמסתובבים בחדר האור מסתובב יחד עם הצופה, ולכן שום ארון אינו
   * הופך ללוח שחור מצד אחד.
   */
  const lit = (nx: number, ny: number, nz: number): number =>
    Math.min(Math.max(0.78 + 0.34 * ny + 0.24 * (nx * sin + nz * cos), 0.66), 1.14);
  return { project, toward, depth, lit };
}

/**
 * העברה ממערכת הקיר לעולם.
 * `x` רץ לאורך הקיר, `z` נכנס אל תוך החדר — בדיוק כמו שהארגזים
 * מוגדרים — והתוצאה היא הרצפה של החדר כולו.
 */
export type Tf = (x: number, z: number) => [number, number];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * המסגרת של ארגז בחדר: מאיפה הוא מתחיל ולאן פונים הצירים שלו.
 *
 * כל הלוחות של אותו ארון חולקים מסגרת אחת — אותו אובייקט ממש —
 * וזה מה שמאפשר לסדר אותם ביניהם בזול: בתוך מסגרת משותפת הם
 * מלבנים מיושרים לצירים, ואפשר לשאול "מי לפני מי" בהשוואת תחומים.
 */
export interface Frame {
  origin: Vec3;
  /** לרוחב הארגז */
  ax: Vec3;
  /** לגובהו — תמיד מעלה */
  ay: Vec3;
  /** לעומקו, אל תוך החדר */
  az: Vec3;
}

/** בונה מסגרת מהעברה של קיר או של ארגז. */
export function frameOf(tf: Tf): Frame {
  const [ox, oz] = tf(0, 0);
  const [sx, sz] = tf(1, 0);
  const [fx, fz] = tf(0, 1);
  return {
    origin: { x: ox, y: 0, z: oz },
    ax: { x: sx - ox, y: 0, z: sz - oz },
    ay: { x: 0, y: 1, z: 0 },
    az: { x: fx - ox, y: 0, z: fz - oz },
  };
}

/**
 * לוח אחד: תיבה מלבנית בתוך מסגרת.
 *
 * הלוח נשמר כתחום ולא כפאות, כי סדר הציור נקבע בין הלוחות ולא בין
 * הפאות: שלוש הפאות הנראות של תיבה נפגשות בפינה הקרובה שלה ואינן
 * מכסות זו את זו לעולם, ולכן אין מה לסדר ביניהן.
 */
export interface Solid {
  key: string;
  tone: string;
  frame: Frame;
  /** הפינה הנמוכה בתחום המקומי: x, y, z */
  lo: [number, number, number];
  /** הפינה הגבוהה */
  hi: [number, number, number];
  glass?: boolean;
  unitId?: string;
  featureKind?: string;
}

/** לוח במידות ובמקום שנתנו לו, בתוך מסגרת. */
export function slab(
  frame: Frame,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tone: string,
  key: string,
): Solid {
  return { key, tone, frame, lo: [x, y, z], hi: [x + w, y + h, z + d] };
}

export type Face = {
  points: string;
  fill: string;
  key: string;
  unitId?: string;
  /**
   * זכוכית: הפאה מצוירת שקופה, ומה שמאחוריה נראה דרכה.
   * דלת זכוכית שנצבעת אטומה היא בדיוק כמו דלת עץ על המסך, והלקוח
   * שביקש זכוכית לא רואה מה קנה.
   */
  glass?: boolean;
  /** סימון קיר שעומד בחדר — עמוד או מדרגה, ולא ארון */
  featureKind?: string;
};

type View = ReturnType<typeof projector>;

/** נקודה מקומית אל העולם. */
function at(f: Frame, x: number, y: number, z: number): Vec3 {
  return {
    x: f.origin.x + f.ax.x * x + f.az.x * z,
    y: f.origin.y + y,
    z: f.origin.z + f.ax.z * x + f.az.z * z,
  };
}

/**
 * הפאות הנראות של לוח.
 *
 * מצוירות הפאות שהנורמל שלהן פונה אל הצופה, ולא שלוש פאות קבועות.
 * זה מה שמאפשר לראות את הגב של ארון מסובב ואת הצד השני של ארון
 * שעוקפים אותו — הגיאומטריה עונה על זה לבד, בלי היפוך מיוחד.
 */
export function solidFaces(s: Solid, v: View): Face[] {
  const f = s.frame;
  const [x0, y0, z0] = s.lo;
  const [x1, y1, z1] = s.hi;
  const out: Face[] = [];
  const face = (name: string, n: Vec3, pts: Vec3[]) => {
    // `depth` על וקטור הוא בדיוק המכפלה עם כיוון המבט
    if (v.depth(n.x, n.y, n.z) <= 0) return;
    out.push({
      points: pts.map((q) => v.project(q.x, q.y, q.z).join(',')).join(' '),
      fill: shade(s.tone, v.lit(n.x, n.y, n.z)),
      key: `${s.key}-${name}`,
      unitId: s.unitId,
      glass: s.glass,
      featureKind: s.featureKind,
    });
  };
  const p = (x: number, y: number, z: number) => at(f, x, y, z);
  const neg = (n: Vec3): Vec3 => ({ x: -n.x, y: -n.y, z: -n.z });

  face('t', f.ay, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)]);
  face('u', neg(f.ay), [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)]);
  face('s', f.ax, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)]);
  face('n', neg(f.ax), [p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)]);
  face('f', f.az, [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)]);
  face('b', neg(f.az), [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)]);
  return out;
}

/** מגע בין לוחות אינו חפיפה: לוח שנוגע בשכנו עדיין מופרד ממנו. */
const TOUCH = 0.5;

/** הקמור של נקודות על המסך, בסריקת שרשרת. */
function convexHull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src: [number, number][]) => {
    const out: [number, number][] = [];
    for (const q of src) {
      while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * האם שתי צלליות קמורות נפגשות — ציר מפריד על מסך.
 *
 * צללית של תיבה בהיטל מקבילי סימטרית סביב מרכזה, ולכן צלעותיה
 * מגיעות בזוגות מקבילים ומחצית הצלעות נותנת את כל הכיוונים.
 */
function hullsMeet(a: [number, number][], b: [number, number][]): boolean {
  for (const poly of [a, b]) {
    const axes = Math.max(Math.floor(poly.length / 2), 1);
    for (let i = 0; i < axes; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      const nx = y0 - y1;
      const ny = x1 - x0;
      let aLo = Infinity;
      let aHi = -Infinity;
      let bLo = Infinity;
      let bHi = -Infinity;
      for (const [x, y] of a) {
        const t = x * nx + y * ny;
        aLo = Math.min(aLo, t);
        aHi = Math.max(aHi, t);
      }
      for (const [x, y] of b) {
        const t = x * nx + y * ny;
        bLo = Math.min(bLo, t);
        bHi = Math.max(bHi, t);
      }
      if (aHi <= bLo || bHi <= aLo) return false;
    }
  }
  return true;
}

/** מה שצריך לדעת על לוח כדי לסדר אותו מול האחרים. */
interface Placed {
  s: Solid;
  /** תחום בעולם, לצורך הפרדה בין מסגרות שונות */
  wLo: [number, number, number];
  wHi: [number, number, number];
  /** תחום על המסך, לפסילה מהירה של זוגות שאינם נפגשים בכלל */
  sLo: [number, number];
  sHi: [number, number];
  /** צללית הלוח על המסך — משושה קמור, לפסילה מדויקת */
  hull: [number, number][];
  /** המרחק בפינה הקרובה — סדר ההתחלה, וגם המוצא כששום ציר אינו מפריד */
  near: number;
}

/**
 * סדר הציור בין הלוחות.
 *
 * אלגוריתם הצייר, אבל בלי מפתח מיון יחיד: אין כזה. לוח גדול ורחוק
 * יכול להיות "קרוב" בפינה אחת ו"רחוק" במרכזו, ולכן כל מפתח יחיד
 * — פינה קרובה, מרכז, גובה — נכשל במקרה אחר. במקום זה נשאלת שאלה
 * מקומית בין כל שני לוחות שנפגשים על המסך: האם יש ציר שמפריד
 * ביניהם, ובאיזה צד שלו נמצא הצופה. התשובה לזוג היא ודאית, וממנה
 * נבנה הסדר הכולל.
 *
 * בתוך מסגרת אחת — כל הלוחות של ארון — הצירים הם צירי הארון עצמו,
 * ולכן ההפרדה מדויקת גם לארון מסובב. בין מסגרות שונות נבדקים צירי
 * החדר, ומה שלא הופרד נופל לפינה הקרובה.
 */
export function orderSolids(solids: Solid[], v: View): Solid[] {
  const dir: Vec3 = { x: v.depth(1, 0, 0), y: v.depth(0, 1, 0), z: v.depth(0, 0, 1) };
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  /* כיוון המבט בצירים של כל מסגרת — מחושב פעם אחת למסגרת */
  const localDir = new Map<Frame, [number, number, number]>();
  const localOf = (f: Frame): [number, number, number] => {
    let d = localDir.get(f);
    if (!d) {
      d = [dot(dir, f.ax), dot(dir, f.ay), dot(dir, f.az)];
      localDir.set(f, d);
    }
    return d;
  };

  const items: Placed[] = solids.map((s) => {
    const wLo: [number, number, number] = [Infinity, Infinity, Infinity];
    const wHi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    const sLo: [number, number] = [Infinity, Infinity];
    const sHi: [number, number] = [-Infinity, -Infinity];
    const screen: [number, number][] = [];
    let near = -Infinity;
    for (const x of [s.lo[0], s.hi[0]]) {
      for (const y of [s.lo[1], s.hi[1]]) {
        for (const z of [s.lo[2], s.hi[2]]) {
          const q = at(s.frame, x, y, z);
          if (q.x < wLo[0]) wLo[0] = q.x;
          if (q.x > wHi[0]) wHi[0] = q.x;
          if (q.y < wLo[1]) wLo[1] = q.y;
          if (q.y > wHi[1]) wHi[1] = q.y;
          if (q.z < wLo[2]) wLo[2] = q.z;
          if (q.z > wHi[2]) wHi[2] = q.z;
          const p = v.project(q.x, q.y, q.z);
          if (p[0] < sLo[0]) sLo[0] = p[0];
          if (p[0] > sHi[0]) sHi[0] = p[0];
          if (p[1] < sLo[1]) sLo[1] = p[1];
          if (p[1] > sHi[1]) sHi[1] = p[1];
          screen.push(p);
          const dpt = v.depth(q.x, q.y, q.z);
          if (dpt > near) near = dpt;
        }
      }
    }
    return { s, wLo, wHi, sLo, sHi, hull: convexHull(screen), near };
  });

  /**
   * חיובי = a לפני b (a מצויר אחר כך), שלילי = מאחוריו, אפס = לא
   * ידוע. שום ציר שמפריד פירושו לוחות שנחתכים, וזה לא אמור לקרות.
   */
  const ahead = (a: Placed, b: Placed): number => {
    const local = a.s.frame === b.s.frame;
    const d = local ? localOf(a.s.frame) : [dir.x, dir.y, dir.z];
    const aLo = local ? a.s.lo : a.wLo;
    const aHi = local ? a.s.hi : a.wHi;
    const bLo = local ? b.s.lo : b.wLo;
    const bHi = local ? b.s.hi : b.wHi;
    for (let i = 0; i < 3; i++) {
      if (aLo[i] >= bHi[i] - TOUCH) return d[i] > 0 ? 1 : -1;
      if (bLo[i] >= aHi[i] - TOUCH) return d[i] > 0 ? -1 : 1;
    }
    /*
     * שום ציר לא הפריד — הלוחות נחתכים זה בזה. לתמונה נכונה היה
     * צריך לחתוך אותם, וזה מחיר שלא שווה אותו: מה שנחתך הוא לוח
     * שהוזז לתוך לוח אחר, וגם בשטח הוא היה נגרר. הפינה הקרובה
     * נותנת תוצאה יציבה ומתקבלת על הדעת במקום להתפוצץ.
     */
    return a.near - b.near;
  };

  /*
   * רק זוגות שנפגשים על המסך צריכים סדר. סריקה לפי הקצה השמאלי
   * חוסכת את רוב ההשוואות: לוחות של ארונות רחוקים זה מזה לא
   * נפגשים לעולם.
   */
  const order = items.map((_, i) => i).sort((i, j) => items[i].near - items[j].near);
  const bySpan = [...order].sort((i, j) => items[i].sLo[0] - items[j].sLo[0]);
  /** מי חייב להיות מצויר לפני מי */
  const before = new Map<number, number[]>();
  const link = (first: number, second: number) => {
    const list = before.get(second);
    if (list) list.push(first);
    else before.set(second, [first]);
  };
  for (let a = 0; a < bySpan.length; a++) {
    const i = bySpan[a];
    for (let b = a + 1; b < bySpan.length; b++) {
      const j = bySpan[b];
      if (items[j].sLo[0] > items[i].sHi[0]) break;
      if (items[j].sLo[1] > items[i].sHi[1] || items[i].sLo[1] > items[j].sHi[1]) continue;
      /*
       * רק לוחות שנפגשים באמת על המסך צריכים סדר ביניהם. מלבן
       * חוסם הוא קירוב גס: תקרת ארון ומכסה שאין ביניהם שום נקודה
       * משותפת נופלים באותו מלבן, והסדר המיותר שנוצר ביניהם היה
       * סוגר מעגלים שהרסו סדר אמיתי במקום אחר.
       */
      if (!hullsMeet(items[i].hull, items[j].hull)) continue;
      const cmp = ahead(items[i], items[j]);
      if (cmp > 0) link(j, i);
      else if (cmp < 0) link(i, j);
    }
  }

  /*
   * מיון טופולוגי. הוא נותן את רוב הסדר בבת אחת, אבל הוא לא יכול
   * לתת את כולו: היחס "לפני" על תיבות אינו סדר חלקי אמיתי, ויכולים
   * להיווצר בו מעגלים — א׳ לפני ב׳ בציר אחד, ב׳ לפני ג׳ בציר שני,
   * ג׳ לפני א׳ בציר שלישי. מעגל נשבר כאן במקום ולא תולה את הציור.
   */
  const state = new Uint8Array(items.length);
  const sorted: number[] = [];
  const visit = (i: number) => {
    if (state[i]) return;
    state[i] = 1;
    for (const j of before.get(i) ?? []) if (state[j] !== 1) visit(j);
    state[i] = 2;
    sorted.push(i);
  };
  for (const i of order) visit(i);

  /*
   * תיקון מקומי למה שהמעגל שבר: כל זוג שכנים שיצא הפוך מוחלף.
   * שני שכנים הם בדיוק המקום שבו טעות בסדר נראית על המסך, ומספר
   * מעברים קטן מספיק — הרשימה כבר כמעט ממוינת.
   */
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i + 1 < sorted.length; i++) {
      if (ahead(items[sorted[i]], items[sorted[i + 1]]) > 0) {
        [sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]];
        moved = true;
      }
    }
    if (!moved) break;
  }
  return sorted.map((i) => items[i].s);
}

/**
 * רצפת החדר: מצולע אחד, ולא רצועה לכל קיר.
 *
 * רצועה לכל קיר משאירה חורים בפינות ושכבות שנצבעות זו על זו, וחדר
 * נראה כמו כמה קירות שבמקרה עומדים ליד. שרשרת הקירות נסגרת כאן
 * לצורה אחת: שני קירות מושלמים למלבן שהם מגדירים, שלושה ומעלה
 * נסגרים בחזרה אל נקודת ההתחלה, וקיר בודד מקבל עומק חדר קבוע — כי
 * אין ממה לגזור אותו.
 */
export function roomFloor(plan: PlanWall[]): { x: number; y: number }[] {
  if (!plan.length) return [];
  const pts = [plan[0].start, ...plan.map((p) => p.end)];
  if (plan.length === 1) {
    const rad = (plan[0].headingDeg * Math.PI) / 180;
    const n = { x: -Math.sin(rad) * LONE_ROOM_MM, y: Math.cos(rad) * LONE_ROOM_MM };
    return [pts[0], pts[1], { x: pts[1].x + n.x, y: pts[1].y + n.y }, { x: pts[0].x + n.x, y: pts[0].y + n.y }];
  }
  if (plan.length === 2) {
    // הצלע הרביעית של המלבן ששני הקירות מגדירים
    const [a, b, c] = pts;
    return [a, b, c, { x: c.x + a.x - b.x, y: c.y + a.y - b.y }];
  }
  return pts;
}
