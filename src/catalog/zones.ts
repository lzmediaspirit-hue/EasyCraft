import { autoShelves } from './CabinetGlyph';
import { glyphDef } from './glyphList';
import type { PlacedUnit, Zone, ZoneColumn, ZoneContent, ZoneKind } from '../db/types';

/**
 * אזורי הפנים של ארון.
 *
 * ארון פשוט מתואר בשדות שטוחים — כמה מדפים, כמה מגירות. ארון מורכב
 * מחולק לאזורים: מגירות למטה, מדפים באמצע, מוט תלייה למעלה. כדי
 * שהשניים יחיו יחד, כל ארון נקרא תמיד כרשימת אזורים: אם הוגדרו
 * אזורים במפורש הם מנצחים, ואחרת הם נגזרים מהשדות השטוחים.
 */

export const ZONE_LABELS: Record<ZoneKind, string> = {
  shelves: 'מדפים',
  drawers: 'מגירות',
  rod: 'מוט תלייה',
  empty: 'חלל פתוח',
};

/** גובה מינימלי לאזור, כדי שלא ייווצר תא שאי אפשר לבנות. */
export const MIN_ZONE_MM = 50;

/** גובה מרבי מומלץ לגוף ארון, בלי הרגליים. */
export const MAX_BODY_MM = 2400;

/** האם האיור הוא ארון שיש לו פנים שאפשר לחלק לאזורים. */
const CONTAINERS = new Set([
  'doors',
  'drawers',
  'doorDrawer',
  'open',
  'shelves',
  'glass',
  'lift',
  'shutter',
  'corner',
  'pantry',
  'hang',
  'hangDouble',
  'sliding',
  'mirror',
  'nightstand',
  'innerDrawers',
  'blindStart',
  'blindEnd',
  'lShape',
]);

export function isContainer(glyph: string): boolean {
  return CONTAINERS.has(glyph);
}

/** ערכי פתיחה סבירים לתוכן, לפי הסוג והגובה שיש לו. */
export function contentDefaults(kind: ZoneKind, heightMm: number): ZoneContent {
  if (kind === 'shelves') return { kind, shelves: Math.max(autoShelves(heightMm), 1) };
  if (kind === 'drawers') return { kind, drawers: 3, drawerCols: 1 };
  return { kind };
}

/**
 * קושרת: מחלקת את האזור למספר עמודות שוות.
 * עמודה שכבר קיימת שומרת על התוכן שלה, כדי ששינוי מספר הקושרות
 * לא ימחק מה שכבר הוגדר בתא.
 */
export function splitZone(zone: Zone, parts = 2): Zone {
  const n = Math.max(parts, 2);
  const existing = zoneColumns(zone);
  const columns: ZoneColumn[] = Array.from({ length: n }, (_, i) => {
    const base =
      existing[i] ?? {
        id: crypto.randomUUID(),
        ...contentDefaults(i === 0 ? zone.kind : 'shelves', zone.heightMm),
      };
    return { ...base, widthShare: 1 / n };
  });
  return { ...zone, columns };
}

/** מבטל את הקושרת ומחזיר את האזור לתא אחד. */
export function mergeZone(zone: Zone): Zone {
  const first = zoneColumns(zone)[0];
  const { columns: _drop, ...rest } = zone;
  return first ? { ...rest, ...stripColumn(first) } : rest;
}

function stripColumn(c: ZoneColumn): ZoneContent {
  const { id: _id, widthShare: _w, ...content } = c;
  return content;
}

/** העמודות של האזור, או רשימה ריקה כשאין קושרת. */
export function zoneColumns(zone: Zone): ZoneColumn[] {
  return (zone.columns?.length ?? 0) > 1 ? zone.columns! : [];
}

/**
 * התאים של האזור — מה שבאמת יושב בתוכו.
 * אזור בלי קושרת הוא תא אחד ברוחב מלא; אזור עם קושרת מחזיר תא לכל
 * עמודה, עם החלק היחסי שלה ברוחב. כך כל חישוב וכל ציור עובדים על
 * אותה רשימה בלי לדעת אם יש קושרת.
 */
export function zoneCells(zone: Zone): { content: ZoneContent; share: number; key: string }[] {
  const cols = zoneColumns(zone);
  if (!cols.length) return [{ content: zone, share: 1, key: zone.id }];
  const total = cols.reduce((a, c) => a + (c.widthShare || 0), 0) || cols.length;
  return cols.map((c) => ({
    content: c,
    share: (c.widthShare || 1) / total,
    key: c.id,
  }));
}

/** כל התאים בארון, מכל האזורים. */
export function unitCells(u: FlatSource): { content: ZoneContent; share: number }[] {
  return unitZones(u).flatMap((z) => zoneCells(z));
}

type FlatSource = Pick<
  PlacedUnit,
  | 'glyph'
  | 'heightMm'
  | 'shelves'
  | 'shelfGapsMm'
  | 'drawers'
  | 'drawerCols'
  | 'drawerStyle'
  | 'zones'
> &
  Partial<Pick<PlacedUnit, 'doors' | 'doorCells' | 'doubleDividers'>>;

/**
 * לכמה תאים הארגז מתחלק בקושרות, כשלא נקבע במפורש.
 *
 * דלת נתפסת על משהו: על צד הארגז או על קושרת. עד שתי דלתות יש
 * לכל אחת צד משלה; משלוש והלאה חייבת להיות קושרת ביניהן, ולכן
 * ארבע דלתות מקבלות קושרת אחת במרכז ושני תאים.
 */
export function doorCells(u: FlatSource): number {
  if (u.doorCells !== undefined) return Math.max(u.doorCells, 1);
  const doors = u.doors ?? 0;
  return doors >= 3 ? Math.ceil(doors / 2) : 1;
}

/**
 * מחלק אזור לתאים לפי הקושרות שהדלתות מחייבות.
 * אזור שכבר חולק ידנית לא נוגעים בו — הבחירה של הנגר גוברת — ואזור
 * של מגירות חיצוניות גם לא, כי שם החלוקה נעשית בעמודות המגירה.
 */
function splitByDoors(zones: Zone[], n: number): Zone[] {
  if (n < 2) return zones;
  return zones.map((z) => {
    if (zoneColumns(z).length) return z;
    if (z.kind === 'drawers' && z.drawerStyle !== 'inner') return z;
    const { columns: _drop, id, heightMm, fixedHeight, ...content } = z;
    return {
      id,
      heightMm,
      fixedHeight,
      ...content,
      columns: Array.from({ length: n }, (_, i) => ({
        ...content,
        id: `${id}-door-${i}`,
        widthShare: 1 / n,
      })),
    };
  });
}

/** קורא את הארון כרשימת אזורים, בין אם הוגדרו במפורש ובין אם לא. */
export function unitZones(u: FlatSource): Zone[] {
  const base = u.zones?.length ? normalizeHeights(u.zones, u.heightMm) : derive(u);
  return splitByDoors(base, doorCells(u));
}

/**
 * מותח את האזורים לגובה הארון.
 *
 * אזור עם גובה קבוע לא נוגעים בו — מתקן תלייה צריך 120 ס"מ ומגירה
 * פנימית צריכה 90, וגובה כזה אינו נתון למשא ומתן. השאר מתחלקים
 * במה שנשאר. כשהקבועים לבדם גדולים מהארון, `requiredBody` מחזיר
 * את הגובה שהארון צריך לגדול אליו.
 */
export function normalizeHeights(zones: Zone[], heightMm: number): Zone[] {
  const flex = zones.filter((z) => !z.fixedHeight);
  const fixedTotal = zones.filter((z) => z.fixedHeight).reduce((a, z) => a + z.heightMm, 0);

  // הכול קבוע, או שאין מקום לגמישים — הגבהים נשארים כפי שהם
  if (!flex.length) return zones.map((z) => ({ ...z }));
  const rest = heightMm - fixedTotal;
  if (rest < flex.length * MIN_ZONE_MM) {
    return zones.map((z) => ({ ...z, heightMm: z.fixedHeight ? z.heightMm : MIN_ZONE_MM }));
  }

  const flexTotal = flex.reduce((a, z) => a + z.heightMm, 0);
  return zones.map((z) => {
    if (z.fixedHeight) return { ...z };
    const share = flexTotal > 0 ? z.heightMm / flexTotal : 1 / flex.length;
    return { ...z, heightMm: Math.max(Math.round(rest * share), MIN_ZONE_MM) };
  });
}

/**
 * גובה הגוף שהאזורים מחייבים.
 * כשכל האזורים קבועים — או כשהקבועים לבדם לא נכנסים — הארון גדל
 * במקום לדחוס תוכן שיש לו מידה אמיתית.
 */
export function requiredBody(zones: Zone[], bodyMm: number): number {
  const flex = zones.filter((z) => !z.fixedHeight);
  const fixedTotal = zones.filter((z) => z.fixedHeight).reduce((a, z) => a + z.heightMm, 0);
  if (!flex.length) return Math.max(fixedTotal, MIN_ZONE_MM);
  return Math.max(bodyMm, fixedTotal + flex.length * MIN_ZONE_MM);
}

function derive(u: FlatSource): Zone[] {
  const h = u.heightMm;
  const id = (k: string) => `derived-${k}`;

  if (u.glyph === 'hang') {
    return [{ id: id('rod'), kind: 'rod', heightMm: h }];
  }
  if (u.glyph === 'hangDouble') {
    return [
      { id: id('rod1'), kind: 'rod', heightMm: h / 2 },
      { id: id('rod2'), kind: 'rod', heightMm: h / 2 },
    ];
  }

  const rows = u.drawers ?? 0;
  if (rows > 0 && u.glyph === 'doorDrawer') {
    const band = Math.min(h * 0.22, h / (rows + 1)) * rows;
    /* הראשון ברשימה הוא התחתון: הדלת למטה, והמגירה מעליה */
    return [
      {
        id: id('shelves'),
        kind: 'shelves',
        heightMm: h - band,
        shelves: u.shelves ?? autoShelves(h - band),
        shelfGapsMm: u.shelfGapsMm,
      },
      {
        id: id('drawers'),
        kind: 'drawers',
        heightMm: band,
        drawers: rows,
        drawerCols: u.drawerCols,
        drawerStyle: u.drawerStyle,
      },
    ];
  }
  if (rows > 0) {
    return [
      {
        id: id('drawers'),
        kind: 'drawers',
        heightMm: h,
        drawers: rows,
        drawerCols: u.drawerCols,
        drawerStyle: u.drawerStyle,
      },
    ];
  }

  /*
   * מדפים מאליהם רק לארון שיש לו מדפים. נישה למקרר או לתנור אינה
   * ארון — מי שכן רוצה שם מדף יגדיר אותו, אבל הוא לא ייספר בחומרים
   * רק מפני שהצורה נראית כמו ארגז.
   */
  const auto = glyphDef(u.glyph).shelves ? autoShelves(h) : 0;
  const shelves = u.shelves ?? auto;
  return [
    {
      id: id('shelves'),
      kind: shelves > 0 ? 'shelves' : 'empty',
      heightMm: h,
      shelves,
      shelfGapsMm: u.shelfGapsMm,
    },
  ];
}

/** גבולות כל אזור בקואורדינטות הציור, שבהן y גדל כלפי מטה. */
export function zoneBands(
  zones: Zone[],
  heightMm: number,
): { zone: Zone; top: number; bottom: number }[] {
  // הגבהים עשויים לחרוג מהמסגרת כשכולם קבועים; הציור מתאים את עצמו
  // לסכום האמיתי, כדי שהאזורים תמיד ימלאו בדיוק את הארון שעל המסך
  const fitted = normalizeHeights(zones, heightMm);
  const sum = fitted.reduce((a, z) => a + z.heightMm, 0);
  const scaled =
    sum > 0 && Math.abs(sum - heightMm) > 1
      ? fitted.map((z) => ({ ...z, heightMm: (z.heightMm / sum) * heightMm }))
      : fitted;
  const out: { zone: Zone; top: number; bottom: number }[] = [];
  // האזור הראשון ברשימה הוא התחתון בארון
  let fromBottom = 0;
  for (const zone of scaled) {
    const bottom = heightMm - fromBottom;
    fromBottom += zone.heightMm;
    out.push({ zone, top: heightMm - fromBottom, bottom });
  }
  return out;
}

/** סך המגירות בארון, מכל התאים. */
export function countDrawers(u: FlatSource): number {
  return unitCells(u).reduce(
    (n, { content: c }) =>
      n + (c.kind === 'drawers' ? (c.drawers ?? 0) * Math.max(c.drawerCols ?? 1, 1) : 0),
    0,
  );
}

/** סך המדפים בארון, מכל התאים. */
export function countShelves(u: FlatSource): number {
  return unitCells(u).reduce(
    (n, { content: c }) => n + (c.kind === 'shelves' ? (c.shelves ?? 0) : 0),
    0,
  );
}

/** סך מוטות התלייה בארון. */
/**
 * מסיר עמודה אחת מהאזור, ומחלק את הרוחב שלה בין הנותרות.
 * כשנשארת עמודה אחת אין יותר קושרת, והאזור חוזר להיות תא יחיד.
 */
export function removeColumn(zone: Zone, columnId: string): Zone {
  const rest = zoneColumns(zone).filter((c) => c.id !== columnId);
  if (rest.length < 2) {
    const first = rest[0];
    const { columns: _drop, ...bare } = zone;
    return first ? { ...bare, ...stripColumn(first) } : bare;
  }
  const total = rest.reduce((a, c) => a + (c.widthShare || 0), 0) || rest.length;
  return { ...zone, columns: rest.map((c) => ({ ...c, widthShare: (c.widthShare || 1) / total })) };
}

/**
 * מוסיף מדף מפריד בתוך אזור: האזור נחצה לשניים באותו תוכן.
 * זו הפעולה שהנגר עושה בראש — "שמים מדף, נוצרים שני תאים" —
 * ולכן היא הפעולה שהעורך מציע, ולא "הוסף אזור" מופשט.
 */
export function splitByShelf(zone: Zone): [Zone, Zone] {
  const half = Math.round(zone.heightMm / 2);
  const bare = (id: string, heightMm: number): Zone => ({
    ...zone,
    id,
    heightMm,
    fixedHeight: undefined,
  });
  return [bare(crypto.randomUUID(), zone.heightMm - half), bare(crypto.randomUUID(), half)];
}

/** תיאור קצר של תוכן תא, לשורה שמוצגת בלי להיכנס אליה. */
export function contentSummary(c: ZoneContent): string {
  if (c.kind === 'shelves') {
    const n = c.shelves ?? 0;
    if (n === 0) return 'בלי מדפים';
    return `${n} ${n === 1 ? 'מדף' : 'מדפים'}${c.glassShelves ? ' · זכוכית' : ''}`;
  }
  if (c.kind === 'drawers') {
    const rows = c.drawers ?? 0;
    const cols = Math.max(c.drawerCols ?? 1, 1);
    const total = rows * cols;
    return `${total} ${total === 1 ? 'מגירה' : 'מגירות'}${
      c.drawerStyle === 'inner' ? ' · פנימיות' : ''
    }`;
  }
  if (c.kind === 'rod') return 'מוט תלייה';
  return 'חלל פתוח';
}
