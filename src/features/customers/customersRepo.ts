import { db } from '../../db/db';
import type { Customer, NewCustomer } from '../../db/types';

/**
 * שכבת הגישה ללקוחות. המסכים לא נוגעים ב-Dexie ישירות,
 * כדי שנוכל להחליף אחסון או להוסיף סנכרון בלי לגעת בממשק.
 */
export const customersRepo = {
  /**
   * הלקוחות, ממוינים לפי שם בסדר אלפביתי עברי.
   * לקוח שסיים עובר לארכיון ויורד מהרשימה הפעילה, אבל נשאר
   * במערכת — הפרויקטים והמחירים שלו הם ההיסטוריה של העסק.
   */
  async list(archived = false): Promise<Customer[]> {
    const all = await db.customers.toArray();
    return all
      .filter((c) => !!c.archivedAt === archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  },

  /** כל הלקוחות, כולל מי שבארכיון. */
  async all(): Promise<Customer[]> {
    return db.customers.toArray();
  },

  async setArchived(id: string, archived: boolean): Promise<void> {
    await db.customers.update(id, {
      archivedAt: archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
  },

  /** מחיקה מוחקת גם את הפרויקטים, הקירות, הארגזים והתהליכים שלו. */
  async remove(id: string): Promise<void> {
    const projects = await db.projects.where('customerId').equals(id).toArray();
    const ids = projects.map((p) => p.id);
    const tables = [
      db.customers,
      db.projects,
      db.walls,
      db.units,
      db.stages,
      db.attachments,
      db.projectPrices,
    ];
    await db.transaction('rw', tables, async () => {
      for (const pid of ids) {
        await db.units.where('projectId').equals(pid).delete();
        await db.walls.where('projectId').equals(pid).delete();
        await db.stages.where('projectId').equals(pid).delete();
        await db.attachments.where('projectId').equals(pid).delete();
        await db.projectPrices.where('projectId').equals(pid).delete();
      }
      await db.projects.where('customerId').equals(id).delete();
      await db.customers.delete(id);
    });
  },

  async get(id: string): Promise<Customer | undefined> {
    return db.customers.get(id);
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
