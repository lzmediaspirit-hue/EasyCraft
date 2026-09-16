import { db } from '../../db/db';
import { releaseConsumption } from '../../materials/consumptionRepo';
import type { Customer, NewCustomer } from '../../db/types';
import { allMine, eraseIds, eraseRows, mine, owned, patchRow } from '../../db/rows';

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
    const all = await allMine(db.customers);
    return all
      .filter((c) => !!c.archivedAt === archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  },

  /** כל הלקוחות של הנגרייה, כולל מי שבארכיון. */
  async all(): Promise<Customer[]> {
    return allMine(db.customers);
  },

  async setArchived(id: string, archived: boolean): Promise<void> {
    await patchRow(db.customers, id, { archivedAt: archived ? Date.now() : undefined });
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
    /* פלטות שנחתכו בפרויקטים של הלקוח חוזרות למלאי לפני המחיקה */
    for (const pid of ids) await releaseConsumption(pid);
    /*
     * מחיקה משאירה סימון, ולכן היא עוברת דרך `eraseRows` ולא דרך
     * `delete`: שורה שנמחקה כאן ואינה מוכרת למכשיר השני חוזרת ממנו
     * בסנכרון הבא, וזו מחיקה שמתבטלת מעצמה.
     */
    await db.transaction('rw', [...tables, db.tombstones], async () => {
      for (const pid of ids) {
        await eraseRows(db.units, await db.units.where('projectId').equals(pid).toArray());
        await eraseRows(db.walls, await db.walls.where('projectId').equals(pid).toArray());
        await eraseRows(db.stages, await db.stages.where('projectId').equals(pid).toArray());
        await eraseRows(
          db.attachments,
          await db.attachments.where('projectId').equals(pid).toArray(),
        );
        await eraseRows(
          db.projectPrices,
          await db.projectPrices.where('projectId').equals(pid).toArray(),
        );
      }
      await eraseRows(db.projects, projects);
      await eraseIds(db.customers, [id]);
    });
  },

  /*
   * לקוח של נגרייה אחרת אינו קיים מכאן — לא "מוסתר", לא קיים:
   * מי שמנחש מזהה מקבל בדיוק את מה שמקבל מי שמבקש מזהה שלא נוצר.
   */
  async get(id: string): Promise<Customer | undefined> {
    const row = await db.customers.get(id);
    return row && mine(row) ? row : undefined;
  },

  async create(input: NewCustomer): Promise<Customer> {
    const now = Date.now();
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      city: input.city.trim(),
      phone: input.phone?.trim() || undefined,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    };
    await db.customers.add(customer);
    return customer;
  },
};
