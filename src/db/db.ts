import Dexie, { type EntityTable } from 'dexie';
import type {
  Attachment,
  CatalogItem,
  Consumption,
  Customer,
  Finish,
  Material,
  PlacedUnit,
  Project,
  ProjectPrice,
  StockItem,
  ProjectStage,
  Settings,
  TeamMember,
  Wall,
} from './types';

/**
 * בסיס הנתונים המקומי (IndexedDB).
 * הכול נשמר על המכשיר — האפליקציה עובדת ללא אינטרנט.
 * סנכרון לשרת ייכנס בהמשך מאחורי אותה שכבת גישה, בלי לשנות מסכים.
 */
export const db = new Dexie('easycraft') as Dexie & {
  customers: EntityTable<Customer, 'id'>;
  projects: EntityTable<Project, 'id'>;
  walls: EntityTable<Wall, 'id'>;
  units: EntityTable<PlacedUnit, 'id'>;
  catalog: EntityTable<CatalogItem, 'id'>;
  materials: EntityTable<Material, 'id'>;
  stock: EntityTable<StockItem, 'id'>;
  finishes: EntityTable<Finish, 'id'>;
  projectPrices: EntityTable<ProjectPrice, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  team: EntityTable<TeamMember, 'id'>;
  stages: EntityTable<ProjectStage, 'id'>;
  attachments: EntityTable<Attachment, 'id'>;
  consumption: EntityTable<Consumption, 'id'>;
};

db.version(1).stores({
  customers: 'id, name, city, createdAt',
});

db.version(2).stores({
  customers: 'id, name, city, createdAt',
  projects: 'id, customerId, createdAt',
  walls: 'id, projectId, index',
  units: 'id, projectId, wallId',
  catalog: 'id, group, sortOrder',
});

const TABLES_V3 = {
  customers: 'id, name, city, createdAt',
  projects: 'id, customerId, createdAt',
  walls: 'id, projectId, index',
  units: 'id, projectId, wallId',
  catalog: 'id, group, sortOrder',
  boards: 'id, role, sortOrder',
  finishes: 'id, boardId, sortOrder',
  projectPrices: 'id, projectId, boardId',
  settings: 'id',
};

db.version(3).stores(TABLES_V3);

/**
 * גובה הארגז כולל מעכשיו את הרגליים, ותחתיתו יושבת על הרצפה.
 * קודם הגובה תיאר רק את הגוף והרגליים היו מתחתיו, ולכן כאן מזיזים
 * את הארגזים הקיימים לסמנטיקה החדשה בלי לשנות את הגובה הכולל שלהם.
 */
db.version(4)
  .stores(TABLES_V3)
  .upgrade((tx) =>
    tx
      .table('units')
      .toCollection()
      .modify((u: { socleMm?: number; yMm: number; heightMm: number }) => {
        const socle = u.socleMm ?? 0;
        if (socle > 0 && u.yMm >= socle) {
          u.yMm -= socle;
          u.heightMm += socle;
        }
      }),
  );

/**
 * מידת הפלטה הסטנדרטית היא 244×122 ס"מ.
 * מי שכבר עבד עם ברירת המחדל הישנה מקבל את החדשה; מי שקבע מידה
 * משלו — נשאר איתה, כי זו החלטה עסקית ולא ברירת מחדל.
 */
db.version(5)
  .stores(TABLES_V3)
  .upgrade((tx) =>
    tx
      .table('settings')
      .toCollection()
      .modify((s: { sheetWidthMm?: number; sheetHeightMm?: number }) => {
        if (s.sheetWidthMm === 2800 && s.sheetHeightMm === 2070) {
          s.sheetWidthMm = 2440;
          s.sheetHeightMm = 1220;
        }
      }),
  );

/**
 * ארגז שנעול לרצפה יושב על 0. גרסה קודמת של לוח העריכה הרימה אותו
 * בגובה הרגליים, ולכן הוא נראה מרחף — כאן הוא מוחזר לרצפה.
 */
db.version(6)
  .stores(TABLES_V3)
  .upgrade((tx) =>
    tx
      .table('units')
      .toCollection()
      .modify((u: { floorLocked?: boolean; yMm: number }) => {
        if (u.floorLocked && u.yMm !== 0) u.yMm = 0;
      }),
  );

/** צוות, שלבי עבודה וקבצים מצורפים — תהליך העבודה של הפרויקט. */
db.version(7).stores({
  ...TABLES_V3,
  team: 'id, role, active',
  stages: 'id, projectId, key, status, assigneeId, scheduledAt',
  attachments: 'id, projectId, kind',
});

/**
 * מידת הפלטה עוברת מהגדרה כללית ללוח עצמו, וכיוון הסיבים עובר
 * מהלוח לגוון. שניהם מאפיינים של המוצר אצל הספק: אותו MDF מגיע
 * בכמה מידות, ואותו לוח מגיע גם בלכה חלקה וגם בפורניר עם סיבים.
 */
db.version(8)
  .stores({
    ...TABLES_V3,
    team: 'id, role, active, username',
    stages: 'id, projectId, key, status, assigneeId, scheduledAt',
    attachments: 'id, projectId, kind',
  })
  .upgrade(async (tx) => {
    const settings = await tx.table('settings').get('app');
    const w = settings?.sheetWidthMm ?? 1220;
    const h = settings?.sheetHeightMm ?? 2440;
    const grainy: string[] = [];
    await tx
      .table('boards')
      .toCollection()
      .modify((b: { sheetWidthMm?: number; sheetHeightMm?: number; hasGrain?: boolean; id: string }) => {
        // המידה הכללית הייתה נכונה לכל הלוחות עד כה
        b.sheetWidthMm ??= w;
        b.sheetHeightMm ??= h;
        if (b.hasGrain) grainy.push(b.id);
        delete b.hasGrain;
      });
    // כיוון הסיבים שהיה על הלוח עובר לכל הגוונים שלו
    if (grainy.length) {
      await tx
        .table('finishes')
        .toCollection()
        .modify((f: { boardId: string; hasGrain?: boolean }) => {
          if (grainy.includes(f.boardId)) f.hasGrain = true;
        });
    }
  });

/**
 * לוח מוגדר לפי החומר שלו ולא לפי "תפקיד" בארון: אותו MDF משמש
 * גם לחזית וגם לגוף, ואותו גוון קיים על כמה חומרים. החלק בארון
 * נקבע מעכשיו לפי הגוון שנבחר לו בהדמיה.
 */
db.version(9)
  .stores({
    ...TABLES_V3,
    team: 'id, role, active, username',
    stages: 'id, projectId, key, status, assigneeId, scheduledAt',
    attachments: 'id, projectId, kind',
  })
  .upgrade((tx) =>
    tx
      .table('boards')
      .toCollection()
      .modify((b: { role?: string; material?: string }) => {
        if (b.material) return;
        // התפקיד הישן מנחש את החומר הסביר, וזה מה שהיה בפועל
        b.material = b.role === 'front' ? 'mdf' : b.role === 'back' ? 'other' : 'sandwich';
        delete b.role;
      }),
  );


/**
 * הגוון והחומר נפרדים.
 *
 * עד כאן "לוח" היה חומר ומחיר ביחד, והגוון היה תלוי בלוח מסוים.
 * בפועל גוון אחד חוצה חומרים — אותו לבן קיים גם על סנדוויץ׳ וגם
 * על MDF, במחיר אחר לגמרי — ולכן החומרים הופכים לרשימה קצרה,
 * הגוונים לרשימה שגדלה, והמחיר יושב בהצטלבות שביניהם.
 *
 * מזהי הלוחות נשמרים כמזהי החומרים, ולכן כל הפניה קיימת בארגזים
 * ובספרייה ממשיכה להצביע על החומר הנכון.
 */
db.version(10)
  .stores({
    ...TABLES_V3,
    boards: null,
    materials: 'id, sortOrder',
    finishes: 'id, sortOrder',
    projectPrices: 'id, projectId, lineKey',
    team: 'id, role, active, username',
    stages: 'id, projectId, key, status, assigneeId, scheduledAt',
    attachments: 'id, projectId, kind',
  })
  .upgrade(async (tx) => {
    type OldBoard = {
      id: string;
      name: string;
      material?: string;
      sheetWidthMm?: number;
      sheetHeightMm?: number;
      factoryPrice?: number;
      consumerPrice?: number;
      sortOrder?: number;
      createdAt?: number;
      updatedAt?: number;
    };
    const boards: OldBoard[] = await tx.table('boards').toArray();

    await tx.table('materials').bulkPut(
      boards.map((b, i) => ({
        id: b.id,
        name: b.name,
        sheetWidthMm: b.sheetWidthMm ?? 1220,
        sheetHeightMm: b.sheetHeightMm ?? 2440,
        sortOrder: b.sortOrder ?? i,
        createdAt: b.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      })),
    );

    // הגוון מקבל את המחיר שהיה בפועל: שלו אם נקבע, אחרת של הלוח
    const boardOf = new Map(boards.map((b) => [b.id, b]));
    const materialByFinish = new Map<string, string>();
    await tx
      .table('finishes')
      .toCollection()
      .modify(
        (f: {
          id: string;
          boardId?: string;
          factoryPrice?: number;
          consumerPrice?: number;
          prices?: Record<string, unknown>;
        }) => {
          if (f.prices) return;
          const b = f.boardId ? boardOf.get(f.boardId) : undefined;
          f.prices = b
            ? {
                [b.id]: {
                  factoryPrice: f.factoryPrice ?? b.factoryPrice ?? 0,
                  consumerPrice: f.consumerPrice ?? b.consumerPrice ?? 0,
                },
              }
            : {};
          if (f.boardId) materialByFinish.set(f.id, f.boardId);
          delete f.boardId;
          delete f.factoryPrice;
          delete f.consumerPrice;
        },
      );

    /*
     * החומר של כל חלק נגזר מהגוון שהיה עליו. ארגז בלי גוון נשאר
     * בלי חומר, וייפול לברירת המחדל של הפרויקט — וזה נכון, כי גם
     * קודם הוא נפל לברירת מחדל.
     */
    const carry = (row: Record<string, unknown>) => {
      for (const role of ['carcass', 'front', 'exposed', 'back'] as const) {
        const fid = row[`${role}FinishId`];
        const mid = typeof fid === 'string' ? materialByFinish.get(fid) : undefined;
        if (mid) row[`${role}MaterialId`] = mid;
      }
    };
    await tx.table('units').toCollection().modify(carry);
    await tx.table('catalog').toCollection().modify(carry);

    /*
     * דריסות המחיר ברמת הפרויקט היו לפי לוח, ובסיס התמחור השתנה
     * לשורה של גוון וחומר. אין דרך נכונה לתרגם אותן, ולכן הן
     * נמחקות — עדיף מחיר מחירון גלוי מדריסה שקופצת על שורה לא
     * נכונה.
     */
    await tx.table('projectPrices').clear();

    await tx
      .table('settings')
      .toCollection()
      .modify((s: { defaultBackKind?: string }) => {
        s.defaultBackKind ??= 'thin';
      });
  });


/**
 * מלאי פלטות.
 * נספר לפי אותה שורה שבה מוזמנים — גוון על חומר — ולא לפי אחד מהם
 * לבדו, כי זה הצירוף שמגיע מהספק.
 */
db.version(11).stores({
  ...TABLES_V3,
  boards: null,
  materials: 'id, sortOrder',
  finishes: 'id, sortOrder',
  projectPrices: 'id, projectId, lineKey',
  stock: 'id, finishId, materialId',
  team: 'id, role, active, username',
  stages: 'id, projectId, key, status, assigneeId, scheduledAt',
  attachments: 'id, projectId, kind',
});


/**
 * מצב הארגז מתפרק למסלולים.
 *
 * קודם היה דגל אחד לכל פעולה — נחתך, קונט, הורכב — כאילו הארגז
 * הוא דבר אחד שנע קדימה. בפועל הגוף, החזיתות והדופן הזרה נעים
 * בזמנים שונים, ולכן לכל אחד מסלול משלו. הדגלים הישנים נקראים
 * כמסלול הגוף, ומה שסומן בחזיתות ובדפנות עובר למסלול שלהן.
 */
db.version(12)
  .stores({
    ...TABLES_V3,
    boards: null,
    materials: 'id, sortOrder',
    finishes: 'id, sortOrder',
    projectPrices: 'id, projectId, lineKey',
    stock: 'id, finishId, materialId',
    team: 'id, role, active, username',
    stages: 'id, projectId, key, status, assigneeId, scheduledAt',
    attachments: 'id, projectId, kind',
  })
  .upgrade((tx) =>
    tx
      .table('units')
      .toCollection()
      .modify((u: { work?: Record<string, unknown> }) => {
        const w = u.work;
        if (!w || w.tracks) return;
        const carcass = w.installed
          ? 'installed'
          : w.assembled
            ? 'assembled'
            : w.edged
              ? 'edged'
              : w.cut
                ? 'cut'
                : w.filesReady
                  ? 'ready'
                  : undefined;
        u.work = {
          issue: w.issue,
          issueBy: w.issueBy,
          tracks: {
            ...(carcass ? { carcass } : {}),
            ...(w.fronts ? { fronts: 'installed' } : {}),
            ...(w.panels ? { panels: 'installed' } : {}),
          },
        };
      }),
  );

/**
 * מרקם אחד לגוון.
 *
 * המרקם היה רשימה, כאילו אפשר לסמן על אותו גוון גם מט וגם יער.
 * בפועל לוח מגיע מהספק במרקם אחד; שני מרקמים על אותו שם הם שני
 * לוחות שונים, שמוזמנים ונספרים בנפרד. מי שסימן כמה — הראשון
 * נשמר, כי הוא זה שנבחר קודם.
 */
db.version(13)
  .stores({
    ...TABLES_V3,
    boards: null,
    materials: 'id, sortOrder',
    finishes: 'id, sortOrder',
    projectPrices: 'id, projectId, lineKey',
    stock: 'id, finishId, materialId',
    team: 'id, role, active, username',
    stages: 'id, projectId, key, status, assigneeId, scheduledAt',
    attachments: 'id, projectId, kind',
  })
  .upgrade((tx) =>
    tx
      .table('finishes')
      .toCollection()
      .modify((f: { textures?: string[]; texture?: string }) => {
        if (f.texture === undefined) f.texture = f.textures?.[0];
        delete f.textures;
      }),
  );

/**
 * מה כל פרויקט צרך מהמלאי.
 *
 * עד כאן המלאי היה מספר שמישהו מעדכן ביד, ומה שנחתך פשוט נעלם
 * ממנו כשנזכרו. עכשיו יש רשומה: כשכל החלקים של גוון+חומר בפרויקט
 * מסומנים כנחתכים, הפלטות יורדות מהמלאי, והרשומה זוכרת כמה ובשביל
 * מי — כדי שאפשר יהיה גם להחזיר וגם לענות "לאן הלכו הלוחות".
 */
db.version(14).stores({
  ...TABLES_V3,
  boards: null,
  materials: 'id, sortOrder',
  finishes: 'id, sortOrder',
  projectPrices: 'id, projectId, lineKey',
  stock: 'id, finishId, materialId',
  team: 'id, role, active, username',
  stages: 'id, projectId, key, status, assigneeId, scheduledAt',
  attachments: 'id, projectId, kind',
  consumption: 'id, projectId, lineKey',
});
