import { glyphDef } from '../catalog/glyphList';

/*
 * נתונים מפורמט ישן, בדרך לפורמט הנוכחי.
 *
 * אותה המרה נדרשת בשני מקומות: במעבר במסד, על שורות שכבר במכשיר,
 * ובייבוא, על קובץ שנארז בגרסה קודמת. היא הייתה קיימת במקום אחד
 * בלבד — ולכן מדף שנשמר בגרסה ישנה עם גובה 300 ועובי נפרד 30 עלה
 * מהמסד בעובי 30, ונכנס מקובץ בעובי 300: אותו מדף, שתי תוצאות,
 * לפי הדלת שדרכה נכנס.
 *
 * כאן זה יושב פעם אחת, ושני הצדדים קוראים ממנו.
 */

/**
 * לוח בודד: לאן שייך העובי הישן.
 *
 * לוח מונח נמדד בגובה, ולוח עומד בעומק — המידה שהייתה `panelThicknessMm`
 * היא היום המידה הדקה של הלוח עצמו, ואין לצידה מספר שני שיכול
 * לסתור אותה.
 */
export function panelSize(
  glyph: string,
  thicknessMm: number,
  shape: 'item' | 'unit',
): Record<string, number> {
  const flat = glyphDef(glyph).noCarcass;
  if (flat === 'horizontal') return { [shape === 'item' ? 'defaultHeightMm' : 'heightMm']: thicknessMm };
  if (flat === 'vertical') return { [shape === 'item' ? 'defaultDepthMm' : 'depthMm']: thicknessMm };
  return {};
}

/** שורה אחת — פריט בספרייה או ארגז מונח — בפורמט הנוכחי. */
export function normalizeRow<T extends Record<string, unknown>>(
  row: T,
  shape: 'item' | 'unit',
): T {
  const th = row.panelThicknessMm;
  let out = row;
  if (typeof th === 'number' && Number.isFinite(th)) {
    const { panelThicknessMm: _drop, ...rest } = out;
    out = { ...rest, ...panelSize(String(out.glyph ?? ''), th, shape) } as unknown as T;
  }
  /*
   * "הוסר מהספרייה" אינו נוסע בין מכשירים.
   *
   * בגרסה ישנה הסרה רק סימנה את הפריט, והוא המשיך לצאת בכל קובץ.
   * המקבל היה קולט שורה שלא מופיעה לו בשום רשימה ואינו יכול
   * למחוק — ארגז רפאים. מי שהסיר, הסיר; מה שנשלח, נשלח שלם.
   */
  if (out.hiddenAt !== undefined) {
    const { hiddenAt: _gone, ...rest } = out;
    out = rest as unknown as T;
  }
  /* חלקי קבוצה נושאים ארגז שלם בתוכם, והוא ישן באותה מידה */
  const parts = out.parts;
  if (Array.isArray(parts)) {
    out = {
      ...out,
      parts: parts.map((p) => {
        const part = p as { unit?: Record<string, unknown> };
        return part?.unit ? { ...part, unit: normalizeRow(part.unit, 'unit') } : p;
      }),
    } as unknown as T;
  }
  return out;
}

/**
 * חבילת ארגזים שלמה, בפורמט הנוכחי.
 *
 * רצה לפני האימות ולא אחריו: קובץ ישן תקין אינו אמור להיפסל על
 * שדה שהוא לא ידע עליו, וקובץ ישן פגום אמור להיפסל על מה שהוא
 * באמת — ולכן קודם מתרגמים, ורק אז בודקים.
 */
export function normalizeTables(
  tables: Record<string, unknown[] | undefined>,
): Record<string, unknown[] | undefined> {
  const catalog = tables.catalog;
  if (!Array.isArray(catalog)) return tables;
  return {
    ...tables,
    catalog: catalog.map((r) =>
      r && typeof r === 'object' && !Array.isArray(r)
        ? normalizeRow(r as Record<string, unknown>, 'item')
        : r,
    ),
  };
}
