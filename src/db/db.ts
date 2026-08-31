import Dexie, { type EntityTable } from 'dexie';
import type {
  Board,
  CatalogItem,
  Customer,
  Finish,
  PlacedUnit,
  Project,
  ProjectPrice,
  Settings,
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
