import { alongWallMm, physicalHeightMm } from '../../db/types';
import type {
  HeightRef,
  PlacedUnit,
  WallFeature,
  WallFeatureKind,
  WallSide,
} from '../../db/types';

/** שדה מידה אחד בטופס הסימון. */
interface FeatureField {
  key: 'x' | 'width' | 'height' | 'y' | 'depth';
  label: string;
}

export interface FeatureDef {
  kind: WallFeatureKind;
  label: string;
  /** מידות וגובה ברירת מחדל במ"מ */
  w: number;
  h: number;
  y: number;
  /**
   * כמה הסימון יוצא מהקיר או נכנס אליו, כברירת מחדל.
   * ריק = הסימון שטוח על הקיר ואין לו עומק בכלל.
   */
  depth?: number;
  /**
   * הסימון נכנס לתוך הקיר במקום לצאת ממנו.
   * נישה מוסיפה עומק לארון שיעמוד בה; עמוד גונב ממנו.
   */
  intoWall?: boolean;
  /** צבע הסימון בהדמיה */
  tone: string;
  /**
   * המרחק האופקי נמדד למרכז הסימון ולא לקצה שלו.
   * שקע מודדים למרכז — שם הוא נקדח; חלון מודדים לקצה.
   */
  xToCenter?: boolean;
  /** הסימון תמיד יושב על הרצפה, ואין מה למדוד לתחתית שלו */
  onFloor?: boolean;
  /**
   * הסימון עולה מהרצפה עד התקרה, ולכן הגובה שלו הוא גובה החדר.
   *
   * עמוד בדירה אינו עומד לגובה שרירותי — הוא חלק מהבניין ומגיע עד
   * התקרה. לכן הוא נולד בגובה הקיר וממשיך להתאים את עצמו כשגובה
   * הקיר משתנה, כל עוד לא נקבע לו במפורש גובה אחר.
   */
  fullHeight?: boolean;
  /**
   * ארגז אינו יכול לעמוד על הסימון הזה.
   *
   * דלת וחלון הם פתח, ועמוד הוא בטון — אי אפשר לבנות לתוכם, ולכן
   * ההנחה נחסמת ולא מסתפקת באזהרה. שקע ונקודת מים לעומת זאת
   * נקדחים בגב הארון, ומדרגה רק גונבת עומק — אלה מותרים.
   */
  blocks?: boolean;
  /**
   * אילו מידות מבקשים, ובאילו מילים.
   * לשדה הגובה נוספת בתצוגה המילה "מהרצפה" או "מהתקרה", לפי המנין
   * שנבחר — ולכן התווית שלו היא שם העצם בלבד.
   */
  fields: FeatureField[];
  /** משפט קצר שמסביר איך מודדים את זה בשטח */
  hint: string;
}

/**
 * לכל סימון יש מידות אחרות שהנגר מודד בשטח.
 * שקע נמדד למרכז ולגובה מהרצפה; דלת נמדדת לקצה הפתח ולגובה הפתח.
 * לכן הטופס משתנה לפי הסימון במקום לבקש מכולם "מ-" ו"רוחב".
 */
export const FEATURE_DEFS: FeatureDef[] = [
  {
    kind: 'window',
    label: 'חלון',
    w: 1000,
    h: 1200,
    y: 900,
    tone: '#7dd3fc',
    blocks: true,
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב החלון' },
      { key: 'height', label: 'גובה החלון' },
      { key: 'y', label: 'סף' },
    ],
    hint: 'הסף הוא תחתית החלון. מעליו לרוב אין ארון תלוי.',
  },
  {
    kind: 'door',
    label: 'דלת / פתח',
    w: 900,
    h: 2100,
    y: 0,
    tone: '#a8a29e',
    onFloor: true,
    blocks: true,
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב הפתח' },
      { key: 'height', label: 'גובה הפתח' },
    ],
    hint: 'הפתח יושב על הרצפה, ולכן נמדד רק הגובה שלו.',
  },
  {
    kind: 'socket',
    label: 'שקע חשמל',
    w: 100,
    h: 100,
    y: 1100,
    tone: '#fbbf24',
    xToCenter: true,
    fields: [
      { key: 'x', label: 'למרכז השקע' },
      { key: 'y', label: 'מרכז' },
      { key: 'width', label: 'רוחב השקע' },
      { key: 'height', label: 'גובה השקע' },
    ],
    hint: 'שקע מודדים למרכז — שם הוא נקדח בגב הארון.',
  },
  {
    kind: 'water',
    label: 'נקודת מים',
    w: 100,
    h: 100,
    y: 500,
    tone: '#60a5fa',
    xToCenter: true,
    fields: [
      { key: 'x', label: 'למרכז הנקודה' },
      { key: 'y', label: 'מרכז' },
      { key: 'width', label: 'רוחב' },
      { key: 'height', label: 'גובה' },
    ],
    hint: 'נקודת מים נמדדת למרכז, כמו שקע.',
  },
  {
    kind: 'pillar',
    label: 'עמוד / פינוי',
    w: 300,
    h: 2600,
    y: 0,
    depth: 250,
    tone: '#d6d3d1',
    onFloor: true,
    fullHeight: true,
    blocks: true,
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב העמוד' },
      { key: 'height', label: 'גובה העמוד' },
      { key: 'depth', label: 'כמה בולט' },
    ],
    hint: 'עמוד יושב על הרצפה, עולה לרוב עד התקרה, ובולט אל תוך החדר.',
  },
  {
    kind: 'niche',
    label: 'נישה',
    w: 600,
    h: 600,
    y: 1000,
    depth: 150,
    intoWall: true,
    tone: '#e7e5e4',
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב הנישה' },
      { key: 'height', label: 'גובה הנישה' },
      { key: 'y', label: 'תחתית' },
      { key: 'depth', label: 'עומק' },
    ],
    hint: 'הנישה נמדדת כמו חלון — לקצה, ולתחתית הפתח — ונכנסת לתוך הקיר.',
  },
  {
    kind: 'step',
    label: 'מדרגת קיר',
    w: 800,
    h: 2600,
    y: 0,
    depth: 60,
    tone: '#e7d8c4',
    onFloor: true,
    fullHeight: true,
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב המדרגה' },
      { key: 'height', label: 'גובה המדרגה' },
      { key: 'depth', label: 'כמה בולטת' },
    ],
    hint: 'גם קיר ישר יוצא מהבנייה עם מדרגה של כמה סנטימטרים. סמן אותה כאן, והארון יידע לוותר עליהם.',
  },
];

export function featureDef(kind: WallFeatureKind): FeatureDef {
  return FEATURE_DEFS.find((f) => f.kind === kind) ?? FEATURE_DEFS[0];
}

/**
 * סימון חדש עם מידות פתיחה סבירות לסוג שלו.
 * סימון שעולה עד התקרה נולד בגובה החדר עצמו, ולא בגובה קבוע שנכתב
 * פעם אחת בקוד ולא מתאים לשום דירה במיוחד.
 */
export function newFeature(kind: WallFeatureKind, wallHeightMm?: number): WallFeature {
  const def = featureDef(kind);
  return {
    id: crypto.randomUUID(),
    kind,
    xMm: 0,
    yMm: def.y,
    widthMm: def.w,
    heightMm: def.fullHeight && wallHeightMm ? wallHeightMm : def.h,
    depthMm: def.depth,
    fromSide: 'start',
    heightRef: 'floor',
  };
}

/**
 * גובה הקיר השתנה — הסימונים שעולים עד התקרה עולים איתו.
 *
 * רק סימון שעמד בדיוק על הגובה הקודם ממשיך: מי שקבע לעמוד גובה
 * אחר קבע אותו במפורש, ולא מחליפים לו אותו מאחורי הגב.
 */
export function growToCeiling(
  features: WallFeature[],
  fromHeightMm: number,
  toHeightMm: number,
): WallFeature[] {
  if (fromHeightMm === toHeightMm) return features;
  return features.map((f) =>
    featureDef(f.kind).fullHeight && f.heightMm === fromHeightMm
      ? { ...f, heightMm: toHeightMm }
      : f,
  );
}

/**
 * האם הארגז והסימון תופסים את אותו מקום על הקיר.
 *
 * שניהם נמדדים באותה מערכת — מרחק מתחילת הקיר וגובה מהרצפה — ולכן
 * זו חפיפת מלבנים פשוטה. היא יושבת כאן ולא בשני מקומות, כי אותה
 * שאלה נשאלת גם כשחוסמים הנחה וגם כשמזהירים עליה, ושתי תשובות
 * שונות לאותה שאלה הן באג שממתין לקרות.
 */
export function featureOverlaps(
  u: Pick<PlacedUnit, 'xMm' | 'yMm' | 'heightMm' | 'counterMm' | 'widthMm' | 'depthMm' | 'rotationDeg'>,
  f: WallFeature,
): boolean {
  return (
    u.xMm < f.xMm + f.widthMm &&
    u.xMm + alongWallMm(u) > f.xMm &&
    u.yMm < f.yMm + f.heightMm &&
    /* הגובה הוא מה שתופס מקום: הארון, ומשטח העבודה שעליו. ארון
       800 עם משטח 40 מגיע לחלון שתחתיתו 810, וזה מה שנבדק כאן. */
    u.yMm + physicalHeightMm(u) > f.yMm
  );
}

/**
 * האם סימון חוסם עומד במלבן הזה של חזית הקיר.
 *
 * אותה חפיפה כמו ב-`featureOverlaps`, על מלבן במקום על ארגז: כך
 * אפשר לשאול "האם מותר להעמיד כאן גוף בגובה הזה" עוד לפני שיש
 * ארגז. התכנון האוטומטי שואל את זה על כל יחידה שהוא שוקל, והוא
 * חייב לקבל בדיוק את התשובה שיקבל אחר כך שער ההנחה — אחרת הוא
 * מציע מטבח ואז פוסל אותו בעצמו.
 *
 * `topMm` הוא הגובה שהגוף מגיע אליו *כולל* משטח העבודה, כי זה מה
 * שתופס מקום מול החלון.
 */
export function wallBlocks(
  features: WallFeature[],
  fromMm: number,
  widthMm: number,
  bottomMm: number,
  topMm: number,
): boolean {
  return features.some(
    (f) =>
      featureDef(f.kind).blocks &&
      f.xMm < fromMm + widthMm &&
      f.xMm + f.widthMm > fromMm &&
      f.yMm < topMm &&
      f.yMm + f.heightMm > bottomMm,
  );
}

/*
 * הגיאומטריה נשמרת תמיד באותה צורה — xMm מתחילת הקיר לקצה השמאלי,
 * yMm מהרצפה לתחתית. מה שמשתנה הוא רק איך המספר מוצג ונקלט, לפי
 * הקצה והמנין שהמשתמש בחר. כך הציור לא צריך לדעת איך נמדד.
 */

/** המרחק האופקי כפי שהמשתמש רואה אותו. */
export function featureX(f: WallFeature, wallLengthMm: number): number {
  const def = featureDef(f.kind);
  const point = def.xToCenter ? f.xMm + f.widthMm / 2 : f.xMm;
  if ((f.fromSide ?? 'start') === 'start') return point;
  return wallLengthMm - (def.xToCenter ? point : f.xMm + f.widthMm);
}

/** תרגום המרחק שהמשתמש הקליד חזרה ל-xMm. */
export function featureXToMm(f: WallFeature, value: number, wallLengthMm: number): number {
  const def = featureDef(f.kind);
  const half = def.xToCenter ? f.widthMm / 2 : 0;
  const fromEnd = (f.fromSide ?? 'start') === 'end';
  const x = fromEnd
    ? wallLengthMm - value - (def.xToCenter ? half : f.widthMm)
    : value - half;
  return Math.max(Math.round(x), 0);
}

/** הגובה כפי שהמשתמש רואה אותו — מהרצפה או מהתקרה. */
export function featureY(f: WallFeature, wallHeightMm: number): number {
  const def = featureDef(f.kind);
  // בסימון נקודתי מודדים למרכז; בפתח מודדים לתחתית
  const point = def.xToCenter ? f.yMm + f.heightMm / 2 : f.yMm;
  if ((f.heightRef ?? 'floor') === 'floor') return point;
  return wallHeightMm - (def.xToCenter ? point : f.yMm + f.heightMm);
}

/** תרגום הגובה שהמשתמש הקליד חזרה ל-yMm. */
export function featureYToMm(f: WallFeature, value: number, wallHeightMm: number): number {
  const def = featureDef(f.kind);
  const half = def.xToCenter ? f.heightMm / 2 : 0;
  const fromCeiling = (f.heightRef ?? 'floor') === 'ceiling';
  const y = fromCeiling
    ? wallHeightMm - value - (def.xToCenter ? half : f.heightMm)
    : value - half;
  return Math.max(Math.round(y), 0);
}

/**
 * העומק בפועל של סימון: מה שנשמר, ואם לא נשמר — ברירת המחדל שלו.
 * סימון שטוח על הקיר מחזיר 0.
 */
export function featureDepth(f: WallFeature): number {
  return Math.max(f.depthMm ?? featureDef(f.kind).depth ?? 0, 0);
}

/**
 * כמה עומק הסימון גונב מארון שיעמוד לפניו, או מוסיף לו.
 * חיובי = הארון צריך לוותר על העומק הזה; שלילי = יש לו עוד מקום.
 */
export function featureBiteMm(f: WallFeature): number {
  const def = featureDef(f.kind);
  if (!def.depth && f.depthMm === undefined) return 0;
  return def.intoWall ? -featureDepth(f) : featureDepth(f);
}

export const SIDE_LABEL: Record<WallSide, string> = {
  start: 'משמאל',
  end: 'מימין',
};

export const HEIGHT_REF_LABEL: Record<HeightRef, string> = {
  floor: 'מהרצפה',
  ceiling: 'מהתקרה',
};
