import { allMine, eraseIds, mine, owned, patchRow } from '../db/rows';
import { db } from '../db/db';
import { workshopId } from '../db/workshop';
import { SHIPPED_FINISHES, SHIPPED_MATERIALS } from '../catalog/shipped';

import { KITCHEN } from '../catalog/standards';
import { CORES } from '../db/types';
import type {
  CoreKind,
  Finish,
  Material,
  Offcut,
  ProjectPrice,
  Settings,
  StockItem,
} from '../db/types';

/** הגדרות ברירת מחדל, עד שהמשתמש משנה אותן במסך ההגדרות. */
/*
 * ההגדרות הן של הנגרייה, ולא של האפליקציה.
 *
 * הן ישבו תחת מזהה קבוע אחד — `'app'` — ולכן שתי נגריות באותו
 * מכשיר היו חולקות מחירון, מידות לוח ואחוז פחת. המזהה הוא מזהה
 * הנגרייה, והשורה הישנה נרשמה על המקומית במעבר.
 */
const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  workshopId: '',
  rev: 1,
  createdAt: 0,
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
  /*
   * המידות שחוזרות בכל פרויקט. הערכים כאן הם התקן שרוב הנגריות
   * עובדות בו, והם נקודת פתיחה — כל אחד מהם ניתן לשינוי במסך אחד.
   */
  defaults: {
    socleMm: KITCHEN.socleH,
    /*
     * גובה המשטח ועוביו — כפי שהספרייה שהנגרייה בנתה עובדת בפועל.
     *
     * `KITCHEN.counterTop` הוא 90 ס״מ, התקן שהזרע הישן נבנה לפיו.
     * הספרייה החדשה בנויה אחרת: רוב הארגזים התחתונים בה הם גוף 90
     * ומשטח 3, כלומר ראש ב-93. ברירת מחדל שסותרת את הספרייה הייתה
     * מקצרת כל ארגז חדש בשלושה סנטימטרים ביום שבו ההגדרה מתחילה
     * לשלוט, ולכן היא נלקחת מהספרייה ולא מהקבוע.
     */
    counterTopMm: 930,
    counterMm: 30,
    baseDepthMm: KITCHEN.baseDepth,
    upperDepthMm: KITCHEN.upperDepth,
    upperBottomMm: KITCHEN.upperBottom,
    wallLengthMm: 3000,
    wallHeightMm: 2600,
    backKind: 'thin',
    drawerBox: 'metal',
  },
  updatedAt: 0,
};

/**
 * הליבות שכל נגרייה עובדת איתן, כנקודת פתיחה.
 *
 * שלוש שורות ולא יותר: הגוף מסנדוויץ׳, החזיתות מ-MDF, הגב מדיקט.
 * זו נקודת הפתיחה ולא כלל — מי שמוסיף MDF בעובי אחר או ליבה בצבע
 * אחר מוסיף שורה, וכל שורה כאן היא לוח שאפשר להצביע עליו במחסן.
 */
const SEED_MATERIALS: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'workshopId' | 'rev'>[] = [
  {
    name: 'סנדוויץ׳ 17 מ״מ',
    core: 'sandwich',
    roles: ['carcass'],
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 17,
    sortOrder: 0,
  },
  {
    name: 'MDF חום 18 מ״מ',
    core: 'mdf',
    coreColor: 'חום',
    roles: ['front', 'exposed'],
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 18,
    sortOrder: 1,
  },
  {
    name: 'דיקט 5 מ״מ',
    core: 'plywood',
    roles: ['back'],
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 5,
    sortOrder: 2,
  },
];

/**
 * שם הלוח מהחלקים שלו: ליבה, צבע ליבה ועובי.
 *
 * השם אינו שדה חופשי שנכתב מחדש בכל פעם אלא תיאור של מה שנבחר,
 * כדי ש"MDF שחור 18" יישמע אותו דבר אצל כל מי שיוסיף אותו. מי
 * שרוצה שם משלו עדיין יכול לכתוב אותו.
 */
export function boardName(input: {
  core?: CoreKind;
  coreColor?: string;
  thicknessMm?: number;
}): string {
  const core = CORES.find((c) => c.key === input.core);
  return [core?.label, input.coreColor, input.thicknessMm ? `${input.thicknessMm} מ״מ` : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * גוונים לפתיחה, עם מחיר לכל חומר.
 * המספרים הם מחירון סביר ולא הבטחה: הם קיימים כדי שהחישוב הראשון
 * ייתן מספר אמיתי, והנגר יתקן אותם למחירים שלו.
 */
const SEED_FINISHES: {
  name: string;
  hex: string;
  hasGrain?: boolean;
  texture?: string;
  /** מחיר לצרכן לכל חומר, לפי סדר החומרים שנזרעו */
  byIndex: (number | undefined)[];
}[] = [
  { name: 'לבן', hex: '#f5f4f1', texture: 'מט', byIndex: [120, 380, 80] },
  { name: 'אפור בטון', hex: '#9c9a95', texture: 'סטון', byIndex: [140, 420, undefined] },
  {
    name: 'אלון טבעי',
    hex: '#c9a227',
    hasGrain: true,
    texture: 'יער',
    byIndex: [190, 520, undefined],
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
  if (!(await settingsRow())) {
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      id: workshopId(),
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
  }
  if ((await allMine(db.materials)).length === 0) {
    /*
     * ספרייה שנבנתה בנגרייה מגיעה עם הלוחות והגוונים שלה, ואז הם
     * אלה שנזרעים — עם המזהים המקוריים שלהם, כי הארגזים מפנים אליהם.
     * בלי זה כל ארגז שנבנה עם גוון מפורש היה מגיע למכשיר חדש עם
     * הפניה לגוון שאינו קיים.
     */
    if (SHIPPED_MATERIALS.length) {
      await db.materials.bulkPut(
        SHIPPED_MATERIALS.map((m) => ({ ...m, ...owned(), createdAt: now, updatedAt: now })),
      );
      if ((await allMine(db.finishes)).length === 0 && SHIPPED_FINISHES.length) {
        await db.finishes.bulkPut(
          SHIPPED_FINISHES.map((f) => ({ ...f, ...owned(), createdAt: now, updatedAt: now })),
        );
      }
      return;
    }
    const materials = SEED_MATERIALS.map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      ...owned(),
      createdAt: now,
      updatedAt: now,
    }));
    await db.materials.bulkPut(materials);

    // הגוונים נזרעים רק יחד עם החומרים, כי המחיר תלוי בהם
    if ((await allMine(db.finishes)).length === 0) {
      await db.finishes.bulkPut(
        SEED_FINISHES.map((f, i) => ({
          id: crypto.randomUUID(),
          name: f.name,
          hex: f.hex,
          hasGrain: f.hasGrain,
          texture: f.texture,
          prices: f.byIndex.reduce<Record<string, { consumerPrice: number }>>(
            (acc, price, k) => {
              if (price !== undefined) acc[materials[k].id] = { consumerPrice: price };
              return acc;
            },
            {},
          ),
          sortOrder: i,
          ...owned(),
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  }
}

/** שורת ההגדרות של הנגרייה הפעילה, אם כבר נשמרה. */
async function settingsRow(): Promise<Settings | undefined> {
  const byId = await db.settings.get(workshopId());
  if (byId) return byId;
  /* המעבר הטביע את השורה הישנה ולא שינה את מזהה שלה */
  return (await allMine(db.settings))[0];
}

export const settingsRepo = {
  async get(): Promise<Settings> {
    const stored = await settingsRow();
    // מיזוג עם ברירות המחדל, כדי שהגדרות שנוספו בגרסה חדשה לא יחזרו ריקות
    return stored
      ? {
          ...DEFAULT_SETTINGS,
          ...stored,
          accessories: { ...DEFAULT_SETTINGS.accessories, ...stored.accessories },
          defaults: { ...DEFAULT_SETTINGS.defaults, ...stored.defaults },
          extras: stored.extras ?? [],
        }
      : DEFAULT_SETTINGS;
  },
  async save(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
    const current = await settingsRow();
    const base = await settingsRepo.get();
    await db.settings.put({
      ...base,
      ...patch,
      id: current?.id ?? workshopId(),
      workshopId: workshopId(),
      rev: (current?.rev ?? 0) + 1,
      createdAt: current?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  },
};

export const materialsRepo = {
  async list(): Promise<Material[]> {
    const rows = await allMine(db.materials);
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<Material | undefined> {
    const row = await db.materials.get(id);
    return row && mine(row) ? row : undefined;
  },

  async save(input: Partial<Material> & { name: string }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await patchRow(db.materials, id, rest);
      return id;
    }
    const id = crypto.randomUUID();
    const count = (await allMine(db.materials)).length;
    await db.materials.add({
      sheetWidthMm: 1220,
      sheetHeightMm: 2440,
      sortOrder: count,
      ...input,
      id,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  /**
   * כמה ארגזים משתמשים בלוח הזה — בפרויקטים, בספרייה ובברירות המחדל.
   *
   * לוח שנמחק בזמן שהוא מוצמד לארגזים משאיר אחריו הפניות ריקות:
   * החלקים שלו יוצאים מהתמחור בלי שאיש רואה, והצעת מחיר יוצאת
   * נמוכה. לכן המחיקה נעצרת כאן ולא מתגלה בהצעה.
   */
  async usage(id: string): Promise<number> {
    const hits = (r: {
      carcassMaterialId?: string;
      frontMaterialId?: string;
      exposedMaterialId?: string;
      backMaterialId?: string;
    }) =>
      r.carcassMaterialId === id ||
      r.frontMaterialId === id ||
      r.exposedMaterialId === id ||
      r.backMaterialId === id;

    const [units, catalog, projects] = await Promise.all([
      db.units.toArray(),
      db.catalog.toArray(),
      db.projects.toArray(),
    ]);
    return (
      units.filter(hits).length +
      catalog.filter(hits).length +
      projects.filter((p) => Object.values(p.defaults ?? {}).some((c) => c?.materialId === id))
        .length
    );
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
      await eraseIds(db.materials, [id]);
    });
  },
};

export const finishesRepo = {
  async all(): Promise<Finish[]> {
    const rows = await allMine(db.finishes);
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /** הגוונים שקיימים על חומר מסוים — כלומר שנקבע להם מחיר עליו. */
  async forMaterial(materialId: string): Promise<Finish[]> {
    return (await finishesRepo.all()).filter((f) => f.prices?.[materialId] !== undefined);
  },

  async get(id: string): Promise<Finish | undefined> {
    const row = await db.finishes.get(id);
    return row && mine(row) ? row : undefined;
  },

  async save(input: Partial<Finish> & { name: string; hex: string }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await patchRow(db.finishes, id, rest);
      return id;
    }
    const id = crypto.randomUUID();
    const count = (await allMine(db.finishes)).length;
    await db.finishes.add({
      prices: {},
      sortOrder: count,
      ...input,
      id,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async remove(id: string): Promise<void> {
    await eraseIds(db.finishes, [id]);
  },
};

export const stockRepo = {
  async all(): Promise<StockItem[]> {
    return allMine(db.stock);
  },

  /**
   * קובע כמה יש וכמה הוזמן לצירוף של גוון וחומר.
   * שורה שהתרוקנה לגמרי נמחקת — מלאי אפס בלי הזמנה הוא פשוט "אין",
   * ורשומה ריקה רק מלכלכת את הרשימה.
   */
  async set(
    finishId: string,
    materialId: string,
    patch: {
      sheets?: number;
      ordered?: number;
      edgeInStock?: boolean;
      backFinishId?: string;
      offcuts?: Offcut[];
    },
  ): Promise<void> {
    const rows = await allMine(db.stock);
    const existing = rows.find((r) => r.finishId === finishId && r.materialId === materialId);
    const now = Date.now();
    const next = {
      sheets: patch.sheets ?? existing?.sheets ?? 0,
      ordered: patch.ordered ?? existing?.ordered ?? 0,
      edgeInStock: patch.edgeInStock ?? existing?.edgeInStock,
      backFinishId: patch.backFinishId ?? existing?.backFinishId,
      offcuts: patch.offcuts ?? existing?.offcuts,
    };
    /* שורה ריקה נמחקת — אבל פחת הוא לוח שקיים, ולכן הוא מחזיק אותה */
    const empty =
      next.sheets === 0 && next.ordered === 0 && !next.edgeInStock && !next.offcuts?.length;

    if (existing) {
      if (empty) await eraseIds(db.stock, [existing.id]);
      else await patchRow(db.stock, existing.id, next);
      return;
    }
    if (empty) return;
    await db.stock.add({
      id: crypto.randomUUID(),
      finishId,
      materialId,
      ...next,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
  },
};

/**
 * ההזמנה הגיעה: מה שהיה בדרך עובר למלאי.
 * פעולה אחת ולא שתי הקלדות — מי שפורק משאית לא אמור לחשב הפרשים.
 */
export async function receiveOrder(finishId: string, materialId: string): Promise<void> {
  const rows = await allMine(db.stock);
  const item = rows.find((r) => r.finishId === finishId && r.materialId === materialId);
  if (!item || item.ordered <= 0) return;
  await db.stock.update(item.id, {
    sheets: item.sheets + item.ordered,
    ordered: 0,
    updatedAt: Date.now(),
  });
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
      if (empty) await eraseIds(db.projectPrices, [existing.id]);
      else await patchRow(db.projectPrices, existing.id, prices);
      return;
    }
    if (empty) return;
    await db.projectPrices.add({
      id: crypto.randomUUID(),
      projectId,
      lineKey: key,
      ...prices,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
  },
};
