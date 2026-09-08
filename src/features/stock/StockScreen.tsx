import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { customersRepo } from '../customers/customersRepo';
import { consumptionRepo } from '../../materials/consumption';
import { receiveOrder, stockRepo } from '../../materials/materialsRepo';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { selectOnFocus } from '../../ui/Field';
import { CheckIcon, PlusIcon } from '../../ui/icons';
import type { ProjectCosting } from '../../costing/boards';
import { useMaterialsAndFinishes } from '../../materials/useMaterials';
import { AddStockSheet } from './AddStockSheet';

type SortKey = 'finish' | 'texture' | 'material' | 'need' | 'have' | 'ordered' | 'missing';

/**
 * מלאי הפלטות בעסק.
 *
 * השאלה שהמסך הזה עונה עליה היא לא "כמה יש" אלא "מה צריך להזמין
 * היום": כמה פלטות דורשים הפרויקטים שכבר נמכרו, כמה מהן מונחות
 * בנגרייה, כמה כבר בדרך — והשאר הוא מה שחסר.
 *
 * הכול בטבלה אחת ולא בכרטיסים, כי זו רשימת הזמנה: העין רצה על
 * עמודה ומשווה מספרים, ולא קוראת כרטיס אחרי כרטיס. מיון וסינון לפי
 * חומר ולפי מרקם, כי ככה מזמינים — כל הסנדוויץ׳ מספק אחד, וכל
 * גוני היער באותה שיחה.
 *
 * ברשימה יש רק שורות שיש בהן משהו: לוח שפרויקט דורש, לוח שמונח
 * בנגרייה, לוח שהוזמן או לוח שכבר נחתך. כל צירוף אפשרי של גוון
 * וחומר היה מאות שורות ריקות שאין בהן החלטה. לוח שיש בנגרייה ואף
 * פרויקט לא דורש נוסף בכפתור "הוספת לוח למלאי".
 */
export function StockScreen() {
  const { materials, finishes } = useMaterialsAndFinishes();
  const stock = useLiveQuery(() => stockRepo.all(), []);
  const projects = useLiveQuery(() => projectsRepo.all(), []);
  const archived = useLiveQuery(() => customersRepo.list(true), []);
  const costings = useLiveQuery<Record<string, ProjectCosting>>(
    async () => (projects ? projectsRepo.summaries(projects.map((p) => p.id)) : {}),
    [projects],
  );

  /*
   * מה כבר נחתך ולאיזה פרויקט. הלוחות האלה כבר ירדו מהמלאי, וזו
   * התשובה ל"לאן הלכו": מי שרואה שהמלאי ירד רוצה לדעת בשביל מי.
   */
  const used = useLiveQuery(() => consumptionRepo.all(), []);

  const [materialId, setMaterialId] = useState<string | null>(null);
  const [texture, setTexture] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('finish');
  const [onlyNeeded, setOnlyNeeded] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const at = (f: string, m: string) => stock.find((s) => s.finishId === f && s.materialId === m);
  const textures = [...new Set(finishes.map((f) => f.texture).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, 'he'),
  );

  const rows = finishes
    .flatMap((f) =>
      materials
        .filter((m) => f.prices?.[m.id] !== undefined)
        .map((m) => {
          const key = `${f.id}:${m.id}`;
          const need = demand.get(key) ?? { sold: 0, quoted: 0 };
          const item = at(f.id, m.id);
          const have = item?.sheets ?? 0;
          const ordered = item?.ordered ?? 0;
          /*
             מה שכבר נחתך ירד מהמלאי, ולכן הוא גם ירד מ"צריך":
             לספור אותו פעמיים היה מציג חוסר שכבר סופק.
          */
          const cut = (used ?? [])
            .filter((c) => c.lineKey === key)
            .reduce((a, c) => a + c.sheets, 0);
          const cutFor = (used ?? []).filter((c) => c.lineKey === key).length;
          const left = Math.max(need.sold - cut, 0);
          return {
            finish: f,
            material: m,
            have,
            ordered,
            ...need,
            sold: left,
            cut,
            cutFor,
            edge: !!item?.edgeInStock,
            missing: Math.max(left - have - ordered, 0),
          };
        }),
    )
    /*
      שורה ריקה — בלי דרישה, בלי מלאי, בלי הזמנה ובלי חיתוך — אינה
      החלטה שמישהו צריך לקבל, ולכן היא לא ברשימה.
    */
    .filter((r) => r.sold + r.quoted + r.have + r.ordered + r.cut > 0)
    .filter((r) => !materialId || r.material.id === materialId)
    .filter((r) => !texture || r.finish.texture === texture)
    .filter((r) => !onlyNeeded || r.missing > 0)
    .sort((a, b) => {
      /* מיון לפי מספר: הגדול קודם, ושוויון נשבר לפי שם הגוון */
      const byName = a.finish.name.localeCompare(b.finish.name, 'he');
      if (sort === 'missing') return b.missing - a.missing || byName;
      if (sort === 'have') return b.have - a.have || byName;
      if (sort === 'ordered') return b.ordered - a.ordered || byName;
      if (sort === 'need') return b.sold + b.quoted - (a.sold + a.quoted) || byName;
      /*
        מיון לפי מרקם: ככה עומדים הלוחות במחסן וככה מזמינים אותם —
        כל היער יחד, כל המט יחד. לוח בלי מרקם יורד לסוף, כדי שלא
        ישב באמצע קבוצה שהוא לא שייך אליה.
      */
      if (sort === 'texture') {
        const ta = a.finish.texture ?? '\uffff';
        const tb = b.finish.texture ?? '\uffff';
        return (
          ta.localeCompare(tb, 'he') ||
          a.finish.name.localeCompare(b.finish.name, 'he') ||
          a.material.sortOrder - b.material.sortOrder
        );
      }
      if (sort === 'material') {
        return (
          a.material.sortOrder - b.material.sortOrder ||
          a.finish.name.localeCompare(b.finish.name, 'he')
        );
      }
      return (
        a.finish.name.localeCompare(b.finish.name, 'he') || a.material.sortOrder - b.material.sortOrder
      );
    });

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

      <main className="flex-1 space-y-3 px-4 pt-4 pb-10">
        {/*
          שלושת המספרים הם גם המיון: לחיצה על "חסר" מעלה למעלה את מה
          שצריך להזמין, ולחיצה על "במלאי" את מה שיש הכי הרבה ממנו.
        */}
        <div className="grid grid-cols-3 gap-2">
          <Total
            label="במלאי"
            value={totals.have}
            active={sort === 'have'}
            onClick={() => setSort(sort === 'have' ? 'finish' : 'have')}
          />
          <Total
            label="הוזמן"
            value={totals.ordered}
            active={sort === 'ordered'}
            onClick={() => setSort(sort === 'ordered' ? 'finish' : 'ordered')}
          />
          <Total
            label="חסר"
            value={totals.missing}
            tone={totals.missing > 0}
            active={sort === 'missing'}
            onClick={() => setSort(sort === 'missing' ? 'finish' : 'missing')}
          />
        </div>

        {/* סינון לפי חומר — ככה מזמינים: כל הסנדוויץ׳ מספק אחד */}
        <Filters
          label="חומר"
          options={materials.map((m) => ({ key: m.id, label: m.name }))}
          value={materialId}
          onChange={setMaterialId}
        />

        {textures.length > 0 && (
          <Filters
            label="מרקם"
            options={textures.map((t) => ({ key: t, label: t }))}
            value={texture}
            onChange={setTexture}
          />
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-stone-500">מיון</span>
          {(
            [
              ['finish', 'גוון'],
              ['texture', 'מרקם'],
              ['material', 'חומר'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                sort === key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setOnlyNeeded((v) => !v)}
            aria-pressed={onlyNeeded}
            className={`ms-auto rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              onlyNeeded ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            רק מה שחסר
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="pt-10 text-center text-sm text-stone-500">
            {onlyNeeded
              ? 'לא חסר כלום.'
              : materialId || texture
                ? 'אין לוחות שמתאימים לסינון.'
                : 'אין עדיין לוחות במלאי ואף פרויקט לא דורש חומר.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {/* כותרת שהיא גם מיון — לוחצים על העמודה שמעניינת */}
            <div className="grid grid-cols-[1fr_2.6rem_3.4rem_4.2rem] items-center gap-1 border-b border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[10px] font-medium text-stone-500">
              <span>גוון · חומר</span>
              <SortHead label="צריך" active={sort === 'need'} onClick={() => setSort(sort === 'need' ? 'finish' : 'need')} />
              <SortHead label="מלאי" active={sort === 'have'} onClick={() => setSort(sort === 'have' ? 'finish' : 'have')} />
              <SortHead label="הוזמן" active={sort === 'ordered'} onClick={() => setSort(sort === 'ordered' ? 'finish' : 'ordered')} />
            </div>
            <ul className="divide-y divide-stone-200/80">
              {rows.map((r) => (
                <li
                  key={`${r.finish.id}:${r.material.id}`}
                  className="grid grid-cols-[1fr_2.6rem_3.4rem_4.2rem] items-center gap-1 px-2.5 py-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded border border-black/10"
                      style={{ background: r.finish.hex }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-900">
                        {r.finish.name}
                      </span>
                      <span className="block truncate text-[10px] text-stone-500">
                        {r.material.name}
                        {/* המרקם הוא מה שמפריד בין שני לוחות באותו שם */}
                        {r.finish.texture && <span> · {r.finish.texture}</span>}
                        {/* מה שכבר נחתך: הלוחות יצאו מהמחסן ונכנסו לפרויקטים */}
                        {r.cut > 0 && (
                          <span className="num text-emerald-700">
                            {' · נחתך '}
                            {r.cut}
                            {r.cutFor > 1 ? ` ב-${r.cutFor} פרויקטים` : ''}
                          </span>
                        )}
                        {r.missing > 0 && (
                          <span className="num font-semibold text-red-600"> · חסר {r.missing}</span>
                        )}
                      </span>
                    </span>
                  </span>

                  <span className="num text-center text-sm text-stone-700">
                    {r.sold || <span className="text-stone-300">0</span>}
                    {r.quoted > 0 && (
                      <span className="block text-[9px] text-stone-400">+{r.quoted}</span>
                    )}
                  </span>

                  <Cell
                    label={`במלאי ${r.finish.name} ${r.material.name}`}
                    value={r.have}
                    onChange={(v) => stockRepo.set(r.finish.id, r.material.id, { sheets: v })}
                  />

                  <span className="flex items-center gap-0.5">
                    <Cell
                      label={`הוזמן ${r.finish.name} ${r.material.name}`}
                      value={r.ordered}
                      onChange={(v) => stockRepo.set(r.finish.id, r.material.id, { ordered: v })}
                    />
                    {/* ההזמנה הגיעה: מה שהיה בדרך עובר למלאי בלחיצה */}
                    {r.ordered > 0 && (
                      <button
                        onClick={() => receiveOrder(r.finish.id, r.material.id)}
                        aria-label={`ההזמנה הגיעה — ${r.finish.name} ${r.material.name}`}
                        title="ההזמנה הגיעה"
                        className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        <CheckIcon className="size-3.5" />
                      </button>
                    )}
                  </span>

                  {/*
                    קנט תואם הוא פריט נפרד אצל הספק ונגמר בלי קשר
                    ללוחות. נגר שמגלה בשולחן שאין קנט בגוון עוצר את
                    כל הארגז, ולכן הוא יושב באותה שורה.
                  */}
                  <button
                    onClick={() =>
                      stockRepo.set(r.finish.id, r.material.id, { edgeInStock: !r.edge })
                    }
                    aria-pressed={r.edge}
                    className={`col-span-4 mt-1 rounded-lg px-2 py-1 text-start text-[11px] font-medium transition-colors ${
                      r.edge
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                    }`}
                  >
                    {r.edge ? '✓ יש קנט תואם' : '— אין קנט תואם'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/*
          לוח שקנו למחסן בלי שאף פרויקט דורש אותו אינו ברשימה, ולכן
          הוא נוסף כאן — אחרת אין דרך להזין אותו בכלל.
        */}
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
        >
          <PlusIcon className="size-4" />
          הוספת לוח למלאי
        </button>

        <p className="text-xs leading-snug text-stone-500">
          מוצגים רק לוחות שפרויקט דורש, שיש מהם במלאי, שהוזמנו או
          שכבר נחתכו. "צריך" נספר מפרויקטים שכבר נמכרו; המספר הקטן
          מתחתיו הוא מה שדורשות הצעות שעוד לא נסגרו.
        </p>
      </main>

      {adding && (
        <AddStockSheet
          finishes={finishes}
          materials={materials}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function Filters({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-stone-500">{label}</span>
      <button
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
          value === null ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
        }`}
      >
        הכול
      </button>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(value === o.key ? null : o.key)}
          aria-pressed={value === o.key}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Cell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      value={value || ''}
      onChange={(e) => onChange(Math.max(Number(e.target.value) || 0, 0))}
      onFocus={selectOnFocus}
      type="number"
      inputMode="numeric"
      placeholder="0"
      aria-label={label}
      className="num w-full min-w-0 rounded-md bg-stone-100 py-1 text-center text-sm font-medium text-stone-900 placeholder:text-stone-300 focus:bg-white focus:ring-1 focus:ring-oak-400 focus:outline-none"
    />
  );
}

function Total({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: boolean;
  /** המיון הנוכחי הוא לפי המספר הזה */
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`מיון לפי ${label}`}
      className={`rounded-2xl border p-3 text-center transition-colors ${
        active
          ? 'border-stone-900 bg-stone-900'
          : tone
            ? 'border-red-200 bg-red-50'
            : 'border-stone-200 bg-white'
      }`}
    >
      <span className={`block text-[11px] ${active ? 'text-white/70' : 'text-stone-500'}`}>
        {label}
      </span>
      <span
        className={`num block text-2xl font-bold ${
          active ? 'text-white' : tone ? 'text-red-700' : 'text-stone-900'
        }`}
      >
        {value}
      </span>
    </button>
  );
}

/** כותרת עמודה שאפשר למיין לפיה. */
function SortHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`מיון לפי ${label}`}
      className={`rounded-md py-0.5 text-center transition-colors ${
        active ? 'bg-stone-900 text-white' : 'hover:bg-stone-200/70'
      }`}
    >
      {label}
    </button>
  );
}
