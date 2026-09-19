import { checkUnit, type BuildContext } from '../../catalog/saveGate';
import { matchCatalog, roleCapable, ROLE_OF_KEY } from './planMatch';
import { unitSpec, topMm } from '../projects/unitSpec';
import type { Placement } from './autoPlan';
import { blocked, unitsClash } from './collision';
import { buildPlan } from './plan';
import { solidBox, unitBox } from './placement';
import { alongWallMm } from '../../db/types';
import type {
  CatalogItem,
  PlacedUnit,
  ProjectDefaults,
  RoomKind,
  Wall,
  WallFeature,
} from '../../db/types';

/**
 * מהצעה אל ארגזים אמיתיים — פעם אחת, לכולם.
 *
 * ההצעה מדברת בתפקידים; הספרייה היא של הנגרייה; והמידות שיישמרו
 * נגזרות מהשתיים. עד כאן כל צרכן עשה את התרגום לעצמו: הכרטיס צייר
 * מארגזי התקן, השמירה בחרה מהספרייה, והניקוד חישב על משהו שלישי.
 * לכן הכרטיס הראה מטבח אחד והקיר קיבל אחר, והצעה שקיבלה 99 הניחה
 * ארגזים שחוסמים חלון.
 *
 * כאן הפתרון קורה פעם אחת ומחזיר גם את מה שאי אפשר: ארגז שאין לו
 * מקבילה בספרייה, מכשיר שאין לו ארגז שיודע להחזיק אותו, חלון
 * שהארגז נכנס לתוכו, תקרה שהוא עובר, ומידה שאי אפשר לבנות ממנה.
 * מי שמציע, מי שמנקד ומי ששומר — כולם קוראים את אותו הדבר.
 */

/** מה מנע מהארגז הזה להיות מונח, ובאיזו חומרה. */
export interface PlanIssue {
  kind: 'missing' | 'capability' | 'window' | 'ceiling' | 'build' | 'wall' | 'bounds' | 'overlap';
  /** שם התפקיד כפי שהמשתמש רואה אותו */
  what: string;
  text: string;
}

export interface ResolvedUnit {
  placement: Placement;
  item: CatalogItem;
  /** הארגז כפי שהוא יישמר — אותו אחד בדיוק שהכרטיס מצייר */
  unit: PlacedUnit;
}

export interface ResolvedPlan {
  units: ResolvedUnit[];
  /** חסמים. הצעה עם חסם אינה מוצעת ואינה נשמרת. */
  issues: PlanIssue[];
}

export interface ResolveInput {
  placements: Placement[];
  items: CatalogItem[];
  walls: Wall[];
  defaults: Pick<
    ProjectDefaults,
    'drawerBox' | 'backKind' | 'socleMm' | 'counterTopMm' | 'counterMm'
  >;
  room?: RoomKind;
  /** הקשר החומר לבדיקת הבנייה. בלעדיו נבדק עובי התקן. */
  build?: BuildContext;
  /** שם קריא לתפקיד, לצורך ההודעות */
  nameOf?: (p: Placement) => string;
}

/**
 * חלון שהארגז נכנס לתוכו.
 *
 * הבדיקה הקודמת התעלמה מחלונות בתחתונים, בנימוק שחלון מתחיל מעל
 * המשטח. זה נכון לחלון רגיל ולא לחלון נמוך: אדן בגובה 30 ס"מ חוצה
 * את הארגז, וההנחה הצליחה. מה שנבדק כאן הוא חפיפה אמיתית בשני
 * הצירים — לרוחב הקיר ולגובה — ולכן חלון גבוה באמת אינו מפריע.
 */
function hitsOpening(u: PlacedUnit, features: WallFeature[]): WallFeature | undefined {
  const top = topMm(u);
  const bottom = u.yMm ?? 0;
  return features.find((f) => {
    if (f.kind !== 'window' && f.kind !== 'door') return false;
    const across = f.xMm < u.xMm + u.widthMm && f.xMm + f.widthMm > u.xMm;
    if (!across) return false;
    return f.yMm < top && f.yMm + f.heightMm > bottom;
  });
}

const OPENING_LABEL: Record<string, string> = { window: 'חלון', door: 'דלת' };

export function resolvePlan(input: ResolveInput): ResolvedPlan {
  const { placements, items, walls, defaults, room, build } = input;
  const name = input.nameOf ?? ((p: Placement) => p.catalogKey);
  const byWall = new Map(walls.map((w) => [w.id, w]));
  const units: ResolvedUnit[] = [];
  const issues: PlanIssue[] = [];

  for (const p of placements) {
    const what = name(p);
    const item = matchCatalog(p.catalogKey, items, p.widthMm, room);
    if (!item) {
      issues.push({ kind: 'missing', what, text: `אין בספרייה ארגז שממלא את התפקיד "${what}".` });
      continue;
    }
    /*
     * תפקיד שיש בו מכשיר או שירות אינו מתמלא בארגז דלתות רגיל.
     *
     * הדירוג נתן לכל ארגז מאותה קטגוריה ניקוד חיובי, ולכן בספרייה
     * שאין בה ארגז כיור נבחר ארגז דלתות — והמטבח יצא בלי כיור, בלי
     * שנאמר דבר. שינוי שם אינו מוסיף ואינו מוריד יכולת פיזית.
     */
    const need = ROLE_OF_KEY[p.catalogKey];
    if (need && !roleCapable(item, need)) {
      issues.push({
        kind: 'capability',
        what,
        text: `אין בספרייה ${need.label}. "${item.name}" אינו ממלא את התפקיד הזה.`,
      });
      continue;
    }

    const unit = {
      ...unitSpec(item, {
        projectId: 'plan',
        wallId: p.wallId,
        xMm: p.xMm,
        widthMm: p.widthMm,
        free: p.free,
        room,
      }, defaults),
      id: `plan-${units.length}`,
      workshopId: '',
      rev: 0,
      createdAt: 0,
      updatedAt: 0,
      ...(p.blindMm ? { blindMm: p.blindMm } : {}),
    } as PlacedUnit;

    /* המידה שאי אפשר לבנות ממנה אינה מגיעה עד המסד */
    const why = checkUnit(unit, build ?? {});
    if (why) {
      issues.push({ kind: 'build', what, text: `${what}: ${why}` });
      continue;
    }

    const wall = byWall.get(p.wallId);
    if (wall) {
      /* תקרה: הגובה שאליו הארגז מגיע בפועל, ולא הגובה שכתוב בו */
      const top = topMm(unit);
      if (top > wall.heightMm) {
        issues.push({
          kind: 'ceiling',
          what,
          text: `${what} מגיע ל-${Math.round(top)} מ״מ, והתקרה כאן ${wall.heightMm} מ״מ.`,
        });
        continue;
      }
      if (!p.free) {
        const hit = hitsOpening(unit, wall.features);
        if (hit) {
          issues.push({
            kind: 'window',
            what,
            text: `${what} נכנס לתוך ${OPENING_LABEL[hit.kind] ?? 'פתח'} שבקיר.`,
          });
          continue;
        }
      }
    }

    units.push({ placement: p, item, unit });
  }

  issues.push(...geometryIssues(units, walls, name));
  return { units, issues };
}

/**
 * הבדיקה שאי אפשר לעשות על ארגז אחד.
 *
 * עד כאן כל יחידה נבדקה לעצמה — מידות, החלון שבקיר שלה, התקרה
 * מעליה — ולכן הצעה שלמה עברה גם כשהארגזים חדרו זה לזה ובלעו
 * עמוד. `applyPlan` החזיר הצלחה ושמר שמונה־עשרה יחידות, וארבע
 * מהן סומנו כמתנגשות בידי אותו בודק התנגשויות שהאפליקציה עצמה
 * מריצה על החדר.
 *
 * מה שנבדק כאן הוא ההצעה כגוף אחד, על הגופים הפתורים בפועל:
 * שהקיר קיים, שהיחידה נמצאת עליו, שאין עמוד או מדרגה במקומה,
 * ושאין שתי יחידות באותו נפח. זו אותה שאלה שנשאלת בגרירה
 * ובמבט העל, ולכן אותה פונקציה — הצעה אינה יכולה להיות חוקית
 * לפי מדד אחד ופסולה לפי אחר.
 */
function geometryIssues(
  units: ResolvedUnit[],
  walls: Wall[],
  name: (p: Placement) => string,
): PlanIssue[] {
  const out: PlanIssue[] = [];
  const byWall = new Map(walls.map((w) => [w.id, w]));
  const placed = units.map((r) => r.unit);
  const plan = buildPlan(walls, placed);

  for (const { placement, unit } of units) {
    const what = name(placement);
    const wall = byWall.get(placement.wallId);
    if (!wall) {
      out.push({ kind: 'wall', what, text: `${what} שויך לקיר שאינו קיים בפרויקט.` });
      continue;
    }
    if (!placement.free) {
      /* הגבולות נמדדים על מה שהיחידה תופסת בפועל, כולל סיבוב */
      const along = alongWallMm(unit);
      if (unit.xMm < 0) {
        out.push({ kind: 'bounds', what, text: `${what} מתחיל לפני תחילת הקיר.` });
        continue;
      }
      if (unit.xMm + along > wall.lengthMm + 1) {
        out.push({
          kind: 'bounds',
          what,
          text: `${what} חורג מקצה הקיר: ${Math.round(unit.xMm + along)} מ״מ מתוך ${wall.lengthMm}.`,
        });
        continue;
      }
    }
    const box = solidBox(unit, plan);
    if (!box) continue;
    /* עמוד, מדרגה ופתח — הגופים שאי אפשר לבנות לתוכם */
    if (blocked(unit, unitBox(unit, plan) ?? box, [], plan)) {
      out.push({ kind: 'overlap', what, text: `${what} עומד על מבנה שאי אפשר לבנות לתוכו.` });
    }
  }

  /* ואז זה מול זה: אותו חוק פיזיקלי של הגרירה, על היחידות הפתורות */
  const solids = units
    .map((r) => ({ r, box: solidBox(r.unit, plan) }))
    .filter((x): x is { r: ResolvedUnit; box: NonNullable<ReturnType<typeof solidBox>> } => !!x.box);
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      if (!unitsClash({ unit: a.r.unit, box: a.box }, { unit: b.r.unit, box: b.box })) continue;
      out.push({
        kind: 'overlap',
        what: name(a.r.placement),
        text: `${name(a.r.placement)} ו-${name(b.r.placement)} תופסים את אותו מקום.`,
      });
    }
  }
  return out;
}
