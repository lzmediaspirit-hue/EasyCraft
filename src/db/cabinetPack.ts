import { db } from './db';
import { checkTable, packFingerprint } from './packSchema';
import type { CatalogItem, Finish, Material } from './types';


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
export const PACK_FORMAT = 4;

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
  /** גיבוב התוכן — מה יש בחבילה, ולא מתי נארזה */
  fingerprint: string;
}

/** הטבלאות שנוסעות בחבילה: הארגזים, ומה שהם מפנים אליו. */
const TABLES = ['catalog', 'materials', 'finishes'] as const;

type TableName = (typeof TABLES)[number];

/** שם הטבלה בעברית, כדי שהודעת שגיאה תדבר על מה שחסר ולא על טבלה. */
const TABLE_LABEL: Record<TableName, string> = {
  catalog: 'הארגזים',
  materials: 'הלוחות',
  finishes: 'הגוונים',
};

/** שלוש הטבלאות, כערכים ולא כשמות. */
export interface PackTables {
  catalog: CatalogItem[];
  materials: Material[];
  finishes: Finish[];
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
  const catalog = ((await db.table('catalog').toArray()) as CatalogItem[]).filter(
    (i) => !i.hiddenAt,
  );
  const [allMaterials, allFinishes] = await Promise.all([
    db.materials.toArray(),
    db.finishes.toArray(),
  ]);

  const need = referenced(catalog);
  const finishes = allFinishes.filter((f) => need.finishes.has(f.id));
  /* גוון מתומחר על לוחות מסוימים, וגם הם חלק מהתלות */
  for (const f of finishes) for (const id of Object.keys(f.prices ?? {})) need.materials.add(id);
  const materials = allMaterials.filter((m) => need.materials.has(m.id));

  const at = Date.now();
  const tables = { catalog, materials, finishes };
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

/** שלוש הטבלאות של החבילה, גם כשהקובץ חסר אחת מהן. */
function tablesOf(pack: CabinetPack): PackTables {
  return {
    catalog: (pack.tables.catalog ?? []) as CatalogItem[],
    materials: (pack.tables.materials ?? []) as Material[],
    finishes: (pack.tables.finishes ?? []) as Finish[],
  };
}

/** הגוונים והלוחות שהארגזים מפנים אליהם. */
function referenced(items: CatalogItem[]): { finishes: Set<string>; materials: Set<string> } {
  const finishes = new Set<string>();
  const materials = new Set<string>();
  for (const i of items) {
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
  return { finishes, materials };
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
export async function importCabinets(
  pack: CabinetPack,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const { catalog: items, materials, finishes } = tablesOf(pack);
  const now = Date.now();
  const out: ImportResult = { added: 0, replaced: 0, removed: 0, deps: 0, unresolved: 0 };

  await db.transaction('rw', db.catalog, db.materials, db.finishes, async () => {
    /*
     * התלויות ראשונות, ובמזהה המקורי שלהן — כך ההפניות שבארגזים
     * נשארות תקפות. מה שכבר קיים באותו מזהה אינו נדרס: המחיר של לוח
     * הוא של העסק הזה, ולא של מי ששלח את הארגזים.
     */
    const haveMaterials = new Set((await db.materials.toArray()).map((m) => m.id));
    const newMaterials = materials.filter((m) => !haveMaterials.has(m.id));
    if (newMaterials.length) await db.materials.bulkAdd(newMaterials);

    const haveFinishes = new Set((await db.finishes.toArray()).map((f) => f.id));
    const newFinishes = finishes.filter((f) => !haveFinishes.has(f.id));
    if (newFinishes.length) await db.finishes.bulkAdd(newFinishes);
    out.deps = newMaterials.length + newFinishes.length;

    const rows = await db.catalog.toArray();
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
        ? new Map(rows.filter((i) => i.code).map((i) => [i.code!.toUpperCase(), i.id]))
        : new Map<string, string>();
    const landed = items.map((i) => {
      const twin = i.code ? byCode.get(i.code.toUpperCase()) : undefined;
      return twin && twin !== i.id ? { ...i, id: twin } : i;
    });

    if (mode === 'replace') {
      const keep = new Set(landed.map((i) => i.id));
      const drop = [...existing.keys()].filter((id) => !keep.has(id));
      out.removed = drop.length;
      await db.catalog.bulkDelete(drop);
    }
    for (const item of landed) {
      if (existing.has(item.id)) out.replaced++;
      else out.added++;
    }
    await db.catalog.bulkPut(landed.map((i) => ({ ...i, updatedAt: now })));


    /* מה שנשאר בלי כיסוי — נאמר במספר ולא מתגלה אחר כך בהדמיה */
    const finishIds = new Set((await db.finishes.toArray()).map((f) => f.id));

    const materialIds = new Set((await db.materials.toArray()).map((m) => m.id));
    out.unresolved = landed.filter((i) => {

      const f = [i.carcassFinishId, i.frontFinishId, i.exposedFinishId, i.backFinishId];
      const m = [i.carcassMaterialId, i.frontMaterialId, i.exposedMaterialId, i.backMaterialId];
      return (
        f.some((id) => id && !finishIds.has(id)) || m.some((id) => id && !materialIds.has(id))
      );
    }).length;
  });

  return out;
}
