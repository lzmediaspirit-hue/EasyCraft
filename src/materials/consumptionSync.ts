import { db } from '../db/db';
import { consumptionRepo, cutLines, moveStock } from './consumptionRepo';
import { settingsRepo } from './materialsRepo';
import { projectsRepo, unitsRepo } from '../features/projects/projectsRepo';
import { eraseIds, owned, patchRow } from '../db/rows';

/**
 * יישור המלאי למה שסומן בפרויקט — שירות מעל המאגרים, לא מאגר.
 *
 * הסנכרון קורא תמחור פרויקט ורשימת ארגזים, ולכן הוא תלוי במאגר
 * הפרויקטים; ומאגר הפרויקטים מחזיר מלאי כשפרויקט נמחק, ולכן הוא
 * תלוי בצריכה. שני המודולים ייבאו זה את זה, ומי שטען אחד מהם
 * ראשון קבע איזה מהם מאותחל חצי. ההחזרה למלאי היא פעולה על
 * הצריכה בלבד ונשארה שם; התיאום בין השניים יושב כאן, מעליהם.
 */
export function syncConsumption(projectId: string): Promise<void> {
  /*
   * שתי הקשות מהירות על שלבי עבודה הריצו שתי סנכרונים במקביל, שניהם
   * קראו את אותו מצב מלאי — והפלטות ירדו פעמיים. לכל פרויקט תור אחד.
   */
  const prev = pending.get(projectId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => runSync(projectId));
  pending.set(projectId, next);
  next.finally(() => {
    if (pending.get(projectId) === next) pending.delete(projectId);
  });
  return next;
}

const pending = new Map<string, Promise<void>>();

async function runSync(projectId: string): Promise<void> {
  const [costing, units, settings, project] = await Promise.all([
    projectsRepo.costing(projectId),
    unitsRepo.listForProject(projectId),
    settingsRepo.get(),
    projectsRepo.get(projectId),
  ]);
  const cut = cutLines(units, settings, project);
  const now = Date.now();

  /*
   * הקריאה של הצריכה והכתיבה למלאי חייבות לשבת באותה עסקה: שני
   * פרויקטים שמסונכרנים במקביל — בשתי לשוניות, למשל — קראו את אותה
   * שורת מלאי ודרסו זה את זה, ופלטה אחת נעלמה מההפחתה. התור שלפני
   * כן מסדר רק פרויקט מול עצמו, והעסקה מסדרת פרויקט מול פרויקט.
   */
  await db.transaction('rw', db.consumption, db.stock, db.tombstones, async () => {
    const existing = await consumptionRepo.listForProject(projectId);

    for (const line of costing.lines) {
      const was = existing.find((c) => c.lineKey === line.key);
      const wants = cut.has(line.key) ? line.sheets : 0;
      const had = was?.sheets ?? 0;
      if (wants === had) continue;

      await moveStock(line.finish?.id, line.material.id, had - wants);
      if (wants === 0) {
        if (was) await eraseIds(db.consumption, [was.id]);
      } else if (was) {
        await patchRow(db.consumption, was.id, { sheets: wants });
      } else {
        await db.consumption.add({
          id: crypto.randomUUID(),
          projectId,
          lineKey: line.key,
          finishId: line.finish?.id,
          materialId: line.material.id,
          sheets: wants,
          ...owned(),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    /* שורה שנעלמה מהתמחור — הגוון הוחלף, הארגז נמחק — מחזירה את שלה */
    for (const c of existing) {
      if (costing.lines.some((l) => l.key === c.lineKey)) continue;
      await moveStock(c.finishId, c.materialId, c.sheets);
      await eraseIds(db.consumption, [c.id]);
    }
  });
}
