import { db } from './db';
import { allMine, eraseIds, mine, owned, revive } from './rows';
import { workshopId } from './workshop';
import type { Table } from 'dexie';
import { normalizeTables } from './legacy';
import { checkTable, packFingerprint } from './packSchema';
import type { CatalogItem, Finish, Material, Room } from './types';
import { cabinetNameKey, cleanCabinetName, freeCabinetName } from '../catalog/names';


/**
 * חבילת ארגזים: להוציא ארגזים מהמכשיר, ולהכניס ארגזים אליו.
 *
 * הנתונים עצמם — לקוחות, פרויקטים, מלאי — יישבו בשרת, ומשם הם
 * נשמרים ומגיעים לכל מי שמחובר. מה שנשאר כאן הוא דבר אחד: ארגז
 * שנבנה בנגרייה אחת ועובר משם הלאה. הוא נוסע כקובץ JSON קריא —
 * לא פורמט סודי — ולכן אפשר לפתוח אותו, לשמור אותו, ולהעלות
 * אותו לכל מקום.
 */

/**
 * גרסת הפורמט.
 *
 * 4 — למניפסט יש טביעת אצבע של התוכן, והספירות מחושבות מהקובץ
 *     ולא נלקחות ממה שכתוב בו.
 * 3 — לחבילה יש מניפסט: כמה ארגזים, על אילו לוחות וגוונים הם
 *     נשענים, ומתי נוצרה. מי שמקבל קובץ צריך לדעת מה בתוכו לפני
 *     שהוא מייבא אותו, ולא אחרי.
 * 2 — החבילה נושאת איתה גם את הלוחות והגוונים שהארגזים מפנים
 *     אליהם. ב-1 היא נשאה רק את הארגזים, והמקבל קיבל הפניות
 *     למזהים שאין אצלו: הגוון שנבחר לחזית פשוט לא היה קיים.
 */
export const PACK_FORMAT = 5;

/**
 * מה יש בחבילה, בלי לפתוח את הטבלאות.
 *
 * זו הצהרה שאפשר לקרוא לפני ייבוא: כמה ארגזים, אילו מק״טים, ועל
 * כמה לוחות וגוונים הם נשענים. בלי זה "ייבוא ארגזים" היה קפיצה
 * לתוך קובץ — והתוצאה התגלתה רק אחרי שהיא כבר נכתבה.
 *
 * שתי שאלות שונות, ולכן שני שדות. `fingerprint` הוא מה יש בחבילה:
 * גיבוב של הארגזים, הלוחות והגוונים עצמם. שתי חבילות עם אותה
 * טביעת אצבע הן אותם ארגזים, גם אם יוצאו בשני מכשירים ובשני ימים.
 * `revision` הוא מתי נארזה, והוא רק מסדר בין שתיים — הוא היה עד
 * כאן חותם הפריט העדכני, וכך שינוי בצבע של גוון היה בלתי נראה בו,
 * והסרת הפריט החדש ביותר דווקא הקטינה אותו.
 */
export interface PackManifest {
  items: number;
  materials: number;
  finishes: number;
  /** המק״טים שבחבילה, ממוינים — הזהות שעוברת בין מכשירים */
  codes: string[];
  revision: number;
  /** כמה חדרים נוסעים עם הארגזים — מגרסה 5 ואילך */
  rooms?: number;
  /** גיבוב התוכן — מה יש בחבילה, ולא מתי נארזה */
  fingerprint: string;
}

/**
 * הטבלאות שנוסעות בחבילה: הארגזים, ומה שהם מפנים אליו.
 *
 * החדרים נוספו בפורמט 5. ארגז שומר מזהי חדרים, ולכן חבילה שנשלחה
 * בלעדיהם הגיעה ליעד עם הפניה לחדר שאינו קיים שם — והייבוא דיווח
 * "0 חסרים", כי הוא בכלל לא הסתכל על חדרים.
 */
const TABLES = ['catalog', 'materials', 'finishes', 'rooms'] as const;

type TableName = (typeof TABLES)[number];

/** שם הטבלה בעברית, כדי שהודעת שגיאה תדבר על מה שחסר ולא על טבלה. */
const TABLE_LABEL: Record<TableName, string> = {
  catalog: 'הארגזים',
  materials: 'הלוחות',
  finishes: 'הגוונים',
  rooms: 'החדרים',
};

/** שלוש הטבלאות, כערכים ולא כשמות. */
export interface PackTables {
  catalog: CatalogItem[];
  materials: Material[];
  finishes: Finish[];
  rooms: Room[];
}

export interface CabinetPack {
  app: 'easycraft';
  format: number;
  /** מתי נארזה, כדי שאפשר יהיה לדעת מה חדש יותר */
  at: number;
  /**
   * מה יש בקובץ. נשאר בפורמט כדי שקובץ ישן ייקרא: היה בעבר גם
   * גיבוי מלא, `all`, והוא אינו נקרא כאן.
   */
  kind: 'library';
  tables: Partial<Record<TableName, unknown[]>>;
  /** מה יש בחבילה — מגרסה 3 ואילך */
  manifest?: PackManifest;
}

/**
 * הארגזים שאפשר להניח על קיר, ומה שהם נשענים עליו.
 *
 * זה מה ששולחים כשרוצים שארגז שנבנה כאן יגיע למישהו אחר, או
 * ייכנס לאפליקציה עצמה כברירת מחדל. לקוחות ופרויקטים אינם כאן.
 *
 * הלוחות והגוונים שהארגזים מפנים אליהם נוסעים איתם. ארגז שומר
 * מזהה של גוון, לא את הגוון עצמו, ולכן חבילה שנשלחה בלעדיהם
 * הגיעה ליעד עם הפניות לשום דבר — הצבע לא הופיע והמחיר לא חושב.
 */
export async function exportCabinets(): Promise<CabinetPack> {
  /*
   * מה שהוסר מהספרייה אינו יוצא בחבילה.
   *
   * ארגז שהוסר נשאר במכשיר כדי שאפשר יהיה להחזיר אותו, אבל הוא
   * אינו חלק מהספרייה — וכשהוא נסע עם החבילה הוא חזר במכשיר הבא,
   * שם איש לא ידע שהוא הוסר פעם.
   */
  const catalog = await allMine(db.catalog);
  const [allMaterials, allFinishes] = await Promise.all([
    allMine(db.materials),
    allMine(db.finishes),
  ]);

  const need = referenced(catalog);
  const finishes = allFinishes.filter((f) => need.finishes.has(f.id));
  /* גוון מתומחר על לוחות מסוימים, וגם הם חלק מהתלות */
  for (const f of finishes) for (const id of Object.keys(f.prices ?? {})) need.materials.add(id);
  const materials = allMaterials.filter((m) => need.materials.has(m.id));

  const at = Date.now();
  /*
   * הבעלות אינה נוסעת.
   *
   * חבילה היא ארגזים, לא חשבון: שורה שנושאת את מזהה הנגרייה
   * ששלחה אותה הייתה נכנסת אצל המקבל כשורה של מישהו אחר, ואז לא
   * מופיעה אצלו בשום רשימה. הכניסה מטביעה בעלות חדשה.
   */
  const bare = <T extends object>(rows: T[]): T[] =>
    rows.map((r) => {
      const { workshopId: _w, rev: _r, ...rest } = r as T & { workshopId?: string; rev?: number };
      return rest as T;
    });
  /*
   * גם החדרים שהארגזים משויכים אליהם.
   *
   * חדר מותאם שנוצר כאן הוא שורה במסד, והארגז שומר את מזההּ. קובץ
   * בלעדיו הגיע ליעד עם הפניה לשום דבר — והייבוא דיווח "0 חסרים",
   * כי חדרים לא נספרו בכלל. חדרי הזרע נוסעים גם הם: המקבל כבר
   * מכיר אותם באותו מזהה, והייבוא לא ידרוס אותם.
   */
  const rooms = (await allMine(db.rooms)).filter((r) => need.rooms.has(r.id));

  const tables = {
    catalog: bare(catalog),
    materials: bare(materials),
    finishes: bare(finishes),
    rooms: bare(rooms),
  };
  return {
    app: 'easycraft',
    format: PACK_FORMAT,
    at,
    kind: 'library',
    tables,
    manifest: { ...describe(tables), revision: at },
  };
}

/** מה שאפשר לספור מהתוכן עצמו: הכול חוץ מהמהדורה. */
function describe(tables: PackTables): Omit<PackManifest, 'revision'> {
  return {
    items: tables.catalog.length,
    materials: tables.materials.length,
    finishes: tables.finishes.length,
    rooms: tables.rooms.length,
    codes: tables.catalog
      .map((i) => i.code)
      .filter((c): c is string => !!c)
      .sort(),
    fingerprint: packFingerprint(tables),
  };
}

/**
 * מה יש בקובץ, בלי לייבא אותו.
 *
 * הספירות מחושבות מהתוכן ולא נלקחות ממה שכתוב במניפסט: מספר
 * בכותרת של קובץ הוא הצהרה של מי שכתב אותו, והמסך שמציג אותו
 * לפני ייבוא צריך להראות את מה שבאמת בפנים. מהמניפסט נלקחת
 * המהדורה בלבד — אותה אי אפשר לחשב מהטבלאות.
 */
export function packManifest(pack: CabinetPack): PackManifest {
  return { ...describe(tablesOf(pack)), revision: pack.manifest?.revision ?? pack.at ?? 0 };
}

/** הטבלאות של החבילה, גם כשהקובץ חסר אחת מהן. */
function tablesOf(pack: CabinetPack): PackTables {
  return {
    catalog: (pack.tables.catalog ?? []) as CatalogItem[],
    materials: (pack.tables.materials ?? []) as Material[],
    finishes: (pack.tables.finishes ?? []) as Finish[],
    rooms: (pack.tables.rooms ?? []) as Room[],
  };
}

/** הגוונים והלוחות שהארגזים מפנים אליהם. */
function referenced(items: CatalogItem[]): {
  finishes: Set<string>;
  materials: Set<string>;
  rooms: Set<string>;
} {
  const finishes = new Set<string>();
  const materials = new Set<string>();
  const rooms = new Set<string>();
  for (const i of items) {
    for (const id of i.rooms ?? []) rooms.add(id);
    for (const id of [i.carcassFinishId, i.frontFinishId, i.exposedFinishId, i.backFinishId]) {
      if (id) finishes.add(id);
    }
    for (const id of [
      i.carcassMaterialId,
      i.frontMaterialId,
      i.exposedMaterialId,
      i.backMaterialId,
    ]) {
      if (id) materials.add(id);
    }
  }
  return { finishes, materials, rooms };
}


/**
 * קריאת חבילה מטקסט.
 *
 * מחזירה הודעה בעברית כשהקובץ אינו מה שהוא אמור להיות — "JSON לא
 * תקין" אינו משפט שנגר אמור לפענח.
 *
 * הבדיקה כאן היא התנאי לייבוא, ולא נימוס: ייבוא בהחלפה מוחק את
 * הספרייה הקיימת, ולכן שורה פגומה אחת הייתה דורסת ספרייה שלמה
 * במשהו שאי אפשר לפתוח. קובץ שאינו תקין נעצר לפני שנגעו בנתונים.
 */
export function readPack(text: string): { pack: CabinetPack } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'הטקסט אינו קובץ ארגזים — נראה שהעתקה נקטעה באמצע' };
  }
  const b = parsed as Partial<CabinetPack>;
  if (b?.app !== 'easycraft' || !b.tables || typeof b.tables !== 'object') {
    return { error: 'זה לא קובץ של EasyCraft' };
  }
  if ((b.format ?? 0) > PACK_FORMAT) {
    return { error: 'הקובץ נוצר בגרסה חדשה יותר של האפליקציה' };
  }
  /* היה בעבר גם גיבוי מלא. כאן מייבאים ארגזים, ולכן הוא נאמר ולא נבלע */
  if (b.kind !== 'library') {
    return { error: 'זה קובץ גיבוי מלא ישן — כאן נכנסים ארגזים בלבד' };
  }
  if (!Array.isArray(b.tables.catalog)) {
    return { error: `חסר בקובץ החלק של ${TABLE_LABEL.catalog}` };
  }

  /*
   * טבלה שקיימת בקובץ אבל אינה מערך אינה "טבלה שלא נשלחה".
   *
   * הדילוג עליה היה שקט: קובץ עם `materials: "oops"` נכנס, והלוחות
   * שהארגזים מפנים אליהם פשוט לא היו שם. מה שנשלח — נבדק.
   */
  for (const name of TABLES) {
    const rows = (b.tables as Record<string, unknown>)[name];
    if (rows !== undefined && !Array.isArray(rows)) {
      return { error: `החלק של ${TABLE_LABEL[name]} בקובץ אינו רשימה` };
    }
  }

  /*
   * המרת פורמט ישן קודמת לאימות.
   *
   * מדף שנארז בגרסה קודמת נשא גובה 300 ועובי נפרד 30. המעבר במסד
   * ידע לתרגם אותו; הייבוא לא, ואותו מדף נכנס בעובי 300 ונראה
   * כקיר. קודם מתרגמים לפורמט הנוכחי, ורק אז בודקים — אחרת קובץ
   * ישן תקין נופל על שדה שלא ידע עליו.
   */
  b.tables = normalizeTables(b.tables as Record<string, unknown[]>) as CabinetPack['tables'];

  /* ההפניות נבדקות מול הקובץ עצמו: מה שאינו בו אינו קיים מבחינתו */
  const present: Record<string, Set<string>> = {};
  for (const name of TABLES) {
    const rows = b.tables[name];
    if (Array.isArray(rows)) {
      present[name] = new Set(rows.map((r) => (r as { id?: string })?.id ?? ''));
    }
  }
  for (const name of TABLES) {
    const rows = b.tables[name];
    if (!Array.isArray(rows)) continue;
    const bad = checkTable(name, rows, present);
    if (bad) return { error: `בחלק של ${TABLE_LABEL[name]}: ${bad}` };
  }

  /*
   * טביעת אצבע שנכתבה בקובץ חייבת לתאר את מה שיש בו. אי־התאמה
   * אינה "קובץ ישן" — היא קובץ שנערך אחרי שנארז.
   */
  const stamped = b.manifest?.fingerprint;
  if (stamped && stamped !== packFingerprint(tablesOf(b as CabinetPack))) {
    return { error: 'תוכן הקובץ אינו תואם למה שכתוב עליו — ייתכן שהוא נערך אחרי שנוצר' };
  }
  return { pack: b as CabinetPack };
}

/** מה קרה בייבוא, כדי לומר את זה במספרים ולא ב"בוצע". */
export interface ImportResult {
  added: number;
  replaced: number;
  removed: number;
  /** לוחות וגוונים שהגיעו עם הארגזים ולא היו כאן */
  deps: number;
  /** ארגזים שנשארו עם הפניה לגוון או ללוח שאינם במכשיר הזה */
  unresolved: number;
  /** ארגזים שהגיעו בשם שכבר תפוס כאן, וקיבלו שם פנוי */
  renamed: number;
  /** ארגזים שהגיעו במק״ט של ארגז אחר כאן, וקיבלו מק״ט פנוי */
  recoded: number;
}


/**
 * ייבוא ארגזים.
 *
 * `merge` מוסיף את מה שאין ומעדכן את מה שיש — ככה מעבירים ארגזים
 * בודדים בין מכשירים. `replace` מוחק את הספרייה הקיימת ושם את
 * החדשה במקומה, וזו פעולה שנגר עושה פעם אחת: כשהספרייה שהוא בנה
 * לעצמו היא הספרייה, ומה שהגיע עם האפליקציה כבר לא רלוונטי.
 *
 * פרויקטים קיימים אינם נפגעים בשום מקרה: ארגז שהונח על קיר שמר את
 * המידות שלו בעצמו ברגע ההנחה, והוא אינו קורא מהספרייה.
 */
/**
 * מזהים מקומיים לשורות שמגיעות מחבילה.
 *
 * המפתח במסד גלובלי, ולכן ייבוא של אותו ארגז לנגרייה שנייה דרס את
 * השורה של הראשונה ולקח לה את הבעלות. אותה ספרייה צריכה להתקיים
 * בשתי נגריות בלי שאף אחת תאבד את מה שערכה בה.
 *
 * הפתרון אינו מפתח מורכב — זו הגירה גדולה על נתונים שכבר קיימים —
 * אלא מיפוי מקומי: שורה שמזההּ תפוס בידי מישהו אחר מקבלת מזהה חדש,
 * והמזהה שממנו היא באה נשמר ב-`sourceId`. ייבוא חוזר מוצא אותה לפיו
 * ומעדכן אותה, במקום ליצור עותק שלישי.
 */
async function localIds<T extends { id: string; sourceId?: string; workshopId?: string }, I>(
  table: Table<T, string, I>,
  incoming: { id: string }[],
): Promise<{ to: (id: string) => string; fresh: Set<string> }> {
  const map = new Map<string, string>();
  const fresh = new Set<string>();
  const ids = incoming.map((r) => r.id);
  const [taken, bySource] = await Promise.all([
    table.bulkGet(ids),
    table.where('sourceId').anyOf(ids).toArray(),
  ]);
  const sourced = new Map(bySource.filter(mine).map((r) => [r.sourceId!, r.id]));

  incoming.forEach((row, i) => {
    /* כבר יובא לכאן פעם — אותו עותק מקומי */
    const already = sourced.get(row.id);
    if (already) return void map.set(row.id, already);
    const holder = taken[i];
    /* פנוי — המזהה המקורי נשאר, והשורה נכנסת */
    if (!holder) {
      fresh.add(row.id);
      return;
    }
    /*
     * כבר שלי באותו מזהה — השורה קיימת, ולכן היא אינה חדשה.
     *
     * `fresh` סימן גם אותה, והייבוא ניסה להוסיף שורה שכבר יושבת
     * במסד: חבילה שנוצרה כאן וחזרה לכאן נפלה על מפתח כפול. מה
     * שקיים נשאר כפי שהוא — השם והמחיר הם של העסק הזה.
     */
    if (mine(holder)) return;
    /* תפוס בידי נגרייה אחרת — עותק מקומי עם מזהה חדש */
    const local = crypto.randomUUID();
    map.set(row.id, local);
    fresh.add(row.id);
  });
  return { to: (id) => map.get(id) ?? id, fresh };
}

export async function importCabinets(
  pack: CabinetPack,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const { catalog: items, materials, finishes, rooms } = tablesOf(pack);
  const now = Date.now();
  const out: ImportResult = { added: 0, replaced: 0, removed: 0, deps: 0, unresolved: 0, renamed: 0, recoded: 0 };

  await db.transaction(
    'rw',
    db.catalog,
    db.materials,
    db.finishes,
    db.rooms,
    db.tombstones,
    async () => {
    /*
     * התלויות ראשונות, ובמזהה המקורי שלהן — כך ההפניות שבארגזים
     * נשארות תקפות. מה שכבר קיים באותו מזהה אינו נדרס: המחיר של לוח
     * הוא של העסק הזה, ולא של מי ששלח את הארגזים.
     */
    const mapMaterials = await localIds(db.materials, materials);
    const newMaterials = materials
      .filter((m) => mapMaterials.fresh.has(m.id))
      .map((m) => ({ ...m, id: mapMaterials.to(m.id), sourceId: m.id, ...owned() }));
    if (newMaterials.length) await db.materials.bulkAdd(newMaterials);

    const mapFinishes = await localIds(db.finishes, finishes);
    const newFinishes = finishes
      .filter((f) => mapFinishes.fresh.has(f.id))
      .map((f) => ({
        ...f,
        id: mapFinishes.to(f.id),
        sourceId: f.id,
        /* מחיר לכל לוח — והלוחות קיבלו מזהים מקומיים */
        prices: Object.fromEntries(
          Object.entries(f.prices ?? {}).map(([mid, price]) => [mapMaterials.to(mid), price]),
        ),
        ...owned(),
      }));
    if (newFinishes.length) await db.finishes.bulkAdd(newFinishes);
    out.deps = newMaterials.length + newFinishes.length;

    const rows = await allMine(db.catalog);
    const existing = new Map(rows.map((i) => [i.id, i]));
    /*
     * המק״ט הוא הזהות שבין המכשירים.
     *
     * אותו ארגז שנבנה כאן וייובא לשם קיבל מזהה פנימי אחר, ולכן
     * ייבוא חוזר יצר אותו פעמיים. ארגז שמגיע עם מק״ט שכבר קיים
     * נכתב על הארגז ההוא, במזהה שלו — ומה שהונח בפרויקטים ממשיך
     * להצביע על מה שהוא הצביע עליו.
     *
     * במיזוג בלבד. בהחלפה מלאה אין למה להיצמד: כל מה שאינו
     * בייבוא נמחק ממילא, ולקיחת המזהה של ארגז שנמחק רק גוזלת
     * ממנו את זהותו — ואז "החזרת ארגזי התקן" אינה מחזירה אותו.
     */
    const byCode =
      mode === 'merge'
        ? new Map(rows.filter((i) => i.code).map((i) => [i.code!.toUpperCase(), i]))
        : new Map<string, CatalogItem>();
    /*
     * החדרים לפני הארגזים: ארגז מצביע על חדר, ולא להפך.
     *
     * חדר שכבר קיים אצל המקבל אינו נדרס — השם והסדר שלו הם שלו —
     * וחדר חדש נכנס כמו שהוא, כדי שהשיוך של הארגז יימצא.
     */
    const mapRooms = await localIds(db.rooms, rooms);
    const newRooms = rooms
      .filter((r) => mapRooms.fresh.has(r.id))
      .map((r) => ({ ...r, id: mapRooms.to(r.id), sourceId: r.id, ...owned() }));
    if (newRooms.length) await db.rooms.bulkAdd(newRooms);

    const mapItems = await localIds(db.catalog, items);
    /*
     * שמות תפוסים ומק״טים תפוסים, כפי שהם כאן לפני הייבוא.
     *
     * הייבוא כותב ב-bulkPut ולכן אינו עובר דרך `saveCustom`, ושני
     * הכללים שנאכפים שם — שם ייחודי, ומק״ט ששייך לארגז אחד — לא
     * נאכפו כאן כלל. קובץ עם שני שמות שנבדלים ברווח נכנס כשניים,
     * וארגז אחר שנשא מק״ט קיים נכתב על הארגז שהחזיק בו.
     */
    const takenNames = new Map(rows.map((i) => [cabinetNameKey(i.name), i.id]));
    const takenCodes = new Map(rows.filter((i) => i.code).map((i) => [i.code!.toUpperCase(), i.id]));
    const nextCode = () => {
      let n = 900;
      for (;;) {
        const code = `IM-${n++}`;
        if (!takenCodes.has(code)) return code;
      }
    };

    const landed = items.map((i) => {
      /*
       * מק״ט זהה הוא זהות רק כשזה אותו ארגז.
       *
       * ייבוא חוזר של אותה ספרייה במזהים אחרים נשען על ההצמדה
       * הזאת, ולכן היא נשארת — אבל ארגז *אחר* שנושא מק״ט קיים
       * אינו מקבל בכך רשות לכתוב עליו. השם הוא מה שמבדיל.
       */
      const sameCode = i.code ? byCode.get(i.code.toUpperCase()) : undefined;
      const twin =
        sameCode && cabinetNameKey(sameCode.name) === cabinetNameKey(i.name)
          ? sameCode.id
          : undefined;
      const id = twin ?? mapItems.to(i.id);

      /* שם שתפוס בידי ארגז אחר — הנכנס מקבל שם פנוי, ונאמר כמה */
      const name = cleanCabinetName(i.name);
      const heldBy = takenNames.get(cabinetNameKey(name));
      const free =
        heldBy === undefined || heldBy === id
          ? name
          : freeCabinetName(name, [...takenNames.keys()]);
      if (free !== name) out.renamed++;
      takenNames.set(cabinetNameKey(free), id);

      /* וכך גם מק״ט שתפוס בידי ארגז אחר */
      const code = i.code?.trim().toUpperCase();
      const codeHeldBy = code ? takenCodes.get(code) : undefined;
      const ownCode =
        !code || codeHeldBy === undefined || codeHeldBy === id ? code : nextCode();
      if (code && ownCode !== code) out.recoded++;
      if (ownCode) takenCodes.set(ownCode, id);

      /* ההפניות לתלויות עוברות למזהים המקומיים שלהן */
      const ref = (v?: string) => (v ? mapMaterials.to(mapFinishes.to(v)) : v);
      return {
        ...i,
        id,
        name: free,
        ...(ownCode ? { code: ownCode } : {}),
        ...(id === i.id ? {} : { sourceId: i.id }),
        rooms: (i.rooms ?? []).map((r) => mapRooms.to(r)),
        carcassFinishId: ref(i.carcassFinishId),
        frontFinishId: ref(i.frontFinishId),
        exposedFinishId: ref(i.exposedFinishId),
        backFinishId: ref(i.backFinishId),
        carcassMaterialId: ref(i.carcassMaterialId),
        frontMaterialId: ref(i.frontMaterialId),
        exposedMaterialId: ref(i.exposedMaterialId),
        backMaterialId: ref(i.backMaterialId),
      };
    });

    if (mode === 'replace') {
      const keep = new Set(landed.map((i) => i.id));
      const drop = [...existing.keys()].filter((id) => !keep.has(id));
      out.removed = drop.length;
      await eraseIds(db.catalog, drop);
    }
    for (const item of landed) {
      if (existing.has(item.id)) out.replaced++;
      else out.added++;
    }
    /*
     * שורה שכבר קיימת מקבלת גרסה מתקדמת ולא גרסה 1.
     *
     * הייבוא הטביע `owned()` על הכול, ולכן עדכון של ארגז קיים החזיר
     * את המונה שלו אחורה: הסנכרון הבא היה רואה כתיבה שמכריזה על
     * עצמה ישנה יותר ממה שכבר יש בצד השני.
     */
    await db.catalog.bulkPut(
      landed.map((i) => {
        const had = existing.get(i.id);
        return {
          ...i,
          workshopId: workshopId(),
          rev: had ? (had.rev ?? 0) + 1 : 1,
          createdAt: had?.createdAt ?? i.createdAt ?? now,
          updatedAt: now,
        };
      }),
    );
    /* מה שחוזר במכוון מבטל את סימון המחיקה שלו, באותה עסקה */
    await revive('catalog', landed.map((i) => i.id));


    /* מה שנשאר בלי כיסוי — נאמר במספר ולא מתגלה אחר כך בהדמיה */
    const finishIds = new Set((await allMine(db.finishes)).map((f) => f.id));

    const materialIds = new Set((await allMine(db.materials)).map((m) => m.id));
    /*
     * חדר חסר נספר גם הוא.
     *
     * הספירה דילגה עליו, ולכן קובץ שהגיע עם ארגז שמשויך לחדר שאין
     * אצל המקבל דיווח "0 חסרים" — והארגז פשוט לא הופיע בשום רשימה.
     */
    const roomIds = new Set((await allMine(db.rooms)).map((r) => r.id));
    out.unresolved = landed.filter((i) => {
      const f = [i.carcassFinishId, i.frontFinishId, i.exposedFinishId, i.backFinishId];
      const m = [i.carcassMaterialId, i.frontMaterialId, i.exposedMaterialId, i.backMaterialId];
      return (
        f.some((id) => id && !finishIds.has(id)) ||
        m.some((id) => id && !materialIds.has(id)) ||
        (i.rooms ?? []).some((id) => !roomIds.has(id))
      );
      }).length;
    },
  );

  return out;
}
