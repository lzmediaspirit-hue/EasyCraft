import { consumptionRepo, cutLines } from './consumptionRepo';
import { settingsRepo } from './materialsRepo';
import { projectsRepo, unitsRepo } from '../features/projects/projectsRepo';

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
  /* מה נחתך — ומשם והלאה זו כתיבה, ולכן היא של המאגר */
  await consumptionRepo.reconcile(projectId, costing.lines, cutLines(units, settings, project));
}
