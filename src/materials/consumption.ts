import { db } from '../db/db';
import { partChoice, unitParts } from '../costing/boards';
import { settingsRepo } from './materialsRepo';
import { projectsRepo } from '../features/projects/projectsRepo';
import { stageIndex, stageOf, tracksOf } from '../workflow/unitWork';
import type { PartSettings } from '../costing/boards';
import type { Consumption, PartRole, PlacedUnit, Project, WorkTrack } from '../db/types';

/**
 * מעקב אוטומטי אחרי הלוחות שהפרויקטים צורכים.
 *
 * הנגר לא סופר פלטות פעמיים. ברגע שכל החלקים של גוון+חומר מסוים
 * בפרויקט סומנו כנחתכים, הפלטות כבר לא במחסן — הן בארגזים — ולכן
 * הן יורדות מהמלאי בלי שאף אחד יזין את זה. סימון שבוטל מחזיר אותן,
 * כי טעות בסימון היא דבר שקורה.
 *
 * ההפחתה היא ברמת שורת הלוחות ולא ברמת הארגז, כי זו הרמה שבה
 * המלאי נספר וזו הרמה שבה מזמינים: פלטה אחת נחתכת לכמה ארגזים,
 * ואי אפשר להפחית שליש ממנה.
 */

/** איזה מסלול עבודה אחראי לחלק מסוג מסוים. */
const TRACK_OF: Record<PartRole, WorkTrack> = {
  carcass: 'carcass',
  back: 'back',
  front: 'fronts',
  exposed: 'panels',
};

/**
 * האם החלק הזה כבר נחתך.
 *
 * גב עבה אינו מסלול בפני עצמו — הוא נחתך יחד עם הגוף — ולכן הוא
 * נשען על מסלול הגוף. מסלול שאינו קיים בארגז נופל לגוף מאותה סיבה.
 */
function partCut(u: PlacedUnit, role: PartRole): boolean {
  const tracks = tracksOf(u);
  if (!tracks.length) return false;
  const want = TRACK_OF[role];
  const track = tracks.some((t) => t.key === want) ? want : 'carcass';
  return stageIndex(stageOf(u, track)) >= stageIndex('cut');
}

/**
 * לכל שורת גוון+חומר: האם כל מה שמרכיב אותה כבר נחתך.
 *
 * ארגז שאין לו מסלולי עבודה — לוח בודד או מכשיר — אינו עוצר את
 * השורה, אבל גם אינו מספיק לבדו: שורה שכולה כזו לא תופחת לעולם,
 * כי אף אחד לא סימן בה כלום.
 */
function cutLines(
  units: PlacedUnit[],
  settings: PartSettings,
  project?: Project,
): Set<string> {
  const state = new Map<string, { tracked: number; cut: number }>();
  for (const u of units) {
    for (const part of unitParts(u, settings)) {
      const choice = partChoice(u, part.role, project);
      if (!choice.materialId) continue;
      const key = `${choice.finishId ?? ''}:${choice.materialId}`;
      const row = state.get(key) ?? { tracked: 0, cut: 0 };
      if (tracksOf(u).length) {
        row.tracked += 1;
        if (partCut(u, part.role)) row.cut += 1;
      }
      state.set(key, row);
    }
  }
  const out = new Set<string>();
  for (const [key, row] of state) {
    if (row.tracked > 0 && row.tracked === row.cut) out.add(key);
  }
  return out;
}

export const consumptionRepo = {
  async all(): Promise<Consumption[]> {
    return db.consumption.toArray();
  },
  async listForProject(projectId: string): Promise<Consumption[]> {
    return db.consumption.where('projectId').equals(projectId).toArray();
  },
};

/**
 * מיישר את המלאי למה שסומן בפרויקט.
 *
 * נקראת אחרי כל שינוי בסימוני העבודה. היא מחשבת מחדש מה נחתך, ומזיזה
 * את המלאי רק בהפרש: שורה שכבר הופחתה לא תופחת שוב, ושורה שהסימון
 * שלה בוטל מקבלת את הפלטות בחזרה.
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
    db.units.where('projectId').equals(projectId).toArray(),
    settingsRepo.get(),
    db.projects.get(projectId),
  ]);
  const cut = cutLines(units, settings, project);
  const existing = await db.consumption.where('projectId').equals(projectId).toArray();
  const now = Date.now();

  for (const line of costing.lines) {
    const was = existing.find((c) => c.lineKey === line.key);
    const wants = cut.has(line.key) ? line.sheets : 0;
    const had = was?.sheets ?? 0;
    if (wants === had) continue;

    await moveStock(line.finish?.id, line.material.id, had - wants);
    if (wants === 0) {
      if (was) await db.consumption.delete(was.id);
    } else if (was) {
      await db.consumption.update(was.id, { sheets: wants, updatedAt: now });
    } else {
      await db.consumption.add({
        id: crypto.randomUUID(),
        projectId,
        lineKey: line.key,
        finishId: line.finish?.id,
        materialId: line.material.id,
        sheets: wants,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /* שורה שנעלמה מהתמחור — הגוון הוחלף, הארגז נמחק — מחזירה את שלה */
  for (const c of existing) {
    if (costing.lines.some((l) => l.key === c.lineKey)) continue;
    await moveStock(c.finishId, c.materialId, c.sheets);
    await db.consumption.delete(c.id);
  }
}

/**
 * מחזיר למלאי את מה שהפרויקט לקח, ומוחק את רישומי הצריכה שלו.
 *
 * נקראת כשפרויקט נמחק. בלעדיה הפלטות שנחתכו בפרויקט שנמחק היו
 * נשארות חסרות במלאי לנצח, בלי שום רישום שמסביר לאן הלכו.
 */
export async function releaseConsumption(projectId: string): Promise<void> {
  const rows = await db.consumption.where('projectId').equals(projectId).toArray();
  for (const c of rows) {
    await moveStock(c.finishId, c.materialId, c.sheets);
    await db.consumption.delete(c.id);
  }
}

/** מוסיף פלטות למלאי (מספר חיובי) או מוריד ממנו (שלילי). */
async function moveStock(
  finishId: string | undefined,
  materialId: string,
  delta: number,
): Promise<void> {
  if (!finishId || delta === 0) return;
  const rows = await db.stock.toArray();
  const row = rows.find((r) => r.finishId === finishId && r.materialId === materialId);
  const now = Date.now();
  /*
   * מלאי שלילי מותר במכוון: הוא אומר "חתכנו יותר ממה שהיה רשום",
   * וזה מידע. עיגול לאפס היה מסתיר את הפער במקום להראות אותו.
   */
  if (row) {
    await db.stock.update(row.id, { sheets: row.sheets + delta, updatedAt: now });
    return;
  }
  await db.stock.add({
    id: crypto.randomUUID(),
    finishId,
    materialId,
    sheets: delta,
    ordered: 0,
    createdAt: now,
    updatedAt: now,
  });
}
