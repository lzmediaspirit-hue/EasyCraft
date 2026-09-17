import { landsOnFloor } from '../../catalog/construction';
import { reusableSpec } from '../../db/types';
import type { CatalogItem, FreePlacement, PlacedUnit, ProjectDefaults } from '../../db/types';

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
export function unitSpec(
  item: CatalogItem,
  at: {
    projectId: string;
    wallId: string;
    xMm: number;
    widthMm?: number;
    free?: FreePlacement;
  },
  defaults: Pick<ProjectDefaults, 'drawerBox' | 'backKind' | 'socleMm'>,
): Omit<PlacedUnit, 'id' | 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'> {
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
    heightMm: item.defaultHeightMm,
    depthMm: item.defaultDepthMm,
    /* הרגליים כפי שנשמרו, וברירת המחדל של הנגרייה רק כשאין */
    socleMm: item.socleMm ?? defaults.socleMm,
    counterMm: item.counterMm,
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
