import { db } from '../db/db';
import { settingsRepo } from '../materials/materialsRepo';
import { allMine, owned } from '../db/rows';
import { workshopId } from '../db/workshop';
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
 * `edited` היא ההתנגשות: התבנית קיימת כאן, היא שונה מהשחרור, והיא
 * שונה גם מהגרסה שנשלחה בשחרור. בלי היסטוריה של הגרסה הקודמת אי
 * אפשר לדעת מי שינה אותה, ולכן ברירת המחדל היא לא לגעת בה.
 */
export async function libraryUpdate(): Promise<LibraryUpdate> {
  const [settings, rows, marks] = await Promise.all([
    settingsRepo.get(),
    allMine(db.catalog),
    db.tombstones.where('[workshopId+table]').equals([workshopId(), 'catalog']).toArray(),
  ]);
  const have = settings.libraryRelease ?? 0;
  const byId = new Map(rows.map((i) => [i.id, i]));
  const erased = new Set(marks.map((m) => m.rowId));
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
    /*
     * שונה מהשחרור. תבנית שנושאת סימון שחרור וזהה לו מעולם לא
     * נערכה כאן, ולכן השינוי הוא של השחרור בלבד. תבנית שתוכנה
     * שונה מהסימון שלה — או שאין לה סימון כלל — ייתכן שנערכה
     * כאן, והיא מוצגת כהתנגשות ואינה נדרסת.
     */
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
 * החלת השחרור, על מה שנבחר בלבד.
 *
 * `take` הוא רשימת המזהים שאושרו. מה שאינו בה נשאר כפי שהוא,
 * והגרסה נרשמת בכל מקרה — כדי שמי שבחר לא לקבל שינוי לא יישאל
 * עליו שוב בכל פתיחה.
 */
export async function applyLibraryUpdate(take: string[]): Promise<number> {
  const picked = new Set(take);
  const { changes } = await libraryUpdate();
  const now = Date.now();
  let n = 0;
  await db.transaction('rw', db.catalog, async () => {
    for (const c of changes) {
      if (!c.shipped || c.kind === 'removed' || !picked.has(c.shipped.id)) continue;
      const mark = fingerprintOf(c.shipped);
      if (c.kind === 'added') {
        await db.catalog.put({
          ...c.shipped,
          releaseMark: mark,
          ...owned(),
          createdAt: now,
          updatedAt: now,
        } as CatalogItem);
      } else if (c.local) {
        /* הסדר, המועדף והמק״ט של הנגרייה נשארים שלה */
        await db.catalog.put({
          ...c.local,
          ...c.shipped,
          id: c.local.id,
          code: c.local.code ?? c.shipped.code,
          sortOrder: c.local.sortOrder,
          favorite: c.local.favorite,
          releaseMark: mark,
          updatedAt: now,
          rev: (c.local.rev ?? 0) + 1,
        } as CatalogItem);
      }
      n += 1;
    }
  });
  await settingsRepo.save({ libraryRelease: LIBRARY_RELEASE });
  return n;
}

/** טביעת האצבע של תבנית בשחרור — נשמרת בשורה כדי לדעת מה נערך. */
export function fingerprintOf(i: Partial<CatalogItem>): string {
  return fingerprint(i);
}
