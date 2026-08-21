import Dexie, { type EntityTable } from 'dexie';
import type { CatalogItem, Customer, PlacedUnit, Project, Wall } from './types';

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
