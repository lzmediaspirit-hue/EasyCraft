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

/*
 * שכבות הציור בתוך ארון.
 *
 * הגוף והפנים חולקים שכבה אחת ומסודרים ביניהם לפי מרחק — דופן
 * ימנית באמת עומדת לפני המדף שמאחוריה. החזית לעומת זאת מכסה תמיד:
 * מדף שנמתח על כל רוחב הארון "קרוב" יותר מדלת שמכסה רק חצי ממנו,
 * ובלי שכבה נפרדת הוא היה נצבע עליה.
 */
export const L_FACE = { body: 0, inside: 0, front: 1, top: 2 };
/*
 * ארון שהחזית שלו פנתה מהצופה: מה שרואים ממנו הוא הגב והדפנות,
 * והדלת נמצאת מאחוריהם. בלי ההיפוך הזה דלת של ארון מסובב הייתה
 * נצבעת על הגוף של עצמו ונראית כאילו היא מרחפת לפניו.
 */
export const L_AWAY = { body: 1, inside: 1, front: 0, top: 2 };

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
  return { project, toward, depth };
}

/**
 * העברה ממערכת הקיר לעולם.
 * `x` רץ לאורך הקיר, `z` נכנס אל תוך החדר — בדיוק כמו שהארגזים
 * מוגדרים — והתוצאה היא הרצפה של החדר כולו.
 */
export type Tf = (x: number, z: number) => [number, number];

export type Face = {
  points: string;
  fill: string;
  key: string;
  depth: number;
  /*
   * שכבת הציור בתוך הארון: גוף, פנים, חזית, משטח. מרחק לבדו לא
   * מספיק — מדף שנמתח על כל רוחב הארון "רחוק" פחות מדלת שמכסה רק
   * חצי ממנו, ובלי השכבות הוא היה נצבע עליה.
   */
  layer: number;
  /** הארון שהפאה שייכת לו, לפי המרחק שלו — הארונות מסודרים ביניהם */
  group: number;
  unitId?: string;
  /** סימון קיר שעומד בחדר — עמוד או מדרגה, ולא ארון */
  featureKind?: string;
};

/**
 * תיבה מלבנית — לוח אחד.
 * מצוירות שלוש הפאות הנראות: חזית, עליונה וצדדית, כל אחת בגוון
 * אחר. ההצללה היא מה שנותן לעין את העובי בלי לצייר אור אמיתי.
 */
export function box(
  view: ReturnType<typeof projector>,
  tf: Tf,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tone: string,
  key: string,
): Face[] {
  const p = (dx: number, dy: number, dz: number) => {
    const [wx, wz] = tf(x + dx, z + dz);
    return view.project(wx, y + dy, wz).join(',');
  };
  const front = [p(0, 0, d), p(w, 0, d), p(w, h, d), p(0, h, d)].join(' ');
  const top = [p(0, h, 0), p(w, h, 0), p(w, h, d), p(0, h, d)].join(' ');
  const side = [p(w, 0, 0), p(w, h, 0), p(w, h, d), p(w, 0, d)].join(' ');
  /*
   * מיון לפי המרחק מהצופה: מה שקרוב יותר מצויר אחרון, והמרחק של
   * לוח נמדד בפינה הקרובה ביותר שלו ולא במרכזו. איזו מארבע הפינות
   * קרובה תלוי בזווית המבט ובסיבוב של הארגז, ולכן היא נבחרת ולא
   * מונחת מראש.
   *
   * מרכז מטעה כשמשווים לוח גדול ללוח קטן: דופן הארון נמדדת באמצע
   * הגובה, ומדף שיושב גבוה נמדד גבוה ממנה — ואז המדף נצבע על הדופן
   * שעומדת לפניו. הפינה הקרובה שייכת לשני הלוחות באותה מידה.
   *
   * שלוש הפאות של אותה תיבה חולקות את הפינה, ולכן הן שומרות על
   * הסדר שבו נכתבו: צד, עליונה, ואז חזית.
   */
  const depth = Math.max(
    ...(
      [
        [0, 0],
        [w, 0],
        [0, d],
        [w, d],
      ] as const
    ).map(([dx, dz]) => {
      const [nx, nz] = tf(x + dx, z + dz);
      return view.depth(nx, y + h, nz);
    }),
  );
  return [
    { points: side, fill: shade(tone, 0.78), key: `${key}-s`, depth, layer: 0, group: 0 },
    { points: top, fill: shade(tone, 1.12), key: `${key}-t`, depth, layer: 0, group: 0 },
    { points: front, fill: tone, key: `${key}-f`, depth, layer: 0, group: 0 },
  ];
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
