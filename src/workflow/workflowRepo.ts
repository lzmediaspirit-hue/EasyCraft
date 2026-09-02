import { db } from '../db/db';
import { STAGES } from './stages';
import type {
  Attachment,
  AttachmentKind,
  ProjectStage,
  StageKey,
  TeamMember,
  UserRole,
} from '../db/types';

/* ------------------------------------------------------------------ */
/* הצוות                                                               */
/* ------------------------------------------------------------------ */

export const teamRepo = {
  async list(): Promise<TeamMember[]> {
    const rows = await db.team.toArray();
    return rows.sort((a, b) => Number(b.active) - Number(a.active) || a.createdAt - b.createdAt);
  },

  async get(id: string): Promise<TeamMember | undefined> {
    return db.team.get(id);
  },

  async forRole(role: UserRole): Promise<TeamMember[]> {
    return (await teamRepo.list()).filter((m) => m.active && m.role === role);
  },

  async save(input: Partial<TeamMember> & { name: string; role: UserRole }): Promise<string> {
    const now = Date.now();
    if (input.id) {
      const { id, ...rest } = input;
      await db.team.update(id, { ...rest, updatedAt: now });
      return id;
    }
    const id = crypto.randomUUID();
    await db.team.add({ active: true, ...input, id, createdAt: now, updatedAt: now });
    return id;
  },

  async remove(id: string): Promise<void> {
    await db.team.delete(id);
  },
};

/* ------------------------------------------------------------------ */
/* שלבי הפרויקט                                                        */
/* ------------------------------------------------------------------ */

export const stagesRepo = {
  async listForProject(projectId: string): Promise<ProjectStage[]> {
    const rows = await db.stages.where('projectId').equals(projectId).toArray();
    const order = new Map(STAGES.map((s, i) => [s.key, i]));
    return rows.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  },

  async all(): Promise<ProjectStage[]> {
    return db.stages.toArray();
  },

  /**
   * יוצר את השלבים החסרים לפרויקט.
   * נקרא בכל פתיחה של תהליך העבודה, כך שגם פרויקט שנוצר לפני
   * שהתהליך היה קיים מקבל אותו — בלי לגעת בשלבים שכבר התקדמו.
   */
  async ensure(projectId: string, open = true): Promise<ProjectStage[]> {
    const existing = await stagesRepo.listForProject(projectId);
    const have = new Set(existing.map((s) => s.key));
    const now = Date.now();
    const missing = STAGES.filter((s) => !have.has(s.key)).map((s, i) => ({
      id: crypto.randomUUID(),
      projectId,
      key: s.key,
      // התהליך נפתח במכירה; עד אז כל השלבים ממתינים
      status: (open && !have.size && i === 0 ? 'active' : 'waiting') as ProjectStage['status'],
      createdAt: now,
      updatedAt: now,
    }));
    if (missing.length) await db.stages.bulkAdd(missing);
    return stagesRepo.listForProject(projectId);
  },

  /** פותח את התהליך: השלב הראשון שעדיין ממתין הופך לפעיל. */
  async start(projectId: string): Promise<void> {
    const stages = await stagesRepo.ensure(projectId, false);
    if (stages.some((s) => s.status !== 'waiting')) return;
    const first = stages[0];
    if (first) await stagesRepo.update(first.id, { status: 'active', startedAt: Date.now() });
  },

  /** האם התהליך כבר התחיל. */
  hasStarted(stages: ProjectStage[]): boolean {
    return stages.some((s) => s.status !== 'waiting');
  },

  async update(id: string, patch: Partial<Omit<ProjectStage, 'id'>>): Promise<void> {
    await db.stages.update(id, { ...patch, updatedAt: Date.now() });
  },

  /**
   * סוגר שלב ופותח את הבא בתור.
   *
   * `skipped` נחשב סגור לכל דבר — פרויקט שהלקוח מתקין בעצמו ממשיך
   * הלאה בלי להיתקע על שלב שלא יקרה.
   */
  async complete(projectId: string, key: StageKey, status: 'done' | 'skipped' = 'done'): Promise<void> {
    const stages = await stagesRepo.ensure(projectId);
    const i = stages.findIndex((s) => s.key === key);
    if (i < 0) return;
    const now = Date.now();
    await stagesRepo.update(stages[i].id, { status, doneAt: now });
    const next = stages[i + 1];
    if (next && next.status === 'waiting') {
      await stagesRepo.update(next.id, { status: 'active', startedAt: now });
    }
  },

  /** מחזיר שלב שנסגר בטעות למצב פתוח, וסוגר את מי שנפתח אחריו. */
  async reopen(projectId: string, key: StageKey): Promise<void> {
    const stages = await stagesRepo.ensure(projectId);
    const i = stages.findIndex((s) => s.key === key);
    if (i < 0) return;
    await stagesRepo.update(stages[i].id, { status: 'active', doneAt: undefined });
    for (const later of stages.slice(i + 1)) {
      if (later.status !== 'waiting') {
        await stagesRepo.update(later.id, { status: 'waiting', doneAt: undefined });
      }
    }
  },

  async removeForProject(projectId: string): Promise<void> {
    await db.stages.where('projectId').equals(projectId).delete();
  },
};

/** השלב שהפרויקט עומד בו עכשיו. */
export function currentStage(stages: ProjectStage[]): ProjectStage | undefined {
  const active = stages.find((s) => s.status === 'active');
  if (active) return active;
  // אין שלב פתוח — הפרויקט גמור, ומה שמעניין הוא השלב האחרון שנסגר
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].status !== 'waiting') return stages[i];
  }
  return undefined;
}

/** כמה מהשלבים כבר נסגרו, מתוך כמה. */
export function stageProgress(stages: ProjectStage[]): { done: number; total: number } {
  return {
    done: stages.filter((s) => s.status === 'done' || s.status === 'skipped').length,
    total: stages.length || STAGES.length,
  };
}

/* ------------------------------------------------------------------ */
/* קבצים מצורפים                                                       */
/* ------------------------------------------------------------------ */

export const attachmentsRepo = {
  async listForProject(projectId: string): Promise<Attachment[]> {
    const rows = await db.attachments.where('projectId').equals(projectId).toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },

  async add(projectId: string, kind: AttachmentKind, file: File): Promise<string> {
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.attachments.add({
      id,
      projectId,
      kind,
      name: file.name,
      mime: file.type,
      sizeBytes: file.size,
      blob: file,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async remove(id: string): Promise<void> {
    await db.attachments.delete(id);
  },

  async removeForProject(projectId: string): Promise<void> {
    await db.attachments.where('projectId').equals(projectId).delete();
  },
};
