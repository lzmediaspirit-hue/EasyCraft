import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo, wallsRepo } from '../projects/projectsRepo';
import { wallName } from '../projects/wallLayouts';
import { WallElevation, type MeasureAxis } from './WallElevation';
import { WallIso } from './WallIso';
import { LibrarySheet } from './LibrarySheet';
import { UnitEditor } from './UnitEditor';
import { UnitEditSheet } from './UnitEditSheet';
import { MaterialsSheet } from './MaterialsSheet';
import { NestingSheet } from './NestingSheet';
import { SaleSheet } from '../projects/SaleSheet';
import { useCurrentMember } from '../../workflow/useMember';
import { DepthSheet } from './DepthSheet';
import { PlanView } from './PlanView';
import { WallThumb } from './WallThumb';
import { buildPlan, cornerZones, planUnits } from './plan';
import { analyzeWall, nextFreeX } from './analysis';
import { finishesRepo } from '../../materials/materialsRepo';
import { roomDef } from '../../catalog/rooms';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { QuickCalcButton } from '../../ui/QuickCalc';
import { Sheet } from '../../ui/Sheet';
import {
  CalcIcon,
  CubeIcon,
  DepthIcon,
  NestIcon,
  FrontsIcon,
  InsideIcon,
  PlanIcon,
  PlusIcon,
  RulerIcon,
} from '../../ui/icons';
import { cm, meters } from '../../ui/units';
import type { CatalogItem, PlacedUnit, Project } from '../../db/types';

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
export function DesignScreen({ projectId }: { projectId: string }) {
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
  const costing = useLiveQuery(() => projectsRepo.costing(projectId), [projectId]);

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
    const x = nextFreeX(units, item.level);
    // הארגז נכנס בתוך הקיר, ולא נדחף אל מעבר לקצה שלו
    const maxX = Math.max(wall.lengthMm - item.defaultWidthMm, 0);
    const unit = await unitsRepo.add(projectId, wall.id, item, Math.min(x, maxX));
    setLibraryOpen(false);
    setSelectedId(unit.id);
  }

  async function patchUnit(id: string, patch: Partial<PlacedUnit>) {
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
          <Tool
            active={depthOpen}
            onClick={() => setDepthOpen(true)}
            icon={<DepthIcon className="size-4" />}
            label="עומק אחיד"
          />
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
        </div>
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
                {wallName(i)}
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
            onSelect={setSelectedId}
            inside={inside}
            measure={measure}
            corners={corners}
            finishHex={finishHex ?? {}}
            onMove={(id, xMm, yMm) => patchUnit(id, { xMm, yMm })}
          />
          )}
        </div>
      </div>

      {selected ? (
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
        <UnitEditor
          unit={selected}
          inside={inside}
          onChange={(patch) => patchUnit(selected.id, patch)}
          project={project}
          onApplyChoiceAll={(role, choice) =>
            unitsRepo.setChoiceForProject(projectId, role, choice)
          }
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
          <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {analysis && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat
                    label="שטח הקיר"
                    value={((wall.lengthMm / 1000) * (wall.heightMm / 1000)).toFixed(2)}
                    unit="מ״ר"
                  />
                  <Stat label="גובה הקיר" value={cm(wall.heightMm)} unit="ס״מ" />
                  <Stat label="מטר רץ תחתון" value={meters(analysis.floorUsedMm)} unit="מ׳" />
                  <Stat label="ארגזים" value={String(units.length)} />
                  <Stat
                    label={analysis.freeMm >= 0 ? 'נשאר על הקיר' : 'חריגה'}
                    value={cm(Math.abs(analysis.freeMm))}
                    unit="ס״מ"
                    tone={analysis.freeMm < 0 ? 'bad' : 'ok'}
                  />
                  <Stat
                    label="שטח חזיתות"
                    value={(
                      units.reduce((n, u) => n + (u.widthMm / 1000) * (u.heightMm / 1000), 0)
                    ).toFixed(2)}
                    unit="מ״ר"
                  />
                </div>

                {analysis.warnings.length > 0 && (
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

            {units.length === 0 && (
              <p className="mt-6 text-center text-[15px] text-stone-500">
                הקיר ריק. פתח את הספרייה והוסף את הארגז הראשון.
              </p>
            )}
          </main>

          <div className="shrink-0 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setLibraryOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
            >
              <PlusIcon />
              הוספת ארגז
            </button>

            {/*
              חישוב הוא סוף העבודה על הקיר ולכן הוא יושב ליד הפעולה
              הראשית, לא בין כלי התצוגה. פתיחת הפרויקט עצמה נעשית
              מתוכו — אחרי שרואים מה זה עולה.
            */}
            <button
              onClick={() => setMaterialsOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-900 bg-white py-3.5 text-base font-semibold text-stone-900 transition-colors hover:bg-stone-100"
            >
              <CalcIcon />
              חישוב פרויקט
            </button>
          </div>
        </>
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  /** תיאור הפעולה, כשהתווית לבדה לא מספרת מה תקרה */
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      /*
       * התווית הנראית היא חלק מהשם הנגיש. כשהיא לא נמצאת בו, מי
       * שמפעיל את האפליקציה בקול אומר "שטוח" ושום כפתור לא נענה.
       */
      aria-label={title ? `${label} — ${title}` : undefined}
      title={title}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** תת-כותרת בלי כפילות: שם החדר מוצג רק אם הוא שונה משם הפרויקט. */
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
