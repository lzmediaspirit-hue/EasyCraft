import Dexie, { type EntityTable } from 'dexie';
import type { Customer } from './types';

/**
 * בסיס הנתונים המקומי (IndexedDB).
 * הכול נשמר על המכשיר — האפליקציה עובדת ללא אינטרנט.
 * סנכרון לשרת ייכנס בהמשך מאחורי אותה שכבת גישה, בלי לשנות מסכים.
 */
export const db = new Dexie('easycraft') as Dexie & {
  customers: EntityTable<Customer, 'id'>;
};

db.version(1).stores({
  customers: 'id, name, city, createdAt',
});
