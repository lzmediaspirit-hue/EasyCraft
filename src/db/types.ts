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
  /**
   * הפנייה בתחילת הקיר ביחס לקיר הקודם, במעלות.
   * 90 היא פינה ישרה; ערך אחר מתאר חדר שאינו מלבן.
   * לקיר הראשון אין משמעות.
   */
  turnDeg?: number;
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
  /** גובה תחתית הארגז מהרצפה, במ"מ. ארגז שעומד על הרצפה יושב על 0 */
  yMm: number;
  widthMm: number;
  /**
   * הגובה הכולל של הארגז, כולל הרגליים.
   * גוף הארון בפירוק החומרים הוא הגובה הזה פחות גובה הרגליים.
   */
  heightMm: number;
  depthMm: number;
  /** גובה הרגליים, נכלל בתוך heightMm */
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
  /** גוון החזית — נשמר מגרסאות קודמות, משמש כברירת מחדל ל-frontFinishId */
  finishId?: string;
  /** גוון גוף הארון */
  carcassFinishId?: string;
  /** גוון החזיתות */
  frontFinishId?: string;
  /** גוון הדפנות הזרות */
  exposedFinishId?: string;
  /** סוג הגב */
  backKind?: BackKind;
  /** ידיות על החזיתות */
  handles?: boolean;
  /** דלתות זכוכית במקום חזית מלאה */
  glassDoors?: boolean;
  /** פסי לד והיכן הם מותקנים */
  led?: LedSpot[];
  /**
   * מרחקים בין המדפים מלמטה למעלה, כולל המרווח לתחתית ולתקרה.
   * אורך המערך הוא מספר המדפים ועוד אחד. ריק = מרווחים שווים.
   */
  shelfGapsMm?: number[];
  /**
   * חלוקת הפנים לאזורים. כשהיא ריקה הפנים נגזר מהשדות הפשוטים
   * (מדפים, מגירות), וכך ארגזים ישנים ממשיכים לעבוד כרגיל.
   */
  zones?: Zone[];
  /** מנגנון פתיחת החזית */
  opening?: OpeningMech;
  /** סוג פינה, כשהארגז יושב במפגש קירות */
  corner?: CornerKind;
  /** רוחב החלק החסום בפינה מתה */
  blindMm?: number;
  /** עובי הלוח — רלוונטי לדופן בודדת שנקנית בעובי משלה */
  panelThicknessMm?: number;
}

/**
 * סוג הגב.
 * thin — לוח דק בחריץ, ברירת המחדל.
 * carcass — גב בעובי הגוף, כשצריך חוזק או כשהגב גלוי.
 * none — בלי גב.
 */
export type BackKind = 'thin' | 'carcass' | 'none';

/** מיקום פס לד בארגז. */
export type LedSpot = 'start' | 'end' | 'top' | 'bottom' | 'shelf';

/** מנגנון פתיחת החזית. */
export type OpeningMech = 'hinge' | 'lift' | 'sliding';

/**
 * סוג פינה.
 * blindStart / blindEnd — פינה מתה: צד אחד של הארגז נחסם על ידי
 * הארון שעל הקיר הסמוך, ורק החלק הנותר נגיש.
 * lShape — ארגז פינתי שיושב במפגש שני הקירות.
 */
export type CornerKind = 'blindStart' | 'blindEnd' | 'lShape';

/**
 * אזור בתוך הארון, מלמטה למעלה.
 * חלוקה לאזורים היא מה שמאפשר ארון אחד שמכיל גם מגירות, גם מדפים
 * וגם מוט תלייה — כל אזור עם התוכן והגובה שלו.
 */
export interface Zone {
  id: string;
  kind: ZoneKind;
  /** גובה האזור במ"מ */
  heightMm: number;
  shelves?: number;
  /** מרווחים בין המדפים באזור, מלמטה למעלה */
  shelfGapsMm?: number[];
  drawers?: number;
  drawerCols?: number;
  drawerStyle?: DrawerStyle;
}

export type ZoneKind = 'shelves' | 'drawers' | 'rod' | 'empty';

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
export type CatalogGroup = 'base' | 'upper' | 'tall' | 'storage' | 'panel';

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
  zones?: Zone[];
  opening?: OpeningMech;
  corner?: CornerKind;
  blindMm?: number;
  panelThicknessMm?: number;
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
  /**
   * שקע הגב בתוך הגוף. הגב יושב בחריץ ולכן קטן מהארון בעובי הצדדים,
   * ובחזרה גדל בעומק החריץ משני הצדדים.
   */
  backGrooveMm: number;
  /** מרווח סביב חזית — דלת קטנה מהפתח בכל צד */
  frontGapMm: number;
  /** מחירי אביזרים, ליחידה */
  accessories: AccessoryPrices;
  /** תוספות שהעסק הגדיר בעצמו */
  extras: ExtraItem[];
  /** מחיר דלת זכוכית למ"ר — נספרת בנפרד ולא מתוך הפלטות */
  glassFactoryPerM2: number;
  glassConsumerPerM2: number;
  updatedAt: number;
}

/**
 * תוספת שהעסק הגדיר: שם, לפי מה נספרת, ומחיר.
 * כך אפשר להוסיף ידיות, קלאפות או כל דבר אחר בלי לשנות את האפליקציה.
 */
export interface ExtraItem {
  id: string;
  name: string;
  per: ExtraBasis;
  /** כמות קבועה, כשהספירה ידנית */
  qty?: number;
  factoryPrice: number;
  consumerPrice: number;
}

/** לפי מה נספרת התוספת. */
export type ExtraBasis = 'door' | 'drawer' | 'cabinet' | 'lift' | 'handle' | 'ledMeter' | 'manual';

/** מחירי אביזרים במפעל ולצרכן. */
export interface AccessoryPrices {
  /** למגירה */
  drawerFactory: number;
  drawerConsumer: number;
  /** למטר רץ של פס לד */
  ledFactory: number;
  ledConsumer: number;
  /** למנגנון קלאפה */
  liftFactory: number;
  liftConsumer: number;
}
