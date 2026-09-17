import type { Placement as PlanPlacement } from '../design/autoPlan';
import { matchCatalog } from '../design/planMatch';
import {
  allMine,
  bumped,
  eraseIds,
  eraseRows,
  mine,
  onlyMine,
  owned,
  patchRow,
  revive,
} from '../../db/rows';
import { db } from '../../db/db';
import { stagesRepo } from '../../workflow/workflowRepo';
import { partsOf, projectCosting, type ProjectCosting } from '../../costing/boards';
import { BuildError, checkUnit } from '../../catalog/saveGate';
import { landsOnFloor } from '../../catalog/construction';
import { finishesRepo, materialsRepo, projectPricesRepo, settingsRepo } from '../../materials/materialsRepo';
import { releaseConsumption } from '../../materials/consumptionRepo';
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
    return onlyMine(rows).sort((a, b) => b.createdAt - a.createdAt);
  },

  /** כל הפרויקטים בנגרייה — מה שהמנהל רואה. */
  async all(): Promise<Project[]> {
    const rows = await allMine(db.projects);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },

  /*
   * שורה של נגרייה אחרת אינה קיימת מכאן.
   *
   * לא "מוסתרת" — לא קיימת: מי שמנחש מזהה מקבל `undefined` בדיוק
   * כמו מי שמבקש מזהה שלא נוצר מעולם. זה אותו גבול שהשרת יאכוף,
   * וכאן הוא כבר נבדק.
   */
  async get(id: string): Promise<Project | undefined> {
    const row = await db.projects.get(id);
    return row && mine(row) ? row : undefined;
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
      ...owned(),
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
      ...owned(),
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
    await patchRow(db.projects, id, patch);
  },

  /**
   * סימון הפרויקט כנמכר.
   * זו הנקודה שבה עוברים מהצעת מחיר לייצור, ולכן היא גם מה שפותח
   * את תהליך העבודה — לפניה אין מה לחתוך.
   */
  async markSold(id: string): Promise<void> {
    await patchRow(db.projects, id, { soldAt: Date.now() });
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
    const source = await projectsRepo.get(id);
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
      ...owned(),
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
          ...owned(),
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
          ...owned(),
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
          ...owned(),
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
    /* מחיקה משאירה סימון — ראה `eraseRows` */
    await db.transaction('rw', [...tables, db.tombstones], async () => {
      await eraseRows(db.units, await db.units.where('projectId').equals(id).toArray());
      await eraseRows(db.walls, await db.walls.where('projectId').equals(id).toArray());
      await eraseRows(db.stages, await db.stages.where('projectId').equals(id).toArray());
      await eraseRows(
        db.attachments,
        await db.attachments.where('projectId').equals(id).toArray(),
      );
      await eraseRows(
        db.projectPrices,
        await db.projectPrices.where('projectId').equals(id).toArray(),
      );
      await eraseIds(db.projects, [id]);
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
        projectsRepo.get(id),
        unitsRepo.listForProject(id),
        projectPricesRepo.listForProject(id),
      ]);
      out[id] = projectCosting(units, materials, settings, overrides, finishes, project);
    }
    return out;
  },

  /** תמחור פרויקט יחיד, למסך ההדמיה. */
  async costing(projectId: string): Promise<ProjectCosting> {
    const [units, materials, settings, overrides, finishes, project] = await Promise.all([
      unitsRepo.listForProject(projectId),
      materialsRepo.list(),
      settingsRepo.get(),
      projectPricesRepo.listForProject(projectId),
      finishesRepo.all(),
      projectsRepo.get(projectId),
    ]);
    return projectCosting(units, materials, settings, overrides, finishes, project);
  },
};

export const wallsRepo = {
  async listForProject(projectId: string): Promise<Wall[]> {
    const rows = await db.walls.where('projectId').equals(projectId).toArray();
    return onlyMine(rows).sort((a, b) => a.index - b.index);
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
      ...owned(),
      createdAt: now,
      updatedAt: now,
    };
    await db.walls.add(wall);
    return wall;
  },

  /** מוחק קיר ואת הארגזים שעליו, ומסדר מחדש את המספור. */
  async remove(id: string): Promise<void> {
    const wall = await db.walls.get(id);
    /* קיר של נגרייה אחרת אינו נמחק מכאן */
    if (!wall || !mine(wall)) return;
    await db.transaction('rw', db.walls, db.units, db.tombstones, async () => {
      await eraseRows(db.units, await db.units.where('wallId').equals(id).toArray());
      await eraseIds(db.walls, [id]);
      const rest = onlyMine(
        await db.walls.where('projectId').equals(wall.projectId).toArray(),
      ).sort((a, b) => a.index - b.index);
      await Promise.all(rest.map((w, index) => patchRow(db.walls, w.id, { index })));
    });
  },

  async update(id: string, patch: Partial<Omit<Wall, 'id'>>): Promise<void> {
    await patchRow(db.walls, id, patch);
  },
};

/**
 * כמה אי משוכפל נדחף הצידה.
 *
 * רוחב הארגז ועוד מרווח אצבע: מספיק כדי ששני הגופים לא ייגעו, וקרוב
 * מספיק כדי שברור שזה העותק של מה שעמד כאן. הכיוון הוא ציר X של
 * החדר — כיוון אחד וקבוע עדיף על ניחוש שתלוי בזווית המבט.
 */
const ISLAND_GAP_MM = 100;

function islandStepMm(u: { widthMm: number }): number {
  return u.widthMm + ISLAND_GAP_MM;
}

/** השדות שמשנים את מה שאפשר לבנות — ורק הם מפעילים את השער */
/*
 * השדות שמפעילים את שער הבנייה.
 *
 * הרשימה החזיקה את מידות הגוף בלבד, ולכן משטח שלילי וגובה מהרצפה
 * שאינו מספר נכתבו ישר למסד: הם לא היו ברשימה, ולכן השער לא רץ.
 */
const BUILD_FIELDS = [
  'glyph',
  'heightMm',
  'widthMm',
  'depthMm',
  'socleMm',
  'counterMm',
  'yMm',
] as const;

/** ההגדרות והפרויקט שמהם נגזר עובי הלוח בפועל */
async function buildContext(projectId: string) {
  const [settings, materials, project] = await Promise.all([
    settingsRepo.get(),
    materialsRepo.list(),
    projectsRepo.get(projectId),
  ]);
  return { parts: partsOf(settings, materials), project };
}

export const unitsRepo = {
  /** כל הארגזים של הנגרייה, בכל הפרויקטים — לסיכומים חוצי־פרויקט. */
  async all(): Promise<PlacedUnit[]> {
    return allMine(db.units);
  },

  async listForProject(projectId: string): Promise<PlacedUnit[]> {
    // מיון לפי סדר ההוספה. בלעדיו הסדר נגזר מהמזהה האקראי,
    // והציור ורשימת הניסור היו משתנים בין טעינות.
    const rows = await db.units.where('projectId').equals(projectId).toArray();
    return onlyMine(rows).sort((a, b) => a.createdAt - b.createdAt);
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

        ...owned(),
        createdAt: now + i,
        updatedAt: now + i,
      } as PlacedUnit);
    }
    /*
     * גם קבוצה עוברת בשער, ולפני הכתיבה ולא באמצעה: קבוצה שחלק
     * ממנה נכתב וחלק נפסל היא פריט מורכב שחסר לו חלק.
     */
    const ctx = await buildContext(projectId);
    for (const u of out) {
      const why = checkUnit(u, ctx);
      if (why) throw new BuildError(`${u.name}: ${why}`);
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
      /*
       * תיבת המגירה שהתבנית נשמרה איתה, ואם אין — דרך העבודה
       * של הנגרייה.
       *
       * הכלל היה הפוך: ברירת המחדל דרסה את מה שנשמר, ולכן ארגז
       * שנבנה במכוון עם תיבת עץ חזר מהספרייה עם תיבת ברזל. מי
       * שטרח לשמור תבנית מצפה לקבל אותה כפי ששמר; ברירת המחדל
       * היא תשובה לשאלה שלא נענתה, לא דריסה של תשובה שכן.
       */
      drawerBox: item.drawerBox ?? defaults.drawerBox,
      // הגב שהפריט הגיע איתו, ואם אין — דרך העבודה של הנגרייה
      backKind: item.backKind ?? defaults.backKind,
      level: item.level,

      xMm,
      /*
       * הגובה שנשמר בפריט הוא הגובה שהוא נולד בו.
       *
       * קודם כל מה שאינו תלוי על הקיר נחת על אפס, ולכן ארון בלי
       * רגליים שנשמר מרחף בגובה 45 ס"מ — מזנון תלוי, ספסל על
       * בסיס — ירד לרצפה בכל הנחה, ומי ששמר אותו כך גילה את זה
       * רק על הקיר.
       */
      yMm: item.defaultYMm ?? 0,
      widthMm: widthMm ?? item.defaultWidthMm,
      heightMm: item.defaultHeightMm,
      depthMm: item.defaultDepthMm,
      /*
       * הרגליים כפי שנשמרו, וברירת המחדל של הנגרייה רק כשאין.
       *
       * קודם כל ערך חיובי הוחלף בברירת המחדל, בנימוק שהרגליים הן
       * אותו גובה בכל העסק. אבל הגובה השמור הוא גוף ועוד רגליים,
       * ולכן החלפת 170 ב-100 לא קיצרה את הרגליים — היא האריכה את
       * הגוף מ-80 ל-87 ס"מ, בשקט, ובניגוד למה שנשמר. זה גם בדיוק
       * הכלל של `drawerBox` ו-`backKind` שלמעלה: ברירת המחדל היא
       * תשובה לשאלה שלא נענתה, ולא דריסה של תשובה שכן.
       */
      socleMm: item.socleMm ?? defaults.socleMm,
      counterMm: item.counterMm,
      /* נעול לרצפה = באמת עומד עליה — הכלל ב-`construction` */
      floorLocked: landsOnFloor(item.level, item.defaultYMm),
      /* תבנית אי נוחתת בחדר; כל השאר נוחת על הקיר */
      ...(item.island && free ? { free } : {}),
      ...owned(),
      createdAt: now,
      updatedAt: now,
    };
    /*
     * אותו שער שחל על עריכה חל גם על הנחה.
     *
     * `update` בדק, `add` לא — ולכן ארגז שאי אפשר לבנות נכנס
     * בדלת הראשונה ונעצר רק בדלת השנייה. מי שהניח ארגז ברוחב
     * 50 מ״מ דרך התכנון האוטומטי קיבל אותו שמור, ורשימת החיתוך
     * יצאה ממנו. הבדיקה כאן היא אותה בדיקה, באותו הקשר חומר.
     */
    const why = checkUnit(unit, await buildContext(projectId));
    if (why) throw new BuildError(why);
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
    const [items, project] = await Promise.all([allMine(db.catalog), db.projects.get(projectId)]);
    const chosen = new Map<string, CatalogItem>();
    for (const p of placements) {
      const item = matchCatalog(p.catalogKey, items, p.widthMm, project?.roomKind);
      if (item) chosen.set(`${p.catalogKey}|${p.widthMm}`, item);
    }
    const missing = placements.filter(
      (p) => !chosen.has(`${p.catalogKey}|${p.widthMm}`),
    ).length;
    if (missing) return { ok: false, missing };

    await eraseRows(db.units, await unitsRepo.listForProject(projectId));
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

  /**
   * שינוי ארגז — הגבול האחרון.
   *
   * המסכים בודקים לפני ואומרים למה; כאן נבדק שוב, כי שער שנאכף
   * במסך אחד נעקף במסך הבא. הבדיקה רצה רק כשהשינוי נוגע במידה או
   * בסוג — גרירה אינה משנה מה אפשר לבנות, ואין סיבה לקרוא הגדרות
   * בכל תזוזה.
   */
  async update(id: string, patch: Partial<Omit<PlacedUnit, 'id'>>): Promise<void> {
    if (BUILD_FIELDS.some((f) => f in patch)) {
      const unit = await db.units.get(id);
      if (unit && mine(unit)) {
        const why = checkUnit({ ...unit, ...patch }, await buildContext(unit.projectId));
        if (why) throw new BuildError(why);
      }
    }
    await patchRow(db.units, id, patch);
  },

  async remove(id: string): Promise<void> {
    await eraseIds(db.units, [id]);
  },

  /**
   * מחזיר את ארגזי הפרויקט למצב שבתצלום — זה מה ש"בטל" עושה.
   *
   * זו אינה כתיבה רגילה, ולכן היא יושבת כאן ולא בהיסטוריה: היא
   * גם מוחקת וגם מחזירה, ושני הכיוונים נוגעים בסימוני המחיקה.
   * ארגז שנעלם ב"בטל" מקבל סימון — אחרת המכשיר השני היה שולח
   * אותו בחזרה; וארגז שחוזר מאבד את הסימון שלו — אחרת הסנכרון
   * הבא היה מוחק אותו שוב, והנגר היה רואה אותו נעלם מעצמו.
   */
  async restoreProject(projectId: string, units: PlacedUnit[]): Promise<void> {
    await db.transaction('rw', db.units, db.tombstones, async () => {
      const keep = new Set(units.map((u) => u.id));
      const live = await db.units.where('projectId').equals(projectId).toArray();
      await eraseRows(
        db.units,
        live.filter((u) => !keep.has(u.id)),
      );
      /*
       * "בטל" הוא כתיבה חדשה, לא שחזור של מה שהיה.
       *
       * התצלום הוחזר כפי שהוא, כולל מספר הגרסה שלו — ולכן ארגז
       * שהיה בגרסה 2 חזר לגרסה 1, והסנכרון הבא היה רואה כתיבה
       * שמכריזה על עצמה ישנה יותר ממה שכבר יש בצד השני. המידות
       * חוזרות אחורה; המונה ממשיך קדימה.
       */
      const was = new Map(live.map((u) => [u.id, u.rev ?? 0]));
      const at = Date.now();
      if (units.length) {
        await db.units.bulkPut(
          units.map((u) => ({
            ...u,
            rev: Math.max(was.get(u.id) ?? 0, u.rev ?? 0) + 1,
            updatedAt: at,
          })),
        );
      }
      await revive(
        'units',
        units.map((u) => u.id),
      );
    });
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
    if (!source || !mine(source)) return undefined;
    const now = Date.now();
    const { work: _fresh, ...rest } = source;
    const copy: PlacedUnit = {
      ...rest,
      id: crypto.randomUUID(),
      xMm,
      /*
       * אי משוכפל אינו יכול לנחות על עצמו.
       *
       * `xMm` הוא המיקום על הקיר, ולאי אין קיר — ולכן העותק קיבל
       * מיקום חדש בשדה שאינו בשימוש, ואת אותו מקום ברצפה בשדה שכן.
       * שני גופים עמדו בדיוק זה בתוך זה: מנוע ההתנגשות ידע לומר
       * את זה, ואיש לא שאל אותו. העותק נדחף לצד לאורך הרוחב שלו.
       */
      ...(source.free
        ? { free: { ...source.free, xMm: source.free.xMm + islandStepMm(source) } }
        : {}),
      ...owned(),
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
    const rows = onlyMine(await db.units.where('wallId').equals(wallId).toArray());
    if (!rows.length) return;
    const from = Math.min(...rows.map((u) => u.xMm));
    const to = Math.max(...rows.map((u) => u.xMm + u.widthMm));
    const offset = Math.round((wallLengthMm - (to - from)) / 2 - from);
    if (offset === 0) return;
    await db.units.bulkPut(bumped(rows.map((u) => ({ ...u, xMm: Math.max(u.xMm + offset, 0) }))));
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
    const project = await projectsRepo.get(projectId);
    if (!project) return;
    await patchRow(db.projects, projectId, {
      defaults: { ...project.defaults, [role]: choice },
    });

    const rows = await unitsRepo.listForProject(projectId);
    await db.units.bulkPut(
      bumped(
        rows.map((u) => ({
          ...u,
          [`${role}FinishId`]: undefined,
          [`${role}MaterialId`]: undefined,
          // הגוון הישן של החזית נשמר בשדה נפרד, ולכן הוא נמחק גם הוא
          ...(role === 'front' ? { finishId: undefined } : {}),
        })),
      ),
    );
  },

  /** קובע עומק אחיד לכל הארונות בפרויקט. */
  async setDepthForProject(projectId: string, depthMm: number, onlyFloor: boolean): Promise<void> {
    const rows = await unitsRepo.listForProject(projectId);
    await db.units.bulkPut(
      bumped(
        rows.filter((u) => (onlyFloor ? u.level !== 'wall' : true)).map((u) => ({ ...u, depthMm })),
      ),
    );
  },
};
