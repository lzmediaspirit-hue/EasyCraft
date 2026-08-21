import { db } from '../../db/db';
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

  /** מספר הארגזים בכל פרויקט — לתצוגה ברשימה. */
  async unitCounts(projectIds: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of projectIds) {
      counts[id] = await db.units.where('projectId').equals(id).count();
    }
    return counts;
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
    return db.units.where('projectId').equals(projectId).toArray();
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
      level: item.level,
      xMm,
      yMm: item.defaultYMm,
      widthMm: widthMm ?? item.defaultWidthMm,
      heightMm: item.defaultHeightMm,
      depthMm: item.defaultDepthMm,
      socleMm: item.socleMm,
      counterMm: item.counterMm,
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
};
