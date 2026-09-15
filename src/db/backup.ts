import { db } from './db';
import type { CatalogItem, Finish, Material } from './types';


/**
 * הוצאת הנתונים מהמכשיר, והחזרתם אליו.
 *
 * הכול נשמר מקומית ב-IndexedDB, וזה מה שמאפשר לאפליקציה לעבוד בלי
 * אינטרנט. המחיר הוא שהנתונים כלואים: הם לא עוברים למכשיר שני, אי
 * אפשר לשלוח אותם למישהו, ואם הדפדפן ינוקה הם ייעלמו.
 *
 * הקובץ כאן הוא הדלת. הוא JSON פשוט וקריא — לא פורמט סודי — ולכן
 * אפשר לפתוח אותו, לקרוא אותו, לשמור אותו בענן, ולהחזיר אותו לכל
 * מכשיר אחר.
 */

/**
 * גרסת הפורמט. מי שקורא קובץ ישן צריך לדעת מה הוא מקבל.
 *
 * 3 — לגיבוי ספרייה יש מניפסט: כמה ארגזים, על אילו לוחות וגוונים
 *     הם נשענים, ומתי נוצר. מי שמקבל קובץ צריך לדעת מה בתוכו לפני
 *     שהוא מייבא אותו, ולא אחרי.
 * 2 — גיבוי ספרייה נושא איתו גם את הלוחות והגוונים שהארגזים מפנים
 *     אליהם. ב-1 הוא נשא רק את הארגזים, והמקבל קיבל הפניות למזהים
 *     שאין אצלו: הגוון שנבחר לחזית פשוט לא היה קיים.
 */
export const BACKUP_FORMAT = 3;

/**
 * מה יש בחבילת ספרייה, בלי לפתוח את הטבלאות.
 *
 * זו הצהרה שאפשר לקרוא לפני ייבוא: כמה ארגזים, אילו מק״טים, ועל
 * כמה לוחות וגוונים הם נשענים. בלי זה "ייבוא ספרייה" היה קפיצה
 * לתוך קובץ — והתוצאה התגלתה רק אחרי שהיא כבר נכתבה.
 *
 * `revision` הוא חותם הזמן של הפריט העדכני ביותר בחבילה. שתי חבילות
 * מאותה נגרייה נבדלות בו, ולכן אפשר לדעת מי מהן חדשה יותר בלי
 * להשוות שורה־שורה.
 */
export interface LibraryManifest {
  items: number;
  materials: number;
  finishes: number;
  /** המק״טים שבחבילה, ממוינים — הזהות שעוברת בין מכשירים */
  codes: string[];
  revision: number;
}


/** הטבלאות שנכנסות לגיבוי מלא, בסדר שבו הן נכתבות בחזרה. */
const TABLES = [
  'settings',
  'materials',
  'finishes',
  'catalog',
  'team',
  'customers',
  'projects',
  'walls',
  'units',
  'stages',
  'stock',
  'consumption',
  'projectPrices',
] as const;

type TableName = (typeof TABLES)[number];

/** שם הטבלה בעברית, כדי שהודעת שגיאה תדבר על מה שחסר ולא על טבלה. */
const TABLE_LABEL: Record<TableName, string> = {
  settings: 'ההגדרות',
  materials: 'הלוחות',
  finishes: 'הגוונים',
  catalog: 'הספרייה',
  team: 'הצוות',
  customers: 'הלקוחות',
  projects: 'הפרויקטים',
  walls: 'הקירות',
  units: 'הארגזים',
  stages: 'השלבים',
  stock: 'המלאי',
  consumption: 'הצריכה',
  projectPrices: 'המחירים',
};

export interface Backup {
  app: 'easycraft';
  format: number;
  /** מתי נוצר, כדי שאפשר יהיה לדעת מה חדש יותר */
  at: number;
  /** מה יש בו: הכול, או הספרייה בלבד */
  kind: 'all' | 'library';
  tables: Partial<Record<TableName, unknown[]>>;
  /** מה יש בחבילה — בגיבוי ספרייה בלבד, ומגרסה 3 ואילך */
  manifest?: LibraryManifest;
}

/**
 * גיבוי מלא: לקוחות, פרויקטים, קירות, ארגזים, לוחות, גוונים, מלאי,
 * צוות והגדרות.
 *
 * הקבצים המצורפים אינם כאן. הם תמונות וקבצים שנשמרים כ-Blob, ו-JSON
 * אינו יודע להחזיק אותם — קידוד שלהם היה מנפח את הקובץ פי כמה
 * ומקשה על העברה. הפרויקטים עצמם נשמרים במלואם.
 */
export async function exportAll(): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const name of TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  return { app: 'easycraft', format: BACKUP_FORMAT, at: Date.now(), kind: 'all', tables };
}

/**
 * הספרייה בלבד — הארגזים שאפשר להניח על קיר.
 *
 * זה מה ששולחים כשרוצים שהספרייה של הנגרייה תעבור למכשיר אחר, או
 * תיכנס לאפליקציה עצמה כברירת מחדל. פרויקטים ולקוחות אינם כאן,
 * ולכן אפשר לשלוח אותה בלי לשלוח את הלקוחות.
 *
 * הלוחות והגוונים שהארגזים מפנים אליהם נוסעים איתם. ארגז שומר מזהה
 * של גוון, לא את הגוון עצמו, ולכן ספרייה שנשלחה בלעדיהם הגיעה ליעד
 * עם הפניות לשום דבר — הצבע לא הופיע והמחיר לא חושב.
 */
export async function exportLibrary(): Promise<Backup> {
  /*
   * מה שהוסר מהספרייה אינו יוצא בגיבוי.
   *
   * ארגז שהוסר נשאר במכשיר כדי שאפשר יהיה להחזיר אותו, אבל הוא אינו
   * חלק מהספרייה — וכשהוא נסע עם הגיבוי הוא חזר למכשיר הבא, שם
   * איש לא ידע שהוא הוסר פעם.
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
  return {
    app: 'easycraft',
    format: BACKUP_FORMAT,
    at,
    kind: 'library',
    tables: { catalog, materials, finishes },
    manifest: {
      items: catalog.length,
      materials: materials.length,
      finishes: finishes.length,
      codes: catalog
        .map((i) => i.code)
        .filter((c): c is string => !!c)
        .sort(),
      /* המהדורה היא הפריט העדכני ביותר, ולא רגע הייצוא */
      revision: catalog.reduce((n, i) => Math.max(n, i.updatedAt ?? 0), 0) || at,
    },
  };
}

/**
 * מה יש בקובץ, בלי לייבא אותו.
 *
 * חבילה מגרסה 3 נושאת מניפסט; ישנה יותר נספרת מהטבלאות עצמן, כדי
 * שגם קובץ שנוצר לפני כן ייקרא לפני שמייבאים אותו.
 */
export function libraryManifest(backup: Backup): LibraryManifest {
  if (backup.manifest) return backup.manifest;
  const catalog = (backup.tables.catalog ?? []) as CatalogItem[];
  return {
    items: catalog.length,
    materials: (backup.tables.materials ?? []).length,
    finishes: (backup.tables.finishes ?? []).length,
    codes: catalog
      .map((i) => i.code)
      .filter((c): c is string => !!c)
      .sort(),
    revision: backup.at ?? 0,
  };
}

/** הגוונים והלוחות שארגזי הספרייה מפנים אליהם. */
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
 * קריאת קובץ גיבוי מטקסט.
 *
 * מחזירה הודעה בעברית כשהקובץ אינו מה שהוא אמור להיות — "JSON לא
 * תקין" אינו משפט שנגר אמור לפענח.
 *
 * הבדיקה כאן היא התנאי לשחזור, ולא נימוס: שחזור מלא מוחק את מה
 * שבמכשיר, ולכן קובץ חסר טבלה היה מוחק חצי ומשאיר חצי — ומדווח
 * שהכול שוחזר. קובץ שאינו שלם נעצר לפני שנגעו בנתונים.
 */
export function readBackup(text: string): { backup: Backup } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'הטקסט אינו קובץ גיבוי — נראה שהעתקה נקטעה באמצע' };
  }
  const b = parsed as Partial<Backup>;
  if (b?.app !== 'easycraft' || !b.tables || typeof b.tables !== 'object') {
    return { error: 'זה לא קובץ גיבוי של EasyCraft' };
  }
  if ((b.format ?? 0) > BACKUP_FORMAT) {
    return { error: 'הקובץ נוצר בגרסה חדשה יותר של האפליקציה' };
  }
  if (b.kind !== 'all' && b.kind !== 'library') {
    return { error: 'לא כתוב בקובץ מה יש בו — גיבוי מלא או ספרייה' };
  }
  const required: readonly TableName[] = b.kind === 'all' ? TABLES : ['catalog'];
  for (const name of required) {
    const rows = b.tables[name];
    if (!Array.isArray(rows)) return { error: `חסר בקובץ החלק של ${TABLE_LABEL[name]}` };
    if (!rows.every(isRow)) return { error: `יש שורות פגומות בחלק של ${TABLE_LABEL[name]}` };
  }
  return { backup: b as Backup };
}

/** שורה בטבלה היא אובייקט עם מזהה. בלי מזהה אי אפשר לכתוב אותה. */
function isRow(row: unknown): boolean {
  return !!row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string';
}

/** מה קרה בייבוא, כדי לומר את זה במספרים ולא ב"בוצע". */
export interface ImportResult {
  added: number;
  replaced: number;
  removed: number;
  /** לוחות וגוונים שהגיעו עם הספרייה ולא היו כאן */
  deps: number;
  /** ארגזים שנשארו עם הפניה לגוון או ללוח שאינם במכשיר הזה */
  unresolved: number;
}


/**
 * ייבוא ספרייה.
 *
 * `merge` מוסיף את מה שאין ומעדכן את מה שיש — ככה מעבירים ארגזים
 * בודדים בין מכשירים. `replace` מוחק את הספרייה הקיימת ושם את
 * החדשה במקומה, וזו פעולה שנגר עושה פעם אחת: כשהספרייה שהוא בנה
 * לעצמו היא הספרייה, ומה שהגיע עם האפליקציה כבר לא רלוונטי.
 *
 * פרויקטים קיימים אינם נפגעים בשום מקרה: ארגז שהונח על קיר שמר את
 * המידות שלו בעצמו ברגע ההנחה, והוא אינו קורא מהספרייה.
 */
export async function importLibrary(
  backup: Backup,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const items = (backup.tables.catalog ?? []) as CatalogItem[];
  const materials = (backup.tables.materials ?? []) as Material[];
  const finishes = (backup.tables.finishes ?? []) as Finish[];
  const now = Date.now();
  const out: ImportResult = { added: 0, replaced: 0, removed: 0, deps: 0, unresolved: 0 };

  await db.transaction('rw', db.catalog, db.materials, db.finishes, async () => {
    /*
     * התלויות ראשונות, ובמזהה המקורי שלהן — כך ההפניות שבארגזים
     * נשארות תקפות. מה שכבר קיים באותו מזהה אינו נדרס: המחיר של לוח
     * הוא של העסק הזה, ולא של מי ששלח את הספרייה.
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


/**
 * שחזור מלא: מה שבקובץ מחליף את מה שבמכשיר.
 *
 * זו פעולה של "המכשיר החדש מקבל את מה שהיה בישן", ולכן היא מוחקת
 * ולא ממזגת — מיזוג של שני מצבי עולם שונים מייצר פרויקטים כפולים
 * ומלאי שלא מסתדר. הקבצים המצורפים נשארים במכשיר הישן.
 *
 * כל הטבלאות מתנקות, גם כאלה שהקובץ ריק בהן: "החלפה" שמשאירה את
 * הלקוחות הישנים לצד החדשים אינה החלפה. `readBackup` כבר ודאה
 * שהקובץ שלם, ולכן טבלה ריקה כאן היא ריקה באמת ולא חסרה.
 */
export async function importAll(backup: Backup): Promise<void> {
  await db.transaction('rw', TABLES.map((n) => db.table(n)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      const rows = backup.tables[name];
      if (rows?.length) await db.table(name).bulkPut(rows);
    }
  });
}
