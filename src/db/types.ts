/** ישות בסיס — לכל רשומה מזהה ותאריכי מעקב. */
export interface Entity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Customer extends Entity {
  /** שם הלקוח — חובה */
  name: string;
  /** עיר — חובה */
  city: string;
  /** טלפון בפורמט מנורמל (ספרות בלבד) — לא חובה */
  phone?: string;
}

/** מה שנדרש כדי ליצור לקוח חדש. */
export type NewCustomer = Pick<Customer, 'name' | 'city'> & { phone?: string };

/* ------------------------------------------------------------------ */
/* פרויקטים                                                            */
/* ------------------------------------------------------------------ */

/** סוג החדר — קובע אילו מוצרים יוצגו בספרייה. */
export type RoomKind = 'kitchen' | 'living' | 'bedroom' | 'custom';

export interface Project extends Entity {
  customerId: string;
  /** שם הפרויקט, למשל "מטבח" או "ארון חדר הורים" */
  name: string;
  roomKind: RoomKind;
}

/* ------------------------------------------------------------------ */
/* קירות                                                               */
/* ------------------------------------------------------------------ */

/** מכשול או נקודה על הקיר שהנגר חייב לקחת בחשבון. */
export type WallFeatureKind = 'window' | 'door' | 'socket' | 'water' | 'pillar' | 'niche';

export interface WallFeature {
  id: string;
  kind: WallFeatureKind;
  /** מרחק מתחילת הקיר, במ"מ */
  xMm: number;
  /** גובה מהרצפה, במ"מ */
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface Wall extends Entity {
  projectId: string;
  /** סדר הקיר בפרויקט, מתחיל ב-0 */
  index: number;
  lengthMm: number;
  heightMm: number;
  features: WallFeature[];
}

/* ------------------------------------------------------------------ */
/* ארגזים על הקיר                                                      */
/* ------------------------------------------------------------------ */

/** מפלס ההתקנה — קובע את הגובה שבו הארגז יושב על הקיר. */
export type UnitLevel = 'floor' | 'wall' | 'tall';

/** ארגז שהונח על קיר מסוים בפרויקט. */
export interface PlacedUnit extends Entity {
  projectId: string;
  wallId: string;
  catalogItemId: string;
  /** צילום השם ברגע ההנחה — כדי שעריכה בספרייה לא תשנה פרויקט קיים */
  name: string;
  glyph: string;
  doors?: number;
  /** שורות מגירות */
  drawers?: number;
  /** עמודות מגירות — שידה עם מגירות זו לצד זו */
  drawerCols?: number;
  /** מספר מדפים פנימיים */
  shelves?: number;
  level: UnitLevel;
  /** מרחק מתחילת הקיר, במ"מ */
  xMm: number;
  /** גובה תחתית הארגז מהרצפה, במ"מ */
  yMm: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** סוקל מתחת לארגז — מצויר אוטומטית בהדמיה */
  socleMm?: number;
  /** משטח עבודה מעל הארגז */
  counterMm?: number;
  /** כשדולק, תחתית הארגז נעולה לרצפה. כשכבוי אפשר לגרור אותו לגובה חופשי */
  floorLocked?: boolean;
  /** מאיזה קצה של הקיר נמדד המיקום בתצוגה */
  anchorEnd?: boolean;
}

/* ------------------------------------------------------------------ */
/* ספריית המוצרים                                                      */
/* ------------------------------------------------------------------ */

/** קבוצה בספרייה — הכרטיסייה שבה המוצר מופיע. */
export type CatalogGroup = 'base' | 'upper' | 'tall' | 'storage';

export interface CatalogItem extends Entity {
  /** באילו חדרים המוצר רלוונטי */
  rooms: RoomKind[];
  group: CatalogGroup;
  name: string;
  /** מפתח האיור של הארגז */
  glyph: string;
  doors?: number;
  drawers?: number;
  drawerCols?: number;
  shelves?: number;
  level: UnitLevel;
  defaultWidthMm: number;
  /** רוחבי תקן נפוצים למוצר הזה */
  widthOptionsMm: number[];
  defaultHeightMm: number;
  defaultDepthMm: number;
  /** גובה תחתית הארגז מהרצפה */
  defaultYMm: number;
  socleMm?: number;
  counterMm?: number;
  /** פריט שהגיע עם האפליקציה, להבדיל מפריט שהמשתמש יצר */
  isBuiltin: boolean;
  sortOrder: number;
  /** הערת תקן קצרה — למה המידות האלה */
  note?: string;
}
