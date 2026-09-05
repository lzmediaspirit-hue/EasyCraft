import { db } from '../db/db';
import type {
  Finish,
  Material,
  PartChoice,
  ProjectPrice,
  Settings,
  StockItem,
} from '../db/types';

/** הגדרות ברירת מחדל, עד שהמשתמש משנה אותן במסך ההגדרות. */
export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  sheetWidthMm: 2440,
  sheetHeightMm: 1220,
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
  vatPct: 18,
  edgeFactoryPerM: 0,
  edgeConsumerPerM: 0,
  defaultBackKind: 'thin',
  updatedAt: 0,
};

/**
 * החומרים שכל נגרייה עובדת איתם, כנקודת פתיחה.
 * הרשימה קצרה ובקושי משתנה — מה שגדל הוא רשימת הגוונים.
 */
const SEED_MATERIALS: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'סנדוויץ׳', sheetWidthMm: 1220, sheetHeightMm: 2440, thicknessMm: 18, sortOrder: 0 },
  { name: 'MDF', sheetWidthMm: 1220, sheetHeightMm: 2440, thicknessMm: 18, sortOrder: 1 },
  { name: 'דיקט 5 מ״מ', sheetWidthMm: 1220, sheetHeightMm: 2440, thicknessMm: 5, sortOrder: 2 },
];

/**
 * גוונים לפתיחה, עם מחיר לכל חומר.
 * המספרים הם מחירון סביר ולא הבטחה: הם קיימים כדי שהחישוב הראשון
 * ייתן מספר אמיתי, והנגר יתקן אותם למחירים שלו.
 */
const SEED_FINISHES: {
  name: string;
  hex: string;
  hasGrain?: boolean;
  /** מחיר לצרכן לכל חומר, לפי סדר החומרים שנזרעו */
  byIndex: (number | undefined)[];
}[] = [
  { name: 'לבן', hex: '#f5f4f1', byIndex: [120, 380, 80] },
  { name: 'אפור בטון', hex: '#9c9a95', byIndex: [140, 420, undefined] },
  { name: 'אלון טבעי', hex: '#c9a227', hasGrain: true, byIndex: [190, 520, undefined] },
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
  if ((await db.materials.count()) === 0) {
    const materials = SEED_MATERIALS.map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    await db.materials.bulkPut(materials);

    // הגוונים נזרעים רק יחד עם החומרים, כי המחיר תלוי בהם
    if ((await db.finishes.count()) === 0) {
      await db.finishes.bulkPut(
        SEED_FINISHES.map((f, i) => ({
          id: crypto.randomUUID(),
          name: f.name,
          hex: f.hex,
          hasGrain: f.hasGrain,
          prices: f.byIndex.reduce<Record<string, { consumerPrice: number }>>(
            (acc, price, k) => {
              if (price !== undefined) acc[materials[k].id] = { consumerPrice: price };
              return acc;
            },
            {},
          ),
          sortOrder: i,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
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

export const materialsRepo = {
  async list(): Promise<Material[]> {
    const rows = await db.materials.toArray();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<Material | undefined> {
    return db.materials.get(id);
  },

  async save(input: Partial<Material> & { name: string }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await db.materials.update(id, { ...rest, updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    const count = await db.materials.count();
    await db.materials.add({
      sheetWidthMm: 1220,
      sheetHeightMm: 2440,
      sortOrder: count,
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  /**
   * מחיקת חומר, יחד עם המחירים שנקבעו לו בגוונים.
   * גוון שנשאר בלי אף מחיר עדיין קיים — הוא פשוט לא זמין לשום
   * חומר עד שיינתן לו מחיר.
   */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.materials, db.finishes, async () => {
      await db.finishes.toCollection().modify((f) => {
        if (f.prices?.[id]) {
          const { [id]: _drop, ...rest } = f.prices;
          f.prices = rest;
        }
      });
      await db.materials.delete(id);
    });
  },
};

export const finishesRepo = {
  async all(): Promise<Finish[]> {
    const rows = await db.finishes.toArray();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /** הגוונים שקיימים על חומר מסוים — כלומר שנקבע להם מחיר עליו. */
  async forMaterial(materialId: string): Promise<Finish[]> {
    return (await finishesRepo.all()).filter((f) => f.prices?.[materialId] !== undefined);
  },

  async get(id: string): Promise<Finish | undefined> {
    return db.finishes.get(id);
  },

  async save(input: Partial<Finish> & { name: string; hex: string }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await db.finishes.update(id, { ...rest, updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    const count = await db.finishes.count();
    await db.finishes.add({
      prices: {},
      sortOrder: count,
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async remove(id: string): Promise<void> {
    await db.finishes.delete(id);
  },
};

export const stockRepo = {
  async all(): Promise<StockItem[]> {
    return db.stock.toArray();
  },

  /**
   * קובע כמה יש וכמה הוזמן לצירוף של גוון וחומר.
   * שורה שהתרוקנה לגמרי נמחקת — מלאי אפס בלי הזמנה הוא פשוט "אין",
   * ורשומה ריקה רק מלכלכת את הרשימה.
   */
  async set(
    finishId: string,
    materialId: string,
    patch: { sheets?: number; ordered?: number; edgeInStock?: boolean },
  ): Promise<void> {
    const rows = await db.stock.toArray();
    const existing = rows.find((r) => r.finishId === finishId && r.materialId === materialId);
    const now = Date.now();
    const next = {
      sheets: patch.sheets ?? existing?.sheets ?? 0,
      ordered: patch.ordered ?? existing?.ordered ?? 0,
      edgeInStock: patch.edgeInStock ?? existing?.edgeInStock,
    };
    const empty = next.sheets === 0 && next.ordered === 0 && !next.edgeInStock;

    if (existing) {
      if (empty) await db.stock.delete(existing.id);
      else await db.stock.update(existing.id, { ...next, updatedAt: now });
      return;
    }
    if (empty) return;
    await db.stock.add({
      id: crypto.randomUUID(),
      finishId,
      materialId,
      ...next,
      createdAt: now,
      updatedAt: now,
    });
  },
};

/** מפתח שורת התמחור: אותו גוון על שני חומרים הוא שתי שורות הזמנה. */
export function lineKey(choice: PartChoice): string {
  return `${choice.finishId ?? ''}:${choice.materialId ?? ''}`;
}

export const projectPricesRepo = {
  async listForProject(projectId: string): Promise<ProjectPrice[]> {
    return db.projectPrices.where('projectId').equals(projectId).toArray();
  },

  /** קובע מחיר שונה לשורת גוון וחומר בפרויקט מסוים, או מנקה אותו. */
  async set(
    projectId: string,
    key: string,
    prices: { factoryPrice?: number; consumerPrice?: number },
  ): Promise<void> {
    const existing = (await db.projectPrices.where('projectId').equals(projectId).toArray()).find(
      (p) => p.lineKey === key,
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
      lineKey: key,
      ...prices,
      createdAt: now,
      updatedAt: now,
    });
  },
};
