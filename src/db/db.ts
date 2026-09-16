import Dexie, { type EntityTable } from 'dexie';

import { fillCodes, type CodeRow } from '../catalog/codes';
import type {
  Attachment,
  CatalogItem,
  Consumption,
  Customer,
  Finish,
  Material,
  Room,
  PlacedUnit,
  Project,
  ProjectPrice,
  StockItem,
  ProjectStage,
  Settings,
  TeamMember,
  Tombstone,
  Wall,
  Workshop,
} from './types';
import { LOCAL_WORKSHOP } from './workshop';
import { panelSize } from './legacy';

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
  rooms: EntityTable<Room, 'id'>;
  workshops: EntityTable<Workshop, 'id'>;
  tombstones: EntityTable<Tombstone, 'id'>;
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
/*
 * מפת הטבלאות מגרסה 11 ואילך.
 *
 * כל גרסה חדשה חזרה על אותה מפה במלואה, ומספיק היה לשכוח שורה אחת
 * כדי לאבד אינדקס. עכשיו יש שם אחד: גרסה שמשנה מבנה מוסיפה לו,
 * וגרסה שרק מהגרת נתונים משתמשת בו כמו שהוא.
 */
const TABLES_V11 = {
  ...TABLES_V3,
  boards: null,
  materials: 'id, sortOrder',
  finishes: 'id, sortOrder',
  projectPrices: 'id, projectId, lineKey',
  stock: 'id, finishId, materialId',
  team: 'id, role, active, username',
  stages: 'id, projectId, key, status, assigneeId, scheduledAt',
  attachments: 'id, projectId, kind',
} as const;

/** מגרסה 14 נוספה טבלת הצריכה — מה שכל פרויקט הוריד מהמלאי. */
const TABLES_V14 = { ...TABLES_V11, consumption: 'id, projectId, lineKey' } as const;

db.version(11).stores(TABLES_V11);


/**
 * מצב הארגז מתפרק למסלולים.
 *
 * קודם היה דגל אחד לכל פעולה — נחתך, קונט, הורכב — כאילו הארגז
 * הוא דבר אחד שנע קדימה. בפועל הגוף, החזיתות והדופן הזרה נעים
 * בזמנים שונים, ולכן לכל אחד מסלול משלו. הדגלים הישנים נקראים
 * כמסלול הגוף, ומה שסומן בחזיתות ובדפנות עובר למסלול שלהן.
 */
db.version(12)
  .stores(TABLES_V11)
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
  .stores(TABLES_V11)
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
db.version(14).stores(TABLES_V14);

/**
 * לחומר יש סוג, ולא רק שם.
 *
 * לכל חלק בארגז יש חומר שהוא נבנה ממנו: הגוף מסנדוויץ׳, החזיתות
 * מ-MDF, הגב מדיקט. עד עכשיו ברירת המחדל הייתה "החומר הראשון
 * ברשימה" — מה שנתן גב מסנדוויץ׳ וחזית מסנדוויץ׳ באותה נשימה.
 * החומרים שנזרעו מזוהים לפי שמם; חומר שהנגר הוסיף בעצמו נשאר
 * בלי סוג, ופשוט לא נבחר אוטומטית.
 */
db.version(15)
  .stores(TABLES_V14)
  .upgrade((tx) =>
    tx
      .table('materials')
      .toCollection()
      .modify((m: { name?: string; kind?: string }) => {
        if (m.kind) return;
        const n = (m.name ?? '').toLowerCase();
        if (n.includes('mdf')) m.kind = 'mdf';
        else if (n.includes('דיקט')) m.kind = 'ply';
        else if (n.includes('סנדוויץ')) m.kind = 'sandwich';
      }),
  );

/**
 * החומר יודע לאילו חלקים הוא משמש.
 *
 * `kind` היה סיווג פנימי — סנדוויץ׳, MDF, דיקט — והקוד גזר ממנו
 * לאיזה חלק כל חומר הולך. זו החלטה של הנגרייה ולא של הקוד, ולכן
 * היא עוברת לנתונים עצמם: לכל חומר רשימת החלקים שהוא משמש להם,
 * והיא נקבעת בהגדרות. הסיווג הישן מתורגם פעם אחת ונמחק.
 */
db.version(16)
  .stores(TABLES_V14)
  .upgrade((tx) =>
    tx
      .table('materials')
      .toCollection()
      .modify((m: { name?: string; kind?: string; roles?: string[] }) => {
        if (!m.roles) {
          const kind =
            m.kind ??
            (/mdf/i.test(m.name ?? '')
              ? 'mdf'
              : /דיקט/.test(m.name ?? '')
                ? 'ply'
                : /סנדוויץ/.test(m.name ?? '')
                  ? 'sandwich'
                  : undefined);
          if (kind === 'sandwich') m.roles = ['carcass'];
          else if (kind === 'mdf') m.roles = ['front', 'exposed'];
          else if (kind === 'ply') m.roles = ['back'];
        }
        delete m.kind;
      }),
  );

/**
 * דלת בגובה הגוף, תמיד.
 *
 * "הדלת מעבר לארגז" נועדה לדלת אחת שמכסה שני ארגזים; בפועל היא
 * הייתה הגדרה שקשה למצוא וקל לשבור בה חזית, והמקום הנכון לכסות
 * כמה חללים בדלת אחת הוא חזית שמשתרעת על כמה תאים בתוך אותו ארון.
 * השדות הישנים נמחקים כדי שלא יישארו ארגזים עם דלת בגובה שאי אפשר
 * לשנות.
 */
db.version(17)
  .stores(TABLES_V14)
  .upgrade((tx) =>
    tx
      .table('units')
      .toCollection()
      .modify((u: Record<string, unknown>) => {
        delete u.doorGrowTopMm;
        delete u.doorGrowBottomMm;
        delete u.exposedMatchesDoor;
      }),
  );

/*
 * `offsetMm` תיאר ארגז שמרוחק מהקיר אבל עדיין נמדד ממנו. אי אמיתי
 * אינו נמדד משום קיר, ולכן המידה הזאת הוחלפה במיקום ברצפת החדר.
 *
 * ההמרה עצמה דורשת את גיאומטריית הקירות, ולכן היא נעשית כאן רק
 * במחיקה: ארגז חוזר להיצמד לקיר, ומי שרצה אותו באמצע החדר מעמיד
 * אותו מחדש בלחיצה. עדיף ארגז שחזר לקיר על ארגז שקפץ למקום שגוי.
 */
db.version(18)
  .stores(TABLES_V14)
  .upgrade((tx) =>
    tx
      .table('units')
      .toCollection()
      .modify((u: Record<string, unknown>) => {
        delete u.offsetMm;
      }),
  );

/*
 * גובה הארגז התחתון התאחד על 880 מ"מ כולל הרגליים.
 *
 * עד כאן הספרייה החזיקה שני גבהים שונים לאותו דבר — 870 לארגזי
 * המטבח ו-820 לארגזים הכלליים — ואף אחד מהם לא היה המידה שהנגר
 * מודד. השדרוג מתקן רק פריטים שנשארו בדיוק על אחד משני המספרים
 * האלה: מי שכבר קבע לעצמו גובה אחר קבע אותו במפורש, ולא מחליפים
 * לו אותו מאחורי הגב.
 */
db.version(19)
  .stores(TABLES_V14)
  .upgrade((tx) =>
    tx
      .table('catalog')
      .toCollection()
      .modify((i: Record<string, unknown>) => {
        if (i.isBuiltin !== true || i.level !== 'floor') return;
        if (i.defaultHeightMm === 870 || i.defaultHeightMm === 820) i.defaultHeightMm = 880;
      }),
  );

/*
 * סוג הגב של ארגז חדש התאחד על שדה אחד.
 *
 * היו שניים בשמות דומים: `defaultBackKind` בשורש ההגדרות, שאליו
 * כתב מסך ההגדרות, ו-`defaults.backKind`, שממנו נולד כל ארגז. לכן
 * הבחירה במסך נשמרה ולא השפיעה. כאן עוברת הבחירה שכבר נעשתה אל
 * השדה האמיתי, כדי שמי שביקש גב אחר יקבל אותו סוף סוף.
 *
 * רק כשהיא באמת בחירה: 'thin' הוא ערך ברירת המחדל של שני השדות,
 * ואי אפשר להבחין בו בין מי שבחר לבין מי שלא נגע. לכן מועברת רק
 * בחירה שאינה ברירת המחדל, ורק כשהצד השני עדיין עליה.
 */
db.version(20)
  .stores(TABLES_V14)
  .upgrade((tx) =>
    tx
      .table('settings')
      .toCollection()
      .modify((s: { defaultBackKind?: string; defaults?: { backKind?: string } }) => {
        const chose = s.defaultBackKind && s.defaultBackKind !== 'thin';
        if (chose && s.defaults && (s.defaults.backKind ?? 'thin') === 'thin') {
          s.defaults.backKind = s.defaultBackKind;
        }
        delete s.defaultBackKind;
      }),
  );

/*
 * מק״ט לכל ארגז בספרייה.
 *
 * עד כאן לארגז היה מזהה פנימי בלבד, שאיש אינו רואה ואי אפשר לכתוב
 * על מדבקה. המק״ט הוא מה שהנגר קורא לו בשמו — והוא גם מה שמונע
 * כפילות: שמירה או ייבוא תחת מק״ט קיים מעדכנים את הארגז ההוא.
 *
 * הסדר כאן הוא סדר הספרייה, כדי שהמספור יהיה קריא ולא אקראי.
 */
db.version(21)
  .stores(TABLES_V14)
  .upgrade(async (tx) => {
    /* מק״ט לכל ארגז שכבר בספרייה, לפי אותו כלל שבו נזרעת חדשה */
    const rows = (await tx.table('catalog').toArray()) as CodeRow[];
    for (const { id, code } of fillCodes(rows)) await tx.table('catalog').update(id, { code });
  });

/*
 * החדרים הופכים לנתונים.
 *
 * עד כאן היו שלושה חדרים כתובים בקוד, ונגר שעובד גם על חדר
 * שירות או על משרד נאלץ לבחור "חדר בהגדרה אישית" ולאבד את
 * הסינון לפי חדר. הטבלה נזרעת בהפעלה הראשונה מ-`SEED_ROOMS`.
 */
const TABLES_V22 = { ...TABLES_V14, rooms: 'id, sortOrder' } as const;

db.version(22).stores(TABLES_V22);

/*
 * מה שהוסר — הוסר.
 *
 * הסרה סימנה `hiddenAt` בלבד, והארגז נשאר במכשיר: הוא לא הופיע
 * ברשימות אבל יצא בכל גיבוי, וחזר עם הספרייה למכשיר הבא. נגר
 * שניקה את הספרייה שלו מצא את מה שמחק חוזר דרך הדלת האחורית.
 *
 * כאן הם נמחקים בפועל. פרויקטים אינם נפגעים — ארגז שהונח שומר את
 * המידות שלו בעצמו ואינו נשען על הספרייה.
 *
 * ובאותה הזדמנות: שני ארגזים לא יכולים לשאת אותו מק״ט. מי שכבר
 * הספיק לצבור כפילות — הראשון נשאר, והשאר נמחקים.
 */
db.version(23)
  .stores(TABLES_V22)
  .upgrade(async (tx) => {
    const rows = (await tx.table('catalog').toArray()) as {
      id: string;
      code?: string;
      hiddenAt?: number;
      sortOrder: number;
    }[];
    const drop = rows.filter((r) => r.hiddenAt).map((r) => r.id);

    const keep = new Map<string, string>();
    for (const row of rows
      .filter((r) => !r.hiddenAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)) {
      const code = row.code?.toUpperCase();
      if (!code) continue;
      if (keep.has(code)) drop.push(row.id);
      else keep.set(code, row.id);
    }
    if (drop.length) await tx.table('catalog').bulkDelete(drop);
  });

/*
 * עובי הלוח הוא מידה ולא שדה.
 *
 * ללוח בודד היה `panelThicknessMm` לצד הגובה והעומק, ושני
 * המספרים יכלו לסתור זה את זה: הציור לקח את השדה, והחיתוך ובדיקת
 * ההתנגשות לקחו את המידה. כאן השדה נכנס אל המידה שהוא תיאר — לוח
 * מונח אל גובהו, לוח עומד אל עומקו — ויורד.
 */
db.version(24)
  .stores(TABLES_V22)
  .upgrade(async (tx) => {
    for (const table of ['catalog', 'units']) {
      const rows = (await tx.table(table).toArray()) as {
        id: string;
        glyph: string;
        panelThicknessMm?: number;
      }[];
      for (const row of rows) {
        const th = row.panelThicknessMm;
        if (th === undefined) continue;
        /* אותה המרה שרצה על קובץ מיובא — ראה `db/legacy` */
        const size = panelSize(row.glyph, th, table === 'catalog' ? 'item' : 'unit');
        await tx.table(table).update(row.id, { ...size, panelThicknessMm: undefined });
      }
    }
  });

/*
 * קטגוריות חדשות בחדרים שכבר נזרעו.
 *
 * "איים" ו"מדפים" הם מוצרים בפני עצמם, ולא שורה בתוך "תחתונים".
 * החדרים נזרעים פעם אחת בהתקנה, ולכן מי שכבר התקין היה מקבל
 * ספרייה שהפריטים החדשים אינם מופיעים בה בכלל.
 */
db.version(25)
  .stores(TABLES_V22)
  .upgrade(async (tx) => {
    const rows = (await tx.table('rooms').toArray()) as {
      id: string;
      isBuiltin?: boolean;
      groups: string[];
    }[];
    for (const room of rows) {
      if (!room.isBuiltin) continue;
      const add = ['island', 'shelf'].filter((g) => !room.groups.includes(g));
      if (!add.length) continue;
      /* לפני "דפנות ולוחות", שהוא תמיד האחרון */
      const at = room.groups.indexOf('panel');
      const groups = [...room.groups];
      groups.splice(at < 0 ? groups.length : at, 0, ...add);
      await tx.table('rooms').update(room.id, { groups });
    }
  });

/*
 * "הספרייה כבר נזרעה" הופך לסימון ולא להשערה.
 *
 * הזריעה נמנעה כל עוד היו שורות בטבלה, ולכן נגר שמחק את הפריט
 * האחרון שלו קיבל בפתיחה הבאה את ספריית ההדגמה בחזרה. מי שכבר
 * יש לו ספרייה מסומן כאן כמי שנזרע, כדי שהמעבר לא יזרע עליו.
 */
db.version(26)
  .stores(TABLES_V22)
  .upgrade(async (tx) => {
    if (!(await tx.table('catalog').count())) return;
    const now = Date.now();
    const settings = await tx.table('settings').get('app');
    if (settings) await tx.table('settings').update('app', { catalogSeededAt: now });
  });


/*
 * בעלות על כל שורה, גרסה לכל שורה, וסימוני מחיקה.
 *
 * עד כאן כל הטבלאות היו גלובליות — "כל הלקוחות" היו כל הלקוחות
 * שבמכשיר — ולא היה שדה שאפשר לשאול לפיו "של מי זה". זה עובד בדיוק
 * כל עוד יש נגרייה אחת ומכשיר אחד, ונשבר ברגע שיש שרת.
 *
 * המעבר עצמו זול: יש נגרייה אחת, ולכן כל מה שקיים שייך לה. הוא
 * נעשה עכשיו דווקא כי הוא זול עכשיו — אחרי שיהיו נתונים אצל נגרים
 * אמיתיים, אותו מעבר הוא כבר סיכון.
 *
 * `rev` מתחיל ב-1 ולא ב-0: שורה קיימת היא שורה שנכתבה פעם אחת.
 */
const TABLES_V27 = {
  ...TABLES_V22,
  customers: 'id, workshopId, name, city, createdAt',
  projects: 'id, workshopId, customerId, createdAt',
  walls: 'id, workshopId, projectId, index',
  units: 'id, workshopId, projectId, wallId',
  catalog: 'id, workshopId, group, sortOrder',
  materials: 'id, workshopId, sortOrder',
  finishes: 'id, workshopId, sortOrder',
  projectPrices: 'id, workshopId, projectId, lineKey',
  stock: 'id, workshopId, finishId, materialId',
  team: 'id, workshopId, role, active, username',
  stages: 'id, workshopId, projectId, key, status, assigneeId, scheduledAt',
  attachments: 'id, workshopId, projectId, kind',
  consumption: 'id, workshopId, projectId, lineKey',
  rooms: 'id, workshopId, sortOrder',
  settings: 'id, workshopId',
  workshops: 'id',
  tombstones: 'id, [workshopId+table], deletedAt',
} as const;

db.version(27)
  .stores(TABLES_V27)
  .upgrade(async (tx) => {
    const now = Date.now();
    await tx.table('workshops').put({
      id: LOCAL_WORKSHOP,
      name: 'הנגרייה שלי',
      createdAt: now,
      updatedAt: now,
    });
    const owned = [
      'customers', 'projects', 'walls', 'units', 'catalog', 'materials', 'stock',
      'finishes', 'projectPrices', 'settings', 'team', 'stages', 'attachments',
      'consumption', 'rooms',
    ];
    for (const name of owned) {
      await tx
        .table(name)
        .toCollection()
        .modify((row: { workshopId?: string; rev?: number }) => {
          row.workshopId ??= LOCAL_WORKSHOP;
          row.rev ??= 1;
        });
    }
  });


/*
 * זהות מקור לשורות שהגיעו מחבילה.
 *
 * ייבוא של אותו ארגז לשתי נגריות דרס את השורה של הראשונה, כי המפתח
 * גלובלי והכתיבה נשאה את המזהה המקורי. מי שמייבא מקבל מעכשיו עותק
 * משלו, והמזהה שממנו הוא בא נשמר ב-`sourceId` — כדי שייבוא חוזר
 * יעדכן את אותו עותק ולא ייצור שלישי.
 */
const TABLES_V28 = {
  ...TABLES_V27,
  catalog: 'id, workshopId, sourceId, group, sortOrder',
  materials: 'id, workshopId, sourceId, sortOrder',
  finishes: 'id, workshopId, sourceId, sortOrder',
} as const;

db.version(28).stores(TABLES_V28);
