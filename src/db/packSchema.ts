import type { CatalogItem, Finish, Material } from './types';

/**
 * מה נחשב שורה תקינה בחבילת ארגזים.
 *
 * ייבוא בהחלפה מוחק את הספרייה הקיימת ושם במקומה את מה שבקובץ,
 * ולכן הבדיקה כאן היא התנאי לפעולה ולא נימוס. עד כאן נבדק רק
 * שלשורה יש מזהה — וכך שורה אחת פגומה, `{"id":"broken-row"}`,
 * החליפה ספרייה שלמה ושברה את מסך הספרייה: הקוד ביקש את `rooms`
 * וקיבל `undefined`.
 *
 * הבדיקות הן על מה שהקוד באמת קורא: שדות חובה, מידות שהן מספר
 * בטווח שאפשר לבנות, ערכים מתוך רשימה סגורה, מזהים כפולים
 * והפניות בין הטבלאות.
 */

type Check = (v: unknown) => boolean;

const str: Check = (v) => typeof v === 'string' && v.trim() !== '';
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const bool: Check = (v) => typeof v === 'boolean';
const time: Check = (v) => num(v) && (v as number) >= 0;
const count: Check = (v) => num(v) && Number.isInteger(v) && (v as number) >= 0;
const order: Check = (v) => num(v) && Number.isInteger(v);

/**
 * מידה במ״מ.
 *
 * הגבול העליון אינו קפריזה: 20 מטר הוא קיר ארוך מאוד, ומספר גדול
 * ממנו הוא כמעט תמיד מ״מ שהוקלד כמיקרון או חישוב שברח. אפס מותר —
 * ארגז יכול לשבת בתחילת הקיר.
 */
const MAX_MM = 20_000;
const mm: Check = (v) => num(v) && (v as number) >= 0 && (v as number) <= MAX_MM;
/** מידה שאורך אפס בה אינו קיים: רוחב, גובה או עומק של גוף */
const size: Check = (v) => num(v) && (v as number) > 0 && (v as number) <= MAX_MM;

const oneOf =
  (...allowed: readonly unknown[]): Check =>
  (v) =>
    allowed.includes(v);

const listOf =
  (item: Check): Check =>
  (v) =>
    Array.isArray(v) && v.every(item);

/** אובייקט שערכיו נבדקים, בלי לדעת מראש את המפתחות */
const mapOf =
  (value: Check): Check =>
  (v) =>
    !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(value);

/**
 * מפרט טבלה.
 *
 * `need` הוא מה שבלעדיו השורה אינה ניתנת לשימוש; `may` נבדק רק אם
 * השדה קיים, כי שדה רשות שקיים בערך שגוי מזיק בדיוק כמו שדה חובה
 * חסר. `refs` הוא המזהה שהשורה מצביעה עליו ובאיזו טבלה הוא אמור
 * להימצא.
 */
interface TableSpec {
  need: Record<string, Check>;
  may?: Record<string, Check>;
  refs?: Record<string, string>;
}

const LEVELS = ['floor', 'wall', 'tall'] as const;
const PART_ROLES = ['carcass', 'front', 'exposed', 'back'] as const;

/** לכל שורה מזהה ותאריכי מעקב. טבלת ההגדרות היא היוצאת מן הכלל. */
const ENTITY: Record<string, Check> = { id: str, createdAt: time, updatedAt: time };

export const SCHEMA: Record<string, TableSpec> = {
  materials: {
    need: { ...ENTITY, name: str, sheetWidthMm: size, sheetHeightMm: size, sortOrder: order },
    may: { core: str, coreColor: str, thicknessMm: size, roles: listOf(oneOf(...PART_ROLES)) },
  },
  finishes: {
    need: { ...ENTITY, name: str, hex: str, sortOrder: order },
    may: {
      texture: str,
      hasGrain: bool,
      /* מחיר לכל לוח: מזהה הלוח ← מספרים. אובייקט פגום כאן הוא מחיר שקרי */
      prices: mapOf(
        (p) =>
          !!p &&
          typeof p === 'object' &&
          Object.entries(p).every(([k, x]) => (k === 'factoryPrice' || k === 'consumerPrice') && num(x)),
      ),
      edgeFactoryPerM: num,
      edgeConsumerPerM: num,
    },
  },
  catalog: {
    /*
     * `rooms` הוא בדיוק השדה שהפיל את המסך: הספרייה מסננת לפיו,
     * וקריאה שלו על שורה שאין בה מערך זרקה שגיאה.
     */
    need: {
      ...ENTITY,
      name: str,
      glyph: str,
      rooms: listOf(str),
      level: oneOf(...LEVELS),
      defaultWidthMm: size,
      defaultHeightMm: size,
      defaultDepthMm: size,
      defaultYMm: mm,
      widthOptionsMm: listOf(size),
      isBuiltin: bool,
      sortOrder: order,
    },
    may: {
      code: str,
      group: str,
      doors: count,
      drawers: count,
      shelves: count,
      socleMm: mm,
      counterMm: mm,
      hiddenAt: time,
      note: str,
      carcassFinishId: str,
      frontFinishId: str,
      exposedFinishId: str,
      backFinishId: str,
      carcassMaterialId: str,
      frontMaterialId: str,
      exposedMaterialId: str,
      backMaterialId: str,
    },
    /*
     * הגוון והלוח אינם נבדקים כהפניה: חבילה נוסעת לפעמים בלעדיהם,
     * והייבוא סופר אותם כ"ללא כיסוי" ואומר את זה במספר.
     */
  },
};

/**
 * יחס בין מידות, ולא מידה לחוד.
 *
 * רגליים גבוהות מהארגז כולו עוברות כל בדיקה של "מספר חיובי"
 * ונופלות רק ברשימת החיתוך, בדופן שאורכה שלילי. העובי אינו ידוע
 * כאן — הוא של הנגרייה המקבלת — ולכן נבדק מה שאינו תלוי בו.
 */
function related(row: Record<string, unknown>): string | null {
  const h = row.defaultHeightMm as number;
  const socle = (row.socleMm as number) ?? 0;
  if (socle >= h) return `הרגליים (${socle} מ״מ) גבוהות מהארגז כולו (${h} מ״מ)`;
  return null;
}

/** תיאור של שורה אחת, כדי שההודעה תצביע על מה שנפל ולא על "משהו". */
function rowLabel(row: unknown, index: number): string {
  const r = row as { name?: unknown; code?: unknown; id?: unknown };
  if (typeof r?.name === 'string' && r.name.trim()) return `"${r.name}"`;
  if (typeof r?.code === 'string' && r.code.trim()) return `מק״ט ${r.code}`;
  if (typeof r?.id === 'string' && r.id.trim()) return `מזהה ${r.id}`;
  return `שורה ${index + 1}`;
}

/**
 * בדיקת טבלה אחת. מחזירה הודעה בעברית על התקלה הראשונה, או `null`.
 *
 * `present` הן הטבלאות שיש בקובץ, לבדיקת ההפניות. טבלה שאינה בקובץ
 * אינה נבדקת כיעד הפניה — חבילת ספרייה נושאת ארגזים בלי פרויקטים,
 * וההפניה לשם פשוט אינה רלוונטית.
 */
export function checkTable(
  name: string,
  rows: unknown[],
  present: Record<string, Set<string>>,
): string | null {
  const spec = SCHEMA[name];
  if (!spec) return null;
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return `שורה ${i + 1} בטבלת ${name} אינה רשומה`;
    }
    const r = row as Record<string, unknown>;
    /*
     * כל השדות החסרים, ולא הראשון בלבד. שורה שנקטעה חסרה כמעט
     * הכול, ו"חסר createdAt" שולח את מי שקורא לחפש את הבעיה
     * במקום שבו היא אינה.
     */
    const missing = Object.entries(spec.need)
      .filter(([field, ok]) => !ok(r[field]))
      .map(([field]) => field);
    if (missing.length === 1) return `ב-${rowLabel(row, i)} חסר או פגום השדה ${missing[0]}`;
    if (missing.length) {
      return `ב-${rowLabel(row, i)} חסרים או פגומים: ${missing.slice(0, 6).join(', ')}`;
    }
    for (const [field, ok] of Object.entries(spec.may ?? {})) {
      if (r[field] !== undefined && !ok(r[field])) {
        return `ב-${rowLabel(row, i)} השדה ${field} אינו תקין`;
      }
    }
    if (name === 'catalog') {
      const bad = related(r);
      if (bad) return `ב-${rowLabel(row, i)} ${bad}`;
    }
    const id = r.id as string;
    if (seen.has(id)) return `המזהה ${id} מופיע יותר מפעם אחת`;
    seen.add(id);
    for (const [field, target] of Object.entries(spec.refs ?? {})) {
      const to = present[target];
      if (!to) continue;
      const value = r[field] as string;
      if (!to.has(value)) return `${rowLabel(row, i)} מפנה ל${target} שאינו בקובץ`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* טביעת אצבע                                                          */
/* ------------------------------------------------------------------ */

/**
 * גיבוב תוכן — FNV-1a בשני מצברים, שמונה־עשרה ספרות הקס.
 *
 * זו זהות ולא אבטחה: המטרה היא שאותו תוכן ייתן אותו מחרוזת בכל
 * מכשיר ובכל דפדפן, בלי ספרייה חיצונית ובלי `await`. מי שרוצה
 * לזייף חבילה יכול; מי שרוצה לדעת אם שתי חבילות זהות — יודע.
 */
export function fingerprint(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((c << 5) | (c >>> 3)), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * מפתחות שאינם חלק מהתוכן.
 *
 * `updatedAt` משתנה בכל ייבוא, ולכן שתי נגריות עם אותה ספרייה בדיוק
 * היו מקבלות טביעות אצבע שונות. טביעת האצבע אומרת מה יש בחבילה,
 * ולא מתי נגעו בה לאחרונה — לזה יש `revision`.
 */
const VOLATILE = new Set(['createdAt', 'updatedAt']);

/** סידור יציב: מפתחות ממוינים, `undefined` יורד, ואין רווחים. */
function stable(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (typeof value === 'object') {
    const parts: string[] = [];
    for (const key of Object.keys(value as object).sort()) {
      if (VOLATILE.has(key)) continue;
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      parts.push(JSON.stringify(key) + ':' + stable(v));
    }
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * טביעת האצבע של חבילת ארגזים.
 *
 * מכסה את הארגזים, הלוחות והגוונים שנוסעים איתם, וגם את הסדר
 * ואת מה שהוסר: הרשימות ממוינות לפי מזהה, ולכן חבילה שממנה נמחק
 * ארגז נותנת מחרוזת אחרת. שינוי בצבע של גוון — שהיה בעבר בלתי
 * נראה במניפסט — משנה אותה גם הוא.
 */
export function packFingerprint(pack: {
  catalog: CatalogItem[];
  materials: Material[];
  finishes: Finish[];
}): string {
  const by = <T extends { id: string }>(rows: T[]) => [...rows].sort((x, y) => (x.id < y.id ? -1 : 1));
  return fingerprint(
    stable({
      catalog: by(pack.catalog),
      materials: by(pack.materials),
      finishes: by(pack.finishes),
    }),
  );
}
