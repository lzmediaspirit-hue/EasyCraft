import { autoShelves } from './CabinetGlyph';
import type { PlacedUnit, Zone, ZoneKind } from '../db/types';

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

export function newZone(kind: ZoneKind, heightMm: number): Zone {
  return {
    id: crypto.randomUUID(),
    kind,
    heightMm,
    ...(kind === 'shelves' ? { shelves: Math.max(autoShelves(heightMm), 1) } : {}),
    ...(kind === 'drawers' ? { drawers: 3, drawerCols: 1 } : {}),
  };
}

type FlatSource = Pick<
  PlacedUnit,
  'glyph' | 'heightMm' | 'shelves' | 'shelfGapsMm' | 'drawers' | 'drawerCols' | 'drawerStyle' | 'zones'
>;

/** קורא את הארון כרשימת אזורים, בין אם הוגדרו במפורש ובין אם לא. */
export function unitZones(u: FlatSource): Zone[] {
  if (u.zones?.length) return normalizeHeights(u.zones, u.heightMm);
  return derive(u);
}

/** האם הארון מחולק ידנית ליותר מאזור אחד. */
export function isZoned(u: FlatSource): boolean {
  return (u.zones?.length ?? 0) > 1;
}

/** גובה כל אזור נמתח יחסית, כדי שסכום האזורים תמיד שווה לגובה הארון. */
export function normalizeHeights(zones: Zone[], heightMm: number): Zone[] {
  const total = zones.reduce((a, z) => a + z.heightMm, 0);
  if (total <= 0) {
    const each = Math.round(heightMm / zones.length);
    return zones.map((z) => ({ ...z, heightMm: each }));
  }
  return zones.map((z) => ({ ...z, heightMm: Math.round((z.heightMm / total) * heightMm) }));
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
    return [
      {
        id: id('drawers'),
        kind: 'drawers',
        heightMm: band,
        drawers: rows,
        drawerCols: u.drawerCols,
        drawerStyle: u.drawerStyle,
      },
      {
        id: id('shelves'),
        kind: 'shelves',
        heightMm: h - band,
        shelves: u.shelves ?? autoShelves(h - band),
        shelfGapsMm: u.shelfGapsMm,
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

  const shelves = u.shelves ?? autoShelves(h);
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
  const scaled = normalizeHeights(zones, heightMm);
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

/** סך המגירות בארון, מכל האזורים. */
export function countDrawers(u: FlatSource): number {
  return unitZones(u).reduce(
    (n, z) => n + (z.kind === 'drawers' ? (z.drawers ?? 0) * Math.max(z.drawerCols ?? 1, 1) : 0),
    0,
  );
}

/** סך המדפים בארון, מכל האזורים. */
export function countShelves(u: FlatSource): number {
  return unitZones(u).reduce((n, z) => n + (z.kind === 'shelves' ? (z.shelves ?? 0) : 0), 0);
}

/** סך מוטות התלייה בארון. */
export function countRods(u: FlatSource): number {
  return unitZones(u).filter((z) => z.kind === 'rod').length;
}
