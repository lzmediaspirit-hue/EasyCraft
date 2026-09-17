import { GlyphPreview } from './GlyphPreview';
import { unitZones } from './zones';
import type { CatalogItem } from '../db/types';
import { cm } from '../ui/units';
import { fitCapability, nameMismatch, productionGap } from './production';
import { promisedByGlyph, type Capability, type CapSource } from './capabilities';
import { promisedRole } from './roles';

/**
 * פריט ספרייה בלשון של ארגז מונח.
 *
 * חישוב האזורים מדבר על `heightMm`, ולפריט יש `defaultHeightMm` —
 * אותה מידה, שני שמות.
 */
export function itemAsUnit(item: CatalogItem) {
  return { ...item, heightMm: item.defaultHeightMm };
}

/**
 * הארגז כפי שהוא ייראה, בקטן.
 *
 * שני מסכי הספרייה העתיקו זה מזה רשימת מאפיינים חלקית, ולכן
 * התמונה הקטנה לא הראתה את מה שנשמר: מגירות פנימיות נראו חיצוניות,
 * ויטרינה נראתה אטומה, וקלאפה נראתה כדלת. הקיר קרא את הכול, והכרטיס
 * קרא חצי — ואז מה שנבחר בעריכה לא היה מה שרואים ברשימה.
 *
 * הגובה הוא גוף הארון בלי הרגליים. הרגליים כלולות ב-`defaultHeightMm`,
 * ולכן העברתו כגובה הציור מתחה את החזית על גובה שכולל אותן.
 */
export function CabinetThumbnail({
  item,
  className,
  inside,
}: {
  item: CatalogItem;
  className?: string;
  /** מציג את פנים הארון במקום את החזית */
  inside?: boolean;
}) {
  const u = itemAsUnit(item);
  return (
    <GlyphPreview
      glyph={item.glyph}
      widthMm={item.defaultWidthMm}
      heightMm={Math.max(item.defaultHeightMm - (item.socleMm ?? 0), 1)}
      doors={item.doors}
      drawers={item.drawers}
      drawerCols={item.drawerCols}
      drawerStyle={item.drawerStyle}
      shelves={item.shelves}
      shelfGapsMm={item.shelfGapsMm}
      glassDoors={item.glassDoors}
      handles={item.handles}
      opening={item.opening}
      corner={item.corner}
      blindMm={item.blindMm}
      /* האזורים תמיד, גם כשהם נגזרים משדות פשוטים — כמו על הקיר */
      zones={unitZones(u)}
      inside={inside}
      className={className}
    />
  );
}

/**
 * המידות של הארגז, כפי שנגר קורא אותן: רוחב × גובה × עומק.
 *
 * הכרטיס הראה רוחב בלבד, ורוחב לבדו אינו אומר אם זה עליון או
 * תחתון. הגובה הוא גוף הארון — הרגליים הן התקנה ולא מידת ארגז.
 */
export function cabinetSize(item: CatalogItem): string {
  const body = Math.max(item.defaultHeightMm - (item.socleMm ?? 0), 0);
  return `${cm(item.defaultWidthMm)} × ${cm(body)} × ${cm(item.defaultDepthMm)}`;
}

/**
 * תג "חסר מידע לייצור".
 *
 * הוא יושב ליד הארגז בכל מקום שבו רואים אותו, ולא בהערה שצריך
 * לפתוח: תצוגה יפה נקראת כאישור לייצור, וזו בדיוק הקריאה שצריך
 * למנוע. מה שחסר כתוב במשפט אחד, ולא רק "יש בעיה".
 */
export function ProductionGap(
  { item, className, onFit }: {
    item: CapSource;
    className?: string;
    /**
     * מה לעשות כשאפשר לתקן.
     *
     * אזהרה שאין ממנה דרך החוצה היא באג, לא מידע. במסך יצירת ארגז
     * לא היה שום פקד שבונה נישה או מוסיף משטח, ולכן האזהרה נדלקה
     * ונשארה. כשהמסך יודע להחיל תיקון הוא מוסר את הפונקציה הזו,
     * והיא מקבלת את התפקיד שצריך להיבנות.
     */
    onFit?: (cap: Capability) => void;
  },
) {
  /* אותו מפרט שנשמר, במידות שלו — האזהרה נגזרת מהמבנה ולא מהשם */
  const why = productionGap(item);
  /* ואי־התאמה בין השם למבנה נאמרת בנפרד, כי היא עניין אחר */
  const naming = nameMismatch(item);
  if (!why && !naming) return null;
  const text = why ? `חסר מידע לייצור — ${why}` : naming!;
  /*
   * התפקיד שאפשר לבנות: מה שהאיור מבטיח, ואם אין — מה שהשם מבטיח.
   *
   * פינת L יוצאת מכאן במפורש. אין מידת תקן לגוף שאינו קיים, ולכן
   * אין מה לבנות — וכפתור שבונה נישה ליד אזהרה על פינה היה מתקן
   * משהו אחר מזה שכתוב, ומשאיר את האזהרה על המסך.
   */
  const corner = !!why && !promisedByGlyph(item);
  const cap = corner ? undefined : promisedByGlyph(item) ?? promisedRole(item.name ?? '')?.cap;
  const fix = onFit && cap && fitCapability(item, cap) ? cap : null;
  return (
    <div
      className={`rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-800 ${className ?? ''}`}
    >
      <p title={text}>{text}</p>
      {fix && (
        <button
          type="button"
          onClick={() => onFit!(fix)}
          className="mt-1 rounded-md bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-300"
        >
          התאמה למידות התקן
        </button>
      )}
    </div>
  );
}
