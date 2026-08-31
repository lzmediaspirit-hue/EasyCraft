import { db } from '../db/db';
import type { Board, BoardRole, Finish, ProjectPrice, Settings } from '../db/types';

/** הגדרות ברירת מחדל, עד שהמשתמש משנה אותן במסך ההגדרות. */
export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  sheetWidthMm: 2800,
  sheetHeightMm: 2070,
  kerfMm: 4,
  carcassThicknessMm: 18,
  yieldPct: 85,
  backGrooveMm: 8,
  frontGapMm: 3,
  accessories: {
    drawerFactory: 0,
    // תוספת סטנדרטית לכל מגירה
    drawerConsumer: 500,
    ledFactory: 0,
    ledConsumer: 0,
    liftFactory: 0,
    liftConsumer: 0,
  },
  extras: [],
  glassFactoryPerM2: 0,
  glassConsumerPerM2: 0,
  updatedAt: 0,
};

/** הלוחות שכל נגרייה עובדת איתם, כנקודת פתיחה. */
const SEED_BOARDS: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'סנדוויץ׳',
    role: 'carcass',
    hasGrain: false,
    factoryPrice: 0,
    consumerPrice: 120,
    sortOrder: 0,
  },
  {
    name: 'MDF',
    role: 'front',
    hasGrain: false,
    factoryPrice: 0,
    consumerPrice: 400,
    sortOrder: 1,
  },
  {
    name: 'גב 5 מ״מ',
    role: 'back',
    hasGrain: false,
    factoryPrice: 0,
    consumerPrice: 80,
    sortOrder: 2,
  },
];

let seeding: Promise<void> | null = null;

/** זריעה חד-פעמית של הלוחות וההגדרות. */
export function seedMaterials(): Promise<void> {
  seeding ??= runSeed();
  return seeding;
}

async function runSeed(): Promise<void> {
  const now = Date.now();
  if ((await db.settings.get('app')) === undefined) {
    await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: now });
  }
  if ((await db.boards.count()) === 0) {
    await db.boards.bulkPut(
      SEED_BOARDS.map((b) => ({ ...b, id: crypto.randomUUID(), createdAt: now, updatedAt: now })),
    );
  }
}

export const settingsRepo = {
  async get(): Promise<Settings> {
    const stored = await db.settings.get('app');
    // מיזוג עם ברירות המחדל, כדי שהגדרות שנוספו בגרסה חדשה לא יחזרו ריקות
    return stored
      ? {
          ...DEFAULT_SETTINGS,
          ...stored,
          accessories: { ...DEFAULT_SETTINGS.accessories, ...stored.accessories },
          extras: stored.extras ?? [],
        }
      : DEFAULT_SETTINGS;
  },
  async save(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
    const current = await settingsRepo.get();
    await db.settings.put({ ...current, ...patch, id: 'app', updatedAt: Date.now() });
  },
};

export const boardsRepo = {
  async list(): Promise<Board[]> {
    const rows = await db.boards.toArray();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<Board | undefined> {
    return db.boards.get(id);
  },

  /** הלוח שמשמש לתפקיד מסוים. הראשון לפי הסדר הוא ברירת המחדל. */
  async forRole(role: BoardRole): Promise<Board | undefined> {
    const rows = await boardsRepo.list();
    return rows.find((b) => b.role === role);
  },

  async save(input: Partial<Board> & { name: string; role: BoardRole }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await db.boards.update(id, { ...rest, updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    const count = await db.boards.count();
    await db.boards.add({
      hasGrain: false,
      factoryPrice: 0,
      consumerPrice: 0,
      sortOrder: count,
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.boards, db.finishes, async () => {
      await db.finishes.where('boardId').equals(id).delete();
      await db.boards.delete(id);
    });
  },
};

export const finishesRepo = {
  async listForBoard(boardId: string): Promise<Finish[]> {
    const rows = await db.finishes.where('boardId').equals(boardId).toArray();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async all(): Promise<Finish[]> {
    return db.finishes.toArray();
  },

  async get(id: string): Promise<Finish | undefined> {
    return db.finishes.get(id);
  },

  async save(input: Partial<Finish> & { boardId: string; name: string; hex: string }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await db.finishes.update(id, { ...rest, updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    const count = await db.finishes.where('boardId').equals(input.boardId).count();
    await db.finishes.add({ sortOrder: count, ...input, id, createdAt: now, updatedAt: now });
    return id;
  },

  async remove(id: string): Promise<void> {
    await db.finishes.delete(id);
  },
};

export const projectPricesRepo = {
  async listForProject(projectId: string): Promise<ProjectPrice[]> {
    return db.projectPrices.where('projectId').equals(projectId).toArray();
  },

  /** קובע מחיר שונה ללוח בפרויקט מסוים, או מנקה אותו כששני השדות ריקים. */
  async set(
    projectId: string,
    boardId: string,
    prices: { factoryPrice?: number; consumerPrice?: number },
  ): Promise<void> {
    const existing = (await db.projectPrices.where('projectId').equals(projectId).toArray()).find(
      (p) => p.boardId === boardId,
    );
    const empty = prices.factoryPrice === undefined && prices.consumerPrice === undefined;
    const now = Date.now();

    if (existing) {
      if (empty) await db.projectPrices.delete(existing.id);
      else await db.projectPrices.update(existing.id, { ...prices, updatedAt: now });
      return;
    }
    if (empty) return;
    await db.projectPrices.add({
      id: crypto.randomUUID(),
      projectId,
      boardId,
      ...prices,
      createdAt: now,
      updatedAt: now,
    });
  },
};
