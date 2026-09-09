import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo, wallsRepo } from '../projects/projectsRepo';
import { WallElevation } from './WallElevation';
import { collides } from './snapping';
import { WallIso } from './WallIso';
import { LibrarySheet } from './LibrarySheet';
import { UnitEditor } from './UnitEditor';
import { UnitEditSheet } from './UnitEditSheet';
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
import { orderedStats, viewOptions, useViewOptions } from './viewOptions';
import { useDesignView } from './designView';
import { StatGrid, roomStats as roomStatsOf, statTile, wallStats } from './StatGrid';
import { DesignToolbar } from './DesignToolbar';
import type { SheetName } from './sheets';
import { history, useHistory } from './history';
import { buildPlan, cornerDepth, cornerZones, isComplexRoom, planUnits } from './plan';
import { analyzeWall, fillSpan, nextFreeX } from './analysis';
import { finishesRepo, settingsRepo } from '../../materials/materialsRepo';
import { customersRepo } from '../customers/customersRepo';
import { syncConsumption } from '../../materials/consumption';
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
} from '../../ui/icons';
import { readPref, writePref } from '../../ui/prefs';
import { turned } from '../../db/types';
import type { CatalogItem, PlacedUnit, Project, UserRole } from '../../db/types';
import { useMaterialsAndFinishes } from '../../materials/useMaterials';

const PANEL_KEY = 'easycraft.panelRatio';

/** גובה הלוח נשאר בתחום שמשאיר את הקיר גלוי ואת הלוח שימושי. */
const clampRatio = (r: number) => Math.min(Math.max(r, 0.2), 0.85);

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
  const { iso, inside, measure, rulerPair, rulerAxis, statsOpen, noUppers, roomStats } =
    design.view;

  const [wallIndex, setWallIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [workToggle, setWorkToggle] = useState(!!startInWork);
  const [workUnitId, setWorkUnitId] = useState<string | null>(null);
  /* מחווני הקיר מתקפלים, וההדמיה תופסת את מה שהתפנה */
  /*
   * גובה לוח העריכה, כחלק מגובה המסך.
   * לוח הגדרות ארוך היה מכסה את הקיר, וקצר מדי מחייב גלילה בלי סוף.
   * לכן הגובה נגרר, ונשמר כדי שהעבודה הבאה תתחיל באותה חלוקה.
   */
  const [panelRatio, setPanelRatio] = useState(() => {
    const saved = Number(readPref(PANEL_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampRatio(saved) : 0.45;
  });
  const dragPanel = useRef<{ startY: number; startRatio: number } | null>(null);

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
  const allUnits = useLiveQuery(() => unitsRepo.listForProject(projectId), [projectId]);
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

  const wall = walls?.[Math.min(wallIndex, (walls?.length ?? 1) - 1)];
  const units = useMemo(
    () => (wall ? (allUnits ?? []).filter((u) => u.wallId === wall.id) : []),
    [allUnits, wall],
  );
  const selected = units.find((u) => u.id === selectedId) ?? null;
  const workUnit = (allUnits ?? []).find((u) => u.id === workUnitId) ?? null;
  const me = useCurrentMember();
  const role = useEffectiveRole(me?.role);
  const mayEdit = can.design(role, project);
  /*
   * מי שאינו מנהל רואה את מסך התהליך ולא את מסך התכנון. זה לא
   * מסך אחר — אלה אותם ארגזים באותם מקומות — אבל זו השאלה שהוא
   * בא לענות עליה: מה נשאר לעשות, ולא איך לסדר מחדש.
   */
  const workMode = role !== 'manager' || workToggle;
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
      const picked = (allUnits ?? []).find((u) => u.id === id);
      return picked && picked.wallId === wallId ? id : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallIndex]);

  const corners = wall && walls && walls.length > 1
    ? cornerZones(walls, wall, allUnits ?? [])
    : undefined;
  /*
   * ההתנגשות נמדדת על המלבנים במבט העל ולא על סימון אזור הפינה:
   * הפינה פתוחה לכל ארגז, והשאלה היחידה היא אם שני ארונות באמת
   * תופסים את אותו מקום.
   */
  const clashing = useMemo(() => {
    if (!wall || !walls || walls.length < 2) return [];
    const boxes = planUnits(buildPlan(walls, allUnits ?? []), allUnits ?? []);
    const seen = new Map<string, { id: string; name: string }>();
    for (const b of boxes) {
      if (!b.clash || b.unit.wallId !== wall.id) continue;
      seen.set(b.unit.id, { id: b.unit.id, name: b.unit.name });
    }
    return [...seen.values()];
  }, [walls, wall, allUnits]);
  const analysis = wall ? analyzeWall(wall, units, clashing) : null;
  /*
   * המקור למחוונים: הקיר שעובדים עליו, או כל הקירות יחד. שניהם
   * נבנים מאותה בדיקה, ולכן אין סיכוי שהמספרים יסתרו זה את זה.
   */
  const statSource =
    wall && analysis
      ? roomStats
        ? roomStatsOf(walls ?? [], allUnits ?? [], (w) =>
            analyzeWall(
              w,
              (allUnits ?? []).filter((u) => u.wallId === w.id),
            ),
          )
        : wallStats(wall, units, analysis)
      : null;

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
    const unit = await unitsRepo.add(projectId, wall.id, item, freeX(Math.min(x, maxX), maxX, item));
    closeSheet();
    setSelectedId(unit.id);
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
    const probe = {
      id: 'new',
      glyph: item.glyph,
      widthMm: item.defaultWidthMm,
      heightMm: item.defaultHeightMm,
      depthMm: item.defaultDepthMm,
    };
    for (let x = from; x <= maxX; x += 50) {
      if (!collides(probe, x, item.defaultYMm, units)) return x;
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

  /** מחזיר לתצוגה את כל מה שהוסתר — צעד אחד, ולא ארגז אחרי ארגז. */
  async function showHidden() {
    const back = (allUnits ?? []).filter((u) => u.hidden);
    if (!back.length) return;
    await history.capture(projectId, 'show-hidden');
    for (const u of back) await unitsRepo.update(u.id, { hidden: false });
  }

  async function removeUnit(id: string) {
    await history.capture(projectId, `del:${id}`);
    await unitsRepo.remove(id);
    setSelectedId(null);
  }

  async function centerWall() {
    if (!wall) return;
    await history.capture(projectId, `center:${Date.now()}`);
    await unitsRepo.centerOnWall(wall.id, wall.lengthMm);
  }

  async function patchUnit(id: string, patch: Partial<PlacedUnit>, tag = `edit:${id}`) {
    await history.capture(projectId, tag);
    await unitsRepo.update(id, patch);
  }

  if (!project || !walls || !wall) return null;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-stone-50">
      <DesignToolbar
        project={project}
        walls={walls}
        wallIndex={wallIndex}
        onWallIndex={setWallIndex}
        units={units}
        allUnits={allUnits ?? []}
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
        onClearSelection={() => setSelectedId(null)}
        onShowHidden={showHidden}
      />

      {/*
        ההדמיה תופסת את מה שנשאר אחרי לוח העריכה, ולכן גרירת הלוח
        כלפי מעלה באמת מכסה את הקיר — וזו הנקודה: לוח הגדרות ארוך
        צריך מקום, וקיר שכבר בנוי אפשר להסתיר לרגע.
      */}
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-3 pb-2">
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-2">
          {iso ? (
            /* התלת־ממד מראה את החדר כולו, ולא רק את הקיר שעובדים עליו */
            <WallIso
              walls={walls}
              units={allUnits ?? []}
              activeWallId={wall.id}
              selectedId={selectedId}
              /* בחירה בתלת־ממד עשויה ליפול על קיר אחר — עוברים אליו */
              onSelect={(id) => {
                const picked = (allUnits ?? []).find((u) => u.id === id);
                if (picked && picked.wallId !== wall.id) {
                  const i = walls.findIndex((w) => w.id === picked.wallId);
                  if (i >= 0) setWallIndex(i);
                }
                setSelectedId(id);
              }}
              /*
               * הסיבוב חופשי גם כשהוא יוצר חפיפה: מי שמעמיד ארון
               * בפינה מסובב אותו קודם ומזיז אחר כך, וחסימה כאן
               * הייתה נראית כמו כפתור שבור. החפיפה מסומנת בהתראות
               * ובמבט העל.
               */
              onRotate={editable ? (id, deg) => patchUnit(id, { rotationDeg: deg }, `rotate:${id}`) : undefined}
              /* גרירה בתלת־ממד עשויה לעבור לקיר שכן — הארגז עובר איתה */
              onMoveTo={
                editable
                  ? (id, xMm, yMm, wallId) => patchUnit(id, { xMm, yMm, wallId })
                  : undefined
              }
              inside={inside}
              noUppers={noUppers}
              finishHex={finishHex ?? {}}
            />
          ) : (
          <WallElevation
            wall={wall}
            units={units}
            selectedId={selectedId}
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
            noUppers={noUppers}
            measure={measure}
            corners={corners}
            finishHex={finishHex ?? {}}
            onMove={(id, xMm, yMm) => patchUnit(id, { xMm, yMm })}
          />
          )}

        </div>
      </div>

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
        <div className="relative flex shrink-0 items-center">
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
        <span className="absolute end-4 flex items-center gap-1.5">
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
            onClick={() => removeUnit(selected.id)}
            aria-label="הסרת הארגז"
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
                  onReorder={(next) => viewOptions.setStatOrder(next)}
                />
              </>
            )}

            {/*
              ההתראות אינן מחוון אלא בעיה, ולכן הן מחוץ למחווני הקיר
              ומוצגות גם כשהם סגורים: מחוון אפשר לא לראות, שקע
              שנחסם — לא.

              התראה מצביעה על ארגז, ולכן היא כפתור: לוחצים, והארגז
              נבחר, מסומן על הקיר ונפתח לעריכה — במקום לחפש לפי השם
              מי מבין הארגזים הוא זה.
            */}
            {analysis && role === 'manager' && view.warnings && analysis.warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                {analysis.warnings.map((w) =>
                  w.unitIds.length > 0 ? (
                    <li key={w.text}>
                      <button
                        onClick={() => setSelectedId(w.unitIds[0])}
                        className="flex w-full items-start gap-1.5 rounded-lg px-1 py-0.5 text-start text-sm leading-snug text-amber-900 underline decoration-amber-300 underline-offset-2 transition-colors hover:bg-amber-100"
                      >
                        {w.text}
                      </button>
                    </li>
                  ) : (
                    <li key={w.text} className="text-sm leading-snug text-amber-900">
                      {w.text}
                    </li>
                  ),
                )}
              </ul>
            )}

            {statsOpen && units.length === 0 && (
              <p className="mt-6 text-center text-[15px] text-stone-500">
                הקיר ריק. פתח את הספרייה והוסף את הארגז הראשון.
              </p>
            )}
          </main>

          <div className="shrink-0 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {editable ? (
              <button
                onClick={() => setSheet('library')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
              >
                <PlusIcon />
                הוספת ארגז
              </button>
            ) : (
              <EditGate
                project={project}
                role={role}
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
            {role === 'manager' &&
              (project.soldAt ? (
                <button
                  onClick={() => {
                    setWorkToggle((v) => !v);
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
              ) : (
                <button
                  onClick={() => setSheet('materials')}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-900 bg-white py-3.5 text-base font-semibold text-stone-900 transition-colors hover:bg-stone-100"
                >
                  <CalcIcon />
                  חישוב פרויקט
                </button>
              ))}
          </div>
        </>
      )}

      {/*
        הארגז נמצא לפני הפתיחה ולא נכפה בסימן קריאה: ארגז יכול
        להימחק בזמן שהמגירה שלו פתוחה — בביטול פעולה, למשל — ואז
        המגירה קיבלה undefined וקרסה.
      */}
      {workUnit && (
        <UnitWorkSheet
          unit={workUnit}
          role={role}
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
          role={role}
          onApply={async (changes) => {
            await history.capture(projectId, `bulk:${Date.now()}`);
            for (const c of changes) await unitsRepo.update(c.id, { work: c.work });
            await syncConsumption(projectId);
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
          units={allUnits ?? []}
          finishes={allFinishes ?? []}
          materials={allMaterials ?? []}
          finishHex={finishHex ?? {}}
          onClose={closeSheet}
        />
      )}

      {sheet === 'plan' && (
        <Sheet title="מבט על החדר" onClose={closeSheet} tall>
          <PlanView
            noUppers={noUppers}
            walls={walls}
            units={allUnits ?? []}
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
          currentMm={selected?.depthMm ?? units[0]?.depthMm ?? 580}
          onClose={closeSheet}
          onApply={async (mm, onlyFloor) => {
            await unitsRepo.setDepthForProject(projectId, mm, onlyFloor);
            closeSheet();
          }}
        />
      )}

      {sheet === 'edit' && selected && (
        <UnitEditSheet unit={selected} onClose={closeSheet} />
      )}

      {sheet === 'sale' && (
        <SaleSheet
          project={project}
          units={allUnits ?? []}
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



