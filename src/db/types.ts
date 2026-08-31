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
  /**
   * מגירות חיצוניות עם חזית בולטת, או פנימיות מאחורי דלתות.
   * ההבדל משנה גם את הציור וגם את חישוב שטח החזיתות.
   */
  drawerStyle?: DrawerStyle;
  /** דפנות זרות — צדדים גלויים שנבנים מלוח חזיתי ועמוקים מהארגז */
  exposed?: ExposedSides;
  /** גוון החזית שנבחר מקטלוג הגוונים */
  finishId?: string;
  /** דלתות זכוכית במקום חזית מלאה */
  glassDoors?: boolean;
  /** פסי לד והיכן הם מותקנים */
  led?: LedSpot[];
  /**
   * מרחקים בין המדפים מלמטה למעלה, כולל המרווח לתחתית ולתקרה.
   * אורך המערך הוא מספר המדפים ועוד אחד. ריק = מרווחים שווים.
   */
  shelfGapsMm?: number[];
}

/** מיקום פס לד בארגז. */
export type LedSpot = 'start' | 'end' | 'top' | 'bottom' | 'shelf';

/** מגירה חיצונית נראית בחזית; פנימית מסתתרת מאחורי דלת. */
export type DrawerStyle = 'outer' | 'inner';

/** צדדים גלויים של הארגז שנבנים כדופן זרה. */
export interface ExposedSides {
  start?: boolean;
  end?: boolean;
  top?: boolean;
  bottom?: boolean;
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
  /** פריט נפוץ — מופיע בספרייה הראשית ולא ברשימת "ארגזים נוספים" */
  common?: boolean;
  /** פריט שהגיע עם האפליקציה, להבדיל מפריט שהמשתמש יצר */
  isBuiltin: boolean;
  sortOrder: number;
  /** הערת תקן קצרה — למה המידות האלה */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* חומרים והגדרות                                                      */
/* ------------------------------------------------------------------ */

/** תפקיד הלוח במבנה הארון. */
export type BoardRole = 'carcass' | 'front' | 'back';

/**
 * לוח גלם. העובי לא נשמר כאן במכוון — הוא משתנה בין פרויקטים ובין
 * משלוחים, ונקבע מול הלוח הפיזי בשטח.
 */
export interface Board extends Entity {
  name: string;
  /** מספר קטלוגי אצל הספק */
  catalogNumber?: string;
  role: BoardRole;
  /** ללוח יש כיוון סיבים שמחייב ניסור בכיוון קבוע */
  hasGrain: boolean;
  /** מחיר פלטה במפעל */
  factoryPrice: number;
  /** מחיר פלטה ללקוח */
  consumerPrice: number;
  sortOrder: number;
}

/** גוון מתוך קטלוג הגוונים של לוח מסוים. */
export interface Finish extends Entity {
  boardId: string;
  name: string;
  /** קוד הגוון אצל הספק */
  code?: string;
  /** צבע לתצוגה בהדמיה */
  hex: string;
  /** מחיר שונה מהמחיר הבסיסי של הלוח, אם יש */
  factoryPrice?: number;
  consumerPrice?: number;
  sortOrder: number;
}

/** מחיר לוח שנקבע אחרת עבור פרויקט מסוים. */
export interface ProjectPrice extends Entity {
  projectId: string;
  boardId: string;
  factoryPrice?: number;
  consumerPrice?: number;
}

/** הגדרות כלליות של העסק. רשומה יחידה. */
export interface Settings {
  id: 'app';
  sheetWidthMm: number;
  sheetHeightMm: number;
  /** עובי כרסום — רוחב חתך המסור, נוסף לכל חלק בחישוב */
  kerfMm: number;
  /**
   * עובי גוף נומינלי לחישוב בלבד.
   * העובי האמיתי נקבע מול הלוח הפיזי ולכן אינו חלק מהגדרת הלוח,
   * אבל בלי מספר כלשהו אי אפשר לגזור את רוחב התחתית והתקרה.
   */
  carcassThicknessMm: number;
  /** אחוז ניצולת פלטה */
  yieldPct: number;
  updatedAt: number;
}
