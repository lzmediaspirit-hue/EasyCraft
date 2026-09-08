import type { HeightRef, WallFeature, WallFeatureKind, WallSide } from '../../db/types';

/** שדה מידה אחד בטופס הסימון. */
interface FeatureField {
  key: 'x' | 'width' | 'height' | 'y';
  label: string;
}

export interface FeatureDef {
  kind: WallFeatureKind;
  label: string;
  /** מידות וגובה ברירת מחדל במ"מ */
  w: number;
  h: number;
  y: number;
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
    tone: '#d6d3d1',
    onFloor: true,
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב העמוד' },
      { key: 'height', label: 'גובה העמוד' },
    ],
    hint: 'עמוד יושב על הרצפה ולרוב עולה עד התקרה.',
  },
  {
    kind: 'niche',
    label: 'נישה',
    w: 600,
    h: 600,
    y: 1000,
    tone: '#e7e5e4',
    fields: [
      { key: 'x', label: 'מהקיר לקצה' },
      { key: 'width', label: 'רוחב הנישה' },
      { key: 'height', label: 'גובה הנישה' },
      { key: 'y', label: 'תחתית' },
    ],
    hint: 'הנישה נמדדת כמו חלון — לקצה, ולתחתית הפתח.',
  },
];

export function featureDef(kind: WallFeatureKind): FeatureDef {
  return FEATURE_DEFS.find((f) => f.kind === kind) ?? FEATURE_DEFS[0];
}

/** סימון חדש עם מידות פתיחה סבירות לסוג שלו. */
export function newFeature(kind: WallFeatureKind): WallFeature {
  const def = featureDef(kind);
  return {
    id: crypto.randomUUID(),
    kind,
    xMm: 0,
    yMm: def.y,
    widthMm: def.w,
    heightMm: def.h,
    fromSide: 'start',
    heightRef: 'floor',
  };
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

export const SIDE_LABEL: Record<WallSide, string> = {
  start: 'משמאל',
  end: 'מימין',
};

export const HEIGHT_REF_LABEL: Record<HeightRef, string> = {
  floor: 'מהרצפה',
  ceiling: 'מהתקרה',
};
