/** ישות בסיס — לכל רשומה מזהה ותאריכי מעקב. */
interface Entity {
  id: string;
  /**
   * הנגרייה שהשורה שייכת לה.
   *
   * זה מה שהופך "כל הלקוחות" ל"כל הלקוחות שלי". כל שאילתה עוברת
   * דרכו, וכל שורה חדשה נרשמת על הנגרייה הפעילה. ראה `db/workshop`.
   */
  workshopId: string;
  /**
   * מאיפה השורה הגיעה, כשהיא הגיעה מחבילה של מישהו אחר.
   *
   * ייבוא של אותו ארגז לשתי נגריות דרס עד כה את השורה של הראשונה:
   * המפתח גלובלי, והכתיבה נשאה את המזהה המקורי ואת הבעלות החדשה.
   * עכשיו מי שמייבא מקבל עותק משלו עם מזהה מקומי, והמזהה המקורי
   * נשמר כאן — כדי שייבוא חוזר של אותה חבילה יעדכן את העותק שלו
   * ולא ייצור שלישי.
   */
  sourceId?: string;
  /**
   * גרסת השורה — עולה באחד בכל עדכון.
   *
   * בלעדיה סנכרון בין שני מכשירים אינו יכול להכריע בין שני שינויים
   * באותו שדה: `updatedAt` לבדו הוא שעון של מכשיר, ושעונים לא
   * מסכימים. הגרסה היא מונה, ומונה אפשר להשוות.
   */
  rev: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * סימון מחיקה.
 *
 * שורה שנמחקה במכשיר אחד ואינה מוכרת לשני חוזרת מהשני — מחיקה
 * שאינה מסונכרנת היא תחייה. הסימון הוא מזהה וגרסה בלבד: הוא פנימי,
 * הוא לא סל מחזור, ואין לו מסך.
 */
export interface Tombstone {
  /** `table:rowId` — מפתח יציב, כדי שמחיקה חוזרת לא תכפיל */
  id: string;
  table: string;
  rowId: string;
  workshopId: string;
  /** הגרסה שהייתה לשורה כשנמחקה */
  rev: number;
  deletedAt: number;
}

/** נגרייה: החשבון שהנתונים שייכים לו. */
export interface Workshop {
  id: string;
  name: string;
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

/**
 * סוג החדר — קובע אילו מוצרים יוצגו בספרייה.
 *
 * מזהה חופשי ולא רשימה סגורה: החדרים הם נתונים בטבלת
 * `rooms`, ונגר שעובד גם על חדר שירות, משרד או ממ״ד מוסיף
 * אותם בעצמו. הקוד מכיר שם שמור אחד — `custom`, חדר ללא סוג
 * שכל הספרייה זמינה בו — וכל השאר מגיע מהטבלה.
 */
export type RoomKind = string;

/** החדר שאין לו סוג: כל הספרייה זמינה בו, והשם מגיע מהמשתמש. */
export const CUSTOM_ROOM = 'custom';

/**
 * חדר בספרייה.
 *
 * החדרים שמגיעים עם האפליקציה מסומנים `isBuiltin`, ואפשר רק
 * להסתיר אותם; חדר שהמשתמש הוסיף נמחק לגמרי. פרויקט שכבר
 * נפתח בחדר שהוסר אינו נפגע — הוא שומר את שם החדר בעצמו.
 */
export interface Room extends Entity {
  label: string;
  /** תיאור קצר שמופיע בבחירת החדר */
  hint: string;
  /** מפתח האייקון */
  icon: string;
  /** הכרטיסיות שמוצגות בספרייה עבור החדר הזה, לפי הסדר */
  groups: CatalogGroup[];
  sortOrder: number;
  isBuiltin: boolean;
  /** הוסתר מרשימת החדרים */
  hiddenAt?: number;
}

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
   * האם המחיר שהוקלד ביד כבר כולל מע"מ.
   *
   * חישוב החומרים יודע בעצמו מה לפני מע"מ ומה אחריו, אבל מספר
   * שנגר כותב ב"מחיר קבוע" או ב"מחיר למטר" הוא מה שהוא אמר ללקוח —
   * ואצל רוב הנגרים זה כבר המחיר הסופי. ברירת המחדל היא לכן "כולל",
   * וזו גם ההתנהגות שהייתה עד שהשאלה נשאלה במפורש.
   */
  priceIncludesVat?: boolean;

  /**
   * הגוון והחומר שנבחרו לפרויקט, לכל חלק בארגז.
   * זו ברירת המחדל של כל ארגז בפרויקט: רוב המטבח הוא אותו גוף
   * ואותן חזיתות, ולבחור אותם מחדש בכל ארגז זו עבודה כפולה.
   */
  defaults?: Partial<Record<PartRole, PartChoice>>;
  /**
   * בקשת התכנת לפתוח את ההדמיה לעריכה, והאישור של המנהל.
   * ההדמיה היא מה שהלקוח אישר; שינוי שלה אחריו הוא שינוי בהזמנה,
   * ולכן הוא עובר דרך המנהל ולא נעשה בשקט.
   */
  editRequest?: { at: number; by?: string; note?: string };
  editGrantedAt?: number;
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
export type WallFeatureKind =
  | 'window'
  | 'door'
  | 'socket'
  | 'water'
  | 'pillar'
  | 'niche'
  | 'step';

/**
 * מאיזה קצה של הקיר נמדד המרחק האופקי.
 * בשטח מודדים מהקצה שנוח יותר להגיע אליו, ולכן הבחירה נשמרת.
 */
export type WallSide = 'start' | 'end';

/** מנין נמדד הגובה — מהרצפה או מהתקרה. */
export type HeightRef = 'floor' | 'ceiling';

/**
 * מיקום של ארגז שאינו על קיר.
 *
 * המרכז נמדד ברצפת החדר, באותה מערכת של מבט העל, והכיוון אומר לאן
 * פונה החזית. אי אינו נמדד מקיר: הוא עומד איפה שהחליטו שיעמוד.
 */
export interface FreePlacement {
  xMm: number;
  zMm: number;
  /** לאן פונה החזית, במעלות, ביחס לציר האופקי של החדר */
  headingDeg: number;
}

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
   * כמה הסימון יוצא מהקיר או נכנס לתוכו, במ"מ.
   *
   * עמוד ומדרגה בולטים אל תוך החדר וגונבים עומק מהארון שיעמוד שם;
   * נישה נכנסת פנימה ומוסיפה עומק. בלי המידה הזאת עמוד הוא כתם על
   * הקיר, והנגר מגלה אותו רק כשהוא מגיע עם הארון.
   */
  depthMm?: number;
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
  /** שם משלך לקיר. ריק = "קיר א׳" לפי המיקום */
  name?: string;
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

/**
 * מסלול עבודה בתוך ארגז.
 *
 * ארגז אינו דבר אחד שנע קדימה: הגוף נחתך, מקונט ומורכב בזמן אחד,
 * החזיתות בזמן אחר, והדופן הזרה לפעמים מגיעה רק בהתקנה. לכן לכל
 * אחד מסלול משלו — ולכן ארגז יכול לעמוד מותקן אצל הלקוח בלי
 * חזיתות, וזה מצב חוקי ולא שגיאה.
 */
export type WorkTrack = 'carcass' | 'back' | 'fronts' | 'panels';

/**
 * השלב שהמסלול נמצא בו.
 * הסדר הוא גם ההיגיון: אי אפשר לקנט לפני שנחתך, ואי אפשר להרכיב
 * לפני שיש קנטים.
 */
export type TrackStage = 'none' | 'ready' | 'cut' | 'edged' | 'assembled' | 'installed';

/**
 * מצב הארגז בתהליך העבודה.
 *
 * התהליך של הפרויקט מתאר שלבים; זה מתאר ארגז. הם לא אותו דבר:
 * בקיר אחד יש ארגז שכבר קונט וארגז שעוד לא נחתך, ומי שעומד ליד
 * המסור צריך לדעת מי מהם.
 */
export interface UnitWork {
  /** השלב של כל מסלול. מסלול שאינו קיים בארגז פשוט חסר */
  tracks?: Partial<Record<WorkTrack, TrackStage>>;
  /** שאלה או בעיה שמישהו רשם על הארגז */
  issue?: string;
  /** מי רשם אותה */
  issueBy?: string;
}

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
  /**
   * סיבוב הארגז סביב הציר האנכי, בצעדים של 90°.
   *
   * ריק או 0 = הארגז מקביל לקיר והחזית פונה אל החדר, כמו רוב
   * הארגזים. 90 או 270 = הארגז מסובב, החזית פונה לאורך הקיר, והוא
   * תופס על הקיר את העומק שלו במקום את הרוחב — עמודת מדפים בפינה,
   * ארגז שחוזר לתוך החדר בקצה מטבח.
   */
  rotationDeg?: 0 | 90 | 180 | 270;
  /**
   * אי: הארגז אינו על הקיר, והמיקום שלו נמדד ברצפת החדר.
   *
   * כשהשדה הזה מלא, `xMm` ו-`rotationDeg` אינם בשימוש — הם מודדים
   * לאורך קיר, ולאי אין קיר למדוד ממנו. הארגז נשאר שייך לקיר
   * ב-`wallId` לצורך ספירה, מחיר וניסור, אבל הוא כבר לא עומד עליו.
   */
  free?: FreePlacement;
  /**
   * מוסתר בהדמיה בלבד.
   *
   * ארגז מוסתר אינו מצויר, אבל הוא קיים לכל דבר אחר: הוא נספר
   * בחומרים, במחיר ובניסור. הסתרה היא כלי הסתכלות ולא מחיקה.
   */
  hidden?: boolean;
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
  /**
   * גובה לוח הגב, כשהוא אינו מכסה את כל הגוף.
   *
   * ארון תלוי שיושב מעל משטח לא תמיד צריך גב עד למטה, וארגז
   * שנצמד לקיר גמור לפעמים מקבל גב חלקי בלבד. ריק = הגב מכסה את
   * הגוף כולו, וזה המצב הרגיל.
   */
  backHeightMm?: number;
  /**
   * חלקים שנבנים מקושרות במקום מלוח מלא.
   *
   * ארגז תחתון לא צריך תקרה שלמה: שתי רצועות של 10 ס"מ מחזיקות את
   * הדפנות, והמשטח יושב עליהן. אותו דבר בגב — שתי רצועות שמחזיקות
   * את הארון מרובע, בלי לוח שנקנה ולא נראה.
   *
   * זו לא הערה על השרטוט אלא על מה שנחתך: קושרת במקום לוח מורידה
   * שטח מהפלטה ולכן גם מהמחיר.
   */
  rails?: RailSides;
  /** מבנה תיבת המגירה — קובע אילו חלקים נחתכים לה */
  drawerBox?: DrawerBox;
  /**
   * לכמה תאים הארגז מחולק בקושרות אנכיות.
   *
   * דלת נתפסת על משהו. בארגז רחב עם ארבע דלתות אין על מה לתלות את
   * השתיים האמצעיות, ולכן נדרשת קושרת במרכז — וזה מה שמחלק את
   * הארגז לשני תאים. ריק = נגזר ממספר הדלתות.
   */
  doorCells?: number;
  /** קושרת בעובי כפול — שני לוחות זה על זה, לארגז ארוך או כבד */
  doubleDividers?: boolean;
  /** מצב הארגז בתהליך העבודה — נפרד מהעיצוב שלו */
  work?: UnitWork;
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
  /**
   * הפרזול של הארגז הזה: מנגנונים, מסילות ומה שהנגר מוסיף בעצמו.
   * כל שורה נושאת את המחיר שהיה כשהיא נבחרה.
   */
  hardware?: Hardware[];
  /**
   * צדדים שלא נבנים כלל.
   *
   * ארגז שנצמד לשכן יכול לוותר על הדופן שביניהם ולהישען עליו;
   * ארגז שנכנס לנישה יכול לוותר על התקרה. הצד היורד יורד גם
   * מהציור, גם מפירוק הלוחות וגם מהמחיר — אחרת הנגר משלם על לוח
   * שלא ייחתך.
   */
  omit?: BoxSides;
}

/**
 * סוג הגב.
 * thin — לוח דק בחריץ, ברירת המחדל.
 * carcass — גב בעובי הגוף, כשצריך חוזק או כשהגב גלוי.
 * none — בלי גב.
 */
export type BackKind = 'thin' | 'carcass' | 'none';

/**
 * סוגי הגב, לבחירה.
 * גב דק יושב בחריץ, גב בעובי גוף נבנה כמו דופן, וללא גב הוא ארון
 * שנשען על הקיר עצמו.
 */
export const BACK_KINDS: { key: BackKind; label: string }[] = [
  { key: 'thin', label: 'גב דק' },
  { key: 'carcass', label: 'גב בעובי גוף' },
  { key: 'none', label: 'ללא גב' },
];

/**
 * מבנה תיבת המגירה.
 * `wood` — מגירת עץ שנבנית בנגרייה: תחתית, שתי דפנות, גב וחזית.
 * `metal` — מסילת ברזל שהדפנות שלה מגיעות מוכנות, ולכן נבנים רק
 * התחתית והגב.
 */
export type DrawerBox = 'wood' | 'metal';

export const DRAWER_BOXES: { key: DrawerBox; label: string; hint: string }[] = [
  { key: 'wood', label: 'מגירת עץ', hint: 'תחתית, דפנות, גב וחזית' },
  { key: 'metal', label: 'מגירת ברזל', hint: 'תחתית וגב; הדפנות מגיעות מוכנות' },
];

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
  /**
   * החזית של האזור מתחילה כאן ואינה המשך של זו שמתחתיו.
   *
   * ריק = אותה חזית ממשיכה כלפי מעלה, וזו ברירת המחדל: דלת אחת
   * מכסה את כל מה שאינו מגירה חיצונית. סימון כאן שובר אותה, וכך
   * נוצרת דלת לכל תא — או דלת אחת שמכסה כמה תאים, לפי איפה שהיא
   * נשברת.
   */
  frontSplit?: boolean;
  /**
   * כמה דלתות יש לחזית שמתחילה באזור הזה. ריק = אחת.
   * רלוונטי רק לאזור שפותח חזית; באזור שממשיך חזית אין משמעות.
   */
  doors?: number;
}

/** עמודה בתוך אזור, מימין לשמאל. */
export interface ZoneColumn extends ZoneContent {
  id: string;
  /** חלק יחסי מרוחב האזור. הסכום מנורמל ל-1. */
  widthShare: number;
}

export type ZoneKind = 'shelves' | 'drawers' | 'rod' | 'empty';

/** מגירה חיצונית נראית בחזית; פנימית מסתתרת מאחורי דלת. */
type DrawerStyle = 'outer' | 'inner';

/**
 * ארבעת הצדדים של ארגז: שמאל, ימין, למעלה ולמטה.
 *
 * אותם ארבעה צדדים חוזרים בכמה שאלות — מי גלוי, מי מזכוכית, מי לא
 * נבנה בכלל — ולכן הם צורה אחת ולא שלוש.
 */
export interface BoxSides {
  start?: boolean;
  end?: boolean;
  top?: boolean;
  bottom?: boolean;
}

/** צדדים גלויים של הארגז שנבנים כדופן זרה. */
export type ExposedSides = BoxSides;

/**
 * חלקים שנבנים מקושרות ולא מלוח מלא.
 *
 * שני מקומות בלבד, כי אלה השניים שנגר באמת בונה ככה: התקרה של
 * ארגז תחתון, והגב של ארון שנצמד לקיר. דופן או תחתית מקושרות אינן
 * ארון אלא שלד.
 */
export interface RailSides {
  top?: boolean;
  back?: boolean;
}

/**
 * רוחב קושרת תקנית.
 * 10 ס"מ הוא מה שנחתך בפועל: מספיק כדי להבריג ולהחזיק, ולא יותר.
 */
export const RAIL_WIDTH_MM = 100;

/* ------------------------------------------------------------------ */
/* ספריית המוצרים                                                      */
/* ------------------------------------------------------------------ */

/** קבוצה בספרייה — הכרטיסייה שבה המוצר מופיע. */
/**
 * הקטגוריה שהפריט יושב בה בספרייה.
 * `island` ו-`shelf` הם מוצרים בפני עצמם ולא ארגז על קיר, ולכן
 * יש להם מקום משלהם ולא שורה בתוך "תחתונים".
 */
export type CatalogGroup = 'base' | 'upper' | 'tall' | 'storage' | 'panel' | 'island' | 'shelf';

/**
 * חלק בפריט מורכב.
 *
 * עמודת תנור שלמה, פינה, או קיר שנבנה פעם אחת — כמה ארגזים
 * שנשמרו יחד ומוזמנים שוב כיחידה אחת. כל חלק שומר את מה שמתאר
 * אותו ואת המרחק שלו מפינת הקבוצה; המקום בחדר נקבע רק בהנחה.
 */
export interface CatalogGroupPart {
  /** מרחק מפינת הקבוצה לאורך הקיר */
  dxMm: number;
  /** מרחק מפינת הקבוצה לגובה */
  dyMm: number;
  /** תיאור הארגז עצמו — בלי זהות, בלי קיר ובלי מיקום */
  unit: Partial<PlacedUnit>;
}

export interface CatalogItem extends Entity {
  /**
   * מק״ט — המזהה שהנגר קורא לארגז בשמו.
   *
   * `id` הוא מזהה פנימי שאיש אינו רואה; המק״ט הוא מה שכתוב על
   * הארגז ברשימה, ומה שמונע כפילות: שמירה תחת מק״ט שכבר קיים
   * מעדכנת את הארגז ההוא במקום ליצור עותק שני שלו, וכך גם ייבוא
   * של ספרייה שכבר יש ממנה חלק.
   */
  code?: string;
  /**
   * מועדף — הארגז נכנס ל"ארגזים מועדפים".
   *
   * זו רשימת העבודה של הנגרייה: מה שבאמת מרכיבים, מתוך כל מה
   * שקיים. היא נפרדת מהחדר ומהקטגוריה ואינה מחליפה אותם.
   */
  favorite?: boolean;
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
  /** הפרזול שנשמר עם הפריט, כדי שהוא יחזור מוכן בפעם הבאה */
  hardware?: Hardware[];
  /*
   * מאפייני גימור שנשמרים עם הפריט, כדי שארגז שהנגר כבר כיוונן פעם
   * אחת יחזור מוכן בפעם הבאה ולא ידרוש את אותה עריכה מחדש.
   */
  drawerStyle?: DrawerStyle;
  exposed?: ExposedSides;
  exposedDepthMm?: number;
  backKind?: BackKind;
  backHeightMm?: number;
  rails?: RailSides;
  drawerBox?: DrawerBox;
  doorCells?: number;
  doubleDividers?: boolean;
  handles?: boolean;
  glassDoors?: boolean;
  glassSides?: { start?: boolean; end?: boolean };
  led?: LedSpot[];
  shelfGapsMm?: number[];
  /**
   * חלקים שהארגז נבנה בלעדיהם — דופן משותפת, בלי תחתית או בלי תקרה.
   * ארגז שתוכנן פתוח במכוון חייב לחזור פתוח מהספרייה, אחרת הוא
   * מקבל לוח שלא נבנה לו מקום.
   */
  omit?: BoxSides;
  carcassFinishId?: string;
  carcassMaterialId?: string;
  frontFinishId?: string;
  frontMaterialId?: string;
  exposedFinishId?: string;
  exposedMaterialId?: string;
  backFinishId?: string;
  backMaterialId?: string;
  level: UnitLevel;
  /**
   * תבנית של אי: הפריט נוחת בחדר ולא על קיר.
   *
   * זו תכונה של התבנית ולא של המופע — מה שמונח בפרויקט מחזיק
   * `free` משלו, ומשם והלאה הוא נערך כמו כל ארגז אחר.
   */
  island?: boolean;
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
  /**
   * הוסר מהספרייה.
   *
   * פריט שהמשתמש בנה נמחק באמת. פריט שהגיע עם האפליקציה רק נעלם
   * מהרשימות — מחיקה אמיתית שלו הייתה חוזרת בעדכון הבא, ופרויקט
   * שהניח אותו פעם היה מאבד את ההפניה. כך או כך הוא כבר לא מוצע,
   * וזה מה שהנגר ביקש.
   */
  hiddenAt?: number;
  sortOrder: number;
  /** הערת תקן קצרה — למה המידות האלה */
  note?: string;
  /**
   * פריט מורכב: ההנחה שלו יוצרת כמה ארגזים ולא אחד.
   * ריק = פריט רגיל, ארגז אחד.
   */
  parts?: CatalogGroupPart[];
}

/**
 * תיאור הבנייה שעובר בין ארגז שעומד על הקיר לבין פריט בספרייה.
 *
 * זו רשימה אחת ולא שתי רשימות ידניות. שמירה לספרייה והנחה מהספרייה
 * העתיקו כל אחת את השדות שהיא הכירה, ולכן כל מאפיין שנוסף לארגז
 * נשמט מאחת מהן: "בלי תקרה" נעלם בשמירה וחזר כלוח מלא, וזכוכית
 * בצד, עומק דופן זרה וחלוקת תאים לא עברו בכלל.
 *
 * מה שאינו כאן שייך למיקום ולא לבנייה — איפה הארגז עומד, מה מידותיו
 * בפועל ומה מצב הייצור שלו — ואלה נקבעים בהנחה ולא בתבנית.
 */
export const REUSABLE_FIELDS = [
  'glyph',
  'doors',
  'drawers',
  'drawerCols',
  'shelves',
  'zones',
  'opening',
  'corner',
  'blindMm',
  'drawerStyle',
  'exposed',
  'exposedDepthMm',
  'backKind',
  'backHeightMm',
  'rails',
  'hardware',
  'drawerBox',
  'doorCells',
  'doubleDividers',
  'handles',
  'glassDoors',
  'glassSides',
  'led',
  'shelfGapsMm',
  'omit',
  'carcassFinishId',
  'carcassMaterialId',
  'frontFinishId',
  'frontMaterialId',
  'exposedFinishId',
  'exposedMaterialId',
  'backFinishId',
  'backMaterialId',
] as const;

export type ReusableField = (typeof REUSABLE_FIELDS)[number];

/**
 * מוציא את תיאור הבנייה מארגז או מפריט ספרייה.
 * שדות ריקים מושמטים, כדי שהעתקה לא תכתוב `undefined` על ערך קיים.
 */
export function reusableSpec(
  from: Partial<PlacedUnit> | Partial<CatalogItem>,
): Partial<Pick<PlacedUnit, ReusableField>> {
  const out: Record<string, unknown> = {};
  for (const key of REUSABLE_FIELDS) {
    const value = (from as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<Pick<PlacedUnit, ReusableField>>;
}

/* ------------------------------------------------------------------ */
/* חומרים והגדרות                                                      */
/* ------------------------------------------------------------------ */


/**
 * איך מורכב לוח.
 *
 * לוח הוא שני דברים שנקנים יחד ומתומחרים יחד: ליבה וגוון.
 *
 * הליבה היא הגוף הפיזי — סנדוויץ׳, MDF או דיקט — והיא זו שקובעת
 * את העובי, את החוזק ואת מה שאפשר לעשות איתה. הגוון הוא מה
 * שמדביקים עליה, והצבע והמרקם יחד הם שקובעים אותו.
 *
 * ההפרדה אינה קפריזה: אותו "לבן מט" קיים גם על סנדוויץ׳ וגם על
 * MDF, במחיר אחר לגמרי ולשימוש אחר לגמרי. לכן הליבות הן רשימה
 * קצרה שכמעט לא משתנה, הגוונים הם הרשימה שגדלה, ומחיר הפלטה יושב
 * בהצטלבות שביניהם.
 */
export type CoreKind = 'sandwich' | 'mdf' | 'plywood';

/**
 * הליבות שקיימות, והעוביים שהן מגיעות בהם.
 *
 * העובי הראשון הוא התקן — מה שמזמינים כשלא אומרים אחרת. `colors`
 * הוא צבע הליבה עצמה, שנראה בקנט ובחתך ולכן הנגר בוחר אותו;
 * `twoSided` אומר שהליבה יכולה להגיע מודבקת בגוון אחר בצד השני.
 */
export const CORES: {
  key: CoreKind;
  label: string;
  thicknessMm: number[];
  colors?: string[];
  twoSided?: boolean;
  hint: string;
}[] = [
  { key: 'sandwich', label: 'סנדוויץ׳', thicknessMm: [17, 18, 16], hint: 'ליבת התקן לגוף הארון' },
  {
    key: 'mdf',
    label: 'MDF',
    thicknessMm: [18, 9],
    colors: ['חום', 'ירוק', 'שחור'],
    twoSided: true,
    hint: 'לחזיתות ולדפנות; יכול להגיע מודבק בגוון אחר בצד השני',
  },
  { key: 'plywood', label: 'דיקט', thicknessMm: [5], hint: 'לוח סנדוויץ׳ דק, לגב' },
];

/** תיאור הליבה לפי המפתח שלה. */
export function coreOf(kind?: CoreKind) {
  return CORES.find((c) => c.key === kind);
}

/** הליבה הזו יכולה להגיע מודבקת בגוון אחר בצד השני. */
export function twoSided(m?: Pick<Material, 'core'>): boolean {
  return !!coreOf(m?.core)?.twoSided;
}

/**
 * ליבה — הבסיס הפיזי של הלוח, כמו שהיא מוזמנת מהספק.
 *
 * שורה כאן היא לא "סוג חומר" מופשט אלא לוח שאפשר להצביע עליו
 * במחסן: MDF שחור 18 מ״מ הוא שורה, ו-MDF שחור 9 מ״מ הוא שורה
 * אחרת — הם עולים אחרת, נחתכים אחרת ומגיעים במשלוח אחר.
 */
export interface Material extends Entity {
  name: string;
  /** סוג הליבה. ריק בלוחות ישנים שנוצרו לפני שהליבה הייתה מפורשת */
  core?: CoreKind;
  /**
   * צבע הליבה עצמה, כשיש לה כזה — MDF מגיע חום, ירוק או שחור.
   * זה לא הגוון: הגוון מודבק מעל, וצבע הליבה נראה בחתך ובקנט.
   */
  coreColor?: string;
  /**
   * מידת הפלטה שהחומר מגיע בה.
   * הרוחב תמיד 1220; הגובה משתנה בין ספקים — 2440 הוא התקן,
   * ויש חומרים שמגיעים ב-2750 או ב-3050.
   */
  sheetWidthMm: number;
  sheetHeightMm: number;
  /**
   * העובי שהלוח הזה נחתך לפיו.
   *
   * זה מה שקובע את המידות הפנימיות של הארגז: גוף מסנדוויץ׳ 17 שנחתך
   * כאילו הוא 18 נותן תחתית קצרה ב-2 מ"מ, וזה נמדד במסור. לוח בלי
   * עובי נופל לעובי הכללי שבהגדרות.
   */
  thicknessMm?: number;

  /**
   * לאילו חלקים בארגז החומר הזה משמש.
   *
   * הגוף נבנה מסנדוויץ׳, החזיתות והדפנות הזרות מ-MDF, הגב מדיקט —
   * וזו החלטה של הנגרייה, לא של הקוד. היא נקבעת פעם אחת בהגדרות
   * החומר, ומשם היא קובעת שני דברים: איזה חומר נבחר לחלק, ואילו
   * גוונים בכלל מוצעים לו. חומר בלי שיוך אינו מוצע לאף חלק
   * אוטומטית, אבל אפשר לבחור בו ביד.
   */
  roles?: PartRole[];
  sortOrder: number;
}

/** החומרים שמשמשים לחלק מסוים, לפי הסדר שנקבע להם. */
function materialsForRole(role: PartRole, materials: Material[]): Material[] {
  return materials.filter((m) => m.roles?.includes(role));
}

/**
 * כמה מקום הארגז תופס לאורך הקיר.
 *
 * ארגז מסובב עומד בצד: על הקיר הוא תופס את העומק שלו, ולתוך החדר
 * הוא נכנס ברוחב שלו. כל חישוב שנוגע במקום על הקיר — הצמדה,
 * חפיפה, מטר רץ, אזהרות — עובר דרך שתי הפונקציות האלה, כדי שסיבוב
 * לא יתפזר לעשרים תנאים.
 */
export function alongWallMm(u: Pick<PlacedUnit, 'widthMm' | 'depthMm' | 'rotationDeg'>): number {
  return turned(u) ? u.depthMm : u.widthMm;
}

/**
 * גובה הגוף: הגובה הכולל פחות הרגליים.
 *
 * הרגליים נכללות ב-heightMm כי זה מה שתופס מקום על הקיר, אבל הגוף
 * — הדפנות, המדפים, החזיתות והאזורים — מתחיל מעליהן. כל מי שמודד
 * את הארון עצמו עובר דרך כאן, כדי ששלושת הציורים והחישוב לא
 * יחשבו את אותו דבר בשלוש דרכים.
 */
export function bodyHeightMm(u: Pick<PlacedUnit, 'heightMm' | 'socleMm'>): number {
  return Math.max(u.heightMm - (u.socleMm ?? 0), 0);
}

/**
 * עוביו של לוח בודד.
 *
 * ללוח אין גוף, ולכן אחת משלוש מידותיו היא העובי עצמו: לוח מונח
 * (מדף צף, משטח שולחן) עוביו הוא גובהו, ולוח עומד (פאנל, דופן)
 * עוביו הוא עומקו. אלה בדיוק המידות שלפיהן הוא נחתך — הפאה היא
 * שתי האחרות.
 *
 * עד כאן היה לצדן שדה נפרד, `panelThicknessMm`, ושני המספרים
 * נפרדו זה מזה: מדף בגובה 300 שעוביו הוגדר 30 צויר בעובי 30
 * ונבדק להתנגשות בגובה 300 — ארגז שהתחיל 20 מ״מ מעליו נחסם על
 * ידי לוח שאינו שם.
 */
export function slabThicknessMm(
  u: Pick<PlacedUnit, 'heightMm' | 'depthMm'>,
  flat: 'horizontal' | 'vertical',
): number {
  return flat === 'horizontal' ? u.heightMm : u.depthMm;
}

/** כמה הארגז נכנס לתוך החדר. */
export function intoRoomMm(u: Pick<PlacedUnit, 'widthMm' | 'depthMm' | 'rotationDeg'>): number {
  return turned(u) ? u.widthMm : u.depthMm;
}

/** האם הארגז עומד בצד — 90° או 270°. */
export function turned(u: Pick<PlacedUnit, 'rotationDeg'>): boolean {
  const r = ((u.rotationDeg ?? 0) % 360 + 360) % 360;
  return r === 90 || r === 270;
}

/**
 * החומר שמתאים לחלק, מתוך מה שזמין.
 *
 * `allowed` מצמצם לרשימה שהגוון באמת קיים עליה. כשאין חומר משויך
 * שעונה על התנאי נופלים למה שיש — חלק בלי חומר אינו מתומחר בכלל,
 * וזה גרוע יותר מחומר שאינו האידיאלי.
 */
export function materialForRole(
  role: PartRole,
  materials: Material[],
  allowed?: (m: Material) => boolean,
): Material | undefined {
  const pool = allowed ? materials.filter(allowed) : materials;
  return materialsForRole(role, pool)[0] ?? pool[0];
}

/**
 * הגוונים שאפשר להציע לחלק.
 *
 * גוון קיים על חומר רק אם נקבע לו מחיר עליו, ולכן "גוונים של
 * סנדוויץ׳" הם בדיוק אלה שמתומחרים על חומר שמשויך לגוף. כשאין
 * חומר משויך לחלק מוצגים כל הגוונים — רשימה ריקה היא מבוי סתום.
 */
export function finishesForRole(
  role: PartRole,
  finishes: Finish[],
  materials: Material[],
): Finish[] {
  const pool = materialsForRole(role, materials);
  if (!pool.length) return finishes;
  const fit = finishes.filter((f) => pool.some((m) => f.prices?.[m.id] !== undefined));
  return fit.length ? fit : finishes;
}

/**
 * מידות פלטה נפוצות, במ"מ.
 *
 * אלה הצעות ולא חוק: 122 הוא הרוחב המקובל, אבל יש ספקים שמגיעים
 * ברוחב אחר, ולוח שיובא עם מידה משלו שומר אותה. הרוחב היה קבוע
 * בקוד, ולכן עריכה של כל מאפיין אחר בלוח דרסה אותו בחזרה ל-1220.
 */
export const SHEET_WIDTHS_MM = [1220, 1250, 1830, 2070];
export const SHEET_HEIGHTS_MM = [2440, 2750, 3050];
/** הרוחב שנבחר ללוח חדש, כשלא נאמר אחרת. */
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
  /**
   * המרקם של פני השטח — מט, טאץ׳, יער, סטון.
   *
   * מרקם אחד לגוון, ולא רשימה: לוח מגיע מהספק במרקם אחד, ושני
   * מרקמים על אותו שם הם שני לוחות שונים שצריך להזמין בנפרד.
   * זו לא הערה חופשית אלא רשימה קצרה שחוזרת אצל כל ספק, ולכן היא
   * נבחרת ולא נכתבת — והרשימה עצמה ניתנת להרחבה.
   */
  texture?: string;
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

/** מרקמי פני שטח שמגיעים עם האפליקציה. אפשר להוסיף עליהם. */
export const BUILTIN_TEXTURES = ['טפ', 'מט', 'יער', 'סטון', 'טרוונטין'];

/** בחירת גוון וחומר לחלק מסוים. */
export interface PartChoice {
  finishId?: string;
  materialId?: string;
}

/**
 * מלאי פלטות בעסק, לצירוף של גוון וחומר.
 *
 * המלאי נספר לפי אותה שורה שבה מוזמנים: "לבן על סנדוויץ׳" הוא פריט
 * אחד, ו"לבן על MDF" הוא פריט אחר לגמרי — הם מגיעים ממחסן אחר
 * ובמחיר אחר, וספירה משותפת שלהם לא אומרת כלום.
 */
export interface StockItem extends Entity {
  finishId: string;
  materialId: string;
  /** פלטות שמונחות בנגרייה */
  sheets: number;
  /** פלטות שהוזמנו ועוד לא הגיעו */
  ordered: number;
  /** יש קנט תואם לגוון הזה במלאי */
  edgeInStock?: boolean;
  /**
   * הגוון שמודבק בצד השני של הפלטה.
   *
   * לוח MDF מגיע לפעמים מודבק בשני גוונים — לבן מצד אחד ואלון
   * מהשני — וזו פלטה אחת ולא שתיים. לכן היא נספרת פעם אחת בלבד,
   * ומוצגת בשתי השורות כרזרבה ולא כמלאי: מי שינסר אותה לצד אחד
   * שרף גם את השני, וספירה כפולה הייתה מבטיחה לוח שאינו קיים.
   */
  backFinishId?: string;
  /**
   * פחתים — שאריות שנשארו מפלטות קודמות ועוד שוות ניסור.
   *
   * הן אינן פלטה שלמה ולכן אינן נספרות ככזו, אבל הן גם לא אפס:
   * נגר שיודע שיש לו חצי פלטה בגוון הזה לא מזמין חדשה בשביל דלת
   * אחת. לכן נשמרות המידות עצמן ולא רק "יש פחת".
   */
  offcuts?: Offcut[];
}

/** שארית לוח שנשמרה במחסן. */
export interface Offcut {
  id: string;
  widthMm: number;
  heightMm: number;
  /** כמה שאריות כאלה יש. ריק = אחת */
  qty?: number;
  /** איפה היא מונחת, כשיש לזה משמעות */
  note?: string;
}

/**
 * פלטות שפרויקט כבר צרך מהמלאי.
 *
 * נוצרת ברגע שכל החלקים של שורת גוון+חומר בפרויקט סומנו כנחתכים:
 * מאותו רגע הלוחות אינם במחסן אלא בארגזים. הרשומה נשמרת כדי שאפשר
 * יהיה גם להחזיר — סימון חיתוך שבוטל מחזיר את הפלטות למלאי, ובלי
 * זיכרון של כמה ירדו ההחזרה הייתה ניחוש.
 *
 * היא גם התשובה ל"לאן הלכו הלוחות": כל רשומה מצביעה על פרויקט אחד.
 */
export interface Consumption extends Entity {
  projectId: string;
  /** מזהה שורת הלוחות: `finishId:materialId` */
  lineKey: string;
  finishId?: string;
  materialId: string;
  /** כמה פלטות ירדו מהמלאי בגלל השורה הזו */
  sheets: number;
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
  /*
   * המזהה הוא מזהה הנגרייה.
   *
   * עד כאן הוא היה `'app'` קבוע, ולכן שתי נגריות באותו מכשיר היו
   * חולקות מחירון ומידות לוח. השורה הישנה שומרת את שמה ונרשמת על
   * הנגרייה המקומית, וכל נגרייה חדשה מקבלת שורה משלה.
   */
  id: string;
  workshopId: string;
  rev: number;
  createdAt: number;
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
  /** המידות שחוזרות בכל פרויקט */

  defaults: ProjectDefaults;
  /** מחירי אביזרים, ליחידה */
  accessories: AccessoryPrices;
  /** תוספות שהעסק הגדיר בעצמו */
  extras: ExtraItem[];
  /**
   * רשימת הפרזול של העסק — התבניות שמהן בוחרים לארגז.
   * ריק = עוד לא הוגדרה, והרשימה שמגיעה עם האפליקציה משמשת.
   */
  hardware?: HardwareSpec[];
  /** מחיר דלת זכוכית למ"ר — נספרת בנפרד ולא מתוך הפלטות */
  glassFactoryPerM2: number;
  glassConsumerPerM2: number;
  /** אחוז מע"מ. ברירת המחדל בישראל היא 18% */
  vatPct: number;
  /** מחיר מטר קנט, למפעל וללקוח */
  edgeFactoryPerM: number;
  edgeConsumerPerM: number;
  /**
   * מתי נזרעה הספרייה, אם נזרעה.
   *
   * הזריעה רצה פעם אחת, והתנאי הוא הסימון הזה ולא "הטבלה ריקה":
   * נגר שמחק את הפריט האחרון שלו קיבל בפתיחה הבאה את ספריית
   * ההדגמה כולה בחזרה, כי טבלה ריקה נראית כמו התקנה חדשה.
   */
  catalogSeededAt?: number;
  /**
   * איזה דור של מוצרי מערכת הנגרייה הזאת כבר קיבלה.
   *
   * בלעדיו מי שהתקין לפני שנוסף מוצר לא היה מקבל אותו לעולם:
   * הזריעה רצה פעם אחת, והסימון "נזרעה" חסם אותה לתמיד. ראה
   * `catalogRepo.addSystemProducts`.
   */
  productsGeneration?: number;
  updatedAt: number;
}

/**
 * המידות שחוזרות בכל פרויקט.
 *
 * נגרייה עובדת באותן מידות שוב ושוב: רגליים 10 ס"מ, משטח בגובה 90,
 * תחתונים בעומק 58. עד עכשיו הן ישבו בקוד כתקן, ומי שעובד אחרת היה
 * מתקן אותן בכל ארגז ובכל פרויקט מחדש. כאן הן נקבעות פעם אחת.
 *
 * זו ברירת מחדל ולא כפייה: ארגז בודד עדיין אפשר לשנות, וזה החריג
 * ולא הרגיל.
 */
export interface ProjectDefaults {
  /** גובה הרגליים של ארגז שעומד על הרצפה */
  socleMm: number;
  /** גובה משטח העבודה מהרצפה — ממנו נגזר גוף הארון התחתון */
  counterTopMm: number;
  /** עומק תחתונים ועומק עליונים */
  baseDepthMm: number;
  upperDepthMm: number;
  /** תחתית הארון העליון מהרצפה */
  upperBottomMm: number;
  /** מידות הקיר שפרויקט חדש נפתח בהן */
  wallLengthMm: number;
  wallHeightMm: number;
  /** סוג הגב שכל ארגז חדש מקבל */
  backKind: BackKind;
  /** תיבת המגירה — ברזל או עץ */
  drawerBox: DrawerBox;
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

/**
 * פרזול שנבחר לארגז אחד.
 *
 * זו שורה של הזמנה, לא של קטלוג: היא נושאת את המחיר שהיה בזמן
 * שהיא נבחרה, ולא הפניה למחיר שמשתנה. עדכון מחיר ברשימת הפרזול
 * של העסק אינו נוגע בהצעה שכבר יצאה — בדיוק כמו ארגז שהונח על
 * קיר ושומר את מידותיו בעצמו.
 *
 * מה שאינו ידוע נשאר ריק ונאמר במפורש ("חסרים נתוני התאמה"), ולא
 * מומצא: ספק, דגם, מידת התקנה ומרווח פתיחה הם נתוני יצרן.
 */
export interface Hardware {
  id: string;
  /** מאיזו שורה ברשימת העסק הוא נבחר, אם נבחר ממנה */
  specId?: string;
  name: string;
  supplier?: string;
  model?: string;
  qty: number;
  /** יחידת המידה, כפי שמזמינים בה */
  unit: HardwareUnit;
  /** עלות לנגרייה. `undefined` = מחיר חסר, ואינו אפס */
  factoryPrice?: number;
  /** מחיר ללקוח */
  consumerPrice?: number;
  /** מטבע. ריק = שקל */
  currency?: string;
  /**
   * הפרזול הזה בא במקום ספירה אוטומטית.
   *
   * בלי זה מנגנון שנבחר ביד נספר פעמיים: פעם בשורה האוטומטית
   * ("מנגנוני קלאפה") ופעם בשורה שלו. הארגז שיש בו פרזול כזה
   * יורד מהספירה האוטומטית של אותו סוג.
   */
  replaces?: ExtraBasis;
  note?: string;
}

/** יחידות שבהן מזמינים פרזול. */
export type HardwareUnit = 'יח׳' | 'זוג' | 'מ׳' | 'סט';

/**
 * שורה ברשימת הפרזול של העסק — התבנית שממנה בוחרים.
 *
 * המחיר כאן הוא המחיר הנוכחי; מה שנבחר לארגז מעתיק אותו אליו
 * ומנתק את הקשר.
 */
export interface HardwareSpec {
  id: string;
  name: string;
  supplier?: string;
  model?: string;
  unit: HardwareUnit;
  factoryPrice?: number;
  consumerPrice?: number;
  currency?: string;
  replaces?: ExtraBasis;
  /** לאיזה סוג ארגז הוא מתאים, כשידוע */
  fits?: string;
  /** מידת התקנה, כשידועה */
  installMm?: number;
  /** מרווח פתיחה שהיצרן דורש, כשידוע */
  clearanceMm?: number;
  note?: string;
}

/** לפי מה נספרת התוספת. */
export type ExtraBasis = 'door' | 'drawer' | 'cabinet' | 'lift' | 'handle' | 'ledMeter' | 'manual';

/** מחירי אביזרים במפעל ולצרכן. */
interface AccessoryPrices {
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
type StageStatus = 'waiting' | 'active' | 'done' | 'skipped';

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
