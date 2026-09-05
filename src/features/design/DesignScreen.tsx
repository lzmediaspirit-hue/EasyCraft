import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo, wallsRepo } from '../projects/projectsRepo';
import { wallLabel } from '../projects/wallLayouts';
import { WallElevation, type MeasureAxis } from './WallElevation';
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
import { WallToolsSheet } from './WallToolsSheet';
import { useViewOptions } from './viewOptions';
import { history, useHistory } from './history';
import { WallThumb } from './WallThumb';
import { buildPlan, cornerDepth, cornerZones, planUnits } from './plan';
import { analyzeWall, nextFreeX } from './analysis';
import { finishesRepo } from '../../materials/materialsRepo';
import { syncConsumption } from '../../materials/consumption';
import { roomDef } from '../../catalog/rooms';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { QuickCalcButton } from '../../ui/QuickCalc';
import { Sheet } from '../../ui/Sheet';
import {
  CalcIcon,
  CenterIcon,
  CheckIcon,
  ChevronIcon,
  CubeIcon,
  DepthIcon,
  NestIcon,
  FrontsIcon,
  InsideIcon,
  PlanIcon,
  PlusIcon,
  RedoIcon,
  RulerIcon,
  TagIcon,
  SlidersIcon,
  UndoIcon,
} from '../../ui/icons';
import { cm, meters, unitLabel } from '../../ui/units';
import type { CatalogItem, PlacedUnit, Project, UserRole } from '../../db/types';

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
  const [wallIndex, setWallIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [nestingOpen, setNestingOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  /* חזית שטוחה לעבודה מדויקת, ומבט תלת-ממדי להבנת המבנה ולהצגה ללקוח */
  const [iso, setIso] = useState(false);
  const [depthOpen, setDepthOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [wallToolsOpen, setWallToolsOpen] = useState(false);
  /* מצב סרגל: מודדים את המרחק בין שני ארגזים שנבחרו */
  const [rulerPair, setRulerPair] = useState<string[] | null>(null);
  /*
   * מצב תהליך עבודה: אותם ארגזים באותם מקומות, אבל צבועים לפי מה
   * שנעשה בהם — ובלי כלי עריכה. מי שעומד ליד המסור לא אמור להזיז
   * ארגז בטעות.
   */
  const [workToggle, setWorkToggle] = useState(!!startInWork);
  const [workUnitId, setWorkUnitId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [finishesOpen, setFinishesOpen] = useState(false);
  /* מחווני הקיר מתקפלים, וההדמיה תופסת את מה שהתפנה */
  const [statsOpen, setStatsOpen] = useState(true);
  const [inside, setInside] = useState(false);
  const [measure, setMeasure] = useState<MeasureAxis | null>(null);
  /*
   * גובה לוח העריכה, כחלק מגובה המסך.
   * לוח הגדרות ארוך היה מכסה את הקיר, וקצר מדי מחייב גלילה בלי סוף.
   * לכן הגובה נגרר, ונשמר כדי שהעבודה הבאה תתחיל באותה חלוקה.
   */
  const [panelRatio, setPanelRatio] = useState(() => {
    const saved = Number(localStorage.getItem(PANEL_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampRatio(saved) : 0.45;
  });
  const dragPanel = useRef<{ startY: number; startRatio: number } | null>(null);

  const project = useLiveQuery(() => projectsRepo.get(projectId), [projectId]);
  const walls = useLiveQuery(() => wallsRepo.listForProject(projectId), [projectId]);
  const allUnits = useLiveQuery(() => unitsRepo.listForProject(projectId), [projectId]);
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
    return [
      ...new Set(
        boxes.filter((b) => b.clash && b.unit.wallId === wall.id).map((b) => b.unit.name),
      ),
    ];
  }, [walls, wall, allUnits]);
  const analysis = wall ? analyzeWall(wall, units, clashing) : null;

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
    const unit = await unitsRepo.add(projectId, wall.id, item, Math.min(x, maxX));
    setLibraryOpen(false);
    setSelectedId(unit.id);
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
      <ScreenHeader
        title={project.name}
        subtitle={subtitle(project.name, project.roomKind, walls.length)}
        action={<QuickCalcButton />}
      >
        {/*
          שתי שורות ולא אחת: השורה הראשונה היא מה שעושים על הקיר
          שעובדים עליו, והשנייה היא איך מסתכלים עליו. שורה אחת
          ארוכה נגללה הצידה, וכפתור שצריך לגלול אליו הוא כפתור
          שלא לוחצים עליו.
        */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Tool
            active={inside}
            onClick={() => setInside((v) => !v)}
            icon={inside ? <InsideIcon className="size-4" /> : <FrontsIcon className="size-4" />}
            label={inside ? 'פנים' : 'חזית'}
            title={inside ? 'הצגת חזיתות' : 'הסתרת חזיתות'}
          />
          <Tool
            active={nestingOpen}
            onClick={() => setNestingOpen(true)}
            icon={<NestIcon className="size-4" />}
            label="ניסור"
          />
          {editable && (
            <Tool
              active={depthOpen}
              onClick={() => setDepthOpen(true)}
              icon={<DepthIcon className="size-4" />}
              label="עומק אחיד"
            />
          )}
          {/*
            אחרי המכירה יש מה לעקוב אחריו. לפניה הארגזים עוד זזים,
            ומצב עבודה על קיר שאינו סגור רק מבלבל.
          */}
          {!!project.soldAt &&
            role === 'manager' && (
              <Tool
                active={workMode}
                onClick={() => {
                  setWorkToggle((v) => !v);
                  setSelectedId(null);
                  setRulerPair(null);
                  setMeasure(null);
                }}
                icon={<FlowIcon className="size-4" />}
                label={workMode ? 'תהליך' : 'תכנון'}
                title={workMode ? 'חזרה למצב תכנון' : 'מצב תהליך עבודה'}
              />
            )}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Tool
            active={iso}
            onClick={() => setIso((v) => !v)}
            icon={<CubeIcon className="size-4" />}
            label={iso ? 'תלת־ממד' : 'שטוח'}
            title={iso ? 'חזרה לציור חזית' : 'מבט תלת־ממדי'}
          />
          {/* מבט על זמין תמיד: משם גם מוסיפים קיר לחדר */}
          <Tool
            active={planOpen}
            onClick={() => setPlanOpen((v) => !v)}
            icon={<PlanIcon className="size-4" />}
            label="מבט על"
          />
          {/*
            לחיצות חוזרות על אותו כפתור מחליפות ציר: רוחב, גובה,
            עומק וכיבוי. קודם היה בורר ציר בשורה נפרדת שגזל מקום
            מהציור, ובטלפון הוא נחתך.
          */}
          <Tool
            active={measure !== null}
            onClick={() =>
              setMeasure((m) => (m === null ? 'w' : m === 'w' ? 'h' : m === 'h' ? 'd' : null))
            }
            icon={<RulerIcon className="size-4" />}
            label={
              measure === null
                ? 'מדידה'
                : measure === 'w'
                  ? 'רוחב'
                  : measure === 'h'
                    ? 'גובה'
                    : 'עומק'
            }
            title="לחיצה נוספת מחליפה ציר"
          />
          {/*
            סרגל: מודדים את המרחק בין שני ארגזים. זו השאלה שנשאלת
            בשטח — "כמה נשאר בין השניים" — ועד עכשיו היה צריך לחשב
            אותה בראש משתי המידות.
          */}
          <Tool
            active={rulerPair !== null}
            onClick={() => {
              setRulerPair((p) => (p === null ? [] : null));
              setMeasure(null);
              setSelectedId(null);
            }}
            icon={<RulerIcon className="size-4" />}
            label="סרגל"
            title="מרחק בין שני ארגזים"
          />
          {role === 'manager' && (
            <Tool
              active={wallToolsOpen}
              onClick={() => setWallToolsOpen(true)}
              icon={<SlidersIcon className="size-4" />}
              label="הקיר"
              title="מידות הקיר ומה מוצג"
            />
          )}
        </div>

        {/*
          שורת פעולות על הארגזים: ביטול וחזרה, שכפול ומרכוז.
          כולן נוגעות במה שכבר על הקיר, ולכן הן חיות יחד ולא בין
          כלי התצוגה.
        */}
        {workMode && (
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Tool
              active={bulkOpen}
              onClick={() => setBulkOpen(true)}
              icon={<CheckIcon className="size-4" />}
              label="סימון מהיר"
              title="לסמן שלב על כל הארגזים בקיר"
            />
          </div>
        )}

        {editable && (
        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Tool
            active={false}
            disabled={!canUndo}
            onClick={() => history.undo(projectId)}
            icon={<UndoIcon className="size-4" />}
            label="בטל"
          />
          <Tool
            active={false}
            disabled={!canRedo}
            onClick={() => history.redo(projectId)}
            icon={<RedoIcon className="size-4" />}
            label="חזור"
          />
          <Tool
            active={finishesOpen}
            onClick={() => setFinishesOpen(true)}
            icon={<TagIcon className="size-4" />}
            label="גוון לכולם"
            title="גוון לכל החזיתות, הגופים או הדפנות"
          />
          <Tool
            active={false}
            disabled={units.length === 0}
            onClick={centerWall}
            icon={<CenterIcon className="size-4" />}
            label="מרכוז"
            title="ממרכז את הארגזים על הקיר"
          />
        </div>
        )}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {walls.length > 1 &&
            walls.map((w, i) => (
              <button
                key={w.id}
                onClick={() => setWallIndex(i)}
                className={`flex shrink-0 items-center gap-2 rounded-full ps-2.5 pe-4 py-1.5 text-sm font-medium transition-colors ${
                  i === wallIndex
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <WallThumb wall={w} units={allUnits ?? []} active={i === wallIndex} />
                {wallLabel(w, i)}
              </button>
            ))}
          <button
            onClick={async () => {
              await wallsRepo.add(projectId);
              setWallIndex(walls.length);
            }}
            aria-label="קיר נוסף"
            title="קיר נוסף"
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-4" />
            קיר
          </button>
        </div>
      </ScreenHeader>

      {/*
        ההדמיה תופסת את מה שנשאר אחרי לוח העריכה, ולכן גרירת הלוח
        כלפי מעלה באמת מכסה את הקיר — וזו הנקודה: לוח הגדרות ארוך
        צריך מקום, וקיר שכבר בנוי אפשר להסתיר לרגע.
      */}
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-3 pb-2">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-2">
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
              inside={inside}
              finishHex={finishHex ?? {}}
            />
          ) : (
          <WallElevation
            wall={wall}
            units={units}
            selectedId={selectedId}
            showHeight={view.heightLine}
            rulerPair={rulerPair}
            work={workMode}
            onSelect={(id) => {
              if (workMode) return setWorkUnitId(id);
              // במצב סרגל הבחירה אוספת שני ארגזים ולא פותחת עורך
              if (rulerPair) {
                if (!id) return setRulerPair([]);
                setRulerPair((p) => {
                  const cur = p ?? [];
                  if (cur.includes(id)) return cur.filter((x) => x !== id);
                  return [...cur, id].slice(-2);
                });
                return;
              }
              setSelectedId(id);
            }}
            inside={inside}
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
        {/* ידית גרירה שקובעת כמה מהמסך תופס לוח העריכה */}
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
            localStorage.setItem(PANEL_KEY, String(panelRatio));
          }}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            const next = clampRatio(panelRatio + (e.key === 'ArrowUp' ? 0.05 : -0.05));
            setPanelRatio(next);
            localStorage.setItem(PANEL_KEY, String(next));
          }}
          className="flex shrink-0 cursor-ns-resize touch-none justify-center py-2"
        >
          <span className="h-1.5 w-12 rounded-full bg-stone-300" />
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
          roomAbove={freeRoom(selected, units, wall.heightMm, 'up')}
          roomBelow={freeRoom(selected, units, wall.heightMm, 'down')}
          onApplyChoiceAll={(role, choice) =>
            unitsRepo.setChoiceForProject(projectId, role, choice)
          }
          onDuplicate={duplicateSelected}
          onEdit={() => setEditOpen(true)}
          onRemove={async () => {
            await unitsRepo.remove(selected.id);
            setSelectedId(null);
          }}
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
          <button
            onClick={() => setStatsOpen((v) => !v)}
            aria-expanded={statsOpen}
            className="mx-4 mt-1 flex shrink-0 items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-medium text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-600"
          >
            <ChevronIcon
              className={`size-3.5 transition-transform ${statsOpen ? '-rotate-90' : 'rotate-90'}`}
            />
            {statsOpen ? 'הסתרת הנתונים' : 'הצגת הנתונים'}
          </button>

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

            {statsOpen && analysis && role === 'manager' && (
              <>
                {/* מה מוצג כאן נבחר במגירת הקיר; אין מחוון שאי אפשר לכבות */}
                <div className="grid grid-cols-3 gap-2">
                  {view.wallArea && (
                    <Stat
                      label="שטח הקיר"
                      value={((wall.lengthMm / 1000) * (wall.heightMm / 1000)).toFixed(2)}
                      unit="מ״ר"
                    />
                  )}
                  {view.wallHeight && (
                    <Stat label="גובה הקיר" value={cm(wall.heightMm)} unit={unitLabel()} />
                  )}
                  {view.floorMeters && (
                    <Stat label="מטר רץ תחתון" value={meters(analysis.floorUsedMm)} unit="מ׳" />
                  )}
                  {view.unitCount && <Stat label="ארגזים" value={String(units.length)} />}
                  {view.freeSpace && (
                    <Stat
                      label={analysis.freeMm >= 0 ? 'נשאר על הקיר' : 'חריגה'}
                      value={cm(Math.abs(analysis.freeMm))}
                      unit={unitLabel()}
                      tone={analysis.freeMm < 0 ? 'bad' : 'ok'}
                    />
                  )}
                  {view.frontArea && (
                    <Stat
                      label="שטח חזיתות"
                      value={(
                        units.reduce((n, u) => n + (u.widthMm / 1000) * (u.heightMm / 1000), 0)
                      ).toFixed(2)}
                      unit="מ״ר"
                    />
                  )}
                </div>

                {view.warnings && analysis.warnings.length > 0 && (
                  <ul className="mt-3 space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    {analysis.warnings.map((w) => (
                      <li key={w} className="text-sm leading-snug text-amber-900">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </>
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
                onClick={() => setLibraryOpen(true)}
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
              חישוב הוא סוף העבודה על הקיר ולכן הוא יושב ליד הפעולה
              הראשית, לא בין כלי התצוגה. פתיחת הפרויקט עצמה נעשית
              מתוכו — אחרי שרואים מה זה עולה.
            */}
            {/*
              חישוב ומחיר הם עניין של המנהל. התכנת והנגר צריכים את
              הארגזים ואת מה שנשאר לעשות בהם, לא את מה שזה עולה.
            */}
            {role === 'manager' && (
              <button
                onClick={() => setMaterialsOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-900 bg-white py-3.5 text-base font-semibold text-stone-900 transition-colors hover:bg-stone-100"
              >
                <CalcIcon />
                חישוב פרויקט
              </button>
            )}
          </div>
        </>
      )}

      {workUnitId && (
        <UnitWorkSheet
          unit={(allUnits ?? []).find((u) => u.id === workUnitId)!}
          role={role}
          onChange={async (work) => {
            await patchUnit(workUnitId, { work }, `work:${workUnitId}`);
            /* סימון חיתוך הוא מה שמוריד פלטות מהמלאי — בלי הזנה נוספת */
            await syncConsumption(projectId);
          }}
          onClose={() => setWorkUnitId(null)}
        />
      )}

      {finishesOpen && (
        <ProjectFinishesSheet
          project={project}
          onApply={(part, choice) => unitsRepo.setChoiceForProject(projectId, part, choice)}
          onClose={() => setFinishesOpen(false)}
        />
      )}

      {bulkOpen && (
        <BulkWorkSheet
          units={units}
          role={role}
          onApply={async (changes) => {
            await history.capture(projectId, `bulk:${Date.now()}`);
            for (const c of changes) await unitsRepo.update(c.id, { work: c.work });
            await syncConsumption(projectId);
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {wallToolsOpen && (
        <WallToolsSheet
          wall={wall}
          index={wallIndex}
          onChange={(patch) => wallsRepo.update(wall.id, patch)}
          onClose={() => setWallToolsOpen(false)}
        />
      )}

      {planOpen && (
        <Sheet title="מבט על החדר" onClose={() => setPlanOpen(false)} tall>
          <PlanView
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

      {depthOpen && (
        <DepthSheet
          currentMm={selected?.depthMm ?? units[0]?.depthMm ?? 580}
          onClose={() => setDepthOpen(false)}
          onApply={async (mm, onlyFloor) => {
            await unitsRepo.setDepthForProject(projectId, mm, onlyFloor);
            setDepthOpen(false);
          }}
        />
      )}

      {editOpen && selected && (
        <UnitEditSheet unit={selected} onClose={() => setEditOpen(false)} />
      )}

      {saleOpen && (
        <SaleSheet
          project={project}
          units={allUnits ?? []}
          costing={costing}
          isManager={me?.role === 'manager'}
          onClose={() => setSaleOpen(false)}
        />
      )}

      {nestingOpen && (
        <NestingSheet projectId={projectId} onClose={() => setNestingOpen(false)} />
      )}

      {materialsOpen && (
        <MaterialsSheet
          projectId={projectId}
          onStart={() => {
            setMaterialsOpen(false);
            setSaleOpen(true);
          }}
          onClose={() => setMaterialsOpen(false)}
        />
      )}

      {libraryOpen && (
        <LibrarySheet
          roomKind={project.roomKind}
          onAdd={addItem}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tool({
  active,
  onClick,
  icon,
  label,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  /** תיאור הפעולה, כשהתווית לבדה לא מספרת מה תקרה */
  title?: string;
  /** פעולה שאין לה על מה לפעול כרגע */
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      /*
       * התווית הנראית היא חלק מהשם הנגיש. כשהיא לא נמצאת בו, מי
       * שמפעיל את האפליקציה בקול אומר "שטוח" ושום כפתור לא נענה.
       */
      aria-label={title ? `${label} — ${title}` : undefined}
      title={title}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
      } disabled:opacity-40`}
    >
      {icon}
      {label}
    </button>
  );
}

/** תת-כותרת בלי כפילות: שם החדר מוצג רק אם הוא שונה משם הפרויקט. */
/**
 * כמה מקום פנוי יש מעל הדלת או מתחתיה, באותו טווח רוחב.
 *
 * זה מה שמגביל דלת שנמשכת מעבר לארגז: היא יכולה לכסות את מה שאין
 * בו ארגז אחר, ולעצור לפני התקרה או הרצפה.
 *
 * הדלת אינה מתחילה בתחתית הארגז אלא מעל הרגליים, ולכן הרגליים עצמן
 * הן מקום פנוי כלפי מטה — זו בדיוק הדלת שמכסה את הסוקל. מדידה
 * מתחתית הארגז החזירה אפס לכל ארגז שעומד על הרצפה, ו"למטה" פשוט
 * לא זז.
 */
function freeRoom(
  unit: PlacedUnit,
  units: PlacedUnit[],
  wallHeightMm: number,
  dir: 'up' | 'down',
): number {
  const overlaps = units.filter(
    (u) => u.id !== unit.id && u.xMm < unit.xMm + unit.widthMm && u.xMm + u.widthMm > unit.xMm,
  );
  if (dir === 'down') {
    const doorBottom = unit.yMm + (unit.socleMm ?? 0);
    const top = overlaps
      .filter((u) => u.yMm + u.heightMm <= unit.yMm + 1)
      .reduce((n, u) => Math.max(n, u.yMm + u.heightMm), 0);
    return Math.max(doorBottom - top, 0);
  }
  const myTop = unit.yMm + unit.heightMm;
  const bottom = overlaps
    .filter((u) => u.yMm >= myTop - 1)
    .reduce((n, u) => Math.min(n, u.yMm), wallHeightMm);
  return Math.max(bottom - myTop, 0);
}

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

function subtitle(name: string, roomKind: Project['roomKind'], wallCount: number): string {
  const room = roomDef(roomKind).label;
  const wallsText = wallCount === 1 ? 'קיר אחד' : `${wallCount} קירות`;
  return name.trim() === room ? wallsText : `${room} · ${wallsText}`;
}

function Stat({
  label,
  value,
  unit,
  tone = 'ok',
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'ok' | 'bad';
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <span
        className={`flex items-baseline gap-1 text-lg font-semibold ${
          tone === 'bad' ? 'text-red-600' : 'text-stone-900'
        }`}
      >
        <span className="num">{value}</span>
        {unit && <span className="text-xs font-normal text-stone-400">{unit}</span>}
      </span>
    </div>
  );
}
