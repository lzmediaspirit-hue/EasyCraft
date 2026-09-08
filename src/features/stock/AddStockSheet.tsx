import { useState } from 'react';
import { stockRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { Pill } from '../../ui/Pill';
import { selectOnFocus } from '../../ui/Field';
import type { Finish, Material } from '../../db/types';

/**
 * הוספת לוח למלאי ביד.
 *
 * הרשימה מציגה רק מה שיש בו מספר, ולכן לוח שנקנה מראש — בלי שאף
 * פרויקט דורש אותו — צריך דרך להיכנס. בוחרים גוון, בוחרים את החומר
 * שהוא קיים עליו, ומזינים כמות.
 */
export function AddStockSheet({
  finishes,
  materials,
  onClose,
}: {
  finishes: Finish[];
  materials: Material[];
  onClose: () => void;
}) {
  const [finishId, setFinishId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [sheets, setSheets] = useState(1);

  const finish = finishes.find((f) => f.id === finishId);
  /* חומר שאין לגוון מחיר עליו אינו לוח שקיים אצל הספק */
  const forFinish = materials.filter((m) => finish?.prices?.[m.id] !== undefined);
  const chosen = forFinish.find((m) => m.id === materialId) ?? forFinish[0];

  return (
    <Sheet
      title="הוספת לוח למלאי"
      onClose={onClose}
      tall
      footer={
        <button
          disabled={!finish || !chosen || sheets < 1}
          onClick={async () => {
            if (!finish || !chosen) return;
            await stockRepo.set(finish.id, chosen.id, { sheets });
            onClose();
          }}
          className="w-full rounded-2xl bg-oak-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-oak-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          הוספה למלאי
        </button>
      }
    >
      <div className="space-y-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">גוון</h3>
          <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {finishes.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => {
                    setFinishId(f.id);
                    setMaterialId(null);
                  }}
                  aria-pressed={f.id === finishId}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${
                    f.id === finishId ? 'bg-oak-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-7 shrink-0 rounded-lg border border-stone-200"
                    style={{ background: f.hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-900">
                      {f.name}
                    </span>
                    {f.texture && (
                      <span className="block truncate text-[11px] text-stone-400">{f.texture}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {finish && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">חומר</h3>
            {forFinish.length === 0 ? (
              <p className="text-xs leading-snug text-stone-500">
                לגוון הזה עוד אין מחיר לאף חומר. קובעים אותו במסך ההגדרות, ואז אפשר
                להחזיק ממנו מלאי.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {forFinish.map((m) => (
                  <Pill
                    key={m.id}
                    active={m.id === chosen?.id}
                    onClick={() => setMaterialId(m.id)}
                  >
                    {m.name}
                  </Pill>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">כמה פלטות</h3>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 5, 10].map((n) => (
              <Pill key={n} active={sheets === n} onClick={() => setSheets(n)}>
                {n}
              </Pill>
            ))}
            <input
              value={sheets || ''}
              onChange={(e) => setSheets(Math.max(Number(e.target.value) || 0, 0))}
              onFocus={selectOnFocus}
              type="number"
              inputMode="numeric"
              aria-label="כמות מדויקת"
              className="num w-16 rounded-lg bg-stone-100 py-1.5 text-center text-sm font-medium text-stone-900 focus:bg-white focus:ring-1 focus:ring-oak-400 focus:outline-none"
            />
          </div>
        </section>
      </div>
    </Sheet>
  );
}
