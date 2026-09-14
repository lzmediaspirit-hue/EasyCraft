import { useState } from 'react';
import { finishesRepo, stockRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { Pill } from '../../ui/Pill';
import { Field, inputClass, selectOnFocus } from '../../ui/Field';
import { twoSided } from '../../db/types';
import type { Finish, Material } from '../../db/types';

/**
 * הוספת לוח למלאי.
 *
 * לוח מורכב משניים, ולכן זה גם סדר השאלות: קודם הליבה — הגוף
 * הפיזי שמונח במחסן — ואחר כך הגוון שמודבק עליה.
 *
 * גוון שאין לו עדיין מחיר על הליבה הזו אינו חסום: מזינים אותו כאן
 * ונגמר הסיפור. עד היום זה שלח את הנגר למסך ההגדרות באמצע ספירת
 * מלאי, וזו הליכה מיותרת בשביל מספר אחד.
 *
 * ליבה שמגיעה מודבקת משני הצדדים מקבלת גוון שני. הפלטה נספרת פעם
 * אחת — היא באמת פלטה אחת — ומופיעה בשתי השורות כרזרבה.
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
  const [materialId, setMaterialId] = useState<string | null>(materials[0]?.id ?? null);
  const [finishId, setFinishId] = useState<string | null>(null);
  const [backFinishId, setBackFinishId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [sheets, setSheets] = useState(1);

  const material = materials.find((m) => m.id === materialId) ?? materials[0];
  const finish = finishes.find((f) => f.id === finishId);
  const backFinish = finishes.find((f) => f.id === backFinishId);
  /** גוון שאין לו מחיר על הליבה הזו — קיים, אבל עוד לא כלוח */
  const unpriced = !!(finish && material && finish.prices?.[material.id] === undefined);
  const canSave = !!finish && !!material && sheets >= 1 && (!unpriced || price.trim() !== '');

  async function save() {
    if (!finish || !material) return;
    /* מחיר לגוון על הליבה הזו — זה מה שהופך אותם ללוח שקיים */
    if (unpriced && price.trim()) {
      await finishesRepo.save({
        ...finish,
        prices: { ...finish.prices, [material.id]: { consumerPrice: Number(price) } },
      });
    }
    await stockRepo.set(finish.id, material.id, {
      sheets,
      backFinishId: backFinish?.id,
    });
    onClose();
  }

  return (
    <Sheet
      title="הוספת לוח למלאי"
      onClose={onClose}
      tall
      footer={
        <button
          disabled={!canSave}
          onClick={save}
          className="w-full rounded-2xl bg-oak-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-oak-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          הוספה למלאי
        </button>
      }
    >
      <div className="space-y-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">ליבה</h3>
          <div className="flex flex-wrap gap-1.5">
            {materials.map((m) => (
              <Pill
                key={m.id}
                active={m.id === material?.id}
                onClick={() => {
                  setMaterialId(m.id);
                  setBackFinishId(null);
                }}
              >
                {m.name}
              </Pill>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">גוון</h3>
          <FinishList
            finishes={finishes}
            material={material}
            selected={finishId}
            onPick={(id) => {
              setFinishId(id);
              setPrice('');
            }}
          />
        </section>

        {/*
          גוון שקיים באפליקציה אבל אין לו מחיר על הליבה הזו הוא עדיין
          לא לוח. מחיר אחד כאן הופך אותו לכזה, בלי לצאת מהמסך.
        */}
        {unpriced && (
          <Field label="מחיר פלטה" hint={`${finish?.name} על ${material?.name} · ₪`}>
            <input
              autoFocus
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="decimal"
              className={`${inputClass} num text-end`}
              placeholder="—"
            />
          </Field>
        )}

        {/*
          לוח MDF מגיע לפעמים מודבק בשני גוונים. זו פלטה אחת ולא
          שתיים, ולכן היא נספרת פעם אחת ומופיעה בשתי השורות כרזרבה.
        */}
        {twoSided(material) && finish && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-stone-700">גוון בצד השני</h3>
            <p className="mb-2 text-[11px] leading-snug text-stone-400">
              לא חובה. פלטה דו-צדדית נספרת פעם אחת — מי שינסר אותה לצד אחד שרף גם
              את השני.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Pill active={!backFinishId} onClick={() => setBackFinishId(null)}>
                אין
              </Pill>
              {finishes
                .filter((f) => f.id !== finish.id)
                .map((f) => (
                  <Pill
                    key={f.id}
                    active={f.id === backFinishId}
                    onClick={() => setBackFinishId(f.id)}
                  >
                    {f.name}
                  </Pill>
                ))}
            </div>
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

/**
 * רשימת הגוונים, כשמי שכבר מתומחר על הליבה הנבחרת עולה למעלה.
 * הסדר הזה הוא הרמז: מה שלמעלה הוא לוח שקיים, ומה שלמטה יהיה כזה
 * ברגע שיינתן לו מחיר.
 */
function FinishList({
  finishes,
  material,
  selected,
  onPick,
}: {
  finishes: Finish[];
  material?: Material;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const priced = (f: Finish) => !!material && f.prices?.[material.id] !== undefined;
  const sorted = [...finishes].sort((a, b) => Number(priced(b)) - Number(priced(a)));

  return (
    <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      {sorted.map((f) => (
        <li key={f.id}>
          <button
            onClick={() => onPick(f.id)}
            aria-pressed={f.id === selected}
            className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${
              f.id === selected ? 'bg-oak-50' : 'hover:bg-stone-50'
            }`}
          >
            <span
              aria-hidden="true"
              className="size-7 shrink-0 rounded-lg border border-stone-200"
              style={{ background: f.hex }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-stone-900">{f.name}</span>
              {f.texture && (
                <span className="block truncate text-[11px] text-stone-400">{f.texture}</span>
              )}
            </span>
            {!priced(f) && <span className="shrink-0 text-[11px] text-stone-400">בלי מחיר</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
