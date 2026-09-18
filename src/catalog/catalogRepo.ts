import { db } from '../db/db';
import { settingsRepo } from '../materials/materialsRepo';
import { CUSTOM_ROOM, type CatalogGroup, type CatalogItem, type RoomKind } from '../db/types';

import { CODE_PREFIX, codeNumber, fillCodes } from './codes';
import { SEED_CATALOG, type SeedItem } from './builtins';
import { LIBRARY_GENERATION, LIBRARY_RELEASE, SHIPPED_LIBRARY, type ShippedItem } from './shipped';
import { diffLibrary, fingerprintOf, mergedRow, type LibraryUpdate } from './libraryRelease';
import { PRODUCTS_GENERATION, SHIPPED_PRODUCTS } from './products';
import { allMine, eraseIds, mine, owned, patchRow, revive } from '../db/rows';
import { workshopId } from '../db/workshop';
import { BuildError, checkItem } from './saveGate';
import { cabinetNameKey, cleanCabinetName } from './names';

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
  await db.catalog.bulkPut(
    rows.map((r) => ({
      ...r,
      code: r.code ?? fresh.get(r.id),
      /* הסימון שממנו יידעו בעתיד מה נערך כאן ומה שינה שחרור */
      releaseMark: fingerprintOf(r),
    })),
  );
  await settingsRepo.save({
    catalogSeededAt: now,
    productsGeneration: PRODUCTS_GENERATION,
    /* התקנה חדשה מקבלת את הגרסה הנוכחית, ואין לה מה לעדכן */
    libraryRelease: LIBRARY_RELEASE,
  });
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
/**
 * מה מציע השחרור הנוכחי לספרייה שכאן.
 *
 * הקריאה למסד יושבת כאן; ההשוואה עצמה טהורה ויושבת ב-
 * `libraryRelease`. ראה שם למה זה לא זריעה חוזרת.
 */
export async function libraryUpdate(): Promise<LibraryUpdate> {
  const [settings, rows, marks] = await Promise.all([
    settingsRepo.get(),
    allMine(db.catalog),
    db.tombstones.where('[workshopId+table]').equals([workshopId(), 'catalog']).toArray(),
  ]);
  return diffLibrary(rows, marks.map((m) => m.rowId), settings.libraryRelease ?? 0);
}

/**
 * החלת השחרור, על מה שסומן בלבד.
 *
 * הגרסה נרשמת בכל מקרה: מי שבחר לא לקבל שינוי לא יישאל עליו שוב
 * בכל פתיחה. מה שלא סומן נשאר כפי שהוא.
 */
export async function applyLibraryUpdate(take: string[]): Promise<number> {
  const picked = new Set(take);
  const { changes } = await libraryUpdate();
  const now = Date.now();
  let n = 0;
  await db.transaction('rw', db.catalog, async () => {
    for (const c of changes) {
      if (!c.shipped || c.kind === 'removed' || !picked.has(c.shipped.id)) continue;
      if (c.kind === 'added') {
        await db.catalog.put({
          ...c.shipped,
          releaseMark: fingerprintOf(c.shipped),
          ...owned(),
          createdAt: now,
          updatedAt: now,
        } as CatalogItem);
      } else if (c.local) {
        await db.catalog.put(mergedRow(c.local, c.shipped, now));
      }
      n += 1;
    }
  });
  await settingsRepo.save({ libraryRelease: LIBRARY_RELEASE });
  return n;
}

/**
 * תבנית שמגיעה עם האפליקציה ומעולם לא הייתה כאן — נכנסת לבד.
 *
 * `applyLibraryUpdate` היא בחירה מפורשת, והיא נכונה לתבנית שכבר
 * קיימת כאן: דריסה של שורה שהנגרייה אולי ערכה היא החלטה שלה. אבל
 * תבנית *חדשה* אינה דריסה של דבר, והדרישה שמישהו ייכנס להגדרות
 * וילחץ עליה הפכה כל ארגז שנוסף לספרייה לארגז שאיש אינו רואה.
 *
 * כך בדיוק נעלמו הארגזים מהחדרים: הספרייה שנזרעה בגרסה מוקדמת
 * כיסתה מטבח, סלון וחדר שינה בלבד, ושש הקטגוריות שנוספו אחריה —
 * אמבטיה, חדר ארונות, חדר ילדים, כניסה, משרד וחדר שירות — נשארו
 * ריקות לנצח. `addBuiltinRooms` החזיר את החדרים; זה מחזיר את מה
 * שבתוכם.
 *
 * שלוש הגבלות, וכולן מכוונות:
 *
 *   • רק `added` ו-`changed`. `changed` היא שורה שטביעת האצבע שלה
 *     זהה לסימון שקיבלה בשחרור הקודם — כלומר מוכח שלא נערכה כאן,
 *     ולכן עדכון שלה אינו מוחק עבודה. `edited` היא התנגשות, והיא
 *     נשארת למסך שמציג אותה ושואל.
 *   • אינה מחזירה תבנית שנמחקה. סימון המחיקה הוא תשובה.
 *   • אינה נוגעת במק״ט שכבר תפוס כאן. שני ארגזים באותו מק״ט הם
 *     בדיוק מה שהגירה 23 באה לנקות.
 *
 * הגרסה נרשמת רק כשלא נשארה התנגשות: אחרת ההתנגשות הייתה נעלמת
 * מהמסך שאמור להציג אותה, בלי שאיש ענה עליה.
 */
export async function addShippedCabinets(): Promise<number> {
  const { have, release, changes } = await libraryUpdate();
  if (have >= release) return 0;

  const now = Date.now();
  const added = await db.transaction('rw', db.catalog, async () => {
    /*
     * המק״טים התפוסים נקראים בתוך הטרנזקציה: בין "מה חסר" לבין
     * "הוסף" אסור שמישהו אחר יתפוס מק״ט.
     */
    const here = await allMine(db.catalog);
    const byId = new Set(here.map((i) => i.id));
    const byCode = new Set(here.filter((i) => i.code).map((i) => i.code!.toUpperCase()));
    let n = 0;
    for (const c of changes) {
      if (!c.shipped) continue;
      if (c.kind === 'added') {
        if (byId.has(c.shipped.id)) continue;
        if (c.shipped.code && byCode.has(c.shipped.code.toUpperCase())) continue;
        await db.catalog.put({
          ...c.shipped,
          releaseMark: fingerprintOf(c.shipped),
          ...owned(),
          createdAt: now,
          updatedAt: now,
        } as CatalogItem);
        byId.add(c.shipped.id);
        if (c.shipped.code) byCode.add(c.shipped.code.toUpperCase());
        n += 1;
      } else if (c.kind === 'changed' && c.local) {
        await db.catalog.put(mergedRow(c.local, c.shipped, now));
        n += 1;
      }
    }
    return n;
  });

  if (!changes.some((c) => c.kind === 'edited')) {
    await settingsRepo.save({ libraryRelease: LIBRARY_RELEASE });
  }
  return added;
}

/**
 * תבניות שהגיעו עם גרסה קודמת של האפליקציה, ואינן נשלחות עוד.
 *
 * הספרייה הוחלפה כולה כשנכנסה ספריית הנגרייה: מזהים אחרים, מק״טים
 * אחרים, שמות אחרים. מי שהתקין לפני כן נשאר עם שתיהן זו לצד זו —
 * שישים ואחת תבניות הדגמה ישנות מתחת לשבעים ושבע החדשות, באותם
 * חדרים.
 *
 * ההסרה אינה אוטומטית ולא תהיה: זו מחיקה, והמחיקה היא של הנגרייה.
 * מה שהיא כן — ניתנת לזיהוי בלי לנחש. `isBuiltin` מסמן תבנית
 * שהגיעה עם האפליקציה ולא נבנתה כאן (ארגז שנשמר מהמסך מקבל
 * `false`), ולכן "מובנית ואינה בשחרור הנוכחי" היא בדיוק "הגיעה
 * עם גרסה קודמת".
 */
export async function supersededBuiltins(): Promise<CatalogItem[]> {
  const shipped = new Set(shippedLibrary().map((s) => s.id));
  return (await allMine(db.catalog)).filter((i) => i.isBuiltin && !shipped.has(i.id));
}

/** הסרת אותן תבניות. פרויקטים אינם נפגעים — ארגז שהונח הוא צילום מצב. */
export async function removeSuperseded(): Promise<number> {
  const rows = await supersededBuiltins();
  if (rows.length) await eraseIds(db.catalog, rows.map((i) => i.id));
  return rows.length;
}

/**
 * הספרייה שמגיעה עם האפליקציה הוחלפה — והתקנה קיימת מקבלת את החדשה
 * במקום הישנה, ולא לצידה.
 *
 * `addShippedCabinets` ו-`applyLibraryUpdate` הם מנגנון ההצעה, והם
 * נכונים לשינוי נקודתי: תבנית שהשתנתה מוצגת, והנגרייה בוחרת. הם
 * אינם נכונים כאן. כשספרייה שלמה מוחלפת באחרת אין "גרסה חדשה של
 * אותו ארגז" למזג — מה שהיה כאן הוא פשוט ספרייה אחרת, והשארתה לצד
 * החדשה נותנת שתי רשימות באותם חדרים. בדיוק זה קרה כשנכנסה ספריית
 * הנגרייה הראשונה, ו-`removeSuperseded` נכתב כדי לנקות אחריה — ביד.
 *
 * הדור הוא מה שהופך את זה לאוטומטי, ורק פעם אחת לכל החלפה. שלושה
 * דברים קורים, לפי הסדר:
 *
 *   1. כל תבנית מובנית שאינה בספרייה החדשה יורדת. פרויקטים אינם
 *      נפגעים — ארגז שהונח על קיר נושא את המפרט שלו בעצמו, ולכן
 *      מחיקת התבנית שממנה נולד אינה נוגעת בו.
 *   2. סימוני המחיקה של מה שכן בספרייה החדשה מנוקים. בלעדיהם ארגז
 *      שהנגרייה מחקה פעם היה חוזר ונעלם — הסימון הוא תשובה לשאלה
 *      הישנה, ולא לזו.
 *   3. הספרייה החדשה נכתבת. תבנית שנערכה כאן נדרסת, וזו הכוונה:
 *      ההחלפה היא החלטה מפורשת.
 *
 * מה שהנגרייה בנתה בעצמה — `isBuiltin: false` — אינו נוגע בזה
 * בכלל. הוא לא הגיע עם האפליקציה, ולכן אין לו "גרסה חדשה".
 */
export async function replaceLibrary(): Promise<{ removed: number; added: number }> {
  const settings = await settingsRepo.get();
  /* התקנה חדשה נזרעת מהספרייה הזאת ממילא, ואין לה מה להחליף */
  if (!settings.catalogSeededAt) {
    await settingsRepo.save({ libraryGeneration: LIBRARY_GENERATION });
    return { removed: 0, added: 0 };
  }
  if ((settings.libraryGeneration ?? 0) >= LIBRARY_GENERATION) return { removed: 0, added: 0 };

  const shipped = shippedLibrary();
  const gone = await supersededBuiltins();
  if (gone.length) await eraseIds(db.catalog, gone.map((i) => i.id));
  await revive('catalog', shipped.map((s) => s.id));

  const now = Date.now();
  await db.catalog.bulkPut(
    shipped.map((r) => ({
      ...r,
      ...owned(),
      createdAt: now,
      updatedAt: now,
      releaseMark: fingerprintOf(r),
    })) as CatalogItem[],
  );
  await settingsRepo.save({
    libraryGeneration: LIBRARY_GENERATION,
    /* אין מה להציע אחרי החלפה: מה שבקוד הוא בדיוק מה שכאן */
    libraryRelease: LIBRARY_RELEASE,
  });
  return { removed: gone.length, added: shipped.length };
}

export async function addSystemProducts(): Promise<number> {
  const settings = await settingsRepo.get();
  const had = settings.productsGeneration ?? 0;
  if (had >= PRODUCTS_GENERATION) return 0;

  const marks = await db.tombstones
    .where('[workshopId+table]')
    .equals([workshopId(), 'catalog'])
    .toArray();
  const erased = new Set(marks.map((m) => m.rowId));

  const now = Date.now();
  /*
   * הקריאה והכתיבה בטרנזקציה אחת.
   *
   * בין "מה חסר" לבין "הוסף" אסור שמישהו אחר יוסיף: `App` נטען
   * פעמיים במצב הפיתוח של React, ושתי קריאות שקראו את אותה טבלה
   * הוסיפו את אותם מוצרים — והשנייה נפלה על מפתח כפול. הפתרון
   * אינו לזכור שכבר רצנו: הפונקציה נקראת שוב אחרי מחיקה, וזיכרון
   * כזה היה עונה על השאלה הישנה.
   */
  const missing = await db.transaction('rw', db.catalog, async () => {
    const rows = await allMine(db.catalog);
    const byId = new Set(rows.map((i) => i.id));
    const byCode = new Set(rows.filter((i) => i.code).map((i) => i.code!.toUpperCase()));
    const add = SHIPPED_PRODUCTS.filter(
      (p) => !byId.has(p.id) && !erased.has(p.id) && !(p.code && byCode.has(p.code.toUpperCase())),
    ).map((p) => ({ ...p, ...owned(), createdAt: now, updatedAt: now }));
    if (add.length) await db.catalog.bulkAdd(add);
    return add.length;
  });

  await settingsRepo.save({ productsGeneration: PRODUCTS_GENERATION });
  return missing;
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
    return nextCodeAmong(await allMine(db.catalog), group);
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
     * הבדיקה והכתיבה בעסקה אחת.
     *
     * "אין ארגז בשם הזה" שנבדק לפני הכתיבה ולא איתה הוא בדיקה
     * שנכונה לרגע: שתי שמירות שרצות יחד עוברות שתיהן, ובספרייה
     * יושבים שני ארגזים באותו שם.
     */
    return db.transaction('rw', db.catalog, async () => {
      const rows = await allMine(db.catalog);
      const current = input.id ? rows.find((r) => r.id === input.id) : undefined;
      if (input.id && !current) throw new BuildError('הארגז הזה כבר אינו בספרייה');

      /*
       * השם הוא מה שרואים ברשימה, ולכן הוא מה שמזהה.
       *
       * שני ארגזים באותו שם הם ארגז אחד שאי אפשר לבחור בו: ההבדל
       * — מידה, רגליים, מפלס — מתגלה רק אחרי ההנחה. רווח כפול
       * ואות גדולה אינם הבדל, ולכן ההשוואה עוברת דרך מפתח מנוקה.
       */
      const name = cleanCabinetName(input.name ?? current?.name ?? '');
      if (!name) throw new BuildError('לארגז צריך שם');
      const key = cabinetNameKey(name);
      if (rows.some((r) => r.id !== input.id && cabinetNameKey(r.name) === key)) {
        throw new BuildError(`כבר יש בספרייה ארגז בשם "${name}"`);
      }

      /*
       * המק״ט שייך לארגז אחד.
       *
       * שמירה תחת מק״ט תפוס עדכנה בשקט את הארגז ההוא: מי ששמר
       * ארגז חדש וכתב מק״ט קיים מחק בכך ארגז אחר, בלי שנאמר לו
       * דבר. עכשיו זה נעצר ונאמר.
       */
      const code = input.code?.trim().toUpperCase();
      if (code && rows.some((r) => r.id !== input.id && r.code?.toUpperCase() === code)) {
        throw new BuildError(`המק״ט ${code} כבר שייך לארגז אחר`);
      }

      /*
       * פריט שאי אפשר לבנות ממנו ארגז אינו פריט — הוא ייצור חלקים
       * בגובה אפס בכל פרויקט שיניח אותו, ורק שם זה יתגלה. הבדיקה
       * היא על הארגז כפי שייראה אחרי השמירה, ולא על מה שנשלח:
       * עדכון חלקי שולח שדה אחד, ומהשדה הזה לבדו אין מה לבנות.
       */
      const after = { ...current, ...defined(input), name };
      const { glyph, defaultWidthMm: w, defaultHeightMm: h, defaultDepthMm: d } = after;
      if (glyph === undefined || w === undefined || h === undefined || d === undefined) {
        throw new BuildError('חסרות מידות לארגז');
      }
      const why = checkItem({ ...after, glyph, defaultWidthMm: w, defaultHeightMm: h, defaultDepthMm: d });
      if (why) throw new BuildError(why);

      const now = Date.now();
      if (current) {
        const { id: _drop, ...rest } = input;
        // שדות שלא נשלחו נשארים כמו שהם, כדי שעריכה לא תמחק מאפיין קיים
        await patchRow(db.catalog, current.id, defined({ ...rest, name, code }));
        return current.id;
      }

      const fresh = crypto.randomUUID();
      await db.catalog.add({
        ...input,
        id: fresh,
        name,
        code: code || nextCodeAmong(rows, input.group),
        // ארגז שהמשתמש בנה הוא ארגז שהוא מתכוון להשתמש בו — מקומו בספרייה הראשית
        common: true,
        isBuiltin: false,
        sortOrder: 1000 + (now % 1000),
        ...owned(),
        createdAt: now,
        updatedAt: now,
      });
      return fresh;
    });
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

/** המק״ט הפנוי הבא בקטגוריה, מתוך שורות שכבר נקראו. */
function nextCodeAmong(rows: CatalogItem[], group: CatalogGroup): string {
  const prefix = CODE_PREFIX[group];
  const top = rows.reduce((n, i) => Math.max(n, codeNumber(i.code, prefix)), 100);
  return `${prefix}-${top + 1}`;
}

/** משמיט מפתחות ללא ערך, כדי ש-update לא ידרוס אותם ב-undefined. */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
