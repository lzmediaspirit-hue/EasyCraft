import type { Part } from './boards';

/**
 * ניסור: פריסת החלקים על פלטות אמיתיות.
 *
 * עד כה מספר הפלטות נגזר משטח החלקים חלקי שטח הפלטה כפול "ניצולת"
 * קבועה. זו הערכה, והיא שקרה בדיוק במקום שכואב: חלק אחד ארוך יכול
 * לדרוש פלטה שלמה גם כשהשטח הכולל קטן.
 *
 * כאן מיושם ניסור גיליוטינה — כל חתך חוצה את הלוח מקצה לקצה, בדיוק
 * כמו במסור אנכי. האלגוריתם הוא shelf packing: החלקים ממוינים לפי
 * גובה יורד ונערמים בשורות. זה לא אופטימלי מתמטית, אבל הוא מייצר
 * פריסה שנגר באמת יכול לנסר לפיה — וזו הנקודה.
 *
 * כיוון סיבים: חלק בגוון עם סיבים חייב להיחתך בכיוון קבוע, ולכן
 * אסור לסובב אותו. בלי סיבים מותר לסובב, וזה משפר את הניצולת.
 */

export interface NestPart {
  /** מזהה החלק בפריסה, לצורך תצוגה */
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  /** סובב ב-90 מעלות ביחס למידה שהוזמנה */
  rotated: boolean;
  x: number;
  y: number;
}

export interface NestSheet {
  index: number;
  parts: NestPart[];
  /** אחוז משטח הפלטה שנוצל בפועל */
  usedPct: number;
}

export interface NestResult {
  sheets: NestSheet[];
  /** חלקים שגדולים מהפלטה ולא ניתן לנסר אותם ממנה */
  oversize: { label: string; widthMm: number; heightMm: number }[];
  /** ניצולת ממוצעת בפועל */
  usedPct: number;
}

interface Piece {
  label: string;
  w: number;
  h: number;
}

/**
 * פורס את החלקים על פלטות במידה נתונה.
 * `kerf` נוסף לכל חלק, כי המסור אוכל חומר בכל חתך.
 */
export function nestParts(
  parts: Part[],
  sheetW: number,
  sheetH: number,
  kerf: number,
  canRotate: boolean,
): NestResult {
  const pieces: Piece[] = [];
  const oversize: NestResult['oversize'] = [];

  for (const p of parts) {
    for (let i = 0; i < p.qty; i++) {
      const w = p.widthMm + kerf;
      const h = p.heightMm + kerf;
      const fits = w <= sheetW && h <= sheetH;
      const fitsRotated = canRotate && h <= sheetW && w <= sheetH;
      if (!fits && !fitsRotated) {
        oversize.push({ label: p.label, widthMm: p.widthMm, heightMm: p.heightMm });
        continue;
      }
      pieces.push({ label: p.label, w, h });
    }
  }

  /*
   * מיון לפי הצלע הארוכה יורד. חלקים גדולים נכנסים ראשונים ומגדירים
   * את השורות; הקטנים ממלאים את מה שנשאר. זה מה שנותן לניסור שורות
   * ישרות במקום פסיפס שאי אפשר לחתוך.
   */
  pieces.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);

  const sheets: NestSheet[] = [];
  // כל שורה: הגובה שלה, כמה רוחב נוצל, ומאיזה y היא מתחילה
  const shelves: { sheet: number; y: number; height: number; usedW: number }[] = [];

  for (const piece of pieces) {
    let placed = false;

    for (const orientation of orientations(piece, canRotate)) {
      // שורה קיימת שהחלק נכנס בה גם ברוחב וגם בגובה
      const shelf = shelves.find(
        (s) => orientation.h <= s.height && s.usedW + orientation.w <= sheetW,
      );
      if (!shelf) continue;
      sheets[shelf.sheet].parts.push({
        id: `${shelf.sheet}-${sheets[shelf.sheet].parts.length}`,
        label: piece.label,
        widthMm: orientation.w - kerf,
        heightMm: orientation.h - kerf,
        rotated: orientation.rotated,
        x: shelf.usedW,
        y: shelf.y,
      });
      shelf.usedW += orientation.w;
      placed = true;
      break;
    }
    if (placed) continue;

    // שורה חדשה: בפלטה האחרונה אם יש מקום לגובה, אחרת פלטה חדשה
    for (const orientation of orientations(piece, canRotate)) {
      const last = sheets.length - 1;
      const usedH = last >= 0 ? shelfBottom(shelves, last) : 0;
      const target = last >= 0 && usedH + orientation.h <= sheetH ? last : -1;
      const sheetIndex = target >= 0 ? target : sheets.length;
      if (target < 0) sheets.push({ index: sheetIndex, parts: [], usedPct: 0 });
      const y = target >= 0 ? usedH : 0;
      if (y + orientation.h > sheetH) continue;

      shelves.push({ sheet: sheetIndex, y, height: orientation.h, usedW: orientation.w });
      sheets[sheetIndex].parts.push({
        id: `${sheetIndex}-${sheets[sheetIndex].parts.length}`,
        label: piece.label,
        widthMm: orientation.w - kerf,
        heightMm: orientation.h - kerf,
        rotated: orientation.rotated,
        x: 0,
        y,
      });
      placed = true;
      break;
    }
  }

  const sheetArea = sheetW * sheetH;
  for (const s of sheets) {
    const used = s.parts.reduce((n, p) => n + (p.widthMm + kerf) * (p.heightMm + kerf), 0);
    s.usedPct = Math.round((used / sheetArea) * 100);
  }

  return {
    sheets,
    oversize,
    usedPct: sheets.length
      ? Math.round(sheets.reduce((n, s) => n + s.usedPct, 0) / sheets.length)
      : 0,
  };
}

/** הכיוונים המותרים לחלק: כמו שהוא, ואם אין סיבים — גם מסובב. */
function orientations(p: Piece, canRotate: boolean) {
  const base = [{ w: p.w, h: p.h, rotated: false }];
  if (canRotate && p.w !== p.h) base.push({ w: p.h, h: p.w, rotated: true });
  return base;
}

/** הגובה שכבר תפוס בפלטה מסוימת. */
function shelfBottom(
  shelves: { sheet: number; y: number; height: number }[],
  sheet: number,
): number {
  return shelves
    .filter((s) => s.sheet === sheet)
    .reduce((max, s) => Math.max(max, s.y + s.height), 0);
}
