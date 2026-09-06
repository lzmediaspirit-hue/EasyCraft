import { useLiveQuery } from 'dexie-react-hooks';
import { finishesRepo, materialsRepo } from '../../materials/materialsRepo';
import { PART_ROLES, materialForRole } from '../../db/types';
import type { PartChoice, PartRole } from '../../db/types';

/**
 * הגוון והחומר של הפרויקט, לכל חלק בארגז.
 *
 * זו ההחלטה שנופלת פעם אחת מול הלקוח — גוף אחד, חזיתות אחת — ואחריה
 * כל ארגז בפרויקט מגיע צבוע. ארגז בודד עדיין אפשר לשנות, אבל זה
 * החריג ולא הרגיל.
 *
 * אפשר גם לדלג: מי שעוד לא יודע ימשיך, והחישוב יתריע שאין גוון.
 */
export function ProjectFinishesStep({
  value,
  onChange,
}: {
  value: Partial<Record<PartRole, PartChoice>>;
  onChange: (next: Partial<Record<PartRole, PartChoice>>) => void;
}) {
  const finishes = useLiveQuery(() => finishesRepo.all(), []);
  const materials = useLiveQuery(() => materialsRepo.list(), []);

  if (!finishes || !materials) return null;

  if (finishes.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-snug text-amber-900">
        אין עדיין גוונים בהגדרות. אפשר להמשיך בלעדיהם ולבחור אותם אחר כך —
        עד אז החישוב לא יידע מה מחיר הפלטה.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {PART_ROLES.map((role) => {
        const choice = value[role.key] ?? {};
        const finish = finishes.find((f) => f.id === choice.finishId);
        const available = finish
          ? materials.filter((m) => finish.prices?.[m.id] !== undefined)
          : [];
        return (
          <section key={role.key}>
            <h3 className="mb-1.5 text-sm font-semibold text-stone-700">{role.label}</h3>

            <div className="flex flex-wrap gap-1.5">
              {finishes.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    /*
                      החומר נבחר לפי החלק ולא לפי סדר הרשימה: גוף
                      מסנדוויץ׳, חזיתות ודפנות זרות מ-MDF, גב מדיקט.
                      אם הגוון לא קיים על החומר הזה — מה שיש.
                    */
                    const pick = materialForRole(
                      role.key,
                      materials,
                      (m) => f.prices?.[m.id] !== undefined,
                    );
                    onChange({
                      ...value,
                      [role.key]: { finishId: f.id, materialId: pick?.id },
                    });
                  }}
                  className={`flex items-center gap-1.5 rounded-lg py-1 pe-2.5 ps-1 text-sm font-medium transition-colors ${
                    choice.finishId === f.id
                      ? 'bg-oak-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-5 shrink-0 rounded border border-black/10"
                    style={{ background: f.hex }}
                  />
                  <span className="max-w-24 truncate">{f.name}</span>
                </button>
              ))}
            </div>

            {available.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {available.map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      onChange({ ...value, [role.key]: { ...choice, materialId: m.id } })
                    }
                    className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                      choice.materialId === m.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <p className="text-xs leading-snug text-stone-500">
        זו ברירת המחדל של הפרויקט. ארגז שצריך גוון אחר משנה אצלו, ומה
        שנקבע כאן ממשיך לחול על כל השאר.
      </p>
    </div>
  );
}
