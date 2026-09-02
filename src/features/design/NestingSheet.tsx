import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { settingsRepo } from '../../materials/materialsRepo';
import { nestParts } from '../../costing/nesting';
import { Sheet } from '../../ui/Sheet';
import { cm } from '../../ui/units';
import type { NestResult } from '../../costing/nesting';

/** צבע לכל סוג חלק, כדי לזהות אותו על הפלטה במבט אחד. */
const TONES = ['#d9b483', '#a8c3d9', '#c4b5a0', '#b8d4b8', '#d9b8c4', '#c9c4a8'];

/**
 * ניסור: איך החלקים יושבים על הפלטות בפועל.
 *
 * זה מה שמחליף את ההערכה "שטח חלקים חלקי ניצולת קבועה". החיתוך הוא
 * גיליוטינה — כל חתך חוצה את הלוח מקצה לקצה — כי זה מה שמסור אנכי
 * באמת עושה, ולכן הפריסה כאן היא פריסה שאפשר לעבוד לפיה.
 */
export function NestingSheet({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const costing = useLiveQuery(() => projectsRepo.costing(projectId), [projectId]);
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const [openGroup, setOpenGroup] = useState(0);

  const nested = useMemo(() => {
    if (!costing || !settings) return [];
    return costing.groups.map((g) => ({
      group: g,
      result: nestParts(
        g.parts,
        g.board.sheetWidthMm,
        g.board.sheetHeightMm,
        settings.kerfMm,
        // גוון עם סיבים מחייב כיוון קבוע, ולכן אסור לסובב חלקים
        !g.finish?.hasGrain,
      ),
    }));
  }, [costing, settings]);

  if (!costing || !settings) return null;

  const totalSheets = nested.reduce((n, x) => n + x.result.sheets.length, 0);
  const estimated = costing.lines.reduce((n, l) => n + l.sheets, 0);

  return (
    <Sheet title="ניסור הלוחות" onClose={onClose} tall>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="פלטות בפריסה" value={String(totalSheets)} />
          <Stat label="לפי הערכה" value={String(estimated)} />
          <Stat
            label="ניצולת בפועל"
            value={`${nested.length ? Math.round(nested.reduce((n, x) => n + x.result.usedPct, 0) / nested.length) : 0}%`}
          />
        </div>

        {totalSheets !== estimated && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
            הפריסה בפועל נותנת מספר אחר מההערכה שבמסך החומרים. הפריסה
            מדויקת יותר — היא מתחשבת במידות האמיתיות של כל חלק ולא רק
            בשטח הכולל. כדאי להזמין לפיה.
          </p>
        )}

        {nested.length === 0 && (
          <p className="text-sm text-stone-500">אין עדיין חלקים לנסר.</p>
        )}

        {nested.map(({ group, result }, i) => (
          <section key={`${group.board.id}-${group.finish?.id ?? ''}`}>
            <button
              onClick={() => setOpenGroup(openGroup === i ? -1 : i)}
              className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-start"
            >
              {group.finish && (
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded border border-black/10"
                  style={{ background: group.finish.hex }}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-stone-900">
                  {group.board.name}
                  {group.finish && <span className="text-stone-500"> · {group.finish.name}</span>}
                </span>
                <span className="num block text-[11px] text-stone-400">
                  פלטה {cm(group.board.sheetWidthMm)}×{cm(group.board.sheetHeightMm)} ס״מ
                  {group.finish?.hasGrain && ' · כיוון סיבים'}
                </span>
              </span>
              <span className="num shrink-0 text-sm font-bold text-stone-900">
                {result.sheets.length}
              </span>
            </button>

            {openGroup === i && (
              <div className="mt-2 space-y-3">
                {result.oversize.length > 0 && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-900">
                    {result.oversize.length} חלקים גדולים מהפלטה ולא ניתן לנסר אותם ממנה:{' '}
                    {result.oversize
                      .map((o) => `${o.label} ${cm(o.widthMm)}×${cm(o.heightMm)}`)
                      .join(', ')}
                    . צריך לפצל אותם או להזמין לוח גדול יותר.
                  </p>
                )}
                {result.sheets.map((sheet) => (
                  <SheetPlan
                    key={sheet.index}
                    sheet={sheet}
                    sheetW={group.board.sheetWidthMm}
                    sheetH={group.board.sheetHeightMm}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        <p className="text-[11px] leading-snug text-stone-400">
          הפריסה היא ניסור גיליוטינה בשורות: כל חתך חוצה את הלוח מקצה
          לקצה, כמו במסור אנכי. הכרסום נוסף סביב כל חלק.
        </p>
      </div>
    </Sheet>
  );
}

function SheetPlan({
  sheet,
  sheetW,
  sheetH,
}: {
  sheet: NestResult['sheets'][number];
  sheetW: number;
  sheetH: number;
}) {
  const labels = [...new Set(sheet.parts.map((p) => p.label))];
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-2">
      <div className="mb-1.5 flex items-baseline gap-2 px-1">
        <span className="text-xs font-medium text-stone-700">פלטה {sheet.index + 1}</span>
        <span className="num text-[11px] text-stone-400">{sheet.usedPct}% ניצולת</span>
      </div>
      <svg
        viewBox={`0 0 ${sheetW} ${sheetH}`}
        className="w-full rounded bg-stone-100"
        style={{ aspectRatio: `${sheetW} / ${sheetH}` }}
      >
        {sheet.parts.map((p) => (
          <g key={p.id}>
            <rect
              x={p.x}
              y={p.y}
              width={p.widthMm}
              height={p.heightMm}
              fill={TONES[labels.indexOf(p.label) % TONES.length]}
              stroke="#78716c"
              strokeWidth={Math.max(sheetW / 400, 2)}
            />
            <text
              x={p.x + p.widthMm / 2}
              y={p.y + p.heightMm / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(Math.min(p.widthMm, p.heightMm) / 5, sheetW / 40)}
              fill="#44403c"
              direction="ltr"
            >
              {cm(p.widthMm)}×{cm(p.heightMm)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1">
        {labels.map((l, i) => (
          <li key={l} className="flex items-center gap-1 text-[10px] text-stone-500">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm"
              style={{ background: TONES[i % TONES.length] }}
            />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <span className="block text-[10px] text-stone-500">{label}</span>
      <span className="num block text-lg font-bold text-stone-900">{value}</span>
    </div>
  );
}
