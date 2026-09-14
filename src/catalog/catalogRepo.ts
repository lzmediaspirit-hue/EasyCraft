import { db } from '../db/db';
import type { CatalogItem, RoomKind } from '../db/types';
import { SEED_CATALOG, type SeedItem } from './builtins';
import { SHIPPED_LIBRARY, type ShippedItem } from './shipped';

/**
 * הספרייה נזרעת לתוך בסיס הנתונים בהפעלה הראשונה, כך שכל פריט —
 * גם כזה שהגיע עם האפליקציה — ניתן לעריכה על ידי המשתמש.
 */
let seeding: Promise<void> | null = null;


export function seedCatalog(): Promise<void> {
  seeding ??= runSeed();
  return seeding;
}

/**
 * מה שמגיע עם האפליקציה.
 *
 * ספרייה שנבנתה בנגרייה והוכנסה לקוד גוברת על ארגזי התקן: מי שכבר
 * בנה לעצמו את הארגזים שהוא עובד איתם לא צריך לראות רשימה כללית
 * לצידם. כשאין כזו — ארגזי התקן הם נקודת הפתיחה.
 */
export function shippedLibrary(): ShippedItem[] {
  return SHIPPED_LIBRARY.length ? SHIPPED_LIBRARY : SEED_CATALOG.map(toShipped);
}

/**
 * זריעה רק לספרייה ריקה — כלומר בהתקנה הראשונה בלבד.
 *
 * קודם נזרע בכל טעינה כל מה שחסר, ולכן נגר שמחק ארגזי תקן או החליף
 * את הספרייה כולה בשלו מצא אותם שוב בפתיחה הבאה: ההסרה החזיקה עד
 * הרענון ולא יותר. מה שהוסר נשאר מוסר, ומי שרוצה את ארגזי התקן
 * בחזרה לוחץ על "החזרת ארגזי התקן" בגיבוי והעברה.
 */
async function runSeed(): Promise<void> {
  if (await db.catalog.count()) return;
  const now = Date.now();
  // bulkPut ולא bulkAdd — כדי ששתי הפעלות במקביל לא ייפלו על כפילות
  await db.catalog.bulkPut(shippedLibrary().map((s) => ({ ...s, createdAt: now, updatedAt: now })));
}

function toShipped(s: SeedItem, order: number): ShippedItem {
  return {
    id: s.key,
    rooms: s.rooms,
    group: s.group,
    name: s.name,
    glyph: s.glyph,
    doors: s.doors,
    drawers: s.drawers,
    drawerCols: s.drawerCols,
    shelves: s.shelves,
    level: s.level,
    defaultWidthMm: s.w,
    widthOptionsMm: s.widths,
    defaultHeightMm: s.h,
    defaultDepthMm: s.d,
    defaultYMm: s.y,
    socleMm: s.socle,
    counterMm: s.counter,
    corner: s.corner,
    blindMm: s.blind,
    panelThicknessMm: s.panelThickness,
    common: s.common,
    isBuiltin: true,
    sortOrder: order,
    note: s.note,
  };
}

export const catalogRepo = {
  /** פריטי הספרייה הרלוונטיים לחדר מסוים. חדר בהגדרה אישית מקבל הכול. */
  async forRoom(room: RoomKind): Promise<CatalogItem[]> {
    const all = await catalogRepo.all();
    return room === 'custom' ? all : all.filter((i) => i.rooms.includes(room));
  },

  /** כל הפריטים שבספרייה, ממוינים לפי הסדר שלה. מה שהוסר אינו כאן. */
  async all(): Promise<CatalogItem[]> {
    const rows = await db.catalog.toArray();
    return rows.filter((i) => !i.hiddenAt).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /** מה שהוסר מהספרייה — כדי שאפשר יהיה להחזיר. */
  async removed(): Promise<CatalogItem[]> {
    const rows = await db.catalog.toArray();
    return rows.filter((i) => i.hiddenAt).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<CatalogItem | undefined> {
    return db.catalog.get(id);
  },

  /**
   * שומר ארגז שהמשתמש בנה, או מעדכן אחד קיים.
   *
   * הקלט נגזר מ-`CatalogItem` ולא מתואר מחדש: שלושים שדות שהועתקו
   * ביד נשארו מאחור בכל פעם שנוסף מאפיין לארגז, והתוצאה הייתה
   * מאפיין שנשמר בספרייה אבל לא היה ניתן לשמירה מהטופס.
   */
  async saveCustom(
    input: Omit<
      CatalogItem,
      'id' | 'createdAt' | 'updatedAt' | 'isBuiltin' | 'sortOrder'
    > & { id?: string },
  ): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      // שדות שלא נשלחו נשארים כמו שהם, כדי שעריכה לא תמחק מאפיין קיים
      await db.catalog.update(id, { ...defined(rest), updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    await db.catalog.add({
      ...input,
      id,
      // ארגז שהמשתמש בנה הוא ארגז שהוא מתכוון להשתמש בו — מקומו בספרייה הראשית
      common: true,
      isBuiltin: false,
      sortOrder: 1000 + (now % 1000),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  /**
   * הסרת פריט מהספרייה.
   *
   * מה שהמשתמש בנה נמחק; מה שהגיע עם האפליקציה רק מסומן כמוסר,
   * כי מחיקה אמיתית שלו הייתה חוזרת בעדכון הבא. בשני המקרים הוא
   * יורד מהרשימות — וזו הבקשה.
   */
  async remove(id: string): Promise<void> {
    const item = await db.catalog.get(id);
    if (!item) return;
    if (item.isBuiltin) await db.catalog.update(id, { hiddenAt: Date.now() });
    else await db.catalog.delete(id);
  },

  /**
   * החזרת ארגזי התקן שמגיעים עם האפליקציה.
   *
   * `seedCatalog` רץ פעם אחת בהפעלה הראשונה, ולכן מי שמחק את ארגזי
   * התקן או החליף את הספרייה כולה בשלו נשאר בלעדיהם לתמיד. כאן הם
   * נזרעים מחדש: מה שחסר נוסף, ומה שהוסתר חוזר לרשימה.
   *
   * מה שקיים אינו נדרס — ארגז תקן שהמשתמש ערך נשאר כמו שערך אותו,
   * כי תיקון של מידה הוא בדיוק מה שלא רוצים לאבד.
   */
  async reseed(): Promise<number> {
    const now = Date.now();
    let back = 0;
    await db.transaction('rw', db.catalog, async () => {
      const existing = new Map((await db.catalog.toArray()).map((i) => [i.id, i]));
      const missing: CatalogItem[] = [];
      for (const s of shippedLibrary()) {
        const have = existing.get(s.id);
        if (!have) missing.push({ ...s, createdAt: now, updatedAt: now });
        else if (have.hiddenAt) missing.push({ ...have, hiddenAt: undefined, updatedAt: now });
      }
      back = missing.length;
      if (missing.length) await db.catalog.bulkPut(missing);
    });
    return back;
  },

  /** מחזיר לספרייה את כל מה שהוסר ממנה. */
  async restoreAll(): Promise<void> {
    await db.catalog
      .toCollection()
      .modify((i) => {
        if (i.hiddenAt) delete i.hiddenAt;
      });
  },
};

/** משמיט מפתחות ללא ערך, כדי ש-update לא ידרוס אותם ב-undefined. */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
