import type { NestInputPart, NestOptions, NestResult } from './nesting';

/**
 * מאמת פריסה, בנפרד מהאלגוריתם שיצר אותה.
 *
 * מנוע הניסור בוחר איפה להניח כל חלק, והוא גם זה שמדווח שהכול
 * תקין — כלומר הוא בודק את עצמו. בדיקה כזאת עוברת בדיוק כשהיא
 * שגויה יחד עם הקוד שהיא בודקת.
 *
 * מה שנעשה כאן הוא הפוך: הקלט והתוצאה נכנסים, והבדיקה נבנית מהם
 * בלי לדעת דבר על השיטה שבחרה. חלק שנעלם, חלק שיצא מהפלטה, שני
 * חלקים שחופפים, סיבים שהתהפכו, חתך שחוצה חלק, או חתך גיליוטינה
 * שלא היה אפשרי בזמן ביצועו — כל אלה נראים כאן ולא שם.
 *
 * זו אינה הוכחת אופטימליות. היא אינה אומרת שמספר הפלטות הוא
 * המזערי, והיא אינה מכירה את מגבלות המסור, האחיזה והשינוע בפועל.
 */

/** מה נמצא, ובאיזו פלטה. */
export interface NestProblem {
  kind:
    | 'missing'
    | 'extra'
    | 'outside'
    | 'overlap'
    | 'grain'
    | 'cutThroughPart'
    | 'notGuillotine'
    | 'notSeparated';
  text: string;
  sheet?: number;
}

/** סובלנות: מידות חלקים עשויות להיות שבריות. */
const EPS = 0.51;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box, gap: number) =>
  a.x + a.w > b.x + gap && b.x + b.w > a.x + gap &&
  a.y + a.h > b.y + gap && b.y + b.h > a.y + gap;

const inside = (a: Box, b: Box) =>
  a.x >= b.x - EPS && a.y >= b.y - EPS &&
  a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;

export function checkNesting(
  parts: NestInputPart[],
  opts: NestOptions,
  result: NestResult,
): NestProblem[] {
  const out: NestProblem[] = [];
  const trim = Math.max(opts.edgeTrimMm ?? 0, 0);
  const usable: Box = {
    x: trim,
    y: trim,
    w: opts.sheetWidthMm - 2 * trim,
    h: opts.sheetHeightMm - 2 * trim,
  };
  const grainAlong = opts.grainAlong ?? (opts.sheetHeightMm >= opts.sheetWidthMm ? 'height' : 'width');

  /* 1. כל חלק שהוזמן — פעם אחת ובכמות שלו */
  const want = new Map<number, number>();
  parts.forEach((p, i) => {
    if (!(p.widthMm > 0 && p.heightMm > 0) || !(p.qty > 0)) return;
    want.set(i, p.qty);
  });
  const got = new Map<number, number>();
  for (const sheet of result.sheets) {
    for (const p of sheet.parts) got.set(p.source, (got.get(p.source) ?? 0) + 1);
  }
  for (const over of result.oversize) {
    /* חלק שאינו נכנס לפלטה מדווח ככזה, וזה לא "חסר" */
    const i = parts.findIndex(
      (p) => p.label === over.label && p.widthMm === over.widthMm && p.heightMm === over.heightMm,
    );
    if (i >= 0) want.delete(i);
  }
  for (const [i, n] of want) {
    const have = got.get(i) ?? 0;
    if (have < n) {
      out.push({ kind: 'missing', text: `"${parts[i].label}": הוזמנו ${n} ונחתכו ${have}` });
    } else if (have > n) {
      out.push({ kind: 'extra', text: `"${parts[i].label}": הוזמנו ${n} ונחתכו ${have}` });
    }
  }
  for (const [i] of got) {
    if (!want.has(i)) out.push({ kind: 'extra', text: `חלק שלא הוזמן בפריסה: ${parts[i]?.label ?? i}` });
  }

  for (const sheet of result.sheets) {
    const boxes: Box[] = sheet.parts.map((p) => ({ x: p.x, y: p.y, w: p.widthMm, h: p.heightMm }));

    /* 2. בתוך הפלטה, אחרי ניקוי השוליים */
    sheet.parts.forEach((p, i) => {
      if (!inside(boxes[i], usable)) {
        out.push({ kind: 'outside', sheet: sheet.index, text: `"${p.label}" חורג משטח הפלטה` });
      }
    });

    /*
     * 3. בלי חפיפה, ועם מרווח הלהב ביניהם.
     *
     * מגע קצה בקצה אינו חפיפה — בפלטה בלי להב שני חלקים באמת
     * נוגעים. מה שכן נדרש: שני חלקים שנפגשים על ציר אחד חייבים
     * להיות מופרדים בעובי הלהב על הציר השני, אחרת המסור אוכל
     * מאחד מהם.
     */
    const kerf = Math.max(opts.kerfMm, 0);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (overlaps(a, b, EPS)) {
          out.push({
            kind: 'overlap',
            sheet: sheet.index,
            text: `"${sheet.parts[i].label}" ו-"${sheet.parts[j].label}" חופפים`,
          });
          continue;
        }
        if (kerf <= 0) continue;
        const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
        const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
        const meetY = gapY < -EPS;
        const meetX = gapX < -EPS;
        if (meetY && gapX > -EPS && gapX < kerf - EPS) {
          out.push({
            kind: 'overlap',
            sheet: sheet.index,
            text: `"${sheet.parts[i].label}" ו-"${sheet.parts[j].label}" קרובים מעובי הלהב`,
          });
        } else if (meetX && gapY > -EPS && gapY < kerf - EPS) {
          out.push({
            kind: 'overlap',
            sheet: sheet.index,
            text: `"${sheet.parts[i].label}" ו-"${sheet.parts[j].label}" קרובים מעובי הלהב`,
          });
        }
      }
    }

    /* 4. סיבים: חלק שסובב חייב להיות מותר לסיבוב */
    for (const p of sheet.parts) {
      if (!p.rotated) continue;
      const src = parts[p.source];
      const grain = opts.hasGrain ? (src?.grain ?? 'height') : 'free';
      if (grain === 'free') continue;
      /*
       * סיבוב מותר גם לחלק עם סיבים, כשהוא מיישר אותם לציר
       * הפלטה — מה שאסור הוא שהתוצאה תניח אותם לרוחב.
       */
      const along = p.widthMm >= p.heightMm ? 'width' : 'height';
      const need = grain === 'height' ? 'height' : 'width';
      if (src.widthMm === src.heightMm) continue;
      if (along !== need && grainAlong === need) {
        out.push({
          kind: 'grain',
          sheet: sheet.index,
          text: `"${p.label}" סובב נגד כיוון הסיבים`,
        });
      }
    }

    /* 5. קו חיתוך אינו חוצה פנים של חלק */
    for (const c of sheet.cuts) {
      for (const b of boxes) {
        const crosses =
          c.axis === 'x'
            ? c.at > b.x + EPS && c.at < b.x + b.w - EPS &&
              c.to > b.y + EPS && c.from < b.y + b.h - EPS
            : c.at > b.y + EPS && c.at < b.y + b.h - EPS &&
              c.to > b.x + EPS && c.from < b.x + b.w - EPS;
        if (crosses) {
          out.push({
            kind: 'cutThroughPart',
            sheet: sheet.index,
            text: `חתך ב-${Math.round(c.at)} מ״מ עובר דרך חלק`,
          });
          break;
        }
      }
    }

    /* 6. שחזור סדר החיתוכים: כל חתך חוצה מלבן שקיים באותו רגע */
    out.push(...replayCuts(sheet.cuts, usable, boxes, sheet.index, Math.max(opts.kerfMm, 0)));
  }
  return out;
}

/**
 * שחזור עצמאי של סדר הניסור.
 *
 * לא די בכך שחתך אינו חוצה חלק: חתך גיליוטינה חייב לחצות מלבן
 * *שלם* שקיים ברגע שבו הוא נעשה. הרשימה מתחילה מהפלטה כולה, וכל
 * חתך מפצל בדיוק מלבן אחד לשניים. בסוף כל חלק חייב לשבת במלבן
 * משלו — אחרת הוא לא הופרד.
 */
function replayCuts(
  cuts: { axis: 'x' | 'y'; at: number; from: number; to: number }[],
  usable: Box,
  parts: Box[],
  sheet: number,
  kerf: number,
): NestProblem[] {
  const out: NestProblem[] = [];
  let rects: Box[] = [{ ...usable }];
  for (const c of cuts) {
    const i = rects.findIndex((r) =>
      c.axis === 'x'
        ? c.at > r.x + EPS && c.at < r.x + r.w - EPS &&
          c.from <= r.y + EPS && c.to >= r.y + r.h - EPS
        : c.at > r.y + EPS && c.at < r.y + r.h - EPS &&
          c.from <= r.x + EPS && c.to >= r.x + r.w - EPS,
    );
    if (i < 0) {
      out.push({
        kind: 'notGuillotine',
        sheet,
        text: `חתך ${c.axis} ב-${Math.round(c.at)} מ״מ אינו חוצה מלבן שלם בזמן ביצועו`,
      });
      continue;
    }
    const r = rects[i];
    /*
     * הלהב אוכל את רוחבו: מה שנשאר מעבר לחתך מתחיל אחריו ולא בו.
     * בלי זה כל חתך הבא נמדד מקואורדינטה שזזה בעובי הלהב, ונראה
     * כאילו אינו חוצה מלבן שלם.
     */
    const halves: Box[] =
      c.axis === 'x'
        ? [
            { ...r, w: c.at - r.x },
            { ...r, x: c.at + kerf, w: Math.max(r.x + r.w - c.at - kerf, 0) },
          ]
        : [
            { ...r, h: c.at - r.y },
            { ...r, y: c.at + kerf, h: Math.max(r.y + r.h - c.at - kerf, 0) },
          ];
    rects = [...rects.slice(0, i), ...halves, ...rects.slice(i + 1)];
  }
  /* ובסוף: כל חלק בתוך מלבן משלו, ואין מלבן שמחזיק שניים */
  const owner = new Map<number, number>();
  parts.forEach((p, pi) => {
    const i = rects.findIndex((r) => inside(p, r));
    if (i < 0) {
      out.push({ kind: 'notSeparated', sheet, text: `חלק לא הופרד באף חתך` });
      return;
    }
    const taken = owner.get(i);
    if (taken !== undefined) {
      out.push({ kind: 'notSeparated', sheet, text: `שני חלקים נשארו באותו מלבן` });
    }
    owner.set(i, pi);
  });
  return out;
}
