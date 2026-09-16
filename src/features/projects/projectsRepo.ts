import type { Placement as PlanPlacement } from '../design/autoPlan';
import { matchCatalog } from '../design/planMatch';
import { db } from '../../db/db';
import { stagesRepo } from '../../workflow/workflowRepo';
import { projectCosting, type ProjectCosting } from '../../costing/boards';
import { finishesRepo, materialsRepo, projectPricesRepo, settingsRepo } from '../../materials/materialsRepo';
import { releaseConsumption } from '../../materials/consumption';
import { reusableSpec } from '../../db/types';
import type {

  CatalogItem,
  FreePlacement,
  PartChoice,
  PartRole,
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
  /** הפנייה ביחס לקיר הקודם. ריק = פינה ישרה */
  turnDeg?: number;
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
    /** הגוון והחומר שנבחרו לפרויקט, לכל חלק */
    defaults?: Project['defaults'];
  }): Promise<Project> {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      customerId: input.customerId,
      name: input.name.trim(),
      roomKind: input.roomKind,
      defaults: input.defaults,
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
      turnDeg: w.turnDeg,
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

  /**
   * שכפול פרויקט: אותו חדר, אותם ארגזים, אותם גימורים.
   *
   * דירות בבניין אחד חוזרות על עצמן, ולקוח שמזמין מטבח שני רוצה
   * את הראשון בשינוי אחד — לא לשרטט אותו מחדש. לכן מועתקים
   * הקירות, הסימונים שעליהם והארגזים עם כל מה שכוונן בהם.
   *
   * מה שלא מועתק הוא מה ששייך למכירה הקודמת ולא לתכנון: הפרויקט
   * החדש אינו מכור, אין לו תשלומים, אין לו קבצים ואין לו היסטוריית
   * ייצור. הוא הצעה חדשה שנראית כמו הקודמת.
   *
   * המחירים המיוחדים של הפרויקט כן עוברים. מחיר שנקבע ללוח מסוים הוא
   * המחיר שהנגר משלם עליו בפועל, ודירה שנייה באותו בניין נבנית מאותם
   * לוחות — בלעדיו ההצעה המשוכפלת חוזרת למחירון ומשתנה בעשרות אחוזים
   * בלי שאיש ביקש.
   */

  async duplicate(id: string, name?: string): Promise<Project | undefined> {
    const source = await db.projects.get(id);
    if (!source) return undefined;
    const now = Date.now();
    const project: Project = {
      ...source,
      id: crypto.randomUUID(),
      name: (name ?? `${source.name} — עותק`).trim(),
      soldAt: undefined,
      payments: undefined,
      editRequest: undefined,
      editGrantedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };

    const [walls, units, prices] = await Promise.all([
      db.walls.where('projectId').equals(id).toArray(),
      db.units.where('projectId').equals(id).toArray(),
      db.projectPrices.where('projectId').equals(id).toArray(),
    ]);
    /* מזהה חדש לכל קיר, והארגזים עוברים איתו */
    const wallId = new Map(walls.map((w) => [w.id, crypto.randomUUID()]));

    await db.transaction('rw', db.projects, db.walls, db.units, db.projectPrices, async () => {

      await db.projects.add(project);
      await db.walls.bulkAdd(
        walls.map((w) => ({
          ...w,
          id: wallId.get(w.id)!,
          projectId: project.id,
          /* הסימונים הם אובייקטים; העתקה רדודה הייתה משתפת אותם */
          features: w.features.map((f) => ({ ...f, id: crypto.randomUUID() })),
          createdAt: now,
          updatedAt: now,
        })),
      );
      await db.units.bulkAdd(
        units.map((u, i) => ({
          ...u,
          id: crypto.randomUUID(),
          projectId: project.id,
          wallId: wallId.get(u.wallId) ?? u.wallId,
          /* תהליך העבודה שייך לארגז שכבר נבנה, לא לעותק שלו */
          work: undefined,
          /* הסדר נשמר: `listForProject` ממיין לפי מועד ההוספה */
          createdAt: now + i,
          updatedAt: now,
        })),
      );
      /* המחיר נקבע לשורה של גוון וחומר, והמפתח הזה זהה בכל פרויקט */
      await db.projectPrices.bulkAdd(
        prices.map((p) => ({
          ...p,
          id: crypto.randomUUID(),
          projectId: project.id,
          createdAt: now,
          updatedAt: now,
        })),
      );
    });


    await stagesRepo.ensure(project.id, false);
    return project;
  },

  async remove(id: string): Promise<void> {
    /* קודם המלאי: פלטות שנחתכו בפרויקט חוזרות אליו לפני שהוא נעלם */
    await releaseConsumption(id);
    // גם תהליך העבודה, הקבצים והמחירים נמחקים, כדי שלא יישארו יתומים
    const tables = [db.projects, db.walls, db.units, db.stages, db.attachments, db.projectPrices];
    await db.transaction('rw', tables, async () => {
      await db.units.where('projectId').equals(id).delete();
      await db.walls.where('projectId').equals(id).delete();
      await db.stages.where('projectId').equals(id).delete();
      await db.attachments.where('projectId').equals(id).delete();
      await db.projectPrices.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    });
  },

  /** סיכום כל פרויקט — ארגזים, פלטות ומחיר — לתצוגה ברשימה. */
  async summaries(projectIds: string[]): Promise<Record<string, ProjectCosting>> {
    const [materials, settings, finishes] = await Promise.all([
      materialsRepo.list(),
      settingsRepo.get(),
      finishesRepo.all(),
    ]);
    const out: Record<string, ProjectCosting> = {};
    for (const id of projectIds) {
      const [project, units, overrides] = await Promise.all([
        db.projects.get(id),
        db.units.where('projectId').equals(id).toArray(),
        projectPricesRepo.listForProject(id),
      ]);
      out[id] = projectCosting(units, materials, settings, overrides, finishes, project);
    }
    return out;
  },

  /** תמחור פרויקט יחיד, למסך ההדמיה. */
  async costing(projectId: string): Promise<ProjectCosting> {
    const [units, materials, settings, overrides, finishes, project] = await Promise.all([
      db.units.where('projectId').equals(projectId).toArray(),
      materialsRepo.list(),
      settingsRepo.get(),
      projectPricesRepo.listForProject(projectId),
      finishesRepo.all(),
      db.projects.get(projectId),
    ]);
    return projectCosting(units, materials, settings, overrides, finishes, project);
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
  /**
   * הנחת פריט מורכב: כמה ארגזים בבת אחת, במרחקים ששמרנו להם.
   *
   * הקבוצה מונחת מפינה אחת, ולכן היא נשארת מחוברת גם אחרי שהוזזה:
   * מה שנשמר הוא היחס בין החלקים, לא המקום שבו הם היו.
   */
  async addGroup(
    projectId: string,
    wallId: string,
    item: CatalogItem,
    xMm: number,
  ): Promise<PlacedUnit[]> {
    const now = Date.now();
    const out: PlacedUnit[] = [];
    for (const [i, part] of (item.parts ?? []).entries()) {
      out.push({
        level: item.level,
        widthMm: item.defaultWidthMm,
        heightMm: item.defaultHeightMm,
        depthMm: item.defaultDepthMm,
        ...part.unit,
        id: crypto.randomUUID(),
        projectId,
        wallId,
        catalogItemId: item.id,
        name: part.unit.name ?? item.name,
        glyph: part.unit.glyph ?? item.glyph,
        xMm: xMm + part.dxMm,
        /*
         * גובה ההנחה הוא הבסיס ששמור בצירוף ועוד ההפרש של החלק.
         * קודם נלקח ההפרש בלבד, ולכן קבוצה של ארונות תלויים שנשמרה
         * בגובה 1,500 הונחה כולה על הרצפה.
         */
        yMm: item.defaultYMm + part.dyMm,

        createdAt: now + i,
        updatedAt: now + i,
      } as PlacedUnit);
    }
    if (out.length) await db.units.bulkAdd(out);
    return out;
  },

  async add(
    projectId: string,
    wallId: string,
    item: CatalogItem,
    xMm: number,
    widthMm?: number,
    /*
     * המקום בחדר, לתבנית אי.
     *
     * אי אינו נמדד על קיר, ולכן הוא אינו מקבל `xMm` אלא נקודה
     * ברצפת החדר. הקיר עדיין נשמר בשורה — הוא הקיר שממנו הוא
     * נולד, וזה מה שמחזיר אותו לקיר אם ירצו.
     */
    free?: FreePlacement,
  ): Promise<PlacedUnit> {
    const now = Date.now();
    const { defaults } = await settingsRepo.get();
    const unit: PlacedUnit = {
      /*
       * כל תיאור הבנייה שנשמר בפריט, מרשימה אחת משותפת עם השמירה
       * לספרייה. ככה מאפיין שנוסף לארגז אינו נשמט באחד משני הכיוונים.
       */
      ...reusableSpec(item),
      id: crypto.randomUUID(),
      projectId,
      wallId,
      catalogItemId: item.id,
      name: item.name,
      glyph: item.glyph,
      // תיבת המגירה היא דרך העבודה של הנגרייה, ולא מאפיין של הפריט
      drawerBox: defaults.drawerBox,
      // הגב שהפריט הגיע איתו, ואם אין — דרך העבודה של הנגרייה
      backKind: item.backKind ?? defaults.backKind,
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
      /*
       * הרגליים נלקחות מברירות המחדל של הנגרייה ולא מהספרייה: הן
       * אותו גובה בכל ארגז תחתון בעסק, ומי שעובד ב-12 ס"מ לא אמור
       * לתקן אותן בכל ארגז מחדש. הספרייה קובעת רק אם יש רגליים בכלל.
       */
      socleMm: item.socleMm ? defaults.socleMm : item.socleMm,
      counterMm: item.counterMm,
      // ארגז שעומד על הרצפה נעול אליה כברירת מחדל; ארון תלוי חופשי לגובה
      floorLocked: item.level !== 'wall',
      /* תבנית אי נוחתת בחדר; כל השאר נוחת על הקיר */
      ...(item.island && free ? { free } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await db.units.add(unit);
    return unit;
  },

  /**
   * מניח תכנון מטבח שלם במקום מה שיש.
   *
   * ההצעה מגיעה כהפניות לספרייה, וכל אחת עוברת דרך `add` הרגילה —
   * אותו נתיב שבו נגר מניח ארגז ביד. לכן מטבח אוטומטי מקבל את
   * אותם גימורים, אותה גובה רגליים ואותה ברירת גב, והוא מתומחר
   * ומנוסר בלי שום מסלול מיוחד.
   *
   * הארגזים הקיימים נמחקים תחילה: הצעה היא מטבח שלם, ולא שכבה
   * נוספת מעל מה שכבר עומד על הקיר. הביטול נשמר בהיסטוריה של
   * המסך, ולכן אין כאן גיבוי משלנו.
   *
   * לפני המחיקה נבדק שכל ההצעה ניתנת להנחה. ההצעה מפנה לארגזי התקן,
   * ומי שהחליף את הספרייה בשלו אינו מחזיק אותם: קודם נמחק מה שעמד
   * על הקיר ואחר כך דולגו הפריטים שלא נמצאו, והפרויקט נשאר ריק.
   */
  async applyPlan(
    projectId: string,
    placements: PlanPlacement[],
  ): Promise<{ ok: true } | { ok: false; missing: number }> {
    /*
     * ההצעה מדברת בתפקידים, והספרייה היא של הנגרייה: כל תפקיד
     * מתורגם לארגז שקיים כאן בפועל, ולא למפתח של ארגזי התקן.
     */
    const items = (await db.catalog.toArray()).filter((i) => !i.hiddenAt);
    const chosen = new Map<string, CatalogItem>();
    for (const p of placements) {
      const item = matchCatalog(p.catalogKey, items, p.widthMm);
      if (item) chosen.set(`${p.catalogKey}|${p.widthMm}`, item);
    }
    const missing = placements.filter(
      (p) => !chosen.has(`${p.catalogKey}|${p.widthMm}`),
    ).length;
    if (missing) return { ok: false, missing };

    await db.units.where('projectId').equals(projectId).delete();
    for (const p of placements) {
      const item = chosen.get(`${p.catalogKey}|${p.widthMm}`)!;
      const unit = await this.add(projectId, p.wallId, item, p.xMm, p.widthMm);
      if (p.free || p.blindMm) {
        await this.update(unit.id, {
          ...(p.free ? { free: p.free } : {}),
          ...(p.blindMm ? { blindMm: p.blindMm } : {}),
        });
      }
    }
    return { ok: true };
  },

  async update(id: string, patch: Partial<Omit<PlacedUnit, 'id'>>): Promise<void> {
    await db.units.update(id, { ...patch, updatedAt: Date.now() });
  },

  async remove(id: string): Promise<void> {
    await db.units.delete(id);
  },

  /**
   * משכפל ארגז לאותו קיר.
   * הרוב המוחלט של קיר הוא אותו ארגז שוב ושוב במידה אחרת, ולבנות
   * כל אחד מחדש מהספרייה זו עבודה שכבר נעשתה.
   *
   * סימוני הייצור אינם מועתקים: הארגז החדש הוא עבודה שעוד לא נעשתה.
   * בלי זה שכפול של ארגז שכבר הותקן ייצר ארגז שני שנראה מותקן, והוא
   * יוצא מרשימת מה שנשאר לחתוך בלי שאיש חתך אותו.
   */
  async duplicate(id: string, xMm: number): Promise<PlacedUnit | undefined> {
    const source = await db.units.get(id);
    if (!source) return undefined;
    const now = Date.now();
    const { work: _fresh, ...rest } = source;
    const copy: PlacedUnit = {
      ...rest,
      id: crypto.randomUUID(),
      xMm,
      createdAt: now,
      updatedAt: now,
    };
    await db.units.add(copy);
    return copy;
  },

  /**
   * ממרכז את הארגזים על הקיר.
   * המרכוז נעשה על הקבוצה כולה ולא על כל ארגז בנפרד: המרווחים
   * שביניהם הם החלטה של הנגר, וריכוזם באמצע לא אמור לשנות אותם.
   */
  async centerOnWall(wallId: string, wallLengthMm: number): Promise<void> {
    const rows = await db.units.where('wallId').equals(wallId).toArray();
    if (!rows.length) return;
    const from = Math.min(...rows.map((u) => u.xMm));
    const to = Math.max(...rows.map((u) => u.xMm + u.widthMm));
    const offset = Math.round((wallLengthMm - (to - from)) / 2 - from);
    if (offset === 0) return;
    const now = Date.now();
    await db.units.bulkPut(
      rows.map((u) => ({ ...u, xMm: Math.max(u.xMm + offset, 0), updatedAt: now })),
    );
  },

  /**
   * קובע גוון וחומר אחידים לחלק מסוים בכל הפרויקט.
   *
   * הבחירה נשמרת כברירת המחדל של הפרויקט, והחריגות שנקבעו בארגזים
   * בודדים נמחקות. כך "לכל הפרויקט" באמת מחיל — וגם ארגז שיתווסף
   * מחר יקבל את אותו גוון בלי לגעת בו.
   */
  async setChoiceForProject(
    projectId: string,
    role: PartRole,
    choice: PartChoice,
  ): Promise<void> {
    const project = await db.projects.get(projectId);
    if (!project) return;
    const now = Date.now();
    await db.projects.update(projectId, {
      defaults: { ...project.defaults, [role]: choice },
      updatedAt: now,
    });

    const rows = await db.units.where('projectId').equals(projectId).toArray();
    await db.units.bulkPut(
      rows.map((u) => ({
        ...u,
        [`${role}FinishId`]: undefined,
        [`${role}MaterialId`]: undefined,
        // הגוון הישן של החזית נשמר בשדה נפרד, ולכן הוא נמחק גם הוא
        ...(role === 'front' ? { finishId: undefined } : {}),
        updatedAt: now,
      })),
    );
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
