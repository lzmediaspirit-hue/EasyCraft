import { db } from '../db/db';
import { settingsRepo } from '../materials/materialsRepo';
import { CUSTOM_ROOM, type CatalogGroup, type CatalogItem, type RoomKind } from '../db/types';

import { CODE_PREFIX, codeNumber, fillCodes } from './codes';
import { SEED_CATALOG, type SeedItem } from './builtins';
import { SHIPPED_LIBRARY, type ShippedItem } from './shipped';
import { PRODUCTS_GENERATION, SHIPPED_PRODUCTS } from './products';
import { allMine, eraseIds, mine, owned, patchRow } from '../db/rows';
import { workshopId } from '../db/workshop';
import { BuildError, checkItem } from './saveGate';

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
 * המוצרים של האפליקציה — האי, המדף והמכשירים — נוסעים לצד שתיהן:
 * הם אינם ארגז שנבנה בנגרייה אלא תבנית של המערכת, ומזהה קבוע שומר
 * עליהם מלהשתכפל בזריעה, בייבוא או בהחזרה.
 */
function shippedLibrary(): ShippedItem[] {
  const base = SHIPPED_LIBRARY.length ? SHIPPED_LIBRARY : SEED_CATALOG.map(toShipped);
  const have = new Set(base.map((i) => i.id));
  return [...base, ...SHIPPED_PRODUCTS.filter((p) => !have.has(p.id))];
}

/**
 * זריעה פעם אחת, בהתקנה הראשונה בלבד.
 *
 * התנאי הוא סימון מפורש ולא "הטבלה ריקה". נגר שמחק את הפריט
 * האחרון שלו קיבל בפתיחה הבאה את ספריית ההדגמה כולה בחזרה —
 * טבלה ריקה נראית בדיוק כמו התקנה חדשה, והקוד לא ידע להבדיל.
 * מה שנמחק נשאר מחוק; "החזרת ארגזי הספרייה" היא הדרך המפורשת
 * חזרה, והיא נלחצת ביד.
 */
async function runSeed(): Promise<void> {
  const settings = await settingsRepo.get();
  if (settings.catalogSeededAt) return;
  const now = Date.now();
  const rows = shippedLibrary().map((s) => ({ ...s, ...owned(), createdAt: now, updatedAt: now }));
  /*
   * מק״ט כבר בזריעה, ולא רק בהגירה של ספרייה קיימת. התקנה
   * חדשה אינה עוברת דרך ההגירה, ובלי זה היא מקבלת ספרייה שלמה
   * בלי מק״טים — ואז שום דבר אינו מונע ממנה להשתכפל בייבוא הבא.
   */
  const fresh = new Map(fillCodes(rows).map((c) => [c.id, c.code]));
  // bulkPut ולא bulkAdd — כדי ששתי הפעלות במקביל לא ייפלו על כפילות
  await db.catalog.bulkPut(rows.map((r) => ({ ...r, code: r.code ?? fresh.get(r.id) })));
  await settingsRepo.save({ catalogSeededAt: now, productsGeneration: PRODUCTS_GENERATION });
}

/**
 * מוצרי מערכת שנוספו אחרי ההתקנה.
 *
 * הזריעה רצה פעם אחת, והסימון "הספרייה נזרעה" חסם אותה לתמיד —
 * ולכן מי שהתקין לפני שמוצר נוסף נשאר בלעדיו לנצח, בזמן
 * שהתקנה חדשה קיבלה אותם. שדרוג ממוקד: רק מה שהדור שלו חדש מהדור
 * שהנגרייה כבר קיבלה, ורק מה שמעולם לא היה כאן.
 *
 * שני דברים שהוא אינו עושה: הוא אינו מחזיר את ספריית ההדגמה, והוא
 * אינו מחזיר מה שנמחק בכוונה — סימון המחיקה הוא התשובה ל"כבר היה
 * לי את זה ולא רציתי אותו".
 */
export async function addSystemProducts(): Promise<number> {
  const settings = await settingsRepo.get();
  const had = settings.productsGeneration ?? 0;
  if (had >= PRODUCTS_GENERATION) return 0;

  const [rows, marks] = await Promise.all([
    allMine(db.catalog),
    db.tombstones.where('[workshopId+table]').equals([workshopId(), 'catalog']).toArray(),
  ]);
  const byId = new Set(rows.map((i) => i.id));
  const byCode = new Set(rows.filter((i) => i.code).map((i) => i.code!.toUpperCase()));
  const erased = new Set(marks.map((m) => m.rowId));

  const now = Date.now();
  const missing = SHIPPED_PRODUCTS.filter(
    (p) => !byId.has(p.id) && !erased.has(p.id) && !(p.code && byCode.has(p.code.toUpperCase())),
  ).map((p) => ({ ...p, ...owned(), createdAt: now, updatedAt: now }));

  if (missing.length) await db.catalog.bulkAdd(missing);
  await settingsRepo.save({ productsGeneration: PRODUCTS_GENERATION });
  return missing.length;
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
    const rows = await allMine(db.catalog);
    const top = rows.reduce((n, i) => Math.max(n, codeNumber(i.code, prefix)), 100);
    return `${prefix}-${top + 1}`;
  },

  /** הארגז שנושא את המק״ט הזה, אם יש כזה. */
  async byCode(code: string): Promise<CatalogItem | undefined> {
    const key = code.trim().toUpperCase();
    if (!key) return undefined;
    return (await allMine(db.catalog)).find((i) => i.code?.toUpperCase() === key);
  },

  /** סימון ארגז כמועדף, או הסרתו מהמועדפים. */
  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await patchRow(db.catalog, id, { favorite });
  },

  /** פריטי הספרייה הרלוונטיים לחדר מסוים. חדר בהגדרה אישית מקבל הכול. */
  async forRoom(room: RoomKind): Promise<CatalogItem[]> {
    const all = await catalogRepo.all();
    return room === CUSTOM_ROOM ? all : all.filter((i) => i.rooms.includes(room));
  },

  /** כל הפריטים שבספרייה, ממוינים לפי הסדר שלה. מה שהוסר אינו כאן. */
  async all(): Promise<CatalogItem[]> {
    const rows = await allMine(db.catalog);
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<CatalogItem | undefined> {
    const row = await db.catalog.get(id);
    return row && mine(row) ? row : undefined;
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
      'id' | 'createdAt' | 'updatedAt' | 'isBuiltin' | 'sortOrder' | 'workshopId' | 'rev'
    > & { id?: string },
  ): Promise<string> {
    /*
     * הספרייה היא שער שמירה ככל שער אחר.
     *
     * פריט שאי אפשר לבנות ממנו ארגז אינו פריט — הוא ייצור חלקים
     * בגובה אפס בכל פרויקט שיניח אותו, ורק שם זה יתגלה.
     */
    const why = checkItem(input);
    if (why) throw new BuildError(why);
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
      await patchRow(db.catalog, id, patch);
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
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
    return fresh;
  },


  /**
   * הזזת פריט מקום אחד בתוך הקטגוריה שלו.
   *
   * הסדר הוא של הנגרייה: מה שמרכיבים כל יום צריך להיות ראשון,
   * ולא במקום שבו הוא נכתב בקוד. ההחלפה היא בין שני שכנים —
   * ולכן שתי שורות בלבד נכתבות, והסדר של השאר אינו זז.
   *
   * זו אינה גרירה. כפתור מעלה וכפתור מטה עובדים באצבע, בעכבר
   * ובמקלדת באותה מידה, ומי שעובד עם קורא מסך שומע לאן הפריט זז.
   */
  async move(id: string, dir: -1 | 1): Promise<void> {
    const rows = await catalogRepo.all();
    const item = rows.find((i) => i.id === id);
    if (!item) return;
    /* השכנים הם של אותה קטגוריה בלבד: סדר הוא בתוך רשימה אחת */
    const peers = rows.filter((i) => i.group === item.group);
    const at = peers.findIndex((i) => i.id === id);
    const swap = peers[at + dir];
    if (!swap) return;
    await db.transaction('rw', db.catalog, async () => {
      await patchRow(db.catalog, item.id, { sortOrder: swap.sortOrder });
      await patchRow(db.catalog, swap.id, { sortOrder: item.sortOrder });
    });
  },

  /**
   * מחיקת פריט מהספרייה.
   *
   * מחיקה היא מחיקה. עד כאן פריט שהגיע עם האפליקציה רק סומן
   * כמוסר ונשאר במכשיר, ומי שניקה את הספרייה שלו מצא אותו חוזר
   * דרך "החזרת ארגזים שהוסרו" או דרך גיבוי — שחזור שסותר את מה
   * שהמשתמש ביקש.
   *
   * ארגזים שכבר הונחו בפרויקטים אינם נוגעים בזה: ארגז שהונח על
   * קיר שמר את המפרט שלו בעצמו ברגע ההנחה, והוא אינו קורא
   * מהספרייה. "החזרת ארגזי הספרייה" נשארת הדרך המפורשת חזרה.
   */
  async remove(id: string): Promise<void> {
    await eraseIds(db.catalog, [id]);
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
      const rows = await allMine(db.catalog);
      const byId = new Map(rows.map((i) => [i.id, i]));
      const byCode = new Map(
        rows.filter((i) => i.code).map((i) => [i.code!.toUpperCase(), i]),
      );
      const missing: CatalogItem[] = [];
      for (const s of shippedLibrary()) {
        const have = byId.get(s.id) ?? (s.code ? byCode.get(s.code.toUpperCase()) : undefined);
        if (!have) missing.push({ ...s, ...owned(), createdAt: now, updatedAt: now });
      }
      back = missing.length;
      if (missing.length) await db.catalog.bulkPut(missing);
    });
    return back;
  },

};

/** משמיט מפתחות ללא ערך, כדי ש-update לא ידרוס אותם ב-undefined. */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
