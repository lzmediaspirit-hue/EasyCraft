import { db } from '../db/db';
import { partChoice, unitParts } from '../costing/boards';
import { stageIndex, stageOf, tracksOf } from '../workflow/unitWork';
import type { PartSettings } from '../costing/boards';
import type { Consumption, PartRole, PlacedUnit, Project, WorkTrack } from '../db/types';
import { allMine, eraseIds, onlyMine, owned, patchRow } from '../db/rows';

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
export function cutLines(
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
    return allMine(db.consumption);
  },
  async listForProject(projectId: string): Promise<Consumption[]> {
    return onlyMine(await db.consumption.where('projectId').equals(projectId).toArray());
  },
};

/**
 * מחזיר למלאי את מה שהפרויקט לקח, ומוחק את רישומי הצריכה שלו.
 *
 * נקראת כשפרויקט נמחק. בלעדיה הפלטות שנחתכו בפרויקט שנמחק היו
 * נשארות חסרות במלאי לנצח, בלי שום רישום שמסביר לאן הלכו.
 */
export async function releaseConsumption(projectId: string): Promise<void> {
  await db.transaction('rw', db.consumption, db.stock, db.tombstones, async () => {
    const rows = await consumptionRepo.listForProject(projectId);
    for (const c of rows) {
      await moveStock(c.finishId, c.materialId, c.sheets);
      await eraseIds(db.consumption, [c.id]);
    }
  });
}

/**
 * מוסיף פלטות למלאי (מספר חיובי) או מוריד ממנו (שלילי).
 * קריאה וכתיבה באותה עסקה, כדי ששתי הפחתות במקביל לא יקראו את אותו
 * מצב ויכתבו זו על זו. קריאה מתוך עסקה פתוחה מצטרפת אליה.
 */
export async function moveStock(
  finishId: string | undefined,
  materialId: string,
  delta: number,
): Promise<void> {
  if (!finishId || delta === 0) return;
  await db.transaction('rw', db.stock, async () => {
    const rows = await allMine(db.stock);
    const row = rows.find((r) => r.finishId === finishId && r.materialId === materialId);
    const now = Date.now();
    /*
     * מלאי שלילי מותר במכוון: הוא אומר "חתכנו יותר ממה שהיה רשום",
     * וזה מידע. עיגול לאפס היה מסתיר את הפער במקום להראות אותו.
     */
    if (row) {
      await patchRow(db.stock, row.id, { sheets: row.sheets + delta });
      return;
    }
    await db.stock.add({
      id: crypto.randomUUID(),
      finishId,
      materialId,
      sheets: delta,
      ordered: 0,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
  });
}
