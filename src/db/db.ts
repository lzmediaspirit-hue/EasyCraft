import Dexie, { type EntityTable } from 'dexie';
import type {
  Attachment,
  Board,
  CatalogItem,
  Customer,
  Finish,
  PlacedUnit,
  Project,
  ProjectPrice,
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
  boards: EntityTable<Board, 'id'>;
  finishes: EntityTable<Finish, 'id'>;
  projectPrices: EntityTable<ProjectPrice, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  team: EntityTable<TeamMember, 'id'>;
  stages: EntityTable<ProjectStage, 'id'>;
  attachments: EntityTable<Attachment, 'id'>;
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
