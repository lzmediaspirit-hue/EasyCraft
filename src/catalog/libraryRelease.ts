import { LIBRARY_RELEASE, SHIPPED_LIBRARY, type ShippedItem } from './shipped';
import { reusableSpec } from '../db/types';
import type { CatalogItem } from '../db/types';

/**
 * עדכון ספרייה למי שכבר מותקן.
 *
 * הזריעה רצה פעם אחת ונעצרת בסימון "נזרעה", וזה נכון: זריעה חוזרת
 * הייתה מוחקת התאמות אישיות ומחזירה תבניות שנמחקו בכוונה. אבל
 * המשמעות הייתה שתיקון בתבנית — נישת תנור במידות תקן, חלל לקערה
 * בארון כיור — אינו מגיע לאף התקנה קיימת, ורק התקנה חדשה מקבלת
 * אותו.
 *
 * מה שנבנה כאן הוא הדרך השלישית: לא זריעה חוזרת, ולא שתיקה, אלא
 * חבילת שחרור עם גרסה — מה נוסף, מה השתנה ומה נמחק — שמוצגת
 * לפני שמחילים אותה, ומחילים ממנה רק את מה שנבחר.
 *
 * שלושה דברים שהיא אינה עושה, ואלה שלושתם מכוונים:
 *
 *   • אינה נוגעת בתבנית שנערכה כאן. שינוי מקומי הוא החלטה של
 *     הנגרייה, והוא מוצג כהתנגשות ולא נדרס.
 *   • אינה מחזירה תבנית שנמחקה. סימון המחיקה הוא תשובה מפורשת.
 *   • אינה נוגעת בארגז שכבר הונח בפרויקט. הוא צילום מצב, ועדכון
 *     שלו הוא פעולה נפרדת שהמשתמש מבקש.
 */

/** מה השחרור הזה עושה לתבנית אחת. */
export type ChangeKind = 'added' | 'changed' | 'edited' | 'removed';

export interface LibraryChange {
  kind: ChangeKind;
  code: string;
  name: string;
  /** התבנית בשחרור. ריק כשהיא נמחקה כאן. */
  shipped?: ShippedItem;
  /** התבנית כפי שהיא כאן. ריק כשהיא חדשה. */
  local?: CatalogItem;
}

export interface LibraryUpdate {
  /** הגרסה שהנגרייה מחזיקה, והגרסה שיש */
  have: number;
  release: number;
  changes: LibraryChange[];
}

/**
 * מה שמשווים כשמחליטים אם תבנית "אותה תבנית".
 *
 * הסדר בספרייה, המועדפים והמק״ט הם של הנגרייה ולא של השחרור,
 * ולכן הם אינם נספרים כשינוי.
 */
function fingerprint(i: Partial<CatalogItem>): string {
  return JSON.stringify({
    ...reusableSpec(i),
    name: i.name,
    rooms: [...(i.rooms ?? [])].sort(),
    group: i.group,
    level: i.level,
    w: i.defaultWidthMm,
    h: i.defaultHeightMm,
    d: i.defaultDepthMm,
    y: i.defaultYMm,
    widths: [...(i.widthOptionsMm ?? [])].sort((a, b) => a - b),
    socle: i.socleMm,
    counter: i.counterMm,
    island: i.island,
    parts: i.parts,
  });
}

/**
 * מה יקרה אם נחיל את השחרור — בלי להחיל אותו.
 *
 * טהורה במכוון: היא מקבלת את מה שיש ומחזירה את ההפרש, ולכן אפשר
 * להריץ אותה על נתוני בדיקה. הקריאה למסד יושבת ב-`catalogRepo`,
 * כמו כל קריאה אחרת.
 *
 * `edited` היא ההתנגשות: התבנית קיימת כאן והיא שונה גם מהשחרור
 * וגם מהסימון שקיבלה בשחרור הקודם — כלומר ייתכן שנערכה כאן.
 * ברירת המחדל היא לא לגעת בה.
 */
export function diffLibrary(
  rows: CatalogItem[],
  erasedIds: string[],
  have: number,
): LibraryUpdate {
  const byId = new Map(rows.map((i) => [i.id, i]));
  const erased = new Set(erasedIds);
  const changes: LibraryChange[] = [];

  for (const s of SHIPPED_LIBRARY) {
    const local = byId.get(s.id);
    const label = { code: s.code ?? '', name: s.name };
    if (erased.has(s.id)) {
      changes.push({ kind: 'removed', ...label, shipped: s });
      continue;
    }
    if (!local) {
      changes.push({ kind: 'added', ...label, shipped: s });
      continue;
    }
    if (fingerprint(local) === fingerprint(s)) continue;
    const untouched = !!local.releaseMark && local.releaseMark === fingerprint(local);
    changes.push({ kind: untouched ? 'changed' : 'edited', ...label, shipped: s, local });
  }

  return { have, release: LIBRARY_RELEASE, changes };
}

/** האם יש מה להציע. */
export function hasLibraryUpdate(u: LibraryUpdate): boolean {
  return u.have < u.release && u.changes.some((c) => c.kind !== 'removed');
}

/**
 * התבנית כפי שהיא תיראה אחרי שהשחרור יוחל עליה.
 *
 * הסדר בספרייה, המועדף והמק״ט הם של הנגרייה, ולכן הם שורדים את
 * העדכון. כל השאר מגיע מהשחרור, והסימון נרשם כדי שהעריכה הבאה
 * תהיה ניתנת לזיהוי.
 */
export function mergedRow(local: CatalogItem, shipped: ShippedItem, now: number): CatalogItem {
  return {
    ...local,
    ...shipped,
    id: local.id,
    code: local.code ?? shipped.code,
    sortOrder: local.sortOrder,
    favorite: local.favorite,
    releaseMark: fingerprint(shipped),
    updatedAt: now,
    rev: (local.rev ?? 0) + 1,
  } as CatalogItem;
}

/** טביעת האצבע של תבנית בשחרור — נשמרת בשורה כדי לדעת מה נערך. */
export function fingerprintOf(i: Partial<CatalogItem>): string {
  return fingerprint(i);
}
