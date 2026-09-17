import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo, wallsRepo } from '../projects/projectsRepo';
import { WallElevation } from './WallElevation';
import { blocked } from './collision';
import { overallDepthMm } from '../../catalog/saveGate';
import { nudge } from './dragSolve';
import { partsOf } from '../../costing/boards';
import { axisLabel } from './axisLock';
import type { Axis } from './axisLock';
import { rad, unitBox } from './placement';
import { WallIso } from './WallIso';
import { LibrarySheet } from './LibrarySheet';
import { AutoPlanSheet } from './AutoPlanSheet';
import { autoPlannable } from './roomProfiles';
import { UnitEditor } from './UnitEditor';
import { UnitEditSheet } from './UnitEditSheet';
import { SaveGroupSheet } from './SaveGroupSheet';
import { MaterialsSheet } from './MaterialsSheet';
import { NestingSheet } from './NestingSheet';
import { SaleSheet } from '../projects/SaleSheet';
import { useCurrentMember } from '../../workflow/useMember';
import { useEffectiveRole } from '../../workflow/viewRole';
import { can } from '../../workflow/auth';
import { UnitWorkSheet } from './UnitWorkSheet';
import { BulkWorkSheet } from './BulkWorkSheet';
import { ProjectFinishesSheet } from './ProjectFinishesSheet';
import { FlowIcon } from '../../ui/icons';
import { DepthSheet } from './DepthSheet';
import { PlanView } from './PlanView';
import { PresentSheet } from './PresentSheet';
import { WallToolsSheet } from './WallToolsSheet';
import { orderedStats, useViewOptions } from './viewOptions';
import { useDesignView } from './designView';
import { StatGrid, roomStats as roomStatsOf, statTile, wallStats } from './StatGrid';
import { DesignToolbar } from './DesignToolbar';
import { DesktopLibrary } from './DesktopLibrary';
import { useMedia } from '../../ui/useMedia';
import type { SheetName } from './sheets';
import { readPref, writePref } from '../../ui/prefs';
import { clamp, cm } from '../../ui/units';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { history, useHistory } from './history';
import { preview, usePreview, withPreview } from './preview';
import type { GesturePhase } from './gesture';
import { buildPlan, cornerDepth, cornerZones, isComplexRoom, planUnits } from './plan';
import {
  WARN_ORDER,
  analyzeWall,
  fillSpan,
  nextFreeX,
  openingWarnings,
  worstLevel,
} from './analysis';
import type { WallWarning } from './analysis';
import { WarningsSheet, warnLevelTone } from './WarningsSheet';
import { finishesRepo, settingsRepo } from '../../materials/materialsRepo';
import { customersRepo } from '../customers/customersRepo';
import { syncConsumption } from '../../materials/consumptionSync';
import { Sheet } from '../../ui/Sheet';
import {
  CalcIcon,
  ChevronIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  SlidersIcon,
  TrashIcon,
  WandIcon,
} from '../../ui/icons';
import { turned } from '../../db/types';
import { AISLE } from '../../catalog/kitchenRules';
import type { CatalogItem, FreePlacement, PlacedUnit, Project, UserRole } from '../../db/types';
import { useMaterialsAndFinishes } from '../../materials/useMaterials';


/** גובה הלוח נשאר בתחום שמשאיר את הקיר גלוי ואת הלוח שימושי. */
/*
 * ברירות מחדל יציבות.
 *
 * `?? []` בתוך ה-JSX יוצר מערך חדש בכל ציור, וכל מי שמקבל אותו
 * מחשב הכול מחדש גם כששום דבר לא השתנה. קבוע אחד פותר את זה.
 */
const NO_UNITS: PlacedUnit[] = [];
const NO_HEX: Record<string, string> = {};

const PANEL_KEY = 'easycraft.panelRatio';
/* גובה לוח העריכה כחלק מגובה המסך — בין רבע למסך כמעט מלא */
const clampRatio = (r: number) => clamp(r, 0.2, 0.85);

/**
 * מסך ההדמיה. רואים קיר אחד בכל רגע, ופעולה ראשית אחת:
 * להוסיף ארגז — או, אם ארגז נבחר, לערוך אותו.
 *
 * הפריסה היא עמודה: הכותרת, ההדמיה שנשארת גלויה, ולוח העריכה שתופס
 * את מה שנשאר. כך בטלפון הלוח לא מכסה את הקיר שעליו עובדים.
 */
export function DesignScreen({
  projectId,
  /** נכנסים ישר למעקב תהליך העבודה — ככה מגיעים לכאן מרשימת התהליכים */
  startInWork,
}: {
  projectId: string;
  startInWork?: boolean;
}) {
  /* איך מסתכלים על הקיר — שבעה מצבים שהם דבר אחד */
  const design = useDesignView();
  const { iso, inside, measure, rulerPair, rulerAxis, statsOpen, roomStats } =
    design.view;

  const [panelRatio, setPanelRatio] = useState(() => {
    const saved = Number(readPref(PANEL_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampRatio(saved) : 0.45;
  });
  const dragPanel = useRef<{ startY: number; startRatio: number } | null>(null);
  const [wallIndex, setWallIndex] = useState(0);
  /*
   * בקשה להתאמת התצוגה. המצלמה עצמה נשארת בתוך התלת־ממד — היא
   * שייכת לרגע ההסתכלות ולא לפרויקט — ומכאן עוברת הבקשה בלבד.
   */
  const [fitAt, setFitAt] = useState<number | undefined>(undefined);
  /* ספריית המחשב קיימת רק כשיש לה מקום — ראו התנאי בפריסה למטה */
  const wide = useMedia('(min-width: 1200px)');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** מה שהמקלדת הזיזה כרגע — נאמר ונעלם, כמו מחוון הגרירה */
  const [keyAxis, setKeyAxis] = useState<string | null>(null);
  /* קבוצת ארגזים שממתינה לשמירה בספרייה כפריט אחד */
  /* הארגזים שעומדים להימחק, עד שהשאלה נענית */
  const [deleting, setDeleting] = useState<PlacedUnit[] | null>(null);
  const [groupToSave, setGroupToSave] = useState<PlacedUnit[] | null>(null);
  /*
   * מגירה אחת פתוחה בכל רגע. אחד־עשר דגלים נפרדים תיארו מצב אחד —
   * "מה פתוח" — ואפשרו לשניים להיפתח יחד; זה גם הפך "לסגור הכול"
   * לאחת־עשרה קריאות במקום אחת.
   */
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const closeSheet = () => setSheet(null);
  /*
   * מצב תהליך עבודה: אותם ארגזים באותם מקומות, אבל צבועים לפי מה
   * שנעשה בהם — ובלי כלי עריכה. מי שעומד ליד המסור לא אמור להזיז
   * ארגז בטעות.
   */
  /*
   * `null` = עוד לא נבחר, ואז ברירת המחדל היא לפי התפקיד: מנהל
   * נכנס לתכנון, וכל השאר לתהליך. משנבחר, הבחירה של המשתמש גוברת.
   */
  const [workToggle, setWorkToggle] = useState<boolean | null>(startInWork ? true : null);

  const [workUnitId, setWorkUnitId] = useState<string | null>(null);
  /* מחווני הקיר מתקפלים, וההדמיה תופסת את מה שהתפנה */
  /*
   * גובה לוח העריכה, כחלק מגובה המסך.
   * לוח הגדרות ארוך היה מכסה את הקיר, וקצר מדי מחייב גלילה בלי סוף.
   * לכן הגובה נגרר, ונשמר כדי שהעבודה הבאה תתחיל באותה חלוקה.
   */

  const project = useLiveQuery(() => projectsRepo.get(projectId), [projectId]);
  const walls = useLiveQuery(() => wallsRepo.listForProject(projectId), [projectId]);
  /*
   * חדר מורכב נפתח בתלת־ממד, פעם אחת בכניסה.
   * מי שסגר את המבט אחר כך התכוון לסגור אותו, ולכן הפתיחה אינה
   * חוזרת בכל רענון של הקירות.
   */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !walls?.length) return;
    opened.current = true;
    if (isComplexRoom(walls)) design.set('iso', true);
  }, [walls, design]);
  const stored = useLiveQuery(() => unitsRepo.listForProject(projectId), [projectId]);
  /*
   * המסך קורא את הארגזים דרך התצוגה המקדימה: בזמן גרירה המקום
   * החדש חי בזיכרון, ונכתב פעם אחת בסוף התנועה.
   */
  const previewAt = usePreview();
  const allUnits = useMemo(
    () => (stored ? withPreview(stored) : stored),
    /* `previewAt` הוא המונה שמכריח חישוב מחדש — הוא אינו נקרא כאן */
    [stored, previewAt],
  );
  const customer = useLiveQuery(
    () => customersRepo.get(project?.customerId ?? ''),
    [project?.customerId],
  );
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const { materials: allMaterials, finishes: allFinishes } = useMaterialsAndFinishes();
  const finishHex = useLiveQuery(async () => {
    const all = await finishesRepo.all();
    return Object.fromEntries(all.map((f) => [f.id, f.hex]));
  }, []);

  /*
   * העוביים שלפיהם נחתך, לפי הלוח שנבחר בפועל. השרטוט והניסור
   * חייבים לעבוד על אותו מספר, אחרת דופן זרה מגדילה את הארגז על
   * המסך ולא בפלטה.
   */
  const parts = useMemo(
    () => settings && partsOf(settings, allMaterials ?? []),
    [settings, allMaterials],
  );

  const wall = walls?.[Math.min(wallIndex, (walls?.length ?? 1) - 1)];

  const units = useMemo(
    () => (wall ? (allUnits ?? NO_UNITS).filter((u) => u.wallId === wall.id) : []),
    [allUnits, wall],
  );
  const selected = units.find((u) => u.id === selectedId) ?? null;
  const workUnit = (allUnits ?? NO_UNITS).find((u) => u.id === workUnitId) ?? null;
  const me = useCurrentMember();
  /*
   * שני תפקידים, ובכוונה.
   *
   * `role` הוא מה שהמסך **נראה** לפיו — מנהל שבוחר לראות כנגר רואה
   * את מסך הנגר. `actor` הוא מי שבאמת נכנס, וממנו נגזר מה **מותר**.
   *
   * ההפרדה הזאת היא התיקון: התפקידים סודרו כסולם יורד, אבל היכולות
   * שלהם אינן מוכלות זו בזו. תכנת שבחר לראות כנגר קיבל בדיוק את מה
   * שאין לו — לסמן "נחתך" — כי נגר נמצא מתחתיו בסולם.
   */
  const role = useEffectiveRole(me?.role);
  const actor = me?.role;
  const mayEdit = can.design(actor, project);
  /*
   * מי שאינו מנהל רואה את מסך התהליך ולא את מסך התכנון. זה לא
   * מסך אחר — אלה אותם ארגזים באותם מקומות — אבל זו השאלה שהוא
   * בא לענות עליה: מה נשאר לעשות, ולא איך לסדר מחדש.
   */
  /*
   * מי שמתכנן — מנהל, או תכנת שההדמיה נפתחה לו — עובר בין תכנון
   * לתהליך במתג. כל השאר רואים תהליך בלבד.
   *
   * קודם נכתב כאן `role !== 'manager'`, ולכן תכנת היה תמיד במצב
   * תהליך: האישור שקיבל לא פתח לו דבר, וגם כפתור "בקשת אישור
   * לעריכה" לא הוצג לו — הוא יושב במסך התכנון.
   */
  const plans = role === 'manager' || role === 'planner';
  /*
   * תהליך עבודה קיים רק אחרי המכירה — לפני כן אין מה לחתוך, ולכן
   * גם אין למה להיכנס. אחריה: מי שמתכנן בוחר, וכל השאר בתהליך.
   */
  const workMode = !project?.soldAt ? false : plans ? (workToggle ?? role !== 'manager') : true;



  /** כלי עריכה מוצגים רק למי שמותר לו, ורק כשלא במצב תהליך עבודה */
  const editable = mayEdit && !workMode;
  const costing = useLiveQuery(() => projectsRepo.costing(projectId), [projectId]);
  const view = useViewOptions();
  const { canUndo, canRedo } = useHistory(projectId);

  /*
   * מעבר לקיר אחר מבטל בחירה, כדי שלא נערוך ארגז שלא רואים —
   * אלא אם המעבר עצמו נבע מבחירת ארגז שנמצא על הקיר החדש, כמו
   * בלחיצה בתלת־ממד על ארון של קיר שכן.
   */
  useEffect(() => {
    const wallId = walls?.[wallIndex]?.id;
    setSelectedId((id) => {
      const picked = (allUnits ?? NO_UNITS).find((u) => u.id === id);
      return picked && picked.wallId === wallId ? id : null;
    });
  }, [wallIndex]);

  const corners = useMemo(
    () => (wall && walls && walls.length > 1 ? cornerZones(walls, wall, allUnits ?? NO_UNITS) : undefined),
    [wall, walls, allUnits],
  );
  /* גיאומטריית החדר, פעם אחת — ממנה נגזרים המבטים וההתנגשות */
  const plan = useMemo(() => buildPlan(walls ?? [], allUnits ?? NO_UNITS), [walls, allUnits]);
  /*
   * המקלדת: אותה תנועה בציר אחד, בלי לגרור.
   *
   * לחיצה ארוכה נועלת ציר באצבע, וזו הדרך השנייה אל אותו דבר — מי
   * שעובד בעכבר ומקלדת, מי שידו אינה יציבה, ומי שפשוט יודע את
   * המספר. חץ אחד = סנטימטר, עם Shift = עשרה. הצירים קבועים:
   * ימינה־שמאלה לאורך הקיר (באי: ציר X), מעלה־מטה לגובה (ציר Y),
   * ועם Alt באי גם ציר Z אל תוך החדר.
   *
   * רצף לחיצות באותו ציר הוא צעד אחד לביטול — התג נושא את הציר,
   * ולכן מעבר לציר אחר פותח צעד חדש.
   */
  useEffect(() => {
    if (!editable || !selected || !walls) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      /* הקלדה בשדה היא הקלדה, לא הזזה */
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const flat: Axis = selected.free ? (e.altKey ? 'z' : 'x') : 'along';
      const map: Record<string, [Axis, number]> = {
        ArrowRight: [flat, 1],
        ArrowLeft: [flat, -1],
        ArrowUp: ['y', 1],
        ArrowDown: ['y', -1],
      };
      const move = map[e.key];
      if (!move) return;
      const [axis, dir] = move;
      e.preventDefault();
      const patch = nudge(selected, axis, dir * (e.shiftKey ? 100 : 10), {
        plan,
        walls,
        units: allUnits ?? NO_UNITS,
      });
      if (!patch) return setKeyAxis(`${axisLabel(axis)} — אין לאן לזוז`);
      setKeyAxis(axisLabel(axis));
      void patchUnit(selected.id, patch, `nudge:${selected.id}:${axis}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, selected, walls, plan, allUnits]);

  /*
   * יציאה מהמסך באמצע מחווה היא ביטול.
   *
   * התצוגה המקדימה חיה במודול ולא ברכיב, ולכן היא שרדה ניווט: מי
   * שיצא מהמסך באמצע גרירה השאיר אחריו מפה של תנועות שלא נכתבו,
   * והן היו נכתבות במחווה הבאה — על ארגזים של פרויקט אחר.
   */
  useEffect(
    () => () => {
      if (preview.active() || history.inGesture(projectId)) {
        preview.discard();
        history.abort(projectId);
      }
    },
    [projectId],
  );

  /* המחוון נעלם מעצמו: הוא אומר מה קרה עכשיו, לא מה קרה פעם */
  useEffect(() => {
    if (!keyAxis) return;
    const t = setTimeout(() => setKeyAxis(null), 1400);
    return () => clearTimeout(t);
  }, [keyAxis]);

  /*
   * ההתנגשות נמדדת על התיבות במרחב החדר ולא על סימון אזור הפינה:
   * הפינה פתוחה לכל ארגז, והשאלה היחידה היא אם שני ארונות באמת
   * תופסים את אותו מקום.
   */
  const clashing = useMemo(() => {
    if (!wall) return [];
    const seen = new Map<string, { id: string; name: string }>();
    for (const b of planUnits(plan, allUnits ?? NO_UNITS)) {
      if (!b.clash || b.unit.wallId !== wall.id) continue;
      seen.set(b.unit.id, { id: b.unit.id, name: b.unit.name });
    }
    return [...seen.values()];
  }, [plan, wall, allUnits]);
  /*
   * הארגזים של הקירות משני צדי הקיר הזה. פינה מתה נמדדת מולם:
   * מה שחוסם את הדלת הוא עומק השורה הניצבת, ולא מה שנוגע בפינה.
   */
  const neighbourUnits = useMemo(() => {
    const at = (i: number) =>
      walls?.[i] ? (allUnits ?? NO_UNITS).filter((u) => u.wallId === walls[i].id) : NO_UNITS;
    return { start: at(wallIndex - 1), end: at(wallIndex + 1) };
  }, [walls, allUnits, wallIndex]);
  const analysis = useMemo(
    () => (wall ? analyzeWall(wall, units, clashing, neighbourUnits) : null),
    [wall, units, clashing, neighbourUnits],
  );
  /*
   * בדיקת הפתיחה נעשית על החדר ולא על הקיר: דלת החדר יושבת בקיר
   * אחד והארון שחוסם אותה עומד על השני. קיר בודד לעולם לא היה
   * רואה את זה.
   */
  const warnings = useMemo(
    () => [
      ...(analysis?.warnings ?? []),
      ...openingWarnings(allUnits ?? NO_UNITS, plan),
    ],
    [analysis, allUnits, plan],
  );
  const worst = worstLevel(warnings);
  /*
   * שני העצמים שהאזהרה מדברת עליהם, מודלקים יחד על הציור.
   * בחירה מסמנת אחד; אזהרה היא יחס בין שניים, ולכן היא מדליקה
   * את שניהם — מה שנפתח ומה שעומד בדרך.
   */
  const [flagged, setFlagged] = useState<WallWarning | null>(null);
  const flaggedIds = useMemo(
    () => new Set([...(flagged?.unitIds ?? []), ...(flagged?.featureIds ?? [])]),
    [flagged],
  );
  /*
   * המקור למחוונים: הקיר שעובדים עליו, או כל הקירות יחד. שניהם
   * נבנים מאותה בדיקה, ולכן אין סיכוי שהמספרים יסתרו זה את זה.
   */
  const statSource = useMemo(
    () =>
      wall && analysis
        ? roomStats
          ? roomStatsOf(walls ?? [], allUnits ?? NO_UNITS, (w) =>
              analyzeWall(
                w,
                (allUnits ?? NO_UNITS).filter((u) => u.wallId === w.id),
              ),
            )
          : wallStats(wall, units, analysis)
        : null,
    [wall, analysis, roomStats, walls, allUnits, units],
  );

  /**
   * פעולה על כמה ארגזים שנבחרו יחד בתלת־ממד.
   *
   * הכול נשמר כצעד אחד בהיסטוריה: מי שמחק חמישה ארגזים בטעות רוצה
   * להחזיר חמישה בביטול אחד, ולא ללחוץ חמש פעמים.
   */
  async function runBulk(ids: string[], action: 'delete' | 'hide' | 'library') {
    const chosen = (allUnits ?? NO_UNITS).filter((u) => ids.includes(u.id));
    if (!chosen.length) return;
    if (action === 'library') return setGroupToSave(chosen);
    /* מחיקה נשאלת לפני שהיא קורית — גם כשהיא של חמישה ארגזים */
    if (action === 'delete') return setDeleting(chosen);
    await history.capture(projectId, `bulk:${action}:${Date.now()}`);
    /* הסתרה היא מתג: אם כולם מוסתרים הפעולה מחזירה אותם */
    const hide = !chosen.every((u) => u.hidden);
    await Promise.all(chosen.map((u) => unitsRepo.update(u.id, { hidden: hide })));
  }

  async function addItem(item: CatalogItem) {
    if (!wall) return;
    /*
     * ארגז חדש לא נוחת בפינה שכבר תפוסה בידי הקיר השכן — אלא אם
     * הוא ארגז פינתי, שנבנה בדיוק בשביל המקום הזה.
     */
    const from = item.corner ? 0 : cornerDepth(corners?.start, item.level === 'wall');
    const x = Math.max(nextFreeX(units, item.level), from);
    // הארגז נכנס בתוך הקיר, ולא נדחף אל מעבר לקצה שלו
    const maxX = Math.max(wall.lengthMm - item.defaultWidthMm, from);
    await history.capture(projectId, `add:${Date.now()}`);
    const at = freeX(Math.min(x, maxX), maxX, item);
    /* פריט מורכב מניח כמה ארגזים; הראשון הוא זה שנבחר אחריו */
    const made = item.parts?.length
      ? await unitsRepo.addGroup(projectId, wall.id, item, at)
      : [await unitsRepo.add(projectId, wall.id, item, at, undefined, islandSpot(item))];
    closeSheet();
    if (made[0]) setSelectedId(made[0].id);
  }

  /**
   * איפה אי נוחת.
   *
   * לא על הקיר אלא מולו: במרכז הקיר שעובדים עליו, ומעבר עבודה
   * שלם ממנו והלאה — המרחק שבו אי עומד באמת. משם גוררים אותו.
   * ריק = הפריט אינו תבנית אי, והוא נוחת על הקיר כרגיל.
   */
  function islandSpot(item: CatalogItem): FreePlacement | undefined {
    if (!item.island || !wall) return undefined;
    const p = plan.find((q) => q.wall.id === wall.id);
    if (!p) return undefined;
    const a = rad(p.headingDeg);
    const dir = { x: Math.cos(a), z: Math.sin(a) };
    const normal = { x: -Math.sin(a), z: Math.cos(a) };
    const along = wall.lengthMm / 2;
    const into = AISLE.workMm + item.defaultDepthMm / 2;
    return {
      xMm: Math.round(p.start.x + dir.x * along + normal.x * into),
      zMm: Math.round(p.start.y + dir.z * along + normal.z * into),
      headingDeg: Math.round(p.headingDeg + 90),
    };
  }

  /**
   * המקום הפנוי הראשון מ-`from` ימינה, שבו הארגז לא נופל על אחר.
   *
   * המפלס לבדו לא מספיק: ארון גבוה תופס גם את מקומו של העליון
   * שמעליו, וארגז חדש שנחת עליו היה נועל את שניהם. כשאין מקום פנוי
   * בכלל הוא נוחת איפה שביקשנו — עדיף ארגז שרואים וצריך להזיז מאשר
   * לחיצה שלא עשתה כלום.
   */
  function freeX(from: number, maxX: number, item: CatalogItem): number {
    if (!wall) return from;
    const probe = {
      id: 'new',
      wallId: wall.id,
      glyph: item.glyph,
      widthMm: item.defaultWidthMm,
      heightMm: item.defaultHeightMm,
      depthMm: item.defaultDepthMm,
      yMm: item.defaultYMm,
      xMm: from,
    } as PlacedUnit;
    for (let x = from; x <= maxX; x += 50) {
      const at = { ...probe, xMm: x };
      const b = unitBox(at, plan);
      if (b && !blocked(at, b, allUnits ?? NO_UNITS, plan)) return x;
    }
    return from;
  }

  /**
   * כל שינוי בארגז נרשם בהיסטוריה לפני שהוא קורה.
   * `tag` מאחד רצף שינויים לפעולה אחת — גרירה שלמה היא צעד אחד
   * ולא ארבעים, ולכן "בטל" מחזיר את הארגז למקום שממנו יצא.
   */
  async function duplicateSelected() {
    if (!selected || !wall) return;
    await history.capture(projectId, `dup:${Date.now()}`);
    const x = Math.min(
      nextFreeX(units, selected.level),
      Math.max(wall.lengthMm - selected.widthMm, 0),
    );
    const copy = await unitsRepo.duplicate(selected.id, x);
    if (copy) setSelectedId(copy.id);
  }

  /**
   * הופך ארגז לאי, או מחזיר אותו אל הקיר.
   *
   * האי נולד בדיוק במקום שהארגז כבר עומד בו — כך הלחיצה מורידה
   * אותו מהקיר בלי להזיז אותו, ומשם גוררים. בדרך חזרה הוא נוחת
   * במקום שבו הצל שלו נפל על הקיר, ולא ב-xMm הישן שכבר לא אומר
   * כלום.
   */
  /** מחזיר לתצוגה את כל מה שהוסתר — צעד אחד, ולא ארגז אחרי ארגז. */
  async function showHidden() {
    const back = (allUnits ?? NO_UNITS).filter((u) => u.hidden);
    if (!back.length) return;
    await history.capture(projectId, 'show-hidden');
    for (const u of back) await unitsRepo.update(u.id, { hidden: false });
  }

  /**
   * מחיקה בפועל, אחרי שנשאלה.
   *
   * צעד אחד בהיסטוריה גם לחמישה ארגזים: מי שמחק קבוצה בטעות רוצה
   * להחזיר אותה בביטול אחד.
   */
  async function removeUnits(ids: string[]) {
    if (!ids.length) return;
    await history.capture(projectId, `del:${ids.join(',')}`);
    await Promise.all(ids.map((id) => unitsRepo.remove(id)));
    if (ids.includes(selectedId ?? '')) setSelectedId(null);
  }


  async function centerWall() {
    if (!wall) return;
    await history.capture(projectId, `center:${Date.now()}`);
    await unitsRepo.centerOnWall(wall.id, wall.lengthMm);
  }

  /**
   * שינוי ארגז — השער היחיד שדרכו זה קורה.
   *
   * הבדיקה כאן ולא רק על הכפתורים: מחווה שנשכח להתנות בה היא דלת
   * פתוחה, וכך בדיוק נשארה הגרירה בציור החזית פתוחה למי שאסור לו.
   * מי שאין לו רשות עריכה אינו משנה ארגז — לא בכפתור, לא בגרירה
   * ולא בשדה מספרי.
   *
   * סימון עבודה אינו עריכה: הוא עובר דרך `canAdvance`, ולכן הוא
   * מותר לנגר דווקא כשההדמיה נעולה בפניו.
   */
  /**
   * תחילת גרירה וסופה.
   *
   * תנועה אחת של היד היא צעד אחד לביטול — גם כשהיא מזיזה חמישה
   * ארגזים, וגם כשהיא נמשכת שתי שניות. הגבול מוכרז כאן ואינו
   * נגזר מקצב האירועים.
   */
  function gesture(phase: GesturePhase) {
    if (!editable) return;
    if (phase === 'start') return void history.begin(projectId, `drag:${Date.now()}`);
    /*
     * ביטול אינו סיום.
     *
     * `pointercancel` הפעיל עד כה בדיוק את אותו מסלול כמו הרפיה,
     * ולכן תנועה שהמשתמש ביטל נשמרה — ב-2D מ-(500,1000) ל-(970,1270).
     * כאן מה שביד יורד בלי להיכתב, והתצלום שנלקח בפתיחת המחווה יורד
     * איתו: מחווה שלא שינתה דבר לא משאירה צעד ב"בטל".
     */
    if (phase === 'cancel') {
      preview.discard();
      history.abort(projectId);
      return;
    }
    /*
     * סוף התנועה: מה שהצטבר נכתב פעם אחת, ורק אז התצוגה המקדימה
     * מתרוקנת — סדר הפוך היה מחזיר את הארגז למקומו הישן לרגע.
     */
    void (async () => {
      const moves = preview.drain();
      for (const [id, patch] of moves) await unitsRepo.update(id, patch);
      history.end(projectId);
    })();
  }

  async function patchUnit(id: string, patch: Partial<PlacedUnit>, tag = `edit:${id}`) {
    const workOnly = Object.keys(patch).every((k) => k === 'work');
    if (!editable && !workOnly) return;
    await history.capture(projectId, tag);
    /*
     * בזמן תנועה השינוי נשאר בזיכרון. הכתיבה היא בסוף, בבת אחת,
     * ולא בכל תזוזה של המצביע.
     */
    if (history.inGesture(projectId)) return preview.set(id, patch);
    await unitsRepo.update(id, patch);
  }

  if (!project || !walls || !wall) return null;

  return (
    <div className="planner-workspace mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-stone-50">
      <DesignToolbar
        project={project}
        walls={walls}
        wallIndex={wallIndex}
        onWallIndex={setWallIndex}
        units={units}
        allUnits={allUnits ?? NO_UNITS}
        role={role}
        editable={editable}
        workMode={workMode}
        design={design}
        sheet={sheet}
        onSheet={setSheet}
        canUndo={canUndo}
        canRedo={canRedo}
        projectId={projectId}
        onCenter={centerWall}
        onFit={() => setFitAt(Date.now())}
        onClearSelection={() => setSelectedId(null)}
        warnCount={warnings.length}
        warnTone={worst ? warnLevelTone(worst) : null}
        onShowHidden={showHidden}
      />

      {/*
        ההדמיה תופסת את מה שנשאר אחרי לוח העריכה, ולכן גרירת הלוח
        כלפי מעלה באמת מכסה את הקיר — וזו הנקודה: לוח הגדרות ארוך
        צריך מקום, וקיר שכבר בנוי אפשר להסתיר לרגע.
      */}
      {/*
        הספרייה כפאנל קבוע. היא אינה מוסתרת ב-CSS אלא פשוט אינה
        קיימת מתחת ל-1200 פיקסל: פאנל מוסתר עדיין נבנה, עדיין שואל
        את המסד, ועדיין נמצא ב-DOM.
      */}
      {editable && wide && (
        <DesktopLibrary roomKind={project.roomKind} onAdd={addItem} />
      )}

      <div className="planner-canvas min-h-0 flex-1 overflow-hidden px-4 pt-3 pb-2">
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-2">
          {/* מה שהמקלדת הזיזה עכשיו, ובאיזה ציר */}
          {keyAxis && (
            <span className="pointer-events-none absolute inset-x-0 top-1 z-10 mx-auto w-fit rounded-full bg-violet-700 px-3 py-1 text-[11px] font-medium text-white">
              {keyAxis}
            </span>
          )}
          {iso ? (
            /* התלת־ממד מראה את החדר כולו, ולא רק את הקיר שעובדים עליו */
            <WallIso
              walls={walls}
              units={allUnits ?? NO_UNITS}
              activeWallId={wall.id}
              selectedId={selectedId}
              flagged={flaggedIds}
              /* בחירה בתלת־ממד עשויה ליפול על קיר אחר — עוברים אליו */
              onSelect={(id) => {
                const picked = (allUnits ?? NO_UNITS).find((u) => u.id === id);
                if (picked && picked.wallId !== wall.id) {
                  const i = walls.findIndex((w) => w.id === picked.wallId);
                  if (i >= 0) setWallIndex(i);
                }
                /*
                 * במצב ייצור נגיעה בארגז פותחת את לוח העבודה שלו,
                 * בדיוק כמו בחזית. בתלת־ממד היא רק סימנה אותו —
                 * ומכיוון שבמצב ייצור אין לוח עריכה, שום דבר לא קרה:
                 * ההוראה על המסך הבטיחה מה שלא התרחש.
                 */
                if (workMode) return setWorkUnitId(id);
                setSelectedId(id);
              }}
              /*
               * הסיבוב חופשי גם כשהוא יוצר חפיפה: מי שמעמיד ארון
               * בפינה מסובב אותו קודם ומזיז אחר כך, וחסימה כאן
               * הייתה נראית כמו כפתור שבור. החפיפה מסומנת בהתראות
               * ובמבט העל.
               */
              onRotate={editable ? (id, patch) => patchUnit(id, patch, `rotate:${id}`) : undefined}
              /* גרירה בתלת־ממד עשויה לעבור לקיר שכן — הארגז עובר איתה */
              onMoveTo={editable ? (id, patch) => patchUnit(id, patch) : undefined}
              /* העיפרון פותח את אותה עריכה מהירה שיש בסרגל */
              onEdit={
                editable
                  ? (id) => {
                      setSelectedId(id);
                      setSheet('edit');
                    }
                  : undefined
              }
              onBulk={editable ? runBulk : undefined}
              inside={inside}
              finishHex={finishHex ?? NO_HEX}
              project={project}
              parts={parts ?? undefined}
              onGesture={gesture}
              work={workMode}
              snap={design.view.snap}
              fitAt={fitAt}
            />
          ) : (

          <WallElevation
            wall={wall}
            units={units}
            allUnits={allUnits ?? NO_UNITS}
            plan={plan}
            selectedId={selectedId}
            flagged={flaggedIds}
            project={project}
            showHeight={view.heightLine}
            rulerPair={rulerPair}

            rulerAxis={rulerAxis}
            work={workMode}
            onSelect={(id) => {
              if (workMode) return setWorkUnitId(id);
              // במצב סרגל הבחירה אוספת שני קצוות ולא פותחת עורך
              if (rulerPair) return design.pickRulerEnd(id);
              setSelectedId(id);
            }}
            inside={inside}
            measure={measure}
            corners={corners}
            finishHex={finishHex ?? NO_HEX}
            parts={parts ?? undefined}
            onGesture={gesture}
            snap={design.view.snap}
            /*
             * גרירה היא עריכה, ולכן היא עוברת באותו שער כמו
             * הכפתורים. בתלת־ממד היא כבר הייתה מותנית ב-`editable`
             * וכאן לא — ולכן נגר ותכנת בלי אישור יכלו להזיז ארגז
             * בציור החזית, בלי שאף כפתור עריכה הוצג להם.
             */
            onMove={editable ? (id, patch) => patchUnit(id, patch) : undefined}
          />
          )}

        </div>
      </div>

      {/*
        לוח המאפיינים. `display: contents` בנייד משאיר אותו בדיוק
        כפי שהיה — הוא נעשה עמודה משלו רק במסך רחב.
      */}
      <div className="planner-properties">
      {selected && editable ? (
        <>
        {/*
          ידית הגרירה שקובעת כמה מהמסך תופס לוח העריכה, ולצידה
          מחיקה ושכפול של הארגז הנבחר.

          הן היו קודם צמודות לארגז על הציור וזזו איתו — כפתור שנודד
          מחפשים בכל פעם מחדש, ומעל ארגז עליון הוא כיסה את השכן.
          כאן הן תמיד באותו מקום, על הגבול שבין הציור ללוח, קרוב
          לאגודל ובלי להסתיר מילימטר מהקיר.
        */}
        {/*
          שורת פעולות אמיתית, ולא כפתורים שמרחפים מעל השורה.

          הפעולות ישבו במיקום מוחלט בתוך שורה שכל תוכנה הוא ידית
          הגרירה. במחשב הידית מוסתרת, ולכן השורה התמוטטה לגובה
          אפס — והעיגולים נחתכו בגבול העמודה שגוללת. עכשיו הם
          תופסים מקום משלהם, בגובה מפורש, ולכן הם נראים בכל רוחב.
        */}
        <div className="flex min-h-12 shrink-0 items-center gap-2 px-4">
        {/* הגבול בין הציור ללוח, והידית שמזיזה אותו */}
        <div
          role="separator"
          aria-label="גובה לוח העריכה"
          aria-orientation="horizontal"
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragPanel.current = { startY: e.clientY, startRatio: panelRatio };
          }}
          onPointerMove={(e) => {
            const d = dragPanel.current;
            if (!d) return;
            // גרירה כלפי מעלה מגדילה את הלוח
            setPanelRatio(clampRatio(d.startRatio + (d.startY - e.clientY) / window.innerHeight));
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            dragPanel.current = null;
            writePref(PANEL_KEY, String(panelRatio));
          }}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            const next = clampRatio(panelRatio + (e.key === 'ArrowUp' ? 0.05 : -0.05));
            setPanelRatio(next);
            writePref(PANEL_KEY, String(next));
          }}
          className="flex flex-1 cursor-ns-resize touch-none justify-center py-2"
        >
          <span className="h-1.5 w-12 rounded-full bg-stone-300" />
        </div>
        <span className="ms-auto flex shrink-0 items-center gap-1.5">
          {/*
            הסתרה, ולא מחיקה: ארגז מוסתר ממשיך להיספר בחומרים,
            במחיר ובניסור — הוא פשוט יורד מהתמונה כדי שאפשר יהיה
            לראות מה מאחוריו.
          */}
          <button
            onClick={() => patchUnit(selected.id, { hidden: !selected.hidden }, `hide:${selected.id}`)}
            aria-label={selected.hidden ? 'החזרת הארגז לתצוגה' : 'הסתרת הארגז מהתצוגה'}
            aria-pressed={!!selected.hidden}
            title={selected.hidden ? 'הארגז מוסתר — נספר, אבל לא מצויר' : 'הורדה מהתמונה בלי למחוק'}
            className={`grid size-9 place-items-center rounded-full shadow-sm ring-1 transition-colors ${
              selected.hidden
                ? 'bg-oak-600 text-white ring-oak-600'
                : 'bg-white text-stone-600 ring-stone-200 hover:text-oak-700'
            }`}
          >
            {selected.hidden ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
          <button
            onClick={duplicateSelected}
            aria-label="שכפול הארגז"
            title="עותק של הארגז הזה"
            className="grid size-9 place-items-center rounded-full bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition-colors hover:text-oak-700"
          >
            <CopyIcon className="size-4" />
          </button>
          <button
            onClick={() => setDeleting([selected])}
            aria-label="מחיקת הארגז"
            title="מחיקת הארגז"
            className="grid size-9 place-items-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-red-200 transition-colors hover:bg-red-50"
          >
            <TrashIcon className="size-4" />
          </button>
        </span>
        </div>

        {/* הלוח עצמו נמתח לגובה שנבחר, ובתוכו הוא גולל */}
        <div
          className="flex shrink-0 flex-col [&>div:first-child]:min-h-0 [&>div:first-child]:flex-1"
          style={{ height: `${panelRatio * 100}dvh` }}
        >
        {/*
          מפתח לפי מזהה הארגז: בלעדיו הלוח נשאר מורכב במעבר בין
          ארגזים, ושדה מידה שהיה פתוח היה כותב את הערך שלו לתוך
          הארגז הבא שנבחר.
        */}
        <UnitEditor
          key={selected.id}
          unit={selected}
          inside={inside}
          onChange={(patch) => patchUnit(selected.id, patch)}
          project={project}
          parts={parts ?? undefined}
          canPrice={can.sell(me?.role)}
          /* ארגז מסובב תופס על הקיר את עומקו, ולכן ההשלמה לרוחב
             לא תמלא את הרווח שנמדד — עדיף בלי הצעה מאשר הצעה שקרית */
          fillWidth={turned(selected) ? undefined : fillSpan(selected, units, wall, 'w')}
          fillHeight={fillSpan(selected, units, wall, 'h')}
          defaultSocleMm={settings?.defaults.socleMm ?? 0}
          onApplyChoiceAll={(role, choice) =>
            unitsRepo.setChoiceForProject(projectId, role, choice)
          }
          onEdit={() => setSheet('edit')}
          onClose={() => setSelectedId(null)}
        />
        </div>
        </>
      ) : (
        <>
          {/*
            המחוונים מתקפלים, וההדמיה תופסת את מה שהתפנה. מי שרק
            מסדר ארגזים לא צריך את המספרים על המסך, וקיר גדול יותר
            שווה יותר מארבעה מלבנים עם נתונים.
          */}
          <div className="mx-4 mt-1 flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => design.toggle('statsOpen')}
              aria-expanded={statsOpen}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-medium text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-600"
            >
              <ChevronIcon
                className={`size-3.5 transition-transform ${statsOpen ? '-rotate-90' : 'rotate-90'}`}
              />
              {statsOpen ? 'הסתרת הנתונים' : 'הצגת הנתונים'}
            </button>
            {/*
              הגדרות הקיר יושבות ליד נתוני הקיר ולא בין כלי התצוגה:
              מי שרואה שאורך הקיר לא נכון רוצה לתקן אותו במקום שבו
              המספר מוצג, ולא לחפש כפתור בסרגל למעלה.
            */}
            {role === 'manager' && (
              <button
                onClick={() => setSheet('wallTools')}
                aria-pressed={sheet === 'wallTools'}
                title="מידות הקיר ומה מוצג"
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-700"
              >
                <SlidersIcon className="size-3.5" />
                הגדרות הקיר
              </button>
            )}
          </div>

          <main
            className={`overflow-y-auto px-4 pb-2 ${
              statsOpen ? 'min-h-0 flex-1' : 'shrink-0'
            }`}
          >
            {/*
              בקשת עריכה של התכנת מגיעה לכאן ולא להתראה נפרדת: המנהל
              רואה אותה על הקיר שעליו היא מדברת.
            */}
            {role === 'manager' && project.editRequest && (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm leading-snug text-amber-900">
                  התכנת ביקש לפתוח את ההדמיה לעריכה
                  {project.editRequest.note && <span> — {project.editRequest.note}</span>}.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      projectsRepo.update(projectId, {
                        editGrantedAt: Date.now(),
                        editRequest: undefined,
                      })
                    }
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    פתיחה לעריכה
                  </button>
                  <button
                    onClick={() => projectsRepo.update(projectId, { editRequest: undefined })}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-stone-600 ring-1 ring-stone-200"
                  >
                    דחייה
                  </button>
                </div>
              </div>
            )}

            {/*
              המחוונים מוצגים לפי הסדר שנקבע להם, ואפשר לגרור אותם
              למקום אחר. לכל נגר יש מספר אחד שהוא מסתכל עליו קודם,
              והוא צריך להיות ראשון — לא שלישי מפני שכך נכתב בקוד.
            */}
            {statsOpen && statSource && role === 'manager' && (
              <>
                {/*
                  אותם שישה מחוונים עונים על שתי שאלות שונות: מה יש
                  על הקיר הזה, ומה יש בחדר. מי שמתמחר עבודה שלמה
                  צריך את השנייה, ומי שמסדר קיר — את הראשונה.
                */}
                <div className="mb-2 flex gap-0.5 rounded-lg bg-stone-200/70 p-0.5">
                  {([false, true] as const).map((room) => (
                    <button
                      key={String(room)}
                      onClick={() => design.set('roomStats', room)}
                      aria-pressed={roomStats === room}
                      className={`flex-1 rounded-md py-1 text-[11px] font-medium transition-colors ${
                        roomStats === room ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                      }`}
                    >
                      {room ? 'החדר כולו' : 'הקיר הזה'}
                    </button>
                  ))}
                </div>
                <StatGrid
                  order={orderedStats(view)}
                  shown={(key) => !!view[key]}
                  render={(key) => statTile(key, statSource)}
                />
              </>
            )}

            {/*
              ההתראות אינן מחוון אלא בעיה, ולכן הן מחוץ למחווני הקיר
              ומוצגות גם כשהם סגורים: מחוון אפשר לא לראות, שקע
              שנחסם — לא.

              התראה מצביעה על ארגז, ולכן היא כפתור: לוחצים, והארגז
              נבחר ומודלק על הציור יחד עם מה שהאזהרה מדברת עליו —
              במקום לחפש לפי השם מי מבין הארגזים הוא זה.

              התראה היא עובדה על התכנון, ולא מידע של המנהל. היא
              הייתה מוצגת למנהל בלבד, וכך תכנת שעבד על הקיר ונגר
              שבנה לפיו לא ראו שארגז חורג מהחדר — מי שלא רשאי
              לשנות עדיין צריך לדעת.

              והיא נשארת כאן, ככתב, ולא רק כאייקון בכותרת. האייקון
              הוא מה שנשאר על המסך גם כשלוח העריכה פתוח ומכסה את
              הרשימה; הרשימה היא מה שנקרא בלי ללחוץ. נגר שצריך
              ללחוץ כדי לדעת ששקע נחסם יגלה את זה בהתקנה.
            */}
            {warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                {/* מהחמור לקל: מה שלא ייבנה קודם למה שחסר בו נתון */}
                {[...warnings]
                  .sort((a, b) => WARN_ORDER.indexOf(a.level) - WARN_ORDER.indexOf(b.level))
                  .map((w) => {
                    /* המפתח כולל את העצמים: שני ארגזים באותו שם מייצרים
                       בדיוק את אותו משפט, ובלעדיהם השני נעלם */
                    const key = `${w.text}|${w.unitIds.join(',')}|${(w.featureIds ?? []).join(',')}`;
                    const dot = (
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${warnLevelTone(w.level)}`} />
                    );
                    return w.unitIds.length > 0 || (w.featureIds ?? []).length > 0 ? (
                      <li key={key}>
                        <button
                          onClick={() => {
                            setFlagged(w);
                            if (w.unitIds.length) setSelectedId(w.unitIds[0]);
                          }}
                          className="flex w-full items-start gap-1.5 rounded-lg px-1 py-0.5 text-start text-sm leading-snug text-amber-900 underline decoration-amber-300 underline-offset-2 transition-colors hover:bg-amber-100"
                        >
                          {dot}
                          {w.text}
                        </button>
                      </li>
                    ) : (
                      <li key={key} className="flex items-start gap-1.5 px-1 text-sm leading-snug text-amber-900">
                        {dot}
                        {w.text}
                      </li>
                    );
                  })}
              </ul>
            )}

            {statsOpen && units.length === 0 && (
              <p className="mt-6 text-center text-[15px] text-stone-500">
                {autoPlannable(project.roomKind)
                  ? 'הקיר ריק. אפשר לתכנן את החדר בלחיצה, או להוסיף ארגז אחד מהספרייה.'
                  : 'הקיר ריק. פתח את הספרייה והוסף את הארגז הראשון.'}
              </p>
            )}
          </main>

          <div className="shrink-0 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {editable ? (
              /*
                שתי דרכים להתחיל קיר: ארגז אחד ביד, או מטבח שלם
                בלחיצה. התכנון האוטומטי יושב לצד ההוספה ולא במקומה —
                הוא נקודת פתיחה שממשיכים לערוך, לא תחליף לעריכה.
              */
              <div className="flex gap-2">
                {/*
                  התכנון האוטומטי אינו של המטבח בלבד.
                  לכל חדר שיש לו פרופיל — תלייה בחדר ארונות, ספרייה
                  במשרד, נעליים בכניסה — יש מה לתכנן. חדר שאין לו
                  פרופיל אינו מציג כפתור שלא יעשה דבר.
                */}
                {autoPlannable(project.roomKind) && (
                  <button
                    onClick={() => setSheet('autoPlan')}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-oak-600 bg-white px-4 py-4 text-base font-semibold text-oak-700 transition-colors hover:bg-oak-50"
                  >
                    <WandIcon />
                    תכנון אוטומטי
                  </button>
                )}
                <button
                  onClick={() => setSheet('library')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
                >
                  <PlusIcon />
                  הוספת ארגז
                </button>
              </div>
            ) : (
              <EditGate
                project={project}
                role={actor}
                workMode={workMode}
                onRequest={(note) =>
                  projectsRepo.update(projectId, {
                    editRequest: { at: Date.now(), by: me?.id, note },
                  })
                }
                onRevoke={() => projectsRepo.update(projectId, { editGrantedAt: undefined })}
              />
            )}

            {/*
              הכפתור הראשי מתחת להדמיה הוא מה שנשאר לעשות עכשיו.
              לפני המכירה זה החישוב — סוף העבודה על הקיר, ומתוכו
              נפתח הפרויקט אחרי שרואים מה זה עולה. אחרי המכירה
              הארגזים כבר סגורים והשאלה היא איפה הם עומדים, ולכן
              הכפתור הופך למתג בין תכנון לתהליך.

              חישוב ומחיר הם עניין של המנהל. התכנת והנגר צריכים את
              הארגזים ואת מה שנשאר לעשות בהם, לא את מה שזה עולה.
            */}
            {/* חישוב ומחיר הם של המנהל; המתג הוא של כל מי שמתכנן */}
            {(plans || project.soldAt) &&
              (project.soldAt ? (
                <button
                  onClick={() => {
                    setWorkToggle(!workMode);
                    setSelectedId(null);

                    design.clearTools();
                  }}
                  aria-pressed={workMode}
                  className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-base font-semibold transition-colors ${
                    workMode
                      ? 'border-oak-600 bg-oak-600 text-white hover:bg-oak-700'
                      : 'border-stone-900 bg-white text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <FlowIcon className="size-5" />
                  {workMode ? 'תהליך עבודה' : 'תכנון'}
                </button>
              ) : role === 'manager' ? (
                <button
                  onClick={() => setSheet('materials')}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-900 bg-white py-3.5 text-base font-semibold text-stone-900 transition-colors hover:bg-stone-100"
                >
                  <CalcIcon />
                  חישוב פרויקט
                </button>
              ) : null)}

          </div>
        </>
      )}
      </div>

      {/*
        הארגז נמצא לפני הפתיחה ולא נכפה בסימן קריאה: ארגז יכול
        להימחק בזמן שהמגירה שלו פתוחה — בביטול פעולה, למשל — ואז
        המגירה קיבלה undefined וקרסה.
      */}
      {workUnit && (
        <UnitWorkSheet
          unit={workUnit}
          role={actor}
          shown={role}
          project={project}
          onChange={async (work) => {
            await patchUnit(workUnit.id, { work }, `work:${workUnit.id}`);
            /* סימון חיתוך הוא מה שמוריד פלטות מהמלאי — בלי הזנה נוספת */
            await syncConsumption(projectId);
          }}
          onClose={() => setWorkUnitId(null)}
        />
      )}

      {sheet === 'finishes' && (
        <ProjectFinishesSheet
          project={project}
          onApply={(part, choice) => unitsRepo.setChoiceForProject(projectId, part, choice)}
          onClose={closeSheet}
        />
      )}

      {sheet === 'bulk' && (
        <BulkWorkSheet
          units={units}
          role={actor}
          shown={role}
          project={project}
          onApply={async (changes) => {
            await history.capture(projectId, `bulk:${Date.now()}`);
            for (const c of changes) await unitsRepo.update(c.id, { work: c.work });
            await syncConsumption(projectId);
          }}
          onClose={closeSheet}
        />
      )}

      {/*
        הבדיקה אינה מחוון ואינה העדפת תצוגה, ולכן היא אינה מאחורי
        מתג ואינה תלויה בתפקיד: תכנת שעובד על הקיר ונגר שבונה
        לפיו צריכים לדעת שדלת לא תיפתח, גם כשאינם רשאים לשנות.
      */}
      {sheet === 'warnings' && (
        <WarningsSheet
          warnings={warnings}
          onPick={(w) => {
            setFlagged(w);
            if (w.unitIds.length) setSelectedId(w.unitIds[0]);
          }}
          onClose={closeSheet}
        />
      )}

      {sheet === 'wallTools' && (
        <WallToolsSheet
          wall={wall}
          index={wallIndex}
          onChange={(patch) => wallsRepo.update(wall.id, patch)}
          onClose={closeSheet}
        />
      )}

      {sheet === 'present' && (
        <PresentSheet
          project={project}
          customer={customer}
          walls={walls}
          units={allUnits ?? NO_UNITS}
          finishes={allFinishes ?? []}
          materials={allMaterials ?? []}
          finishHex={finishHex ?? NO_HEX}
          onClose={closeSheet}
        />
      )}

      {sheet === 'plan' && (
        <Sheet title="מבט על החדר" onClose={closeSheet} tall>
          <PlanView
            walls={walls}
            units={allUnits ?? NO_UNITS}
            activeWallId={wall.id}
            onSelectWall={(id) => {
              const i = walls.findIndex((w) => w.id === id);
              if (i >= 0) setWallIndex(i);
            }}
            onChangeWall={(id, patch) => wallsRepo.update(id, patch)}
            onAddWall={async () => {
              await wallsRepo.add(projectId);
              setWallIndex(walls.length);
            }}
            onRemoveWall={async (id) => {
              await wallsRepo.remove(id);
              setWallIndex((i) => Math.max(Math.min(i, walls.length - 2), 0));
            }}
          />
        </Sheet>
      )}

      {sheet === 'depth' && (
        <DepthSheet
          /* אותה מידה שהשדה מבטיח: עומק כולל חזית, כמו בעריכה המהירה */
          currentMm={
            selected
              ? overallDepthMm(selected, { parts, project })
              : units[0]
                ? overallDepthMm(units[0], { parts, project })
                : 580
          }
          onClose={closeSheet}
          onApply={async (mm, onlyFloor) => {
            await unitsRepo.setDepthForProject(projectId, mm, onlyFloor);
            closeSheet();
          }}
        />
      )}

      {sheet === 'edit' && selected && (
        <UnitEditSheet
          unit={selected}
          wallLengthMm={wall.lengthMm}
          parts={parts}
          project={project}
          onClose={closeSheet}
        />
      )}

      {/*
        מחיקה נשאלת לפני שהיא קורית.
        ארגז שיורד מהקיר יורד גם מהחומרים, מהניסור ומהמחיר — וזה
        מה שהשאלה אומרת, במקום "האם אתה בטוח".
      */}
      {deleting?.length && (
        <ConfirmSheet
          title={deleting.length > 1 ? 'מחיקת ארגזים' : 'מחיקת הארגז'}
          what={
            deleting.length > 1
              ? `${deleting.length} ארגזים`
              : `${deleting[0].name} · ${cm(deleting[0].widthMm)} ס״מ`
          }
          impact={'הארגזים יורדים מהקיר, ואיתם מהחומרים, מהניסור ומהמחיר. אפשר להחזיר ב"בטל" מיד אחרי המחיקה.'}
          onConfirm={() => void removeUnits(deleting.map((u) => u.id))}
          onClose={() => setDeleting(null)}
        />
      )}

      {/* שמירת אוסף שנבחר בתלת־ממד כפריט אחד */}
      {groupToSave && (
        <SaveGroupSheet units={groupToSave} onClose={() => setGroupToSave(null)} />
      )}

      {sheet === 'sale' && (
        <SaleSheet
          project={project}
          units={allUnits ?? NO_UNITS}
          costing={costing}
          isManager={me?.role === 'manager'}
          onClose={closeSheet}
        />
      )}

      {sheet === 'nesting' && (
        <NestingSheet projectId={projectId} onClose={closeSheet} />
      )}

      {sheet === 'materials' && (
        <MaterialsSheet
          projectId={projectId}
          onPickFinishes={() => setSheet('finishes')}
          onStart={() => setSheet('sale')}
          onClose={closeSheet}
        />
      )}

      {sheet === 'autoPlan' && walls && (
        <AutoPlanSheet
          projectId={projectId}
          roomKind={project.roomKind}
          walls={walls}
          units={allUnits ?? NO_UNITS}
          onClose={closeSheet}
        />
      )}

      {sheet === 'library' && (
        <LibrarySheet
          roomKind={project.roomKind}
          onAdd={addItem}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */


/**
 * מה מוצג במקום כפתור ההוספה למי שאינו עורך.
 *
 * ההדמיה היא מה שהלקוח אישר, ולכן שינוי שלה אחרי האישור עובר דרך
 * המנהל. התכנת מבקש, המנהל פותח — ומה שנפתח אפשר גם לסגור.
 */
function EditGate({
  project,
  role,
  workMode,
  onRequest,
  onRevoke,
}: {
  project: Project;
  role?: UserRole;
  workMode: boolean;
  onRequest: (note?: string) => void;
  onRevoke: () => void;
}) {
  if (workMode) {
    return (
      <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-center text-sm leading-snug text-stone-500">
        מצב תהליך עבודה. הקשה על ארגז מראה איפה הוא עומד ומה נשאר לעשות בו.
      </p>
    );
  }

  if (role === 'manager') {
    return (
      <button
        onClick={onRevoke}
        className="w-full rounded-2xl border-2 border-stone-900 bg-white py-3.5 text-base font-semibold text-stone-900"
      >
        חזרה למצב תכנון
      </button>
    );
  }

  if (role !== 'planner') {
    return (
      <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-center text-sm leading-snug text-stone-500">
        ההדמיה לצפייה בלבד בתפקיד הזה.
      </p>
    );
  }

  if (project.editRequest) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm leading-snug text-amber-900">
        נשלחה בקשה לפתוח את ההדמיה לעריכה. המנהל צריך לאשר אותה.
      </p>
    );
  }

  return (
    <button
      onClick={() => onRequest()}
      className="w-full rounded-2xl border-2 border-stone-900 bg-white py-3.5 text-base font-semibold text-stone-900 transition-colors hover:bg-stone-100"
    >
      בקשת אישור לעריכה
    </button>
  );
}



