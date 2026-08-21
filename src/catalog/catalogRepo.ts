import { db } from '../db/db';
import type { CatalogItem, CatalogGroup, RoomKind } from '../db/types';
import { SEED_CATALOG, type SeedItem } from './builtins';

/**
 * הספרייה נזרעת לתוך בסיס הנתונים בהפעלה הראשונה, כך שכל פריט —
 * גם כזה שהגיע עם האפליקציה — ניתן לעריכה על ידי המשתמש.
 * זריעה חוזרת מוסיפה רק פריטים חדשים ולא דורסת עריכות קיימות.
 */
let seeding: Promise<void> | null = null;

export function seedCatalog(): Promise<void> {
  seeding ??= runSeed();
  return seeding;
}

async function runSeed(): Promise<void> {
  const existing = new Set((await db.catalog.toArray()).map((i) => i.id));
  const now = Date.now();
  const missing = SEED_CATALOG.filter((s) => !existing.has(s.key)).map((s) =>
    toCatalogItem(s, now, SEED_CATALOG.indexOf(s)),
  );
  // bulkPut ולא bulkAdd — כדי ששתי הפעלות במקביל לא ייפלו על כפילות
  if (missing.length) await db.catalog.bulkPut(missing);
}

function toCatalogItem(s: SeedItem, now: number, order: number): CatalogItem {
  return {
    id: s.key,
    rooms: s.rooms,
    group: s.group,
    name: s.name,
    glyph: s.glyph,
    doors: s.doors,
    drawers: s.drawers,
    level: s.level,
    defaultWidthMm: s.w,
    widthOptionsMm: s.widths,
    defaultHeightMm: s.h,
    defaultDepthMm: s.d,
    defaultYMm: s.y,
    socleMm: s.socle,
    counterMm: s.counter,
    isBuiltin: true,
    sortOrder: order,
    note: s.note,
    createdAt: now,
    updatedAt: now,
  };
}

export const catalogRepo = {
  /** פריטי הספרייה הרלוונטיים לחדר מסוים. חדר בהגדרה אישית מקבל הכול. */
  async forRoom(room: RoomKind): Promise<CatalogItem[]> {
    const all = await db.catalog.toArray();
    const relevant = room === 'custom' ? all : all.filter((i) => i.rooms.includes(room));
    return relevant.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<CatalogItem | undefined> {
    return db.catalog.get(id);
  },

  async saveCustom(input: {
    id?: string;
    rooms: RoomKind[];
    group: CatalogGroup;
    name: string;
    glyph: string;
    doors?: number;
    drawers?: number;
    level: CatalogItem['level'];
    defaultWidthMm: number;
    widthOptionsMm: number[];
    defaultHeightMm: number;
    defaultDepthMm: number;
    defaultYMm: number;
    socleMm?: number;
    counterMm?: number;
    note?: string;
  }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await db.catalog.update(id, { ...rest, updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    await db.catalog.add({
      ...input,
      id,
      isBuiltin: false,
      sortOrder: 1000 + now % 1000,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  /** מחיקה מותרת רק לפריטים שהמשתמש יצר. */
  async removeCustom(id: string): Promise<void> {
    const item = await db.catalog.get(id);
    if (item && !item.isBuiltin) await db.catalog.delete(id);
  },
};
