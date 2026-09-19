import { landsOnFloor } from '../../catalog/construction';
import { reusableSpec } from '../../db/types';
import type {
  CatalogItem, FreePlacement, PlacedUnit, ProjectDefaults, RoomKind, UnitLevel,
} from '../../db/types';

/**
 * פריט ספרייה, כארגז שעומד על הקיר.
 *
 * זה התרגום היחיד בין השניים. הוא ישב בתוך `unitsRepo.add` בלבד,
 * ולכן כל מי שרצה לדעת "איך ייראה הארגז הזה כשיונח" — התצוגה
 * המקדימה של התכנון האוטומטי, בדיקת הגובה, בדיקת ההתנגשות — בנה
 * לעצמו גרסה מקורבת. התצוגה המקדימה השתמשה בארגזי התקן והשמירה
 * בספרייה של הנגרייה, וכך הכרטיס הראה מטבח אחד והקיר קיבל אחר.
 *
 * מה שחסר כאן הוא מה שמגיע מהמסד: מזהה, זמנים ובעלות. הפונקציה
 * טהורה במכוון — אפשר לקרוא לה על הצעה שלא נשמרה.
 */
/** הגוף המינימלי שנשאר מעל הרגליים, כדי שההפרש לא ייתן ארגז שלילי */
const MIN_BODY_MM = 100;

/**
 * מה שתקן הנגרייה קובע לארגז הזה.
 *
 * זו התשובה היחידה, ושני מסלולים שואלים אותה: ארגז שנולד עכשיו
 * מהספרייה, וארגז שכבר עומד בפרויקט וש"החלת המידות" מיישרת אותו.
 * שני חישובים נפרדים לאותו כלל היו נפרדים ביום שבו אחד מהם
 * משתנה — ואז אותו ארגז היה נראה אחרת לפי הדרך שבה הגיע.
 *
 * שני כללים, ושניהם מותנים במה שהארגז *הוא*:
 *
 *   • גובה הרגליים הוא תקן של הנגרייה, אבל *האם* יש רגליים הוא
 *     של הארגז. מדף בודד, דופן צד, שולחן ויחידת מגירות לחדר
 *     ארונות עומדים על הרצפה בלי רגליים בכוונה — בספרייה הזאת הם
 *     שלושים ואחד פריטים, ו"כל מה שעומד על הרצפה מקבל רגליים"
 *     היה מדביק רגליים גם להם.
 *
 *   • גובה המשטח קובע את גובה הגוף, למי שיש לו משטח ובמטבח בלבד.
 *     ארון כיור אמבטיה נבנה ל-67 ס״מ וזו לא טעות שצריך לתקן.
 */
export function workshopFit(
  u: {
    level: UnitLevel;
    yMm: number;
    heightMm: number;
    socleMm?: number;
    counterMm?: number;
  },
  defaults: Pick<ProjectDefaults, 'socleMm' | 'counterTopMm' | 'counterMm'>,
  room?: RoomKind,
): { socleMm: number; counterMm: number; heightMm: number } {
  const onFloor = landsOnFloor(u.level, u.yMm);
  const socleMm = onFloor && (u.socleMm ?? 0) > 0 ? defaults.socleMm : (u.socleMm ?? 0);

  const worktop = (u.counterMm ?? 0) > 0 && onFloor && room === 'kitchen';
  return {
    socleMm,
    counterMm: worktop ? defaults.counterMm : (u.counterMm ?? 0),
    heightMm: worktop
      ? Math.max(defaults.counterTopMm - defaults.counterMm, socleMm + MIN_BODY_MM)
      : u.heightMm,
  };
}

export function unitSpec(
  item: CatalogItem,
  at: {
    projectId: string;
    wallId: string;
    xMm: number;
    widthMm?: number;
    free?: FreePlacement;
    /**
     * החדר של הפרויקט.
     *
     * גובה המשטח הוא תקן של מטבח: ארון כיור אמבטיה נבנה ל-67 ס״מ
     * וזו לא טעות שצריך לתקן. בלי החדר ההגדרה הייתה מותחת גם אותו
     * לגובה עבודה.
     */
    room?: RoomKind;
  },
  defaults: Pick<
    ProjectDefaults,
    'drawerBox' | 'backKind' | 'socleMm' | 'counterTopMm' | 'counterMm'
  >,
): Omit<PlacedUnit, 'id' | 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'> {
  /* אותו תקן בדיוק שמיישר ארגז קיים — ראה `workshopFit` */
  const fit = workshopFit(
    {
      level: item.level,
      yMm: item.defaultYMm ?? 0,
      heightMm: item.defaultHeightMm,
      socleMm: item.socleMm,
      counterMm: item.counterMm,
    },
    defaults,
    at.room,
  );

  return {
    /*
     * כל תיאור הבנייה שנשמר בפריט, מרשימה אחת משותפת עם השמירה
     * לספרייה. ככה מאפיין שנוסף לארגז אינו נשמט באחד משני הכיוונים.
     */
    ...reusableSpec(item),
    projectId: at.projectId,
    wallId: at.wallId,
    catalogItemId: item.id,
    name: item.name,
    glyph: item.glyph,
    /*
     * תיבת המגירה והגב שהתבנית נשמרה איתם, ואם אין — דרך העבודה
     * של הנגרייה. ברירת המחדל היא תשובה לשאלה שלא נענתה, ולא
     * דריסה של תשובה שכן.
     */
    drawerBox: item.drawerBox ?? defaults.drawerBox,
    backKind: item.backKind ?? defaults.backKind,
    level: item.level,

    xMm: at.xMm,
    /*
     * הגובה שנשמר בפריט הוא הגובה שהוא נולד בו: ארון בלי רגליים
     * שנשמר מרחף בגובה 45 ס"מ נשאר שם.
     */
    yMm: item.defaultYMm ?? 0,
    widthMm: at.widthMm ?? item.defaultWidthMm,
    heightMm: fit.heightMm,
    depthMm: item.defaultDepthMm,
    socleMm: fit.socleMm,
    counterMm: fit.counterMm,
    /* נעול לרצפה = באמת עומד עליה */
    floorLocked: landsOnFloor(item.level, item.defaultYMm),
    /* תבנית אי נוחתת בחדר; כל השאר נוחת על הקיר */
    ...(item.island && at.free ? { free: at.free } : {}),
  };
}

/**
 * הגובה שאליו הארגז מגיע בפועל, מהרצפה.
 *
 * הגובה השמור הוא גוף ועוד רגליים, והמשטח יושב מעליו. ארון תלוי
 * מתחיל בגובה `yMm` ולכן הוא מגיע גבוה יותר ממה שכתוב בו.
 */
export function topMm(u: Pick<PlacedUnit, 'yMm' | 'heightMm' | 'counterMm'>): number {
  return (u.yMm ?? 0) + u.heightMm + (u.counterMm ?? 0);
}
