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

db.version(3).stores({
  customers: 'id, name, city, createdAt',
  projects: 'id, customerId, createdAt',
  walls: 'id, projectId, index',
  units: 'id, projectId, wallId',
  catalog: 'id, group, sortOrder',
  boards: 'id, role, sortOrder',
  finishes: 'id, boardId, sortOrder',
  projectPrices: 'id, projectId, boardId',
  settings: 'id',
});
