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
  /**
   * לקוח שסיים. הוא יורד מהרשימה הפעילה ועובר לארכיון, אבל
   * הפרויקטים והמחירים שלו נשמרים — זו ההיסטוריה של העסק.
   */
  archivedAt?: number;
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
  /**
   * איך הפרויקט מתומחר. ריק = לפי חישוב החומרים, כמו עד היום.
   */
  pricingMode?: PricingMode;
  /** מחיר שהמנהל קבע בעצמו, בשקלים — גובר על כל חישוב */
  manualPrice?: number;
  /** ₪ למ"ר חזית ארגז — מחיר שגדל עם מידות הארגז */
  perUnitRate?: number;
  /** ₪ למטר רץ של קיר */
  perMeterRate?: number;
  /**
   * הגוון והחומר שנבחרו לפרויקט, לכל חלק בארגז.
   * זו ברירת המחדל של כל ארגז בפרויקט: רוב המטבח הוא אותו גוף
   * ואותן חזיתות, ולבחור אותם מחדש בכל ארגז זו עבודה כפולה.
   */
  defaults?: Partial<Record<PartRole, PartChoice>>;
  /** מתי נמכר. עד אז תהליך העבודה סגור */
  soldAt?: number;
  /** תשלום אחד או בתשלומים */
  paymentPlan?: PaymentPlan;
  payments?: Payment[];
}

/**
 * שיטת התמחור.
 * materials — לפי חישוב הפלטות והאביזרים, כמו במסך החומרים
 * perUnit  — ₪ למ"ר חזית, כך שארגז גדול עולה יותר
 * perMeter — ₪ למטר רץ של קיר, השיטה הנפוצה במטבחים
 * manual   — המנהל קובע מספר, והחישוב נשאר כהערכה בלבד
 */
export type PricingMode = 'materials' | 'perUnit' | 'perMeter' | 'manual';

export type PaymentPlan = 'single' | 'installments';

/** תשלום אחד בעסקה. */
export interface Payment {
  id: string;
  /** בשקלים */
  amount: number;
  /** מתי אמור להיות משולם */
  dueAt?: number;
  /** מתי שולם בפועל. ריק = טרם שולם */
  paidAt?: number;
  label?: string;
}

/* ------------------------------------------------------------------ */
/* קירות                                                               */
/* ------------------------------------------------------------------ */

/** מכשול או נקודה על הקיר שהנגר חייב לקחת בחשבון. */
export type WallFeatureKind = 'window' | 'door' | 'socket' | 'water' | 'pillar' | 'niche';

/**
 * מאיזה קצה של הקיר נמדד המרחק האופקי.
 * בשטח מודדים מהקצה שנוח יותר להגיע אליו, ולכן הבחירה נשמרת.
 */
export type WallSide = 'start' | 'end';

/** מנין נמדד הגובה — מהרצפה או מהתקרה. */
export type HeightRef = 'floor' | 'ceiling';

export interface WallFeature {
  id: string;
  kind: WallFeatureKind;
  /** מרחק מתחילת הקיר לקצה השמאלי של הסימון, במ"מ */
  xMm: number;
  /** גובה תחתית הסימון מהרצפה, במ"מ */
  yMm: number;
  widthMm: number;
  heightMm: number;
  /**
   * הקצה שממנו נמדד המרחק האופקי. ברירת המחדל היא תחילת הקיר;
   * הגיאומטריה עצמה נשמרת תמיד ב-xMm, והשדה הזה הוא רק איך מציגים אותה.
   */
  fromSide?: WallSide;
  /** הגובה נמדד מהרצפה או מהתקרה */
  heightRef?: HeightRef;
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
  /**
   * עומק הדופן הזרה במ"מ. ריק = עומק הארגז ועוד 22, המידה
   * שמכסה חזית סטנדרטית. נגר שעובד אחרת מזין מידה משלו.
   */
  exposedDepthMm?: number;
  /** גוון החזית — נשמר מגרסאות קודמות, משמש כברירת מחדל ל-frontFinishId */
  finishId?: string;
  /*
   * גוון וחומר לכל חלק. ריק = מה שנבחר לפרויקט.
   * ברירת המחדל אינה מועתקת לארגז אלא נקראת בזמן אמת, כדי ששינוי
   * הגוון של הפרויקט יחול על כל מי שלא נגעו בו במפורש.
   */
  carcassFinishId?: string;
  carcassMaterialId?: string;
  frontFinishId?: string;
  frontMaterialId?: string;
  exposedFinishId?: string;
  exposedMaterialId?: string;
  backFinishId?: string;
  backMaterialId?: string;
  /** סוג הגב */
  backKind?: BackKind;
  /** ידיות על החזיתות */
  handles?: boolean;
  /** דלתות זכוכית במקום חזית מלאה */
  glassDoors?: boolean;
  /**
   * צדדים שעשויים זכוכית במקום לוח — ויטרינה שרואים דרכה מהצד.
   * הצד הזה יוצא מפירוק הלוחות ונכנס לרשימת הזכוכית, ולארון
   * נשארים הגב, הצד השני והתחתית והתקרה.
   */
  glassSides?: { start?: boolean; end?: boolean };
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
 * תוכן של אזור או של עמודה בתוכו.
 *
 * זה החלק שחוזר בשתי הרמות: אזור בלי קושרת מחזיק תוכן אחד, ואזור
 * עם קושרת מחזיק תוכן לכל עמודה. הפרדה בין "מה יש כאן" לבין "איפה
 * זה יושב" היא מה שמאפשר לתאר ארון אמיתי בלי מבנה רקורסיבי.
 */
export interface ZoneContent {
  kind: ZoneKind;
  shelves?: number;
  /**
   * מדפי זכוכית. כמו דלת זכוכית — הם אינם לוח, ולכן יוצאים מחישוב
   * הפלטות ונספרים לפי שטח ברשימת הזכוכית.
   */
  glassShelves?: boolean;
  /** מרווחים בין המדפים, מלמטה למעלה */
  shelfGapsMm?: number[];
  drawers?: number;
  drawerCols?: number;
  drawerStyle?: DrawerStyle;
}

/**
 * אזור בתוך הארון, מלמטה למעלה.
 * חלוקה לאזורים היא מה שמאפשר ארון אחד שמכיל גם מגירות, גם מדפים
 * וגם מוט תלייה — כל אזור עם התוכן והגובה שלו.
 */
export interface Zone extends ZoneContent {
  id: string;
  /** גובה האזור במ"מ */
  heightMm: number;
  /**
   * גובה שנקבע במפורש ואינו נדחס.
   * מתקן תלייה חייב 120 ס"מ ומגירה פנימית חייבת 90 — ולכן כשכל
   * האזורים קבועים, הארון עצמו גדל כדי להכיל אותם.
   */
  fixedHeight?: boolean;
  /**
   * עומק שונה מעומק הארון — אזור רדוד מעל משטח עבודה.
   * ריק = עומק הארון.
   */
  depthMm?: number;
  /**
   * קושרות אנכיות: העמודות שהאזור מחולק אליהן.
   * ריק או עמודה אחת = אין קושרת. רמת עומק אחת מספיקה לתאר
   * ארון אמיתי, ולכן עמודה אינה מתחלקת שוב.
   */
  columns?: ZoneColumn[];
}

/** עמודה בתוך אזור, מימין לשמאל. */
export interface ZoneColumn extends ZoneContent {
  id: string;
  /** חלק יחסי מרוחב האזור. הסכום מנורמל ל-1. */
  widthShare: number;
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
  /*
   * מאפייני גימור שנשמרים עם הפריט, כדי שארגז שהנגר כבר כיוונן פעם
   * אחת יחזור מוכן בפעם הבאה ולא ידרוש את אותה עריכה מחדש.
   */
  drawerStyle?: DrawerStyle;
  exposed?: ExposedSides;
  backKind?: BackKind;
  handles?: boolean;
  glassDoors?: boolean;
  led?: LedSpot[];
  shelfGapsMm?: number[];
  carcassFinishId?: string;
  carcassMaterialId?: string;
  frontFinishId?: string;
  frontMaterialId?: string;
  exposedFinishId?: string;
  exposedMaterialId?: string;
  backFinishId?: string;
  backMaterialId?: string;
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

/**
 * סוג החומר של הלוח.
 *
 * הלוח אינו "שייך" לחלק מסוים בארון — אותו MDF משמש גם לחזית וגם
 * לגוף, ואותו גוון קיים על סנדוויץ' ועל MDF כאחד. מה שמבדיל לוח
 * מלוח הוא החומר עצמו והמידה שהוא מגיע בה, ולכן זה מה שנשמר.
 * החלק בארון נקבע לפי הגוון שנבחר לו בהדמיה.
 */
/**
 * חומר גלם — הבסיס הפיזי של הלוח.
 *
 * החומר והגוון הם שני דברים נפרדים: "לבן" הוא גוון, וסנדוויץ׳ הוא
 * חומר, ואותו לבן קיים גם על סנדוויץ׳ וגם על MDF במחיר אחר לגמרי.
 * לכן החומרים הם רשימה קצרה שכמעט לא משתנה, והגוונים הם הרשימה
 * שגדלה — ומחיר הפלטה יושב בהצטלבות שביניהם.
 */
export interface Material extends Entity {
  name: string;
  /**
   * מידת הפלטה שהחומר מגיע בה.
   * הרוחב תמיד 1220; הגובה משתנה בין ספקים — 2440 הוא התקן,
   * ויש חומרים שמגיעים ב-2750 או ב-3050.
   */
  sheetWidthMm: number;
  sheetHeightMm: number;
  /**
   * עובי נומינלי, לתיאור בלבד.
   * העובי האמיתי נקבע מול הלוח הפיזי ומשתנה בין משלוחים.
   */
  thicknessMm?: number;
  sortOrder: number;
}

/** גבהים נפוצים של פלטה, במ"מ. הרוחב תמיד 1220. */
export const SHEET_HEIGHTS_MM = [2440, 2750, 3050];
export const SHEET_WIDTH_MM = 1220;

/** תפקיד החלק במבנה הארון — נגזר מהחיתוך, לא מהלוח. */
/**
 * תפקיד החלק בארגז. התפקיד קובע מאיזה גוון וחומר — ולכן מאיזו
 * פלטה — הוא נחתך. דופן זרה היא תפקיד בפני עצמו: היא נראית מבחוץ
 * ולעיתים קרובות נבחר לה גוון אחר מהחזיתות.
 */
export type PartRole = 'carcass' | 'front' | 'exposed' | 'back';

export const PART_ROLES: { key: PartRole; label: string }[] = [
  { key: 'carcass', label: 'גוף' },
  { key: 'front', label: 'חזיתות' },
  { key: 'exposed', label: 'דפנות זרות' },
  { key: 'back', label: 'גב' },
];

/** מחיר פלטה של גוון מסוים על חומר מסוים. */
export interface MaterialPrice {
  factoryPrice?: number;
  consumerPrice?: number;
}

/**
 * גוון.
 *
 * הגוון הוא מה שהלקוח בוחר ומה שהנגר מזמין לפי שם, והוא חוצה
 * חומרים: אותו "אפור בטון" מוזמן גם כסנדוויץ׳ לגוף וגם כ-MDF
 * לחזיתות. לכן המחיר אינו מספר אחד אלא מחיר לכל חומר שהגוון קיים
 * עליו — וחומר שאין לו מחיר פשוט לא מוצע לגוון הזה.
 */
export interface Finish extends Entity {
  name: string;
  /** תיאור קצר של הצבע — לא חובה */
  note?: string;
  /**
   * לגוון יש כיוון סיבים שמחייב ניסור בכיוון קבוע.
   * זה מאפיין של הגוון ולא של החומר: אותו MDF יכול להגיע בלכה
   * חלקה ובפורניר עם סיבים.
   */
  hasGrain?: boolean;
  /** צבע לתצוגה בהדמיה */
  hex: string;
  /** מחיר פלטה לכל חומר שהגוון קיים עליו, לפי מזהה החומר */
  prices: Record<string, MaterialPrice>;
  /**
   * קנט בגוון הזה, במחיר למטר רץ.
   * קנט תואם ללוח הוא המצב הרגיל, ולכן המחיר שלו שייך לגוון ולא
   * להגדרה גלובלית. ריק = המחיר הכללי שבהגדרות.
   */
  edgeFactoryPerM?: number;
  edgeConsumerPerM?: number;
  sortOrder: number;
}

/** בחירת גוון וחומר לחלק מסוים. */
export interface PartChoice {
  finishId?: string;
  materialId?: string;
}

/** מחיר לוח שנקבע אחרת עבור פרויקט מסוים. */
export interface ProjectPrice extends Entity {
  projectId: string;
  /** מזהה שורת התמחור: `finishId:materialId` */
  lineKey: string;
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
  /**
   * סוג הגב שכל ארגז חדש מקבל.
   * לנגרייה יש דרך עבודה אחת לגב, ולבחור אותה מחדש בכל ארגז זו
   * עבודה שחוזרת על עצמה. מי שרוצה אחרת בארגז מסוים משנה שם.
   */
  defaultBackKind: BackKind;
  /** מחירי אביזרים, ליחידה */
  accessories: AccessoryPrices;
  /** תוספות שהעסק הגדיר בעצמו */
  extras: ExtraItem[];
  /** מחיר דלת זכוכית למ"ר — נספרת בנפרד ולא מתוך הפלטות */
  glassFactoryPerM2: number;
  glassConsumerPerM2: number;
  /** אחוז מע"מ. ברירת המחדל בישראל היא 18% */
  vatPct: number;
  /** מחיר מטר קנט, למפעל וללקוח */
  edgeFactoryPerM: number;
  edgeConsumerPerM: number;
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

/* ------------------------------------------------------------------ */
/* אנשי הצוות ותהליך העבודה                                            */
/* ------------------------------------------------------------------ */

/**
 * תפקיד בעסק. התפקיד קובע מה רואים ומה מותר לעשות —
 * המנהל רואה הכול, כל שאר התפקידים רואים את מה שמחכה להם.
 */
export type UserRole = 'manager' | 'planner' | 'carpenter' | 'installer';

export interface TeamMember extends Entity {
  name: string;
  role: UserRole;
  /** טלפון בפורמט מנורמל (ספרות בלבד) — לא חובה */
  phone?: string;
  /** עובד שעזב נשאר במערכת, כדי שההיסטוריה של הפרויקטים לא תישבר */
  active: boolean;
  /** שם משתמש לכניסה. ייחודי, באותיות קטנות */
  username?: string;
  /**
   * גיבוב הסיסמה והמלח שלה. הסיסמה עצמה לא נשמרת בשום מקום —
   * גם מי שפותח את בסיס הנתונים על המכשיר לא רואה אותה.
   */
  passwordHash?: string;
  passwordSalt?: string;
}

/**
 * שלב בתהליך העבודה של פרויקט, לפי הסדר.
 *
 * brief — המנהל פותח את הפרויקט ומעביר לתכנת מידות וסגנון
 * design — התכנת מתכנן את הקיר
 * approval — הלקוח מאשר את ההדמיה
 * files — התכנת מעלה פירוק לוחות, הדמיות והוראות הרכבה
 * cutting / edging / assembly — הנגר: חיתוך, קנטים, הרכבה
 * install — התקנה אצל הלקוח. לא כל פרויקט מותקן על ידי העסק,
 *           ולכן השלב הזה ניתן לדילוג.
 */
export type StageKey =
  | 'brief'
  | 'design'
  | 'approval'
  | 'files'
  | 'cutting'
  | 'edging'
  | 'assembly'
  | 'install';

/**
 * מצב השלב.
 * waiting — עוד לא הגיע תורו, כי השלב שלפניו לא הסתיים
 * active — פתוח ומחכה למי שאחראי עליו
 * done — הושלם
 * skipped — נוסה במכוון, למשל התקנה שהלקוח מבצע בעצמו
 */
export type StageStatus = 'waiting' | 'active' | 'done' | 'skipped';

export interface ProjectStage extends Entity {
  projectId: string;
  key: StageKey;
  status: StageStatus;
  /** איש הצוות שהשלב הועבר אליו */
  assigneeId?: string;
  /** מועד שנקבע — רלוונטי בעיקר להתקנה, שנכנסת ללוח השנה */
  scheduledAt?: number;
  startedAt?: number;
  doneAt?: number;
  /** הנחיה או הערה שנכתבה לשלב, למשל הסגנון שהמנהל ביקש */
  note?: string;
}

/** סוג הקובץ שהתכנת מעלה לפרויקט. */
export type AttachmentKind = 'cutlist' | 'render' | 'assembly';

/**
 * קובץ שמצורף לפרויקט — פירוק לוחות, הדמיה או הוראות הרכבה.
 * התוכן נשמר כ-Blob במכשיר, כמו כל השאר, כדי שהאפליקציה תמשיך
 * לעבוד בלי אינטרנט. סנכרון לשרת ייכנס מאחורי אותה שכבת גישה.
 */
export interface Attachment extends Entity {
  projectId: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  sizeBytes: number;
  blob: Blob;
}
