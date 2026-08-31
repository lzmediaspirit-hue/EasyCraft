import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo, wallsRepo } from '../projects/projectsRepo';
import { wallName } from '../projects/wallLayouts';
import { WallElevation, type MeasureAxis } from './WallElevation';
import { LibrarySheet } from './LibrarySheet';
import { UnitEditor } from './UnitEditor';
import { UnitEditSheet } from './UnitEditSheet';
import { MaterialsSheet } from './MaterialsSheet';
import { analyzeWall, nextFreeX } from './analysis';
import { finishesRepo } from '../../materials/materialsRepo';
import { roomDef } from '../../catalog/rooms';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { CalcIcon, FrontsIcon, InsideIcon, PlusIcon, RulerIcon } from '../../ui/icons';
import { cm, meters } from '../../ui/units';
import type { CatalogItem, PlacedUnit, Project } from '../../db/types';

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
  const [inside, setInside] = useState(false);
  const [measure, setMeasure] = useState<MeasureAxis | null>(null);

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

  // מעבר לקיר אחר מבטל בחירה, כדי שלא נערוך ארגז שלא רואים
  useEffect(() => setSelectedId(null), [wallIndex]);

  const analysis = wall ? analyzeWall(wall, units) : null;

  async function addItem(item: CatalogItem) {
    if (!wall) return;
    const x = nextFreeX(units, item.level);
    const unit = await unitsRepo.add(projectId, wall.id, item, Math.min(x, wall.lengthMm));
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
      >
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Tool
            active={inside}
            onClick={() => setInside((v) => !v)}
            icon={inside ? <InsideIcon className="size-4" /> : <FrontsIcon className="size-4" />}
            label={inside ? 'פנים' : 'חזית'}
          />
          <Tool
            active={measure !== null}
            onClick={() => setMeasure((m) => (m === null ? 'w' : null))}
            icon={<RulerIcon className="size-4" />}
            label="מדידה"
          />
          <Tool
            active={materialsOpen}
            onClick={() => setMaterialsOpen(true)}
            icon={<CalcIcon className="size-4" />}
            label="חומרים"
          />

          {measure !== null && (
            <div className="ms-1 flex shrink-0 gap-1 rounded-full bg-stone-200/70 p-0.5">
              {(
                [
                  ['w', 'רוחב'],
                  ['h', 'גובה'],
                  ['d', 'עומק'],
                ] as const
              ).map(([axis, label]) => (
                <button
                  key={axis}
                  onClick={() => setMeasure(axis)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    measure === axis ? 'bg-teal-700 text-white' : 'text-stone-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {walls.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {walls.map((w, i) => (
              <button
                key={w.id}
                onClick={() => setWallIndex(i)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  i === wallIndex
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {wallName(i)}
              </button>
            ))}
          </div>
        )}
      </ScreenHeader>

      {/* ההדמיה נשארת גלויה גם כשלוח העריכה פתוח */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-2">
          <WallElevation
            wall={wall}
            units={units}
            selectedId={selectedId}
            onSelect={setSelectedId}
            inside={inside}
            measure={measure}
            finishHex={finishHex ?? {}}
            onMove={(id, xMm, yMm) => patchUnit(id, { xMm, yMm })}
          />
        </div>
      </div>

      {selected ? (
        <UnitEditor
          unit={selected}
          onChange={(patch) => patchUnit(selected.id, patch)}
          onEdit={() => setEditOpen(true)}
          onRemove={async () => {
            await unitsRepo.remove(selected.id);
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {analysis && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="ארגזים" value={String(units.length)} />
                  <Stat label="מטר רץ תחתון" value={meters(analysis.floorUsedMm)} unit="מ׳" />
                  <Stat
                    label={analysis.freeMm >= 0 ? 'נשאר על הקיר' : 'חריגה'}
                    value={cm(Math.abs(analysis.freeMm))}
                    unit="ס״מ"
                    tone={analysis.freeMm < 0 ? 'bad' : 'ok'}
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
          </div>
        </>
      )}

      {editOpen && selected && (
        <UnitEditSheet unit={selected} onClose={() => setEditOpen(false)} />
      )}

      {materialsOpen && (
        <MaterialsSheet projectId={projectId} onClose={() => setMaterialsOpen(false)} />
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
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
