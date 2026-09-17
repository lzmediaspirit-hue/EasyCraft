import { GlyphPreview } from './GlyphPreview';
import { unitZones } from './zones';
import type { CatalogItem } from '../db/types';
import { cm } from '../ui/units';

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
