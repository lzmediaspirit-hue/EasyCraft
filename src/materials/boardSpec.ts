import { CORES, PART_ROLES } from '../db/types';
import type { Finish, Material, MaterialPrice, PartRole } from '../db/types';

/*
 * מפרט הלוח — תיאור אחד של מה שנבחר.
 *
 * הלוח חי באפליקציה כשני רשומות: ליבה וגוון. זו הפרדה נכונה — אותו
 * "לבן מט" קיים על סנדוויץ׳ ועל MDF במחיר אחר — אבל מה שמגיע
 * לנגרייה במשאית הוא דבר אחד: פלטה בגודל מסוים, בעובי מסוים, בגוון
 * מסוים, במחיר מסוים. עד עכשיו המסך הראה שם של גוון ושם של לוח,
 * והשאר — עובי, מידת פלטה, כיוון סיבים, מחיר — היה פזור במסכי
 * ההגדרות.
 *
 * כאן מחברים את השניים לתשובה אחת, בלי ציור ובלי מסך, כדי שכל מי
 * שמציג לוח יציג את אותו הדבר.
 */

/**
 * מצב מסחרי של צירוף גוון וחומר.
 *
 * `missing` — הגוון פשוט אינו קיים על הלוח הזה אצל הספק.
 * `unpriced` — קיים, אבל עוד לא הוקלד לו מחיר. זה לא "לא זמין",
 *   וזה בהחלט לא "בחינם": הצעת מחיר שכוללת אותו אינה שלמה.
 * `priced` — יש מחיר, ואפשר לתמחר לפיו.
 */
export type BoardStatus = 'priced' | 'unpriced' | 'missing';

export interface BoardSpec {
  status: BoardStatus;
  finishName: string;
  finishHex: string;
  /** מרקם פני השטח — מט, יער, סטון */
  texture?: string;
  /** כיוון סיבים שמחייב ניסור בכיוון קבוע */
  hasGrain: boolean;
  materialName?: string;
  /** שם הליבה — סנדוויץ׳, MDF, דיקט */
  coreLabel?: string;
  /** צבע הליבה, שנראה בחתך ובקנט */
  coreColor?: string;
  thicknessMm?: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  /** לאיזה חלק בארגז זה נבחר עכשיו */
  roleLabel?: string;
  price?: MaterialPrice;
}

/** האם לצירוף הזה יש מחיר שאפשר לתמחר לפיו. */
export function isPriced(price: MaterialPrice | undefined): boolean {
  return !!price && (price.factoryPrice !== undefined || price.consumerPrice !== undefined);
}

/**
 * הצירוף קיים אצל הספק, גם אם עוד אין לו מחיר.
 *
 * הרשומה עצמה היא ההצהרה: מפתח קיים = הגוון מגיע על הלוח הזה. עד
 * עכשיו הזמינות נגזרה מהמחיר, ולכן גוון אמיתי שעוד לא תומחר נעלם
 * מהרשימה — והנגר לא הבין למה הלוח שיש לו במחסן אינו מוצע לו.
 */
function isOffered(finish: Finish | undefined, materialId: string | undefined): boolean {
  return !!finish && !!materialId && finish.prices?.[materialId] !== undefined;
}

function boardStatus(
  finish: Finish | undefined,
  materialId: string | undefined,
): BoardStatus {
  if (!isOffered(finish, materialId)) return 'missing';
  return isPriced(finish!.prices[materialId!]) ? 'priced' : 'unpriced';
}

/** המפרט המלא של הצירוף שנבחר. */
export function boardSpec(
  finish: Finish | undefined,
  material: Material | undefined,
  role?: PartRole,
): BoardSpec {
  const core = CORES.find((c) => c.key === material?.core);
  const price = finish && material ? finish.prices?.[material.id] : undefined;
  return {
    status: boardStatus(finish, material?.id),
    finishName: finish?.name ?? 'לא נבחר גוון',
    finishHex: finish?.hex ?? '#e7e5e4',
    texture: finish?.texture,
    hasGrain: !!finish?.hasGrain,
    materialName: material?.name,
    coreLabel: core?.label,
    coreColor: material?.coreColor,
    thicknessMm: material?.thicknessMm,
    sheetWidthMm: material?.sheetWidthMm,
    sheetHeightMm: material?.sheetHeightMm,
    roleLabel: role ? PART_ROLES.find((r) => r.key === role)?.label : undefined,
    price,
  };
}
