import { AISLE, BLIND_CORNER, ISLAND, KITCHEN, LANDING, PREP, SAFETY, TRIANGLE } from '../../catalog/kitchenRules';
import type { FreePlacement, UnitLevel, Wall, WallFeature } from '../../db/types';
import { SEED_CATALOG } from '../../catalog/builtins';
import type { PlanWall } from './plan';
import { rad } from './placement';

/**
 * תכנון מטבח אוטומטי.
 *
 * נכנס חדר ורשימת מכשירים, יוצאות כמה הצעות מלאות. זו פונקציה
 * טהורה: אין בה React ואין בה בסיס נתונים, ואפשר להריץ אותה על
 * מספרים ולבדוק שהתוצאה מקיימת את הכללים.
 *
 * הרעיון אינו "למלא ארונות". הוא סדר התנועה במטבח — מוציאים
 * מהמקרר, שוטפים, מכינים, מבשלים — ולכן זה סדר האזורים לאורך
 * הקיר, וממנו נגזר הכול. פריסה שמכבדת אותו נוחה גם בלי לחשב
 * משולש עבודה.
 *
 * מה שיוצא אינו ארגז מוכן אלא הפניה לפריט ספרייה: ההנחה עצמה
 * נעשית באותו נתיב שבו נגר מניח ארגז ביד, ולכן ההצעה מתומחרת,
 * מנוסרת ונצבעת בדיוק כמו מטבח שסודר ידנית. ההסבר המלא לכללים
 * יושב ב-`docs/kitchen-design.md`, והמספרים ב-`kitchenRules.ts`.
 */

/** מה יש במטבח. כיור תמיד יש. */
export interface Appliances {
  fridge: boolean;
  oven: boolean;
  hob: boolean;
  microwave: boolean;
  dishwasher: boolean;
  hood: boolean;
}

/** מה שהמשתמש מסמן לפני שהוא לוחץ. */
export interface AutoInput {
  walls: Wall[];
  plan: PlanWall[];
  appliances: Appliances;
  /** כיסאות באי או בחצי־אי */
  seating: boolean;
  /**
   * רמת הגימור, והיא גם רמת התקציב.
   * `plain` בוחר ארונות רחבים ודלתות; `rich` בוחר מגירות.
   */
  finish: 'plain' | 'standard' | 'rich';
}

export type LayoutKind = 'single' | 'galley' | 'l' | 'u';
export type Priority = 'ergonomic' | 'economical' | 'storage';

/**
 * תפקיד של ארגז ברצף.
 *
 * במטבח זה מה שקובע את סדר התנועה — מקרר, כיור, כיריים. בחדרים
 * האחרים אין סדר תנועה אלא סדר חשיבות: מה נכנס ראשון ומקבל את
 * המקום הטוב. אותו שדה משרת את שניהם, כי בשניהם השאלה היא "מה
 * הארגז הזה עושה כאן".
 */
export type Role =
  | 'fridge' | 'sink' | 'dishwasher' | 'hob' | 'oven'
  | 'prep' | 'store' | 'corner' | 'upper' | 'hood' | 'island'
  /* חדרים שאינם מטבח */
  | 'hang' | 'shelving' | 'drawers' | 'vanity' | 'shoes' | 'media'
  | 'display' | 'appliance';

/**
 * ארגז אחד בהצעה, כהפניה לספרייה.
 *
 * אין כאן מידות גוף, גימורים או רגליים — כל אלה מגיעים מהפריט
 * ומהגדרות הפרויקט ברגע ההנחה. שכפול שלהם כאן היה יוצר מטבח
 * אוטומטי שנראה אחרת ממטבח ידני.
 */
export interface Placement {
  /** מפתח הפריט בספרייה, למשל `k-base-sink` */
  catalogKey: string;
  wallId: string;
  xMm: number;
  widthMm: number;
  level: UnitLevel;
  role: Role;
  /** עומק החלק החסום, בארון פינה מתה בלבד */
  blindMm?: number;
  /** אי: מיקום ברצפת החדר במקום על הקיר */
  free?: FreePlacement;
}

export interface Proposal {
  key: string;
  layout: LayoutKind;
  priority: Priority;
  /** הקטגוריה שההצעה הזאת הכי טובה בה */
  title: string;
  /** צורת הפריסה — היא זהה לכל ההצעות, ולכן היא שורת משנה */
  layoutName: string;
  units: Placement[];
  /** מה שלא נכנס, ולמה */
  dropped: string[];
  /** מה שנכון בהצעה הזאת ושווה לומר */
  notes: string[];
  score: Score;
}

export interface Score {
  /** משולש העבודה — 1 כשכל הצלעות בתחום */
  triangle: number;
  /** אזור ההכנה הרציף הגדול ביותר, במ"מ */
  prepMm: number;
  /** מטר רץ תחתון */
  runMm: number;
  /** מספר הארגזים — פחות ארגזים, פחות דפנות וצירים */
  boxes: number;
  /**
   * כמה תחנות שנתבקשו חסרות בהצעה.
   *
   * זה מה שמונע "99 ומשולש 100%" למטבח בלי כיריים: המשולש נמדד
   * על הצלעות שקיימות, וכשחסרה תחנה הוא מודד פחות ולכן נראה טוב
   * יותר. מספר שאומר מה חסר קודם למספר שאומר כמה טוב.
   */
  missing: number;
  /** הציון הכולל שלפיו ההצעות מסודרות */
  total: number;
}

/** רוחב מזערי שמתחתיו אין טעם להתחיל ארגז. */
export const MIN_BOX = 300;
/** קיר קצר מזה אינו קיר עבודה. */
const MIN_WALL = 1200;

/**
 * מאיפה מתחיל הקיר השני בפינה.
 *
 * הארונות של הקיר הראשון תופסים את הפינה לכל עומקם, ומעליהם עוד
 * לוח סתימה — בלעדיו הדלת של הארון הפינתי והמגירה של הניצב לו
 * נפגשות באוויר.
 */
export const CORNER_START = KITCHEN.baseDepthMm + BLIND_CORNER.fillerMm;

/**
 * ארון הפינה המתה: הרוחב, והחלק שנחסם בתוכו.
 *
 * החסום הוא בדיוק מה שהשורה הניצבת תופסת, ועוד לוח הסתימה. הרוחב
 * נגזר ממנו ולא להפך: הפתח שנשאר חייב להיות אמיתי, ולכן הארון
 * רחב מספיק כדי שהחסום יישאר בגבול שהמודל מרשה — שני שלישים.
 */
const CORNER_BLIND = KITCHEN.baseDepthMm + BLIND_CORNER.fillerMm;
const CORNER_WIDTH = 1000;

/* ------------------------------------------------------------------ */
/* בחירת הקירות                                                        */
/* ------------------------------------------------------------------ */

const usableWalls = (plan: PlanWall[]): PlanWall[] =>
  plan.filter((p) => p.wall.lengthMm >= MIN_WALL);

/** האם שני קירות מקבילים ופונים זה אל זה. */
const parallel = (a: PlanWall, b: PlanWall): boolean => {
  const d = Math.abs(((b.headingDeg - a.headingDeg) % 360 + 360) % 360 - 180);
  return d < 20;
};

/**
 * הקירות שהפריסה רצה עליהם, בסדר שבו הם נפגשים.
 *
 * הסדר אינו קישוט: פינה נוצרת רק בין קירות עוקבים, ורק שם צריך
 * ארון פינתי והסטה. בחירה של "שני הארוכים ביותר" הייתה מייצרת L
 * בין קירות שאין ביניהם פינה בכלל.
 */
export function runOf(plan: PlanWall[], layout: LayoutKind): PlanWall[] {
  const usable = usableWalls(plan);
  if (!usable.length) return [];
  if (layout === 'single') {
    return [usable.reduce((a, b) => (b.wall.lengthMm > a.wall.lengthMm ? b : a))];
  }
  if (layout === 'galley') {
    for (const a of usable) {
      const b = usable.find((o) => o !== a && parallel(a, o));
      if (b) return [a, b];
    }
    return [];
  }
  /*
   * L ו-U רצים על קירות עוקבים.
   *
   * L הוא בדיוק שניים; U הוא כל מה שיש — שלושה קירות ומעלה. חדר
   * עם ארבעה קירות שימושיים מקבל ארונות על ארבעתם, כי קיר ריק
   * במטבח הוא מקום אחסון שלא נבנה.
   */
  const n = layout === 'l' ? 2 : 3;
  let best: PlanWall[] = [];
  for (let i = 0; i + n <= plan.length; i++) {
    /* הרצף הארוך ביותר שמתחיל כאן — עוצר בקיר הראשון שאינו שימושי */
    let run = plan.slice(i, i + n);
    if (run.some((p) => p.wall.lengthMm < MIN_WALL)) continue;
    if (layout === 'u') {
      let j = i + n;
      while (j < plan.length && plan[j].wall.lengthMm >= MIN_WALL) j++;
      run = plan.slice(i, j);
    }
    const total = run.reduce((s, p) => s + p.wall.lengthMm, 0);
    if (total > best.reduce((s, p) => s + p.wall.lengthMm, 0)) best = run;
  }
  return best;
}

/**
 * אילו פריסות החדר בכלל מרשה.
 *
 * לא כל פריסה מתאימה לכל חדר, וזה לא עניין של טעם: שתי שורות
 * ארונות בחדר צר יותר ממעבר עבודה הן מטבח שאי אפשר לפתוח בו
 * מגירה. הבדיקה נעשית כאן, ולא אחרי שכבר סודרו ארונות.
 */
export function layoutsFor(plan: PlanWall[]): LayoutKind[] {
  const all: LayoutKind[] = ['single', 'galley', 'l', 'u'];
  return all.filter((k) => {
    const run = runOf(plan, k);
    if (run.length < (k === 'single' ? 1 : k === 'u' ? 3 : 2)) return false;
    if (k === 'galley') return aisleOf(run) >= AISLE.workMm;
    /*
     * פינה בזווית שאינה ישרה אינה נתמכת, ולכן אינה מוצעת.
     *
     * הפינה נבנית כאן על הנחה אחת: הקיר הבא ניצב, ולכן די להתחיל
     * אותו במרחק עומק ארון. בחדר שנשרטט ביד בזווית פנימית של 45
     * מעלות ההנחה אינה נכונה, והארונות נכנסו זה לתוך זה בכל הצעה
     * — גם כשלא היה בקיר שום מכשול. ארון פינה בזווית חדה הוא גוף
     * אחר, עם החזרה ועם חזית אחרת, ולא ארון מלבני שהוזז.
     *
     * עד שיהיה מודל אמיתי לפינה כזאת, מה שנכון לומר הוא שאין
     * הצעה — ולא להציע מטבח שאי אפשר לבנות.
     */
    return squareCorners(run);
  });
}

/** כמה מעלות מותר לפינה לסטות מ-90 ועדיין להיחשב ישרה. */
const CORNER_TOLERANCE_DEG = 5;

/**
 * האם כל המפגשים ברצף הזה הם פינות ישרות.
 *
 * הזווית נמדדת מהכיוונים בפועל ולא מהשדה השמור: קיר שנשרטט ביד
 * מקבל כיוון מהנקודות שלו, ו-`turnDeg` אינו קיים בו.
 */
function squareCorners(run: PlanWall[]): boolean {
  for (let i = 1; i < run.length; i++) {
    const turn = Math.abs(((run[i].headingDeg - run[i - 1].headingDeg + 540) % 360) - 180);
    if (Math.abs(turn - 90) > CORNER_TOLERANCE_DEG) return false;
  }
  return true;
}

/**
 * הפריסה שמנצלת את כל הקירות.
 *
 * קיר ריק במטבח הוא מקום אחסון שלא נבנה, ולכן הבחירה אינה בין
 * פריסות אלא בין מה שהחדר מרשה — והגדולה שבהן היא זו שמכסה הכי
 * הרבה קיר. `runOf` כבר מחזיר את הרצף הארוך ביותר לכל פריסה,
 * ולכן די להשוות אורך.
 */
export function layoutFor(plan: PlanWall[]): LayoutKind | null {
  const options = layoutsFor(plan);
  if (!options.length) return null;
  const cover = (k: LayoutKind) => runOf(plan, k).reduce((s, p) => s + p.wall.lengthMm, 0);
  return options.reduce((a, b) => (cover(b) > cover(a) ? b : a));
}

/**
 * האם שרשרת הקירות נסגרת — הקיר האחרון חוזר אל תחילת הראשון.
 *
 * בחדר סגור גם הפינה שבין האחרון לראשון היא פינה: מי שלא ידע את
 * זה הניח ארון בתחילת הקיר הראשון בדיוק במקום שבו כבר עומדת
 * העמודה של הקיר האחרון, ושני ארונות נכנסו זה לזה.
 */
function closedRing(run: PlanWall[]): boolean {
  if (run.length < 3) return false;
  const a = run[0].start;
  const b = run[run.length - 1].end;
  return Math.hypot(a.x - b.x, a.y - b.y) < KITCHEN.baseDepthMm;
}

/** המרווח בין שתי שורות ארונות מקבילות. */
function aisleOf(run: PlanWall[]): number {
  if (run.length < 2) return Infinity;
  const [a, b] = run;
  const dx = b.start.x - a.start.x;
  const dy = b.start.y - a.start.y;
  const theta = rad(a.headingDeg);
  /* המרחק הניצב בין הקירות, פחות שתי שורות ארונות */
  const gap = Math.abs(-Math.sin(theta) * dx + Math.cos(theta) * dy);
  return Math.max(0, gap - 2 * KITCHEN.baseDepthMm);
}

/* ------------------------------------------------------------------ */
/* סדר האזורים לאורך הקיר                                              */
/* ------------------------------------------------------------------ */

/**
 * האזור שהתפקיד שייך אליו.
 *
 * שלושת האזורים הם שלושת קודקודי משולש העבודה: קר (מקרר ואחסון),
 * רטוב (כיור ומדיח), חם (כיריים ותנור). החלוקה הזאת היא מה שמאפשר
 * לקפל את המשולש סביב הפינה במקום למתוח אותו לאורך קיר אחד.
 */
type Zone = 'cold' | 'wet' | 'hot';

const ZONES: Zone[] = ['cold', 'wet', 'hot'];

interface Slot {
  role: Role;
  zone: Zone;
  key: string;
  /** הרוחב שהתפקיד דורש; המילוי יתאים אותו לרוחבי התקן */
  wantMm: number;
  /** רוחב מזערי שמתחתיו אין טעם להניח אותו */
  minMm: number;
}

/**
 * הרצף שהמטבח נבנה ממנו, בסדר התנועה.
 *
 * מקרר בקצה, אחריו משטח, אחריו הכיור עם המדיח לידו, אחריו משטח
 * ההכנה, ואז הבישול. זה הסדר שנגר מסדר בו מטבח ביד, וזה גם מה
 * שהכללים דורשים: משטח נחיתה משני צדי הכיור, ומשטח בין הכיור
 * לכיריים.
 */
function sequence(input: AutoInput, priority: Priority): Slot[] {
  const a = input.appliances;
  /* מגירות עולות יותר מדלתות, ולכן הן נכנסות לפי רמת הגימור */
  const prepKey = input.finish === 'plain' || priority === 'economical'
    ? 'k-base-door2'
    : 'k-base-dr3';
  const fridgeMm = 700;
  const sinkMm = 800;
  /*
   * המשטח שבין המקרר לכיור אינו רק "משטח נחיתה": הוא גם מה שקובע
   * את הצלע הראשונה של משולש העבודה. ארגז צר מדי כאן דוחס את שני
   * המכשירים זה על זה, ולכן הרוחב נגזר מהצלע המזערית ולא מהמינימום
   * של הנחיתה.
   */
  const toSink = Math.max(
    LANDING.fridgeMm,
    TRIANGLE.minLegMm - fridgeMm / 2 - sinkMm / 2,
  );

  const out: Slot[] = [];
  if (a.fridge) {
    out.push({ role: 'fridge', zone: 'cold', key: 'k-tall-fridge', wantMm: fridgeMm, minMm: 600 });
  }
  /* הרוחב הזה אינו מילוי אלא צלע במשולש, ולכן הוא גם המינימום */
  out.push({
    role: 'prep', zone: 'cold', key: prepKey,
    wantMm: toSink, minMm: a.fridge ? toSink : MIN_BOX,
  });
  out.push({ role: 'sink', zone: 'wet', key: 'k-base-sink', wantMm: sinkMm, minMm: 600 });
  if (a.dishwasher) {
    out.push({ role: 'dishwasher', zone: 'wet', key: 'k-base-dw', wantMm: 600, minMm: 450 });
  }
  /*
   * אזור ההכנה — המשטח הרציף שבין הכיור לכיריים.
   *
   * זה גם המקום שבו העדיפות באמת מוכרעת: "מקסימום אחסון" מקצר
   * אותו למינימום כדי שיישאר קיר לעמודת מזווה, ו"נוח לעבודה"
   * שומר עליו מלא. זה בדיוק הוויתור שבין השניים.
   */
  out.push({
    role: 'prep', zone: 'wet', key: prepKey,
    wantMm: priority === 'storage' ? 400 : PREP.widthMm, minMm: 400,
  });
  if (a.hob) out.push({ role: 'hob', zone: 'hot', key: 'k-base-hob', wantMm: 600, minMm: 600 });
  if (a.oven) {
    out.push({
      role: 'oven',
      zone: 'hot',
      key: a.microwave ? 'k-tall-ovenmicro' : 'k-tall-oven',
      wantMm: 600,
      minMm: 600,
    });
  }
  return out;
}

/**
 * מחלק את הרצף בין קירות הפריסה.
 *
 * זה הלב של תכנון פינתי: על קיר אחד המשולש נמתח לקו ישר, והצלע
 * מהמקרר לכיריים יוצאת ארוכה מכל מה שמותר. ברגע שהבישול עובר את
 * הפינה המשולש נסגר, וזה בדיוק מה שמבדיל מטבח L ממטבח קו אחד
 * שנשפך לשני קירות.
 *
 * מה שלא נכנס לקיר שלו זולג לקיר הבא בסדר, ולא נעלם.
 */
function spread(slots: Slot[], caps: number[]): Slot[][] {
  const out: Slot[][] = caps.map(() => []);
  if (caps.length <= 1) return [slots];
  for (const slot of slots) {
    const wall = Math.floor((ZONES.indexOf(slot.zone) * caps.length) / ZONES.length);
    out[Math.min(wall, caps.length - 1)].push(slot);
  }
  /* זליגה: קיר שאין בו מקום מעביר את העודף הלאה */
  for (let i = 0; i < out.length - 1; i++) {
    let used = 0;
    const keep: Slot[] = [];
    const spill: Slot[] = [];
    for (const slot of out[i]) {
      if (used + slot.minMm <= caps[i]) {
        keep.push(slot);
        used += slot.wantMm;
      } else {
        spill.push(slot);
      }
    }
    out[i] = keep;
    out[i + 1] = [...spill, ...out[i + 1]];
  }
  return out;
}

const NAME: Record<string, string> = {
  'k-tall-fridge': 'עמודת מקרר',
  'k-tall-oven': 'עמודת תנור',
  'k-tall-ovenmicro': 'עמודת תנור ומיקרוגל',
  'k-tall-pantry': 'עמודת מזווה',
  'k-base-sink': 'ארגז כיור',
  'k-base-dw': 'ארגז מדיח',
  'k-base-hob': 'ארגז כיריים',
  'k-base-door1': 'ארגז דלת',
  'k-base-door2': 'ארגז דלתות',
  'k-base-dr3': 'ארגז מגירות',
  'k-base-blind-end': 'ארון פינה מתה',
  'k-tall-door': 'עמודת דלתות',
  'k-up-door1': 'עליון דלת',
  'k-up-door2': 'עליון דלתות',
  'k-up-micro': 'ארון מיקרוגל',
  'k-up-hood': 'ארון קולט אדים',
};

/** ארגז עמודה מגיע עד התקרה ואינו נושא ארון עליון. */
const isColumn = (key: string): boolean => key.startsWith('k-tall');

/**
 * זוגות פריטים שהם אותו תפקיד בשני רוחבים.
 *
 * ארגז דלתות ברוחב 400 הוא ארגז דלת אחת, ועמודת מזווה אינה נבנית
 * ברוחב 900. הזוג נבחר לפי הרוחב שנמצא בפועל, ולכן רשימת הרוחבים
 * שלו היא איחוד השניים.
 */
const PAIRS: Record<string, { narrow: string; wide: string; atMm: number }> = {
  'k-base-door1': { narrow: 'k-base-door1', wide: 'k-base-door2', atMm: 600 },
  'k-base-door2': { narrow: 'k-base-door1', wide: 'k-base-door2', atMm: 600 },
  'k-tall-pantry': { narrow: 'k-tall-pantry', wide: 'k-tall-door', atMm: 601 },
};

const seedOf = (key: string) => SEED_CATALOG.find((i) => i.key === key);

/** הפריט שמתאים לרוחב שנבחר בפועל. */
function keyForWidth(key: string, widthMm: number): string {
  const pair = PAIRS[key];
  if (!pair) return key;
  return widthMm >= pair.atMm ? pair.wide : pair.narrow;
}

/**
 * הרוחבים שהפריט הזה באמת נבנה בהם.
 *
 * המקור הוא הספרייה ולא רשימה משלנו: מטבח אוטומטי שמייצר ארגז
 * כיור ברוחב 700 מציע מידה שהעסק לא עובד בה, וזו תקלה שמתגלה רק
 * בניסור.
 */
function widthsFor(key: string): number[] {
  const pair = PAIRS[key];
  const keys = pair ? [pair.narrow, pair.wide] : [key];
  const all = new Set<number>();
  for (const k of keys) for (const w of seedOf(k)?.widths ?? []) all.add(w);
  return [...all].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* מילוי קיר                                                           */
/* ------------------------------------------------------------------ */

/** קטע פנוי על קיר — מה שנשאר אחרי דלתות ועמודים. */
export interface Span {
  fromMm: number;
  toMm: number;
}

/**
 * הקטעים שאפשר להעמיד בהם יחידות שעומדות על הרצפה.
 *
 * דלת חוסמת לגמרי, ועמוד ומדרגה גונבים עומק ולכן הם חוסמים גם הם.
 *
 * חלון תלוי בגובה. ארון מטבח תחתון עובר מתחת לחלון רגיל, ולכן
 * החלון לא נחשב חסימה — עד שמגיע חלון עם אדן בגובה 30 ס״מ, או
 * ארון בגדים בגובה 2.4 מטר. `topMm` הוא הגובה שהיחידה מגיעה
 * אליו, וחלון שמתחיל מתחתיו הוא חסימה אמיתית.
 */
export function baseSpans(
  p: PlanWall,
  fromMm: number,
  toMm: number,
  topMm = KITCHEN.counterTopMm,
): Span[] {
  const blocks = p.wall.features
    .filter(
      (f) =>
        f.kind === 'door' ||
        f.kind === 'pillar' ||
        f.kind === 'step' ||
        (f.kind === 'window' && f.yMm < topMm),
    )
    .map((f) => ({ from: f.xMm, to: f.xMm + f.widthMm }))
    .sort((x, y) => x.from - y.from);
  const out: Span[] = [];
  let at = fromMm;
  for (const b of blocks) {
    if (b.to <= fromMm || b.from >= toMm) continue;
    if (b.from - at >= MIN_BOX) out.push({ fromMm: at, toMm: b.from });
    at = Math.max(at, b.to);
  }
  if (toMm - at >= MIN_BOX) out.push({ fromMm: at, toMm });
  return out;
}

/** האם ארון עליון ברוחב הזה יתנגש בחלון או בדלת. */
export function upperBlocked(wall: Wall, fromMm: number, widthMm: number): boolean {
  return wall.features.some((f: WallFeature) => {
    if (f.kind !== 'window' && f.kind !== 'door') return false;
    if (f.yMm + f.heightMm <= KITCHEN.upperBottomMm) return false;
    return f.xMm < fromMm + widthMm && f.xMm + f.widthMm > fromMm;
  });
}

/**
 * הרוחב מרשימת התקן שנכנס למקום שנשאר.
 *
 * `wide` מבקש את הרחב ביותר האפשרי — ארגז אחד רחב זול משניים
 * צרים, כי יש בו פחות דפנות ופחות צירים.
 */
function fitWidth(availableMm: number, slot: Slot, wide: boolean): number | null {
  const options = widthsFor(slot.key).filter(
    (w) => w <= availableMm && w >= slot.minMm && w >= MIN_BOX,
  );
  if (!options.length) return null;
  if (wide) return options[options.length - 1];
  return options.reduce((best, w) =>
    Math.abs(w - slot.wantMm) < Math.abs(best - slot.wantMm) ? w : best,
  );
}

/** תפקידים שאפשר לצמצם: משטח הוא משטח גם כשהוא צר יותר. */
const FLEXIBLE: Role[] = ['prep', 'store'];

/**
 * סדר הוויתור, מהראשון שיורד לאחרון.
 *
 * כשהחדר קטן מדי לכל מה שסומן, השאלה אינה "מה נחתך" אלא "על מה
 * מוותרים". מדיח הוא נוחות; כיריים וכיור הם מטבח. עמודת תנור
 * יורדת לפני הכיריים כי אפשר לבנות תנור מתחת למשטח, ומקרר יורד
 * אחרון שבאחרונים כי הוא נשאר בחדר גם כשאין לו ארון.
 */
const SACRIFICE: Role[] = ['store', 'dishwasher', 'oven', 'prep', 'fridge', 'hob', 'sink'];

/**
 * מוריד מהרצף את מה שהחדר לא יכול להכיל.
 *
 * הבדיקה היא על הרוחב המזערי ולא המבוקש: מה שנכנס מכווץ יישאר,
 * וירד רק מה שאין לו מקום בכלל.
 */
function sacrifice(slots: Slot[], capacityMm: number): { slots: Slot[]; cut: Slot[] } {
  const keep = [...slots];
  const cut: Slot[] = [];
  const need = () => keep.reduce((n, x) => n + x.minMm, 0);
  while (need() > capacityMm) {
    const role = SACRIFICE.find((r) => keep.some((x) => x.role === r));
    if (role === undefined) break;
    const i = keep.map((x) => x.role).lastIndexOf(role);
    cut.push(keep[i]);
    keep.splice(i, 1);
  }
  return { slots: keep, cut };
}

/**
 * מכווץ את הרצף כדי שייכנס לאורך הקיר שיש בפועל.
 *
 * קודם מצטמצמים המשטחים, ורק אם עדיין אין מקום — גם ארגזי
 * המכשירים, עד הרוחב המזערי שלהם. זה הסדר שנגר עובד בו: מקצרים
 * את המשטח לפני שמוותרים על המדיח.
 */
function squeeze(slots: Slot[], capacityMm: number): Slot[] {
  const trim = (list: Slot[], roles: Role[] | null, excess: number): [Slot[], number] => {
    const room = list.reduce(
      (n, s) => n + (!roles || roles.includes(s.role) ? s.wantMm - s.minMm : 0), 0,
    );
    if (room <= 0 || excess <= 0) return [list, excess];
    const take = Math.min(excess, room);
    return [
      list.map((s) => {
        if (roles && !roles.includes(s.role)) return s;
        const share = ((s.wantMm - s.minMm) / room) * take;
        return { ...s, wantMm: Math.round(s.wantMm - share) };
      }),
      excess - take,
    ];
  };
  let excess = slots.reduce((n, s) => n + s.wantMm, 0) - capacityMm;
  if (excess <= 0) return slots;
  let out = slots;
  [out, excess] = trim(out, FLEXIBLE, excess);
  [out] = trim(out, null, excess);
  return out;
}

/* ------------------------------------------------------------------ */
/* הצעה אחת                                                            */
/* ------------------------------------------------------------------ */

function buildProposal(input: AutoInput, layout: LayoutKind, priority: Priority): Proposal | null {
  const run = runOf(input.plan, layout);
  if (!run.length) return null;

  const units: Placement[] = [];
  const dropped: string[] = [];
  const notes: string[] = [];
  const wide = priority === 'economical';
  let queue = sequence(input, priority);

  const put = (
    p: PlanWall, key: string, xMm: number, widthMm: number, role: Role, blindMm?: number,
  ) => {
    units.push({
      catalogKey: keyForWidth(key, widthMm),
      wallId: p.wall.id,
      xMm: Math.round(xMm),
      widthMm,
      level: isColumn(key) ? 'tall' : 'floor',
      role,
      blindMm,
    });
  };

  /*
   * שלב ראשון: מה יש. הפינות נסגרות והקטעים הפנויים נמדדים לפני
   * שמניחים ארגז אחד, כי הרצף חייב לדעת כמה קיר עומד לרשותו.
   */
  const areas: { p: PlanWall; spans: Span[] }[] = [];
  /* פינה פנימית קיימת רק בין קירות עוקבים, ולכן לא במטבח מקבילי */
  const corner = layout === 'l' || layout === 'u';
  /* בחדר סגור גם המפגש שבין הקיר האחרון לראשון הוא פינה */
  const ring = corner && closedRing(run);
  for (const [wi, p] of run.entries()) {
    const startMm = corner && (wi > 0 || ring) ? CORNER_START : 0;
    let endMm = p.wall.lengthMm;

    /*
     * הפינה עצמה: ארון פינה מתה בקצה הקיר היוצא. בלעדיו העומק
     * שמאחורי הקיר הבא פשוט אובד. בגרסה החסכונית מוותרים עליו —
     * ארון פינה יקר, והשטח שהוא מציל קטן.
     */
    if (corner && (wi < run.length - 1 || ring)) {
      const w = CORNER_WIDTH;
      if (priority !== 'economical' && endMm - startMm >= w + MIN_BOX) {
        put(p, 'k-base-blind-end', endMm - w, w, 'corner', CORNER_BLIND);
        endMm -= w;
      } else {
        endMm -= KITCHEN.baseDepthMm;
        if (priority === 'economical') notes.push('הפינה נשארת ריקה — בלי ארון פינה');
      }
    }
    areas.push({ p, spans: baseSpans(p, startMm, endMm) });
  }

  /*
   * שלב שני: לחלק את הרצף בין הקירות ולהתאים כל חלק לאורך שיש.
   *
   * בלי הכיווץ המילוי החמדני היה נותן לארגז ההכנה את הרוחב המלא
   * ומגלה רק בסוף שלכיריים לא נשאר מקום — ובמטבח אמיתי מצמצמים
   * ארגז הכנה ולא מוותרים על הבישול.
   */
  const caps = areas.map((a) => a.spans.reduce((m, sp) => m + (sp.toMm - sp.fromMm), 0));
  const room = caps.reduce((n, c) => n + c, 0)
    - (queue.some((x) => x.role === 'hob') ? SAFETY.hobFromWallMm : 0);
  const trimmed = sacrifice(queue, room);
  queue = trimmed.slots;
  for (const gone of trimmed.cut) {
    dropped.push(`${NAME[gone.key] ?? gone.key} — אין בחדר מקום גם ברוחב המזערי`);
  }
  const queues = spread(queue, caps).map((q, i) => {
    /* הכיריים צריכות משטח גם אחריהן, ולכן הקיר שלהן קצר בכך */
    const tail = q.some((x) => x.role === 'hob') ? SAFETY.hobFromWallMm : 0;
    return squeeze(q, caps[i] - tail);
  });

  /* שלב שלישי: המילוי עצמו */
  for (const [i, { p, spans }] of areas.entries()) {
    let q = queues[i];
    for (const span of spans) {
      let at = span.fromMm;
      while (span.toMm - at >= MIN_BOX) {
        const slot = q[0] ?? {
          role: 'store' as Role,
          zone: 'cold' as const,
          key: priority === 'storage' ? 'k-tall-pantry' : 'k-base-door2',
          wantMm: priority === 'storage' ? 500 : 600,
          minMm: MIN_BOX,
        };
        const w = fitWidth(span.toMm - at, slot, wide && slot.role === 'store');
        if (w === null) break;

        /*
         * כיריים לא נצמדות לקיר ניצב: ידית סיר בולטת אל המעבר,
         * וזה גם מסוכן וגם לא נוח. כשאין מקום — ממלאים ומחכים
         * למקום הבא ברצף.
         */
        const tooClose =
          slot.role === 'hob' &&
          (at - span.fromMm < SAFETY.hobFromWallMm || span.toMm - (at + w) < SAFETY.hobFromWallMm);
        if (tooClose) {
          const filler = fitWidth(span.toMm - at, { ...slot, minMm: MIN_BOX }, false);
          if (filler === null) break;
          put(p, 'k-base-door2', at, filler, 'store');
          at += filler;
          continue;
        }

        put(p, slot.key, at, w, slot.role);
        if (q[0]) q = q.slice(1);
        at += w;
      }
    }
    /* מה שנשאר בתור של הקיר הזה עובר הלאה, ורק בסוף נחשב "לא נכנס" */
    if (i + 1 < queues.length) queues[i + 1] = [...q, ...queues[i + 1]];
    else queue = q;
  }

  for (const missed of queue) {
    dropped.push(`${NAME[missed.key] ?? missed.key} — לא נשאר קיר פנוי ברוחב ${missed.minMm} מ"מ`);
  }

  /* ---- ארונות עליונים ---- */
  if (priority === 'economical') {
    notes.push('בלי ארונות עליונים — הגרסה החסכונית');
    /*
     * מכשיר שנבחר אינו נעלם בגלל העדפת אחסון.
     *
     * טיפול המיקרוגל ישב כולו בענף שאינו החסכוני, ולכן מי שביקש
     * מיקרוגל בלי תנור קיבל הצעה חסכונית בלי מיקרוגל ובלי מילה —
     * רשימת "לא נכנס" הייתה ריקה. אם אין לו מקום, זה נאמר.
     */
    if (input.appliances.microwave && !input.appliances.oven) {
      dropped.push('מיקרוגל — בגרסה החסכונית אין ארונות עליונים לתלות אותו');
    }
    if (input.appliances.hood && input.appliances.hob) {
      dropped.push('קולט אדים — בגרסה החסכונית אין ארונות עליונים לתלות אותו');
    }
  } else {
    const hood = input.appliances.hood && input.appliances.hob;
    for (const u of [...units]) {
      if (u.level !== 'floor') continue;
      const wall = wallOf(input, u.wallId);
      if (upperBlocked(wall, u.xMm, u.widthMm)) continue;
      /* מעל כיריים תלוי קולט אדים ולא ארון; ובלי קולט — כלום */
      if (u.role === 'hob') {
        if (hood) units.push({ ...u, catalogKey: 'k-up-hood', role: 'hood', level: 'wall' });
        continue;
      }
      units.push({
        ...u,
        catalogKey: u.widthMm > 600 ? 'k-up-door2' : 'k-up-door1',
        role: 'upper',
        level: 'wall',
        /* הארון העליון אינו פינה מתה גם כשמתחתיו יש אחת */
        blindMm: undefined,
      });
    }
    /* מיקרוגל בלי תנור יושב בארון עליון מעל אזור ההכנה */
    if (input.appliances.microwave && !input.appliances.oven) {
      const spot = units.find((u) => u.role === 'upper' && u.widthMm >= 600);
      if (spot) {
        spot.catalogKey = 'k-up-micro';
        spot.role = 'oven';
        spot.widthMm = 600;
      } else {
        dropped.push('מיקרוגל — אין ארון עליון ברוחב 600 מ"מ שאפשר לשים בו אותו');
      }
    }
  }

  if (units.some((u) => u.role === 'hood')) {
    notes.push(`תחתית קולט האדים ${SAFETY.hoodElectricMm} מ"מ מעל הכיריים`);
  } else if (priority !== 'economical' && input.appliances.hood && input.appliances.hob) {
    dropped.push('קולט אדים — אין ארון עליון מעל הכיריים שאפשר לתלות אותו בו');
  }

  /* ---- ישיבה ---- */
  if (input.seating) {
    const island = islandFor(input, layout);
    if (island) {
      units.push(island);
      notes.push(`אי לישיבה — מרווח ${ISLAND.clearMm} מ"מ מסביבו, ומשטח בולט ${ISLAND.overhangMm} מ"מ לכיסאות`);
    } else {
      dropped.push(`ישיבה — לחדר אין מקום לאי: צריך ${ISLAND.roomAreaM2} מ"ר ומרווח ${ISLAND.clearMm} מ"מ מכל צד`);
    }
  }

  if (layout === 'galley') {
    const advice = aisleAdvice(aisleOf(run));
    if (advice) notes.push(advice);
  }

  return {
    key: `${layout}-${priority}`,
    layout,
    priority,
    title: PRIORITY_NAMES[priority],
    layoutName: LAYOUT_NAMES[layout],
    units,
    /* אותה הערה על שתי פינות היא אותה הערה — פעם אחת מספיקה */
    dropped: [...new Set(dropped)],
    notes: [...new Set(notes)],
    score: scoreOf(units, input.appliances, input.plan),
  };
}

const LAYOUT_NAMES: Record<LayoutKind, string> = {
  single: 'קו אחד',
  galley: 'שני קווים',
  l: 'פינת L',
  u: 'פרסה',
};

const PRIORITY_NAMES: Record<Priority, string> = {
  ergonomic: 'נוח לעבודה',
  economical: 'חסכוני',
  storage: 'מקסימום אחסון',
};

function wallOf(input: AutoInput, wallId: string): Wall {
  return input.walls.find((w) => w.id === wallId) ?? input.walls[0];
}

/* ------------------------------------------------------------------ */
/* אי                                                                  */
/* ------------------------------------------------------------------ */

/** שטח החדר במ"ר, לפי מצולע הקירות. */
function roomAreaM2(plan: PlanWall[]): number {
  if (plan.length < 3) return 0;
  let sum = 0;
  for (const p of plan) sum += p.start.x * p.end.y - p.end.x * p.start.y;
  return Math.abs(sum) / 2 / 1e6;
}

/**
 * אי, אם החדר באמת מרשה אותו.
 *
 * אי אינו שאלה של רצון אלא של מרווח: צריך מעבר מלא מכל צד, ולכן
 * הרוחב הפנוי חייב להכיל שורת ארונות, שני מעברים ואת האי עצמו.
 * חדר שלא עומד בזה מקבל "לא נכנס" ולא אי צפוף.
 */
function islandFor(input: AutoInput, layout: LayoutKind): Placement | null {
  const { plan } = input;
  if (layout === 'galley' || plan.length < 3) return null;
  if (roomAreaM2(plan) < ISLAND.roomAreaM2) return null;

  const xs = plan.map((p) => p.start.x);
  const ys = plan.map((p) => p.start.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const rows = layout === 'single' ? 1 : 2;
  const need = rows * KITCHEN.baseDepthMm + 2 * ISLAND.clearMm + ISLAND.minDepthMm;
  if (Math.min(w, h) < need) return null;

  const long = Math.max(w, h);
  const widthMm = Math.min(1200, Math.max(ISLAND.minWidthMm, long - 2 * ISLAND.clearMm));
  return {
    catalogKey: 'k-base-door2',
    wallId: plan[0].wall.id,
    xMm: 0,
    widthMm,
    level: 'floor',
    role: 'island',
    free: {
      xMm: Math.round(Math.min(...xs) + w / 2 - widthMm / 2),
      zMm: Math.round(Math.min(...ys) + h / 2 - KITCHEN.baseDepthMm / 2),
      headingDeg: plan[0].headingDeg,
    },
  };
}

/* ------------------------------------------------------------------ */
/* ניקוד                                                               */
/* ------------------------------------------------------------------ */

/**
 * כמה ההצעה טובה.
 *
 * שלושה דברים נמדדים: משולש העבודה, אורך משטח ההכנה הרציף, ומטר
 * רץ. הסולם אחד לכל ההצעות במכוון — ציון שמשתנה לפי העדיפות אינו
 * ניתן להשוואה, ושתי הצעות זו לצד זו הן בדיוק מה שהמסך מציג.
 * הגרסה החסכונית תקבל ציון נמוך יותר, וזה נכון: היא ויתור מדעת,
 * ולא מטבח טוב יותר.
 */
function scoreOf(units: Placement[], want: Appliances, plan: PlanWall[]): Score {
  const floor = units.filter((u) => !u.free && u.level !== 'wall');
  const runMm = floor.reduce((n, u) => n + u.widthMm, 0);

  /*
   * משולש העבודה, בקואורדינטות החדר.
   *
   * עד כאן שתי תחנות על קירות שונים נמדדו כסכום הקואורדינטות
   * המקומיות שלהן — שתי מידות שמתחילות בשתי נקודות שונות. בחדר L
   * זה נתן 350+1,575 = 1,925 מ״מ למרחק שבפועל הוא כ-3,975 באוויר
   * וכ-5,225 במסלול דרך הפינה. סכום כזה אינו אף אחד מהשניים.
   *
   * מה שנמדד עכשיו מוגדר במפורש: המרחק הישר בין מרכזי התחנות
   * ברצפת החדר, כפי שמודדים משולש עבודה. אותה מערכת צירים שבה
   * נמדדת ההתנגשות, ולכן שני המספרים מדברים על אותו חדר.
   */
  const centre = (role: Role) => {
    const u = floor.find((x) => x.role === role);
    if (!u) return null;
    const p = plan.find((q) => q.wall.id === u.wallId);
    if (!p) return null;
    const a = rad(p.headingDeg);
    const at = u.xMm + u.widthMm / 2;
    return { x: p.start.x + Math.cos(a) * at, y: p.start.y + Math.sin(a) * at };
  };
  const pts = [centre('sink'), centre('hob'), centre('fridge')].filter((v) => v !== null);
  const legs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      legs.push(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y));
    }
  }
  const inRange = legs.filter((l) => l >= TRIANGLE.minLegMm && l <= TRIANGLE.maxLegMm).length;
  const triangle = legs.length ? inRange / legs.length : 0;

  /*
   * משטח ההכנה: הרצף הארוך ביותר של משטח *רציף*.
   *
   * החישוב הקודם חיבר רוחבים עוקבים ברשימה בלי לבדוק מה ביניהם,
   * ולכן קיר 3,500 עם דלת ברוחב 900 באמצע דיווח על רצף הכנה של
   * 1,200 מ״מ — 600 מצד אחד של הדלת ו-600 מהצד השני. רצף נשבר
   * במרווח בין הארגזים, בפתח שבקיר, ובמכשיר.
   */
  const appliance: Role[] = ['sink', 'hob', 'oven', 'fridge', 'dishwasher'];
  let prepMm = 0;
  for (const wallId of new Set(floor.map((u) => u.wallId))) {
    const wall = plan.find((q) => q.wall.id === wallId)?.wall;
    const opens = (wall?.features ?? []).filter((f) => f.kind === 'door' || f.kind === 'window');
    let run = 0;
    let end: number | null = null;
    for (const u of floor.filter((x) => x.wallId === wallId).sort((a, b) => a.xMm - b.xMm)) {
      const gap = end === null || Math.abs(u.xMm - end) > 1;
      /* פתח בין הארגז הקודם לזה — אין רצף מעליו */
      const cut =
        end !== null &&
        opens.some((f) => f.xMm < u.xMm && f.xMm + f.widthMm > end!);
      run = appliance.includes(u.role) || gap || cut ? u.widthMm : run + u.widthMm;
      if (appliance.includes(u.role)) run = 0;
      end = u.xMm + u.widthMm;
      prepMm = Math.max(prepMm, run);
    }
  }

  const boxes = units.length;
  /*
   * תחנה שנתבקשה ואינה בהצעה מורידה את הציון, ולא רק מופיעה
   * ברשימת "לא נכנס".
   *
   * הצעה שבה לא נכנסו הכיריים ולא התנור קיבלה 99 ו"משולש עבודה
   * 100%": המשולש חושב על הצלעות שקיימות, וכשאין כיריים יש רק
   * צלע אחת — שהיא תמיד בטווח. מטבח בלי כיריים אינו מטבח מצוין,
   * וציון גבוה עליו הוא הבטחה שאינה מתקיימת.
   */
  const STATIONS: [keyof Appliances, Role][] = [
    ['hob', 'hob'],
    ['oven', 'oven'],
    ['fridge', 'fridge'],
    ['dishwasher', 'dishwasher'],
  ];
  const asked = STATIONS.filter(([a]) => want[a]);
  /* הכיור אינו נבחר — הוא תמיד חלק מהמטבח */
  const missing =
    asked.filter(([, role]) => !units.some((u) => u.role === role)).length +
    (units.some((u) => u.role === 'sink') ? 0 : 1);
  const complete = asked.length + 1 === 0 ? 1 : 1 - missing / (asked.length + 1);

  const total =
    (45 * triangle + 30 * Math.min(prepMm / PREP.widthMm, 1) + 25 * Math.min(runMm / 5000, 1)) *
    complete;
  return {
    triangle: missing ? 0 : triangle,
    prepMm,
    runMm,
    boxes,
    missing,
    total: Math.round(total),
  };
}

/* ------------------------------------------------------------------ */
/* הכניסה                                                             */
/* ------------------------------------------------------------------ */

/**
 * כל ההצעות שהחדר מרשה, מהטובה לפחות.
 *
 * פריסה × עדיפות: קודם נבחרות הפריסות שהחדר בכלל מאפשר, ולכל
 * אחת נבנות שלוש גרסאות. מה שלא נכנס יורד עם הסבר ולא נדחס בכוח —
 * מטבח שנראה שלם ואי אפשר לפתוח בו מגירה גרוע ממטבח שאומר מראש
 * מה לא נכנס.
 */
export function planKitchen(input: AutoInput): Proposal[] {
  /*
   * פריסה אחת, שלוש עדיפויות — ולכן שלוש הצעות: הטובה ביותר
   * לנוחות, לאחסון ולמחיר. הפריסה אינה נבחרת מתוך רשימה אלא היא
   * הגדולה שהחדר מרשה, כי קיר ריק במטבח הוא אחסון שלא נבנה.
   *
   * חדר צר אינו משאיר מרווח לבחור בו, ואז שתי עדיפויות מגיעות
   * לאותו מטבח בדיוק. שני כרטיסים זהים אינם בחירה אלא רעש, ולכן
   * נשאר אחד — ובכותרת שלו כתובות שתי העדיפויות שהוא משרת.
   */
  const layout = layoutFor(input.plan);
  if (!layout) return [];
  const out: Proposal[] = [];
  const seen = new Map<string, Proposal>();
  for (const priority of ['ergonomic', 'storage', 'economical'] as const) {
    const p = buildProposal(input, layout, priority);
    if (!p || !p.units.length) continue;
    const sig = p.units
      .map((u) => `${u.catalogKey}|${u.wallId}|${u.xMm}|${u.widthMm}`)
      .sort()
      .join(';');
    /*
     * הצעה זהה לקודמת נשארת ברשימה ומסומנת ככזו. חדר צר לא משאיר
     * מרווח לבחור בו, ואז האופטימום לנוחות ולאחסון הוא אותו מטבח
     * — וזו תשובה שכדאי לראות, לא כרטיס שנעלם בלי הסבר.
     */
    const twin = seen.get(sig);
    if (twin) p.notes.push(`אותה פריסה כמו "${twin.title}"`);
    else seen.set(sig, p);
    out.push(p);
  }
  return out;
}

/** מה מפריע לתכנון, כשאין אף הצעה. */
export function whyNothing(plan: PlanWall[]): string {
  if (!plan.length) return 'אין קירות בחדר';
  const longest = Math.max(...plan.map((p) => p.wall.lengthMm));
  if (longest < MIN_WALL) return `הקיר הארוך ביותר הוא ${longest} מ"מ, וצריך לפחות ${MIN_WALL}`;
  /*
   * זווית שאינה ישרה נאמרת בשמה. "אין קטע פנוי" היה תשובה שגויה
   * לחדר שכולו פנוי ושהבעיה בו היא צורת הפינה.
   */
  if (plan.length > 1 && !squareCorners(plan)) {
    return 'התכנון האוטומטי בונה פינות ישרות בלבד. בחדר הזה יש פינה בזווית אחרת — אפשר להניח ארגזים ביד';
  }
  return 'הדלתות והעמודים לא משאירים קטע קיר פנוי';
}

/** המרווח שבין שתי שורות ארונות, כדי לומר אם הוא מספיק. */
function aisleAdvice(widthMm: number): string | null {
  if (!Number.isFinite(widthMm) || widthMm >= AISLE.twoCooksMm) return null;
  if (widthMm >= AISLE.workMm) return `מעבר ${Math.round(widthMm)} מ"מ — מספיק לטבח אחד; לשניים צריך ${AISLE.twoCooksMm}`;
  return `המעבר ${Math.round(widthMm)} מ"מ — מעבר עבודה מתחיל ב-${AISLE.workMm} מ"מ`;
}

/** שם קריא לארגז בהצעה, לתצוגה ברשימה. */
export const placementName = (p: Placement): string => NAME[p.catalogKey] ?? 'ארגז';

