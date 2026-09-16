import { db } from '../db/db';
import { CUSTOM_ROOM, type CatalogGroup, type CatalogItem, type RoomKind } from '../db/types';

import { CODE_PREFIX, codeNumber, fillCodes } from './codes';
import { SEED_CATALOG, type SeedItem } from './builtins';
import { SHIPPED_LIBRARY, type ShippedItem } from './shipped';
import { SHIPPED_PRODUCTS } from './products';

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
 *
 * המוצרים של האפליקציה — האי והמדף — נוסעים לצד שתיהן: הם אינם
 * ארגז שנבנה בנגרייה אלא תבנית של המערכת, ומזהה קבוע שומר עליהם
 * מלהשתכפל בזריעה, בייבוא או בהחזרה.
 */
function shippedLibrary(): ShippedItem[] {
  const base = SHIPPED_LIBRARY.length ? SHIPPED_LIBRARY : SEED_CATALOG.map(toShipped);
  const have = new Set(base.map((i) => i.id));
  return [...base, ...SHIPPED_PRODUCTS.filter((p) => !have.has(p.id))];
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
  const rows = shippedLibrary().map((s) => ({ ...s, createdAt: now, updatedAt: now }));
  /*
   * מק״ט כבר בזריעה, ולא רק בהגירה של ספרייה קיימת. התקנה
   * חדשה אינה עוברת דרך ההגירה, ובלי זה היא מקבלת ספרייה שלמה
   * בלי מק״טים — ואז שום דבר אינו מונע ממנה להשתכפל בייבוא הבא.
   */
  const fresh = new Map(fillCodes(rows).map((c) => [c.id, c.code]));
  // bulkPut ולא bulkAdd — כדי ששתי הפעלות במקביל לא ייפלו על כפילות
  await db.catalog.bulkPut(rows.map((r) => ({ ...r, code: r.code ?? fresh.get(r.id) })));
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
    common: s.common,
    isBuiltin: true,
    sortOrder: order,
    note: s.note,
  };
}

export const catalogRepo = {
  /**
   * המק״ט הפנוי הבא בקטגוריה.
   * ממשיך מהגבוה ביותר שקיים, כך שמק״ט שנמחק אינו חוזר ומתנגש
   * בארגז ישן שעדיין מוזכר בהזמנה או על מדבקה.
   */
  async nextCode(group: CatalogGroup): Promise<string> {
    const prefix = CODE_PREFIX[group];
    const rows = await db.catalog.toArray();
    const top = rows.reduce((n, i) => Math.max(n, codeNumber(i.code, prefix)), 100);
    return `${prefix}-${top + 1}`;
  },

  /** הארגז שנושא את המק״ט הזה, אם יש כזה. */
  async byCode(code: string): Promise<CatalogItem | undefined> {
    const key = code.trim().toUpperCase();
    if (!key) return undefined;
    return (await db.catalog.toArray()).find((i) => i.code?.toUpperCase() === key);
  },

  /** סימון ארגז כמועדף, או הסרתו מהמועדפים. */
  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await db.catalog.update(id, { favorite, updatedAt: Date.now() });
  },

  /** פריטי הספרייה הרלוונטיים לחדר מסוים. חדר בהגדרה אישית מקבל הכול. */
  async forRoom(room: RoomKind): Promise<CatalogItem[]> {
    const all = await catalogRepo.all();
    return room === CUSTOM_ROOM ? all : all.filter((i) => i.rooms.includes(room));
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
    const code = input.code?.trim().toUpperCase();
    /*
     * המק״ט הוא הזהות.
     *
     * שמירה תחת מק״ט שכבר קיים מעדכנת את הארגז ההוא ואינה יוצרת
     * עותק שני שלו — אחרת אותו ארגז מופיע פעמיים ברשימה, ואי אפשר
     * לדעת איזה מהם נכון. גם ייבוא של ספרייה שכבר יש ממנה חלק
     * נשען על זה.
     */
    const twin = !input.id && code ? await catalogRepo.byCode(code) : undefined;
    const id = input.id ?? twin?.id;

    if (id) {
      const { id: _drop, ...rest } = input;
      // שדות שלא נשלחו נשארים כמו שהם, כדי שעריכה לא תמחק מאפיין קיים
      const patch = defined({ ...rest, code });
      await db.catalog.update(id, { ...patch, updatedAt: now });
      return id;
    }

    const fresh = crypto.randomUUID();
    await db.catalog.add({
      ...input,
      id: fresh,
      code: code || (await catalogRepo.nextCode(input.group)),
      // ארגז שהמשתמש בנה הוא ארגז שהוא מתכוון להשתמש בו — מקומו בספרייה הראשית
      common: true,
      isBuiltin: false,
      sortOrder: 1000 + (now % 1000),
      createdAt: now,
      updatedAt: now,
    });
    return fresh;
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
   * החזרת הספרייה שמגיעה עם האפליקציה.
   *
   * `seedCatalog` רץ פעם אחת בהפעלה הראשונה, ולכן מי שמחק ארגזים
   * או החליף את הספרייה כולה בשלו נשאר בלעדיהם לתמיד. כאן היא
   * חוזרת: מה שחסר נוסף, ומה שהוסתר חוזר לרשימה.
   *
   * ההתאמה היא לפי המזהה ולפי המק״ט גם יחד. ארגז שהגיע למכשיר הזה
   * דרך ייבוא קיבל אולי מזהה אחר, ובלי המק״ט הוא היה חוזר לכאן
   * פעם שנייה — אותו ארגז, שתי שורות.
   *
   * מה שקיים אינו נדרס — ארגז שהמשתמש ערך נשאר כמו שערך אותו, כי
   * תיקון של מידה הוא בדיוק מה שלא רוצים לאבד.
   */
  async reseed(): Promise<number> {
    const now = Date.now();
    let back = 0;
    await db.transaction('rw', db.catalog, async () => {
      const rows = await db.catalog.toArray();
      const byId = new Map(rows.map((i) => [i.id, i]));
      const byCode = new Map(
        rows.filter((i) => i.code).map((i) => [i.code!.toUpperCase(), i]),
      );
      const missing: CatalogItem[] = [];
      for (const s of shippedLibrary()) {
        const have = byId.get(s.id) ?? (s.code ? byCode.get(s.code.toUpperCase()) : undefined);
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
