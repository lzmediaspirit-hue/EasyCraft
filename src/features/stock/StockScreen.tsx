import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { customersRepo } from '../customers/customersRepo';
import { finishesRepo, materialsRepo, stockRepo } from '../../materials/materialsRepo';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { selectOnFocus } from '../../ui/Field';
import { CheckIcon } from '../../ui/icons';
import type { ProjectCosting } from '../../costing/boards';
import type { Finish, Material } from '../../db/types';

/**
 * מלאי הפלטות בעסק.
 *
 * השאלה שהמסך הזה עונה עליה היא לא "כמה יש" אלא "מה צריך להזמין
 * היום": כמה פלטות דורשים הפרויקטים שכבר נמכרו, כמה מהן מונחות
 * בנגרייה, כמה כבר בדרך — והשאר הוא מה שחסר.
 *
 * פרויקט שעוד לא נמכר נספר בנפרד: הוא הצעה, לא התחייבות, ולהזמין
 * חומר לפיו זה להמר.
 */
export function StockScreen() {
  const materials = useLiveQuery(() => materialsRepo.list(), []);
  const finishes = useLiveQuery(() => finishesRepo.all(), []);
  const stock = useLiveQuery(() => stockRepo.all(), []);
  const projects = useLiveQuery(() => projectsRepo.all(), []);
  const archived = useLiveQuery(() => customersRepo.list(true), []);
  const costings = useLiveQuery<Record<string, ProjectCosting>>(
    async () => (projects ? projectsRepo.summaries(projects.map((p) => p.id)) : {}),
    [projects],
  );
  const [onlyNeeded, setOnlyNeeded] = useState(false);

  /**
   * כמה פלטות דורש כל צירוף של גוון וחומר.
   * לקוח שהועבר לארכיון כבר לא ממתין לחומר, ולכן הוא יוצא מהספירה.
   */
  const demand = useMemo(() => {
    const out = new Map<string, { sold: number; quoted: number }>();
    if (!projects || !costings) return out;
    const archivedIds = new Set((archived ?? []).map((c) => c.id));
    for (const p of projects) {
      if (archivedIds.has(p.customerId)) continue;
      const costing = costings[p.id];
      if (!costing) continue;
      for (const line of costing.lines) {
        const row = out.get(line.key) ?? { sold: 0, quoted: 0 };
        if (p.soldAt) row.sold += line.sheets;
        else row.quoted += line.sheets;
        out.set(line.key, row);
      }
    }
    return out;
  }, [projects, costings, archived]);

  if (!materials || !finishes || !stock) return null;

  const at = (finishId: string, materialId: string) =>
    stock.find((s) => s.finishId === finishId && s.materialId === materialId);

  /*
   * שורה מוצגת לכל צירוף שיש לו מחיר. טבלה מלאה של כל גוון כפול כל
   * חומר הייתה רובה אפסים, ומה שאין לו מחיר גם לא מוזמן.
   */
  const rows = finishes.flatMap((f) =>
    materials
      .filter((m) => f.prices?.[m.id] !== undefined)
      .map((m) => {
        const key = `${f.id}:${m.id}`;
        const need = demand.get(key) ?? { sold: 0, quoted: 0 };
        const item = at(f.id, m.id);
        const have = item?.sheets ?? 0;
        const ordered = item?.ordered ?? 0;
        return {
          finish: f,
          material: m,
          have,
          ordered,
          ...need,
          missing: Math.max(need.sold - have - ordered, 0),
        };
      })
      .filter((r) => !onlyNeeded || r.missing > 0),
  );

  const totals = rows.reduce(
    (a, r) => ({
      have: a.have + r.have,
      ordered: a.ordered + r.ordered,
      missing: a.missing + r.missing,
    }),
    { have: 0, ordered: 0, missing: 0 },
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <ScreenHeader title="מלאי לוחות" subtitle="מה יש, מה בדרך ומה חסר" />

      <main className="flex-1 space-y-4 px-5 pt-4 pb-10">
        <div className="grid grid-cols-3 gap-2">
          <Total label="במלאי" value={totals.have} />
          <Total label="הוזמן" value={totals.ordered} />
          <Total label="חסר" value={totals.missing} tone={totals.missing > 0} />
        </div>

        <button
          onClick={() => setOnlyNeeded((v) => !v)}
          aria-pressed={onlyNeeded}
          className={`w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            onlyNeeded ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          רק מה שחסר
        </button>

        {rows.length === 0 ? (
          <p className="pt-10 text-center text-sm text-stone-500">
            {onlyNeeded ? 'לא חסר כלום.' : 'אין עדיין גוונים עם מחיר לחומר.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <StockRow
                key={`${r.finish.id}:${r.material.id}`}
                finish={r.finish}
                material={r.material}
                have={r.have}
                ordered={r.ordered}
                sold={r.sold}
                quoted={r.quoted}
                missing={r.missing}
                edgeInStock={!!at(r.finish.id, r.material.id)?.edgeInStock}
                onChange={(patch) => stockRepo.set(r.finish.id, r.material.id, patch)}
              />
            ))}
          </ul>
        )}

        <p className="text-xs leading-snug text-stone-500">
          "צריך" נספר מפרויקטים שכבר נמכרו. הצעות שעוד לא נסגרו מוצגות
          בנפרד — להזמין חומר לפיהן זה להמר.
        </p>
      </main>
    </div>
  );
}

function StockRow({
  finish,
  material,
  have,
  ordered,
  sold,
  quoted,
  missing,
  edgeInStock,
  onChange,
}: {
  finish: Finish;
  material: Material;
  have: number;
  ordered: number;
  sold: number;
  quoted: number;
  missing: number;
  edgeInStock: boolean;
  onChange: (patch: { sheets?: number; ordered?: number; edgeInStock?: boolean }) => void;
}) {
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-lg border border-black/10"
          style={{ background: finish.hex }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-stone-900">
            {finish.name}
            <span className="font-normal text-stone-500"> · {material.name}</span>
          </span>
          <span className="num block truncate text-[11px] text-stone-500">
            צריך {sold}
            {quoted > 0 && <span className="text-stone-400"> · בהצעות {quoted}</span>}
          </span>
        </span>
        {missing > 0 && (
          <span className="num shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            חסר {missing}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <CountBox label="במלאי" value={have} onChange={(v) => onChange({ sheets: v })} />
        <CountBox label="הוזמן" value={ordered} onChange={(v) => onChange({ ordered: v })} />
      </div>

      {/*
        קנט תואם הוא פריט נפרד אצל הספק, והוא נגמר בלי קשר ללוחות.
        נגר שמגלה בשולחן שאין קנט בגוון עוצר את כל הארגז.
      */}
      <button
        onClick={() => onChange({ edgeInStock: !edgeInStock })}
        aria-pressed={edgeInStock}
        className={`mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-medium transition-colors ${
          edgeInStock
            ? 'bg-emerald-50 text-emerald-800'
            : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
        }`}
      >
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full ${
            edgeInStock ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-stone-500'
          }`}
        >
          {edgeInStock ? <CheckIcon className="size-3.5" /> : <span className="text-xs">—</span>}
        </span>
        {edgeInStock ? 'יש קנט תואם' : 'אין קנט תואם'}
      </button>
    </li>
  );
}

function CountBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(Math.max(Number(e.target.value) || 0, 0))}
        onFocus={selectOnFocus}
        type="number"
        inputMode="numeric"
        placeholder="0"
        aria-label={label}
        className="num w-full bg-transparent text-base font-medium text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
    </label>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3 text-center ${
        tone ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'
      }`}
    >
      <span className="block text-[11px] text-stone-500">{label}</span>
      <span className={`num block text-2xl font-bold ${tone ? 'text-red-700' : 'text-stone-900'}`}>
        {value}
      </span>
    </div>
  );
}
