import type { PartRole } from '../db/types';

/**
 * ניסור: פריסת החלקים על פלטות אמיתיות.
 *
 * הפריסה כאן היא ניסור גיליוטינה רקורסיבי: כל חתך חוצה את היחידה
 * הנוכחית מקצה לקצה — קודם את הפלטה השלמה, ואחר כך כל רצועה שנוצרה
 * ממנה. זה לא אילוץ אסתטי אלא המציאות של מסור פנלים: הלהב לא יודע
 * לעצור באמצע הלוח ולפנות. פריסה שנראית צפופה אבל דורשת חתך חלקי
 * היא פריסה שאי אפשר לנסר, ולכן היא שווה אפס.
 *
 * האלגוריתם: ניהול "מלבנים פנויים" עם פיצול גיליוטינה. כל חלק
 * שמונח בתוך מלבן פנוי חותך אותו לשני מלבנים חדשים — מימין ומתחת —
 * ואחד משני החתכים רץ לכל אורך המלבן (זה החתך הראשון במסור) בעוד
 * השני קצר יותר. בחירת המלבן, כיוון הפיצול וסדר החלקים הם היוריסטיקות
 * שאין להן תשובה אחת נכונה, ולכן המנוע מריץ סל קבוע של שילובים
 * ומחזיר את הפריסה הטובה ביותר: פחות פלטות, ואחר כך שארית גדולה
 * ומרוכזת ככל האפשר בפלטה האחרונה. הסל קבוע ומסודר, ולכן אותו קלט
 * נותן תמיד אותה פריסה.
 *
 * כרסום: המסור אוכל חומר רק היכן שיש חתך. לכן הכרסום נגרע פעם אחת
 * בכל קו חיתוך — בין שני חלקים סמוכים, או בין חלק לשארית — ולא
 * מתווסף כשוליים לכל חלק מארבעה צדדים. חלק שנשען על קצה הפלטה או על
 * קו חיתוך קיים לא משלם כרסום נוסף בצד הזה.
 *
 * סיבים: הסיבים של הפלטה רצים לאורכה (הצלע הארוכה — 2440, 2750 או
 * 3050). חלק שחייב לעקוב אחרי הסיבים מונח כך שציר הסיבים שלו מקביל
 * לאורך הפלטה, ואסור לסובב אותו. חלק בלי דרישת סיבים מסתובב בחופשיות
 * כשזה משפר את הניצולת.
 */

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

/**
 * כיוון הסיבים בחלק, ביחס למידות שלו כפי שהוזמן:
 * - `height` — הסיבים רצים לאורך `heightMm`. זה המקרה של חזיתות
 *   (דלת, חזית מגירה, דופן זרה) וצדדי גוף: הסיבים עומדים.
 * - `width`  — הסיבים רצים לאורך `widthMm`.
 * - `free`   — אין דרישת סיבים; מותר לסובב לשיפור הניצולת
 *   (מדפים, תחתיות, תקרות, גבים, קושרות).
 */
export type PartGrain = 'height' | 'width' | 'free';

/**
 * חלק לניסור. `Part` מתוך boards.ts מתאים כפי שהוא; `grain` הוא
 * התוספת היחידה. כשהוא חסר, ברירת המחדל שמרנית — חלק שאינו גב נחשב
 * כעוקב סיבים — כי צד גלוי שנחתך נגד הסיבים הוא חלק הרוס, ואילו מדף
 * שסובב שלא לצורך עולה רק כמה אחוזי ניצולת.
 */
export interface NestInputPart {
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  role?: PartRole;
  grain?: PartGrain;
}

export interface NestOptions {
  /** רוחב הפלטה — הצלע הקצרה, בדרך כלל 1220 */
  sheetWidthMm: number;
  /** אורך הפלטה — הצלע הארוכה, שלאורכה רצים הסיבים */
  sheetHeightMm: number;
  /** עובי הלהב, נגרע בכל קו חיתוך */
  kerfMm: number;
  /** האם ללוח יש סיבים בכלל. בלוח חלק כל החלקים חופשיים לסיבוב. */
  hasGrain: boolean;
  /**
   * ניקוי שולי הפלטה לפני הניסור, במ"מ לכל צד. קצה מפעל לרוב פגום
   * מהשינוע, ונגר שרוצה קצה נקי גוזר אותו. 0 — משתמשים בקצה כפי שהוא.
   */
  edgeTrimMm?: number;
  /** ציר הסיבים בפלטה. ברירת מחדל: הצלע הארוכה. */
  grainAlong?: 'height' | 'width';
}

interface NestPart {
  /** מזהה החלק בפריסה, לצורך תצוגה */
  id: string;
  /** האינדקס של החלק ברשימת הקלט שהוא נחתך ממנה */
  source: number;
  label: string;
  /** המידות כפי שהחלק מונח על הפלטה — אחרי סיבוב, אם היה */
  widthMm: number;
  heightMm: number;
  /** סובב ב-90 מעלות ביחס למידה שהוזמנה */
  rotated: boolean;
  x: number;
  y: number;
}

/** שארית שימושית שנשארת מהפלטה אחרי הניסור. */
interface Offcut {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
}

/**
 * קו חיתוך אחד, בסדר הביצוע. `axis: 'x'` הוא חתך אנכי בקו x = at
 * שרץ מ-y = from עד y = to; `axis: 'y'` הוא חתך אופקי בקו y = at
 * שרץ מ-x = from עד x = to. כל חתך חוצה את היחידה שהוא נעשה בה.
 */
interface Cut {
  axis: 'x' | 'y';
  at: number;
  from: number;
  to: number;
}

interface NestSheet {
  index: number;
  parts: NestPart[];
  /** אחוז משטח הפלטה שהופך לחלקים — נטו, בלי הכרסום */
  usedPct: number;
  /** שאריות שימושיות, מהגדולה לקטנה */
  offcuts: Offcut[];
  /** תוכנית החיתוך, בסדר שבו נכון לנסר */
  cuts: Cut[];
}

/** חלק שאינו נכנס לפלטה באף כיוון מותר. */
interface OversizePart {
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  /** הכיוון שנדרש — לפעמים החלק היה נכנס אילו הותר לסובב אותו */
  grain: PartGrain;
}

export interface NestResult {
  sheets: NestSheet[];
  oversize: OversizePart[];
  /** ניצולת כוללת: שטח החלקים חלקי שטח כל הפלטות */
  usedPct: number;
  /** שם השילוב שנבחר מהסל — לצורך ניפוי שגיאות */
  strategy: string;
}

/**
 * שארית שצלעה הקצרה קטנה מזה אינה נחשבת — פס צר כזה לא הופך לחלק
 * בפרויקט הבא, הוא הולך לפח.
 */
const MIN_OFFCUT_MM = 100;

/** סובלנות להשוואת מידות, כי מידות חלקים עשויות להיות שבריות */
const EPS = 1e-6;

/* ------------------------------------------------------------------ */
/* מבנים פנימיים                                                        */
/* ------------------------------------------------------------------ */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Orientation {
  w: number;
  h: number;
  rotated: boolean;
}

/** עותק אחד של חלק — כל יחידה מהכמות היא פריט נפרד */
interface Item {
  idx: number;
  source: number;
  label: string;
  w: number;
  h: number;
  grain: PartGrain;
  orientations: Orientation[];
}

interface Placement {
  item: Item;
  o: Orientation;
  x: number;
  y: number;
}

interface SheetState {
  placements: Placement[];
  free: Rect[];
  cuts: Cut[];
}

/** איך בוחרים את המלבן הפנוי לחלק */
type FitRule = 'shortSide' | 'area' | 'longSide';
/** לאיזה כיוון רץ החתך הארוך אחרי הנחת החלק */
type SplitRule = 'maxArea' | 'vertical' | 'horizontal' | 'shorterCut' | 'longerCut' | 'minArea';
/** באיזה סדר החלקים מונחים */
type SortRule = 'area' | 'longSide' | 'height' | 'width' | 'perimeter';
/**
 * `sequential` — חלק אחרי חלק לפי הסדר, לתוך המלבן הפנוי המתאים
 *   ביותר (בפלטה הראשונה שיש בה מקום, או בכל הפלטות הפתוחות).
 * `fill` — פלטה אחרי פלטה: בכל צעד נבחר הזוג חלק/מלבן שמתאים הכי
 *   טוב, עד שלא נכנס יותר כלום. סוגר פלטות צפוף יותר בדרך כלל.
 */
type Policy = 'sequentialFirst' | 'sequentialGlobal' | 'fill';

interface Strategy {
  policy: Policy;
  sort: SortRule;
  fit: FitRule;
  split: SplitRule;
}

const SORTS: SortRule[] = ['area', 'longSide', 'height', 'width', 'perimeter'];
const FITS: FitRule[] = ['shortSide', 'area', 'longSide'];
const SPLITS: SplitRule[] = ['maxArea', 'vertical', 'horizontal', 'shorterCut', 'longerCut', 'minArea'];

/* ------------------------------------------------------------------ */

/**
 * פורס את החלקים על פלטות במידה נתונה.
 */
export function nestParts(parts: NestInputPart[], opts: NestOptions): NestResult {
  const kerf = Math.max(opts.kerfMm, 0);
  const trim = Math.max(opts.edgeTrimMm ?? 0, 0);
  const sheetW = opts.sheetWidthMm;
  const sheetH = opts.sheetHeightMm;
  const usable: Rect = { x: trim, y: trim, w: sheetW - 2 * trim, h: sheetH - 2 * trim };

  // הסיבים רצים לאורך הצלע הארוכה, אלא אם נאמר אחרת
  const grainAlong = opts.grainAlong ?? (sheetH >= sheetW ? 'height' : 'width');
  const grainAxis: 'x' | 'y' = grainAlong === 'height' ? 'y' : 'x';

  const items: Item[] = [];
  const oversize: OversizePart[] = [];

  parts.forEach((p, source) => {
    // חלק במידה אפס אינו חלק — נוצר כשארגז קטן מהעוביים שלו
    if (!(p.widthMm > 0 && p.heightMm > 0) || !(p.qty > 0)) return;
    /*
     * כמות היא מספר חלקים, ולכן היא שלמה.
     *
     * הלולאה שמתחת רצה `i < p.qty`, ולכן כמות 1.5 הפכה לשני
     * חלקים בשקט — הפריסה יצאה תקינה, והנגר קיבל חלק שלא הזמין.
     * מספר שאינו שלם אינו כמות, והוא נעצר בגבול ולא מתעגל.
     */
    if (!Number.isInteger(p.qty)) {
      throw new RangeError(`כמות חייבת להיות מספר שלם: "${p.label}" הגיע בכמות ${p.qty}`);
    }
    const grain: PartGrain = opts.hasGrain ? (p.grain ?? defaultGrain(p.role)) : 'free';
    const orientations = allowedOrientations(p.widthMm, p.heightMm, grain, grainAxis);

    if (!orientations.some((o) => fitsIn(o, usable))) {
      // מקובץ לפי מידה כדי שהנגר יראה "6 דלתות" ולא שש שורות זהות
      const same = oversize.find(
        (o) => o.label === p.label && o.widthMm === p.widthMm && o.heightMm === p.heightMm,
      );
      if (same) same.qty += p.qty;
      else oversize.push({ label: p.label, widthMm: p.widthMm, heightMm: p.heightMm, qty: p.qty, grain });
      return;
    }

    for (let i = 0; i < p.qty; i++) {
      items.push({
        idx: items.length,
        source,
        label: p.label,
        w: p.widthMm,
        h: p.heightMm,
        grain,
        orientations,
      });
    }
  });

  if (items.length === 0) {
    return { sheets: [], oversize, usedPct: 0, strategy: 'none' };
  }

  /*
   * מריצים את כל הסל ושומרים את הטוב ביותר. הסדר קבוע, וההשוואה
   * מעדיפה את הראשון בשוויון — ולכן התוצאה דטרמיניסטית.
   */
  let best: { sheets: SheetState[]; strategy: Strategy } | undefined;
  for (const strategy of strategies()) {
    const sheets = pack(items, usable, kerf, strategy);
    if (!best || isBetter(sheets, best.sheets)) best = { sheets, strategy };
  }

  return toResult(best!.sheets, best!.strategy, oversize, sheetW, sheetH);
}

/* ------------------------------------------------------------------ */
/* סיבים וכיוונים                                                       */
/* ------------------------------------------------------------------ */

/**
 * ברירת המחדל כשלא נאמר כלום על הסיבים.
 * גב הוא חלק פנימי ומוסתר, וכל השאר — חזיתות וגוף — מקבלים את הצד
 * הבטוח: עוקבים אחרי הסיבים. boards.ts אמור לציין במפורש מדף מול צד.
 */
function defaultGrain(role: PartRole | undefined): PartGrain {
  return role === 'back' ? 'free' : 'height';
}

/**
 * הכיוונים שמותר להניח בהם את החלק.
 * `rotated=false` — heightMm של החלק לאורך ציר y של הפלטה.
 * חלק עוקב-סיבים מקבל רק את הכיוון שבו ציר הסיבים שלו מקביל לציר
 * הסיבים של הפלטה; חלק חופשי מקבל את שניהם (ריבוע — אחד).
 */
function allowedOrientations(
  w: number,
  h: number,
  grain: PartGrain,
  grainAxis: 'x' | 'y',
): Orientation[] {
  const upright: Orientation = { w, h, rotated: false };
  const turned: Orientation = { w: h, h: w, rotated: true };
  if (grain === 'free') return w === h ? [upright] : [upright, turned];
  // בכיוון הישר heightMm של החלק רץ על ציר y; ב-width הוא רץ על x
  const heightAxis: 'x' | 'y' = grain === 'height' ? 'y' : 'x';
  return heightAxis === grainAxis ? [upright] : [turned];
}

function fitsIn(o: Orientation, r: Rect): boolean {
  return o.w <= r.w + EPS && o.h <= r.h + EPS;
}

/* ------------------------------------------------------------------ */
/* הסל                                                                  */
/* ------------------------------------------------------------------ */

function strategies(): Strategy[] {
  const out: Strategy[] = [];
  for (const policy of ['sequentialFirst', 'sequentialGlobal'] as Policy[]) {
    for (const sort of SORTS) {
      for (const fit of FITS) {
        for (const split of SPLITS) out.push({ policy, sort, fit, split });
      }
    }
  }
  // ב-fill הסדר משפיע רק על שוויונות, ולכן שני סדרים מספיקים
  for (const sort of ['area', 'longSide'] as SortRule[]) {
    for (const fit of FITS) {
      for (const split of SPLITS) out.push({ policy: 'fill', sort, fit, split });
    }
  }
  return out;
}

function sortItems(items: Item[], rule: SortRule): Item[] {
  const key = (it: Item): [number, number] => {
    switch (rule) {
      case 'area':
        return [it.w * it.h, Math.max(it.w, it.h)];
      case 'longSide':
        return [Math.max(it.w, it.h), it.w * it.h];
      case 'height':
        return [it.h, it.w];
      case 'width':
        return [it.w, it.h];
      case 'perimeter':
        return [it.w + it.h, it.w * it.h];
    }
  };
  // מיון יציב עם האינדקס כשובר שוויון — כדי שסדר הקלט לא ישנה תוצאה
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return kb[0] - ka[0] || kb[1] - ka[1] || a.idx - b.idx;
  });
}

/**
 * ציון ההתאמה של חלק למלבן פנוי — קטן יותר הוא טוב יותר.
 * צלע קצרה: מעדיף מלבן שהחלק ממלא כמעט בדיוק בצד אחד, כי אז נשארת
 * רצועה ישרה ולא שני שברים. שטח: מעדיף את המלבן הקטן ביותר שמכיל.
 */
function fitScore(free: Rect, o: Orientation, rule: FitRule): [number, number] {
  const dw = free.w - o.w;
  const dh = free.h - o.h;
  switch (rule) {
    case 'shortSide':
      return [Math.min(dw, dh), Math.max(dw, dh)];
    case 'longSide':
      return [Math.max(dw, dh), Math.min(dw, dh)];
    case 'area':
      return [free.w * free.h - o.w * o.h, Math.min(dw, dh)];
  }
}

function scoreLess(a: [number, number], b: [number, number]): boolean {
  if (a[0] < b[0] - EPS) return true;
  if (a[0] > b[0] + EPS) return false;
  return a[1] < b[1] - EPS;
}

/**
 * האם החתך הארוך הוא אופקי (רוחבי, y = const לכל רוחב המלבן) —
 * ואז השארית הגדולה היא רצועה מלאה מתחת לחלק — או אנכי, ואז השארית
 * הגדולה היא רצועה מלאה מימין לו.
 */
function splitHorizontal(free: Rect, o: Orientation, kerf: number, rule: SplitRule): boolean {
  const below = Math.max(free.h - o.h - kerf, 0) * free.w;
  const beside = Math.max(free.w - o.w - kerf, 0) * free.h;
  switch (rule) {
    case 'horizontal':
      return true;
    case 'vertical':
      return false;
    // לשמור את השארית הגדולה שלמה — זו השארית שאפשר להשתמש בה שוב
    case 'maxArea':
      return below >= beside;
    case 'minArea':
      return below < beside;
    // חתך קצר קודם — פחות מטרים של ניסור ופחות סיכוי לסטייה
    case 'shorterCut':
      return free.w <= free.h;
    case 'longerCut':
      return free.w > free.h;
  }
}

/* ------------------------------------------------------------------ */
/* ההנחה עצמה                                                           */
/* ------------------------------------------------------------------ */

function newSheet(usable: Rect): SheetState {
  return { placements: [], free: [{ ...usable }], cuts: [] };
}

/**
 * מניח חלק בפינה השמאלית-עליונה של מלבן פנוי ומפצל את השארית.
 *
 * הכרסום נגרע רק היכן שיש חתך בפועל: אם החלק ממלא את המלבן עד הקצה
 * אין חתך בצד הזה ואין כרסום. כשיש שארית קטנה מהכרסום — למשל 2 מ"מ
 * מול להב של 4 — החתך נעשה, השארית הופכת לנסורת, ולא נרשם מלבן פנוי.
 */
function place(
  sheet: SheetState,
  freeIndex: number,
  item: Item,
  o: Orientation,
  kerf: number,
  rule: SplitRule,
): void {
  const f = sheet.free[freeIndex];
  sheet.free.splice(freeIndex, 1);
  sheet.placements.push({ item, o, x: f.x, y: f.y });

  const leftW = f.w - o.w;
  const leftH = f.h - o.h;
  const addFree = (x: number, y: number, w: number, h: number) => {
    if (w > EPS && h > EPS) sheet.free.push({ x, y, w, h });
  };

  if (splitHorizontal(f, o, kerf, rule)) {
    // חתך רוחבי לכל רוחב המלבן, ואז חתך קצר שמפריד את החלק מהשארית שלצדו
    if (leftH > EPS) {
      sheet.cuts.push({ axis: 'y', at: f.y + o.h, from: f.x, to: f.x + f.w });
      addFree(f.x, f.y + o.h + kerf, f.w, leftH - kerf);
    }
    if (leftW > EPS) {
      sheet.cuts.push({ axis: 'x', at: f.x + o.w, from: f.y, to: f.y + o.h });
      addFree(f.x + o.w + kerf, f.y, leftW - kerf, o.h);
    }
  } else {
    // חתך אורכי לכל גובה המלבן, ואז חתך קצר שמפריד את החלק מהשארית שמתחתיו
    if (leftW > EPS) {
      sheet.cuts.push({ axis: 'x', at: f.x + o.w, from: f.y, to: f.y + f.h });
      addFree(f.x + o.w + kerf, f.y, leftW - kerf, f.h);
    }
    if (leftH > EPS) {
      sheet.cuts.push({ axis: 'y', at: f.y + o.h, from: f.x, to: f.x + o.w });
      addFree(f.x, f.y + o.h + kerf, o.w, leftH - kerf);
    }
  }
}

interface Candidate {
  score: [number, number];
  sheet: number;
  free: number;
  item: number;
  o: Orientation;
}

/** המלבן והכיוון הטובים ביותר לפריט בפלטה אחת, אם יש כאלה */
function bestInSheet(
  sheet: SheetState,
  sheetIndex: number,
  item: Item,
  itemIndex: number,
  fit: FitRule,
  current: Candidate | undefined,
): Candidate | undefined {
  let best = current;
  for (let fi = 0; fi < sheet.free.length; fi++) {
    const f = sheet.free[fi];
    for (const o of item.orientations) {
      if (!fitsIn(o, f)) continue;
      const score = fitScore(f, o, fit);
      if (!best || scoreLess(score, best.score)) {
        best = { score, sheet: sheetIndex, free: fi, item: itemIndex, o };
      }
    }
  }
  return best;
}

function pack(items: Item[], usable: Rect, kerf: number, s: Strategy): SheetState[] {
  const order = sortItems(items, s.sort);
  const sheets: SheetState[] = [];

  if (s.policy === 'fill') {
    /*
     * ממלאים פלטה עד הסוף לפני שפותחים חדשה. בכל צעד נבחר הזוג
     * חלק/מלבן עם ההתאמה הטובה ביותר; בשוויון — החלק הגדול יותר, כי
     * הוא זה שקשה יותר למצוא לו מקום אחר כך.
     */
    const remaining = [...order];
    let sheet = newSheet(usable);
    sheets.push(sheet);
    while (remaining.length > 0) {
      let best: Candidate | undefined;
      for (let ii = 0; ii < remaining.length; ii++) {
        best = bestInSheet(sheet, sheets.length - 1, remaining[ii], ii, s.fit, best);
      }
      if (!best) {
        // הפלטה מלאה. פלטה ריקה שלא נכנס בה כלום לא תקרה — חלקי-ענק סוננו קודם
        if (sheet.placements.length === 0) break;
        sheet = newSheet(usable);
        sheets.push(sheet);
        continue;
      }
      place(sheet, best.free, remaining[best.item], best.o, kerf, s.split);
      remaining.splice(best.item, 1);
    }
    return sheets;
  }

  for (const item of order) {
    let best: Candidate | undefined;
    for (let si = 0; si < sheets.length; si++) {
      best = bestInSheet(sheets[si], si, item, 0, s.fit, best);
      // בפלטה-הראשונה עוצרים ברגע שנמצא מקום, כדי לסגור פלטות לפי הסדר
      if (best && s.policy === 'sequentialFirst') break;
    }
    if (!best) {
      const sheet = newSheet(usable);
      sheets.push(sheet);
      best = bestInSheet(sheet, sheets.length - 1, item, 0, s.fit, undefined);
      if (!best) continue; // לא אמור לקרות — חלקי-ענק סוננו קודם
    }
    place(sheets[best.sheet], best.free, item, best.o, kerf, s.split);
  }
  return sheets;
}

/* ------------------------------------------------------------------ */
/* בחירת הפריסה הטובה                                                    */
/* ------------------------------------------------------------------ */

function usedArea(sheet: SheetState): number {
  return sheet.placements.reduce((n, p) => n + p.o.w * p.o.h, 0);
}

function usableOffcuts(sheet: SheetState): Rect[] {
  return sheet.free.filter((r) => Math.min(r.w, r.h) >= MIN_OFFCUT_MM - EPS);
}

/**
 * מה עדיף: קודם פחות פלטות. אחר כך — הפלטה הפחות מנוצלת ריקה ככל
 * האפשר, כי שארית של חצי פלטה שווה יותר מאותו שטח מפוזר על שש פלטות.
 * ובסוף — שאריות גדולות ומעטות על פני רבות וקטנות.
 */
function isBetter(a: SheetState[], b: SheetState[]): boolean {
  if (a.length !== b.length) return a.length < b.length;

  const emptiest = (sheets: SheetState[]) => Math.min(...sheets.map(usedArea));
  const ea = emptiest(a);
  const eb = emptiest(b);
  if (Math.abs(ea - eb) > EPS) return ea < eb;

  const chunkiness = (sheets: SheetState[]) =>
    sheets.reduce(
      (n, s) => n + usableOffcuts(s).reduce((m, r) => m + (r.w * r.h) ** 2, 0),
      0,
    );
  return chunkiness(a) > chunkiness(b) + EPS;
}

function toResult(
  sheets: SheetState[],
  strategy: Strategy,
  oversize: OversizePart[],
  sheetW: number,
  sheetH: number,
): NestResult {
  const sheetArea = sheetW * sheetH;
  let totalUsed = 0;

  const out: NestSheet[] = sheets.map((s, index) => {
    const used = usedArea(s);
    totalUsed += used;
    return {
      index,
      parts: s.placements.map((p, i) => ({
        id: `${index}-${i}`,
        source: p.item.source,
        label: p.item.label,
        widthMm: p.o.w,
        heightMm: p.o.h,
        rotated: p.o.rotated,
        x: p.x,
        y: p.y,
      })),
      usedPct: Math.round((used / sheetArea) * 100),
      offcuts: usableOffcuts(s)
        .map((r) => ({ x: r.x, y: r.y, widthMm: r.w, heightMm: r.h }))
        .sort(
          (a, b) =>
            b.widthMm * b.heightMm - a.widthMm * a.heightMm || a.y - b.y || a.x - b.x,
        ),
      cuts: s.cuts,
    };
  });

  return {
    sheets: out,
    oversize,
    usedPct: sheets.length ? Math.round((totalUsed / (sheets.length * sheetArea)) * 100) : 0,
    strategy: `${strategy.policy}/${strategy.sort}/${strategy.fit}/${strategy.split}`,
  };
}
