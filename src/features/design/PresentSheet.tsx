import { useState } from 'react';
import { WallIso } from './WallIso';
import { Sheet } from '../../ui/Sheet';
import { roomDef } from '../../catalog/rooms';
import { partChoice } from '../../costing/boards';
import { PART_ROLES } from '../../db/types';
import type { Customer, Finish, Material, PlacedUnit, Project, Wall } from '../../db/types';

/**
 * מה שמראים ללקוח.
 *
 * מסך ההדמיה הוא כלי עבודה: קווים בין הלוחות, שמות קירות, מידות,
 * סימון של מה שנבחר. הלקוח לא קורא שרטוט — הוא רוצה לראות איך זה
 * ייראה אצלו — ולכן כאן נשאר החדר בלבד, עם אור וצל, ולצדו רשימת
 * הגוונים שנבחרו ושם הפרויקט.
 *
 * גם כאן אפשר לסובב: הרגע שבו הלקוח מבין מה הוא מקבל הוא הרגע שבו
 * הוא מזיז את התמונה בעצמו.
 */
export function PresentSheet({
  project,
  customer,
  walls,
  units,
  finishes,
  materials,
  finishHex,
  onClose,
}: {
  project: Project;
  customer?: Customer;
  walls: Wall[];
  units: PlacedUnit[];
  finishes: Finish[];
  materials: Material[];
  finishHex: Record<string, string>;
  onClose: () => void;
}) {
  /* חזיתות סגורות זו התמונה שמראים; פתיחה היא בקשה של הלקוח */
  const [inside, setInside] = useState(false);

  /*
   * הגוונים שבאמת חלים על הפרויקט, חלק אחרי חלק. נקראים מהארגזים
   * ולא מברירת המחדל, כי ארגז יחיד ששונה הוא בדיוק מה שהלקוח שואל
   * עליו.
   */
  const chosen = PART_ROLES.map((role) => {
    const used = new Map<string, { finish?: Finish; material?: Material }>();
    for (const u of units) {
      const c = partChoice(u, role.key, project);
      if (!c.finishId) continue;
      used.set(`${c.finishId}:${c.materialId ?? ''}`, {
        finish: finishes.find((f) => f.id === c.finishId),
        material: materials.find((m) => m.id === c.materialId),
      });
    }
    return { role, lines: [...used.values()].filter((l) => l.finish) };
  }).filter((r) => r.lines.length > 0);

  return (
    <Sheet title="הדמיה ללקוח" onClose={onClose} tall>
      <div className="space-y-3">
        <div className="text-center">
          <h2 className="text-xl font-bold text-stone-900">{project.name}</h2>
          <p className="text-xs text-stone-500">
            {roomDef(project.roomKind).label}
            {customer ? ` · ${customer.name}` : ''}
          </p>
        </div>

        <div className="relative flex h-[46vh] min-h-0 overflow-hidden rounded-2xl border border-stone-200">
          <WallIso
            walls={walls}
            units={units}
            activeWallId={walls[0]?.id ?? ''}
            selectedId={null}
            onSelect={() => {}}
            inside={inside}
            finishHex={finishHex}
            present
          />
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setInside((v) => !v)}
            aria-pressed={inside}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              inside ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {inside ? 'סגירת הדלתות' : 'פתיחת הדלתות'}
          </button>
        </div>

        {chosen.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-stone-700">הגוונים שנבחרו</h3>
            <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {chosen.map((r) => (
                <li key={r.role.key} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="w-20 shrink-0 text-xs font-medium text-stone-500">
                    {r.role.label}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
                    {r.lines.map((l) => (
                      <span key={l.finish!.id} className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="size-5 shrink-0 rounded border border-black/10"
                          style={{ background: l.finish!.hex }}
                        />
                        <span className="truncate text-sm text-stone-800">
                          {l.finish!.name}
                          {l.finish!.texture && (
                            <span className="text-stone-400"> · {l.finish!.texture}</span>
                          )}
                        </span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          שמירה לקובץ חסומה בתצוגה מוטמעת, ולכן הדרך לשלוח את התמונה
          היא צילום מסך — וזה גם מה שנגר עושה ממילא.
        */}
        <p className="pb-2 text-center text-[11px] leading-snug text-stone-400">
          גוררים כדי לסובב את החדר. לשליחה ללקוח — צילום מסך.
        </p>
      </div>
    </Sheet>
  );
}
