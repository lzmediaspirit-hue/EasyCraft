import { db } from '../../db/db';
import { stagesRepo } from '../../workflow/workflowRepo';
import { projectCosting, type ProjectCosting } from '../../costing/boards';
import { boardsRepo, finishesRepo, projectPricesRepo, settingsRepo } from '../../materials/materialsRepo';
import type {
  CatalogItem,
  PlacedUnit,
  Project,
  RoomKind,
  Wall,
  WallFeature,
} from '../../db/types';

export interface NewWallInput {
  lengthMm: number;
  heightMm: number;
  features: WallFeature[];
}

export const projectsRepo = {
  async listForCustomer(customerId: string): Promise<Project[]> {
    const rows = await db.projects.where('customerId').equals(customerId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },

  /** כל הפרויקטים בעסק — מה שהמנהל רואה. */
  async all(): Promise<Project[]> {
    const rows = await db.projects.toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },

  async get(id: string): Promise<Project | undefined> {
    return db.projects.get(id);
  },

  /** יוצר פרויקט יחד עם הקירות שלו בפעולה אחת. */
  async create(input: {
    customerId: string;
    name: string;
    roomKind: RoomKind;
    walls: NewWallInput[];
  }): Promise<Project> {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      customerId: input.customerId,
      name: input.name.trim(),
      roomKind: input.roomKind,
      createdAt: now,
      updatedAt: now,
    };
    const walls: Wall[] = input.walls.map((w, index) => ({
      id: crypto.randomUUID(),
      projectId: project.id,
      index,
      lengthMm: w.lengthMm,
      heightMm: w.heightMm,
      features: w.features,
      createdAt: now,
      updatedAt: now,
    }));

    await db.transaction('rw', db.projects, db.walls, async () => {
      await db.projects.add(project);
      await db.walls.bulkAdd(walls);
    });

    // השלבים נוצרים סגורים; המכירה היא מה שפותח את התהליך
    await stagesRepo.ensure(project.id, false);
    return project;
  },

  async update(id: string, patch: Partial<Omit<Project, 'id'>>): Promise<void> {
    await db.projects.update(id, { ...patch, updatedAt: Date.now() });
  },

  /**
   * סימון הפרויקט כנמכר.
   * זו הנקודה שבה עוברים מהצעת מחיר לייצור, ולכן היא גם מה שפותח
   * את תהליך העבודה — לפניה אין מה לחתוך.
   */
  async markSold(id: string): Promise<void> {
    await db.projects.update(id, { soldAt: Date.now(), updatedAt: Date.now() });
    await stagesRepo.start(id);
  },

  async remove(id: string): Promise<void> {
    // גם תהליך העבודה והקבצים נמחקים, כדי שלא יישארו שלבים יתומים
    await db.transaction(
      'rw',
      db.projects,
      db.walls,
      db.units,
      db.stages,
      db.attachments,
      async () => {
        await db.units.where('projectId').equals(id).delete();
        await db.walls.where('projectId').equals(id).delete();
        await db.stages.where('projectId').equals(id).delete();
        await db.attachments.where('projectId').equals(id).delete();
        await db.projects.delete(id);
      },
    );
  },

  /** סיכום כל פרויקט — ארגזים, פלטות ומחיר — לתצוגה ברשימה. */
  async summaries(projectIds: string[]): Promise<Record<string, ProjectCosting>> {
    const [boards, settings, finishes] = await Promise.all([
      boardsRepo.list(),
      settingsRepo.get(),
      finishesRepo.all(),
    ]);
    const out: Record<string, ProjectCosting> = {};
    for (const id of projectIds) {
      const [units, overrides] = await Promise.all([
        db.units.where('projectId').equals(id).toArray(),
        projectPricesRepo.listForProject(id),
      ]);
      out[id] = projectCosting(units, boards, settings, overrides, finishes);
    }
    return out;
  },

  /** תמחור פרויקט יחיד, למסך ההדמיה. */
  async costing(projectId: string): Promise<ProjectCosting> {
    const [units, boards, settings, overrides, finishes] = await Promise.all([
      db.units.where('projectId').equals(projectId).toArray(),
      boardsRepo.list(),
      settingsRepo.get(),
      projectPricesRepo.listForProject(projectId),
      finishesRepo.all(),
    ]);
    return projectCosting(units, boards, settings, overrides, finishes);
  },
};

export const wallsRepo = {
  async listForProject(projectId: string): Promise<Wall[]> {
    const rows = await db.walls.where('projectId').equals(projectId).toArray();
    return rows.sort((a, b) => a.index - b.index);
  },

  /**
   * מוסיף קיר בסוף השרשרת.
   * חדר אמיתי לא תמיד מלבן, ולפעמים מתגלה קיר נוסף רק במדידה
   * בשטח — ולכן מספר הקירות אינו נעול למה שנבחר ביצירת הפרויקט.
   * הקיר החדש יורש את גובה הקודם, כי זה אותו חדר.
   */
  async add(projectId: string): Promise<Wall> {
    const existing = await this.listForProject(projectId);
    const last = existing[existing.length - 1];
    const now = Date.now();
    const wall: Wall = {
      id: crypto.randomUUID(),
      projectId,
      index: existing.length,
      lengthMm: last?.lengthMm ?? 3000,
      heightMm: last?.heightMm ?? 2600,
      features: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.walls.add(wall);
    return wall;
  },

  /** מוחק קיר ואת הארגזים שעליו, ומסדר מחדש את המספור. */
  async remove(id: string): Promise<void> {
    const wall = await db.walls.get(id);
    if (!wall) return;
    await db.transaction('rw', db.walls, db.units, async () => {
      await db.units.where('wallId').equals(id).delete();
      await db.walls.delete(id);
      const rest = (await db.walls.where('projectId').equals(wall.projectId).toArray()).sort(
        (a, b) => a.index - b.index,
      );
      await Promise.all(rest.map((w, index) => db.walls.update(w.id, { index })));
    });
  },

  async update(id: string, patch: Partial<Omit<Wall, 'id'>>): Promise<void> {
    await db.walls.update(id, { ...patch, updatedAt: Date.now() });
  },
};

export const unitsRepo = {
  async listForProject(projectId: string): Promise<PlacedUnit[]> {
    // מיון לפי סדר ההוספה. בלעדיו הסדר נגזר מהמזהה האקראי,
    // והציור ורשימת הניסור היו משתנים בין טעינות.
    const rows = await db.units.where('projectId').equals(projectId).toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },

  /**
   * מוסיף ארגז לקיר. המידות מועתקות מהספרייה ברגע ההנחה, כדי שעריכה
   * מאוחרת בספרייה לא תשנה פרויקט שכבר תומחר.
   */
  async add(
    projectId: string,
    wallId: string,
    item: CatalogItem,
    xMm: number,
    widthMm?: number,
  ): Promise<PlacedUnit> {
    const now = Date.now();
    const unit: PlacedUnit = {
      id: crypto.randomUUID(),
      projectId,
      wallId,
      catalogItemId: item.id,
      name: item.name,
      glyph: item.glyph,
      doors: item.doors,
      drawers: item.drawers,
      drawerCols: item.drawerCols,
      shelves: item.shelves,
      zones: item.zones,
      opening: item.opening,
      corner: item.corner,
      blindMm: item.blindMm,
      panelThicknessMm: item.panelThicknessMm,
      // גימור שנשמר עם הפריט חוזר איתו, כדי שלא יידרש אותו כיוונון שוב
      drawerStyle: item.drawerStyle,
      exposed: item.exposed,
      backKind: item.backKind,
      handles: item.handles,
      glassDoors: item.glassDoors,
      led: item.led,
      shelfGapsMm: item.shelfGapsMm,
      carcassFinishId: item.carcassFinishId,
      frontFinishId: item.frontFinishId,
      exposedFinishId: item.exposedFinishId,
      level: item.level,
      xMm,
      /*
       * ארגז שעומד על הרצפה מתחיל עליה, ולא בגובה שנשמר בספרייה.
       * הגובה השמור נועד לארון תלוי; ארגז תחתון או עמודה שמקבלים
       * אותו היו נראים מרחפים מעל הרצפה ברגע ההוספה.
       */
      yMm: item.level === 'wall' ? item.defaultYMm : 0,
      widthMm: widthMm ?? item.defaultWidthMm,
      heightMm: item.defaultHeightMm,
      depthMm: item.defaultDepthMm,
      socleMm: item.socleMm,
      counterMm: item.counterMm,
      // ארגז שעומד על הרצפה נעול אליה כברירת מחדל; ארון תלוי חופשי לגובה
      floorLocked: item.level !== 'wall',
      createdAt: now,
      updatedAt: now,
    };
    await db.units.add(unit);
    return unit;
  },

  async update(id: string, patch: Partial<Omit<PlacedUnit, 'id'>>): Promise<void> {
    await db.units.update(id, { ...patch, updatedAt: Date.now() });
  },

  async remove(id: string): Promise<void> {
    await db.units.delete(id);
  },

  /** קובע גוון אחיד לחלק מסוים בכל הארונות בפרויקט. */
  async setFinishForProject(
    projectId: string,
    part: 'carcass' | 'front' | 'exposed' | 'back',
    finishId: string | undefined,
  ): Promise<void> {
    const key = (
      { carcass: 'carcassFinishId', front: 'frontFinishId', exposed: 'exposedFinishId', back: 'backFinishId' } as const
    )[part];
    const rows = await db.units.where('projectId').equals(projectId).toArray();
    const now = Date.now();
    await db.units.bulkPut(rows.map((u) => ({ ...u, [key]: finishId, updatedAt: now })));
  },

  /** קובע עומק אחיד לכל הארונות בפרויקט. */
  async setDepthForProject(projectId: string, depthMm: number, onlyFloor: boolean): Promise<void> {
    const rows = await db.units.where('projectId').equals(projectId).toArray();
    const now = Date.now();
    await db.units.bulkPut(
      rows
        .filter((u) => (onlyFloor ? u.level !== 'wall' : true))
        .map((u) => ({ ...u, depthMm, updatedAt: now })),
    );
  },
};
