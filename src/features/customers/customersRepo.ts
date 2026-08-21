import { db } from '../../db/db';
import type { Customer, NewCustomer } from '../../db/types';

/**
 * שכבת הגישה ללקוחות. המסכים לא נוגעים ב-Dexie ישירות,
 * כדי שנוכל להחליף אחסון או להוסיף סנכרון בלי לגעת בממשק.
 */
export const customersRepo = {
  /** כל הלקוחות, ממוינים לפי שם בסדר אלפביתי עברי. */
  async list(): Promise<Customer[]> {
    const all = await db.customers.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  },

  async create(input: NewCustomer): Promise<Customer> {
    const now = Date.now();
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      city: input.city.trim(),
      phone: input.phone?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await db.customers.add(customer);
    return customer;
  },
};
