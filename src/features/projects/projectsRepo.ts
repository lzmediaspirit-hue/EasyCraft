import { db } from '../../db/db';
import { projectCosting, type ProjectCosting } from '../../costing/boards';
import { boardsRepo, projectPricesRepo, settingsRepo } from '../../materials/materialsRepo';
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
    return project;
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.projects, db.walls, db.units, async () => {
      await db.units.where('projectId').equals(id).delete();
      await db.walls.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    });
  },

  /** סיכום כל פרויקט — ארגזים, פלטות ומחיר — לתצוגה ברשימה. */
  async summaries(projectIds: string[]): Promise<Record<string, ProjectCosting>> {
    const [boards, settings] = await Promise.all([boardsRepo.list(), settingsRepo.get()]);
    const out: Record<string, ProjectCosting> = {};
    for (const id of projectIds) {
      const [units, overrides] = await Promise.all([
        db.units.where('projectId').equals(id).toArray(),
        projectPricesRepo.listForProject(id),
      ]);
      out[id] = projectCosting(units, boards, settings, overrides);
    }
    return out;
  },

  /** תמחור פרויקט יחיד, למסך ההדמיה. */
  async costing(projectId: string): Promise<ProjectCosting> {
    const [units, boards, settings, overrides] = await Promise.all([
      db.units.where('projectId').equals(projectId).toArray(),
      boardsRepo.list(),
      settingsRepo.get(),
      projectPricesRepo.listForProject(projectId),
    ]);
    return projectCosting(units, boards, settings, overrides);
  },
};

export const wallsRepo = {
  async listForProject(projectId: string): Promise<Wall[]> {
    const rows = await db.walls.where('projectId').equals(projectId).toArray();
    return rows.sort((a, b) => a.index - b.index);
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
      level: item.level,
      xMm,
      yMm: item.defaultYMm,
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
