import { Stat } from '../../ui/Stat';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo } from '../projects/projectsRepo';
import { productionGap } from '../../catalog/construction';
import { Sheet } from '../../ui/Sheet';
import { cm, unitLabel } from '../../ui/units';
import type { NestResult } from '../../costing/nesting';

/** צבע לכל סוג חלק, כדי לזהות אותו על הפלטה במבט אחד. */
const TONES = ['#d9b483', '#a8c3d9', '#c4b5a0', '#b8d4b8', '#d9b8c4', '#c9c4a8'];

/**
 * ניסור: איך החלקים יושבים על הפלטות בפועל.
 *
 * הפריסה מגיעה מוכנה מהתמחור — אותו מנוע שסופר את הפלטות במסך
 * החישוב הוא זה שמצייר אותן כאן, ולכן המספרים לא יכולים להיפרד.
 * החיתוך הוא גיליוטינה: כל חתך חוצה את הלוח מקצה לקצה, כמו במסור
 * פנלים, ולכן זו פריסה שאפשר לעבוד לפיה ולא רק להתרשם ממנה.
 *
 * הפלטה מצוירת שוכבת — הצלע הארוכה לרוחב המסך — כמו שהיא באמת
 * מונחת על שולחן המסור. זה סיבוב של התצוגה בלבד: החלקים עצמם
 * נפרסו בכיוון הסיבים הנכון, ולא סובבו בחישוב.
 */
export function NestingSheet({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const costing = useLiveQuery(() => projectsRepo.costing(projectId), [projectId]);
  const [openGroup, setOpenGroup] = useState(0);
  // מדידת השארית: מה נשאר בין קצה החלק לקצה הפלטה
  const [showOffcuts, setShowOffcuts] = useState(false);

  if (!costing) return null;

  const groups = costing.groups;
  const totalSheets = groups.reduce((n, g) => n + g.nest.sheets.length, 0);
  const partsM2 = costing.lines.reduce((n, l) => n + l.areaM2, 0);
  const sheetsM2 = groups.reduce(
    (n, g) =>
      n + (g.nest.sheets.length * g.material.sheetWidthMm * g.material.sheetHeightMm) / 1_000_000,
    0,
  );
  const usedPct = sheetsM2 > 0 ? Math.round((partsM2 / sheetsM2) * 100) : 0;

  return (
    <Sheet title="ניסור הלוחות" onClose={onClose} tall>
      <div className="space-y-4">
        {/*
          מה שאי אפשר לנסר לפי מה שכתוב כאן.
          רשימת חיתוך היא מסמך ייצור, ולכן ארגז שהתבנית שלו חסרה
          נישה או מידות יצרן נאמר כאן — לפני הפלטות ולא אחריהן.
        */}
        <GapsInProject projectId={projectId} />

        <div className="grid grid-cols-3 gap-2">
          <Stat variant="flat" label="פלטות" value={String(totalSheets)} />
          <Stat variant="flat" label="מ״ר חלקים" value={partsM2.toFixed(1)} />
          <Stat variant="flat" label="ניצולת" value={`${usedPct}%`} />
        </div>

        <button
          onClick={() => setShowOffcuts((v) => !v)}
          aria-pressed={showOffcuts}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            showOffcuts
              ? 'border-oak-500 bg-oak-50 text-oak-800'
              : 'border-stone-200 bg-white text-stone-600 hover:border-oak-300'
          }`}
        >
          {showOffcuts ? 'מסתיר שאריות' : 'הצגת השארית שנותרה'}
        </button>

        {groups.length === 0 && <p className="text-sm text-stone-500">אין עדיין חלקים לנסר.</p>}

        {groups.map((group, i) => (
          <section key={group.key}>
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
                {/* הגוון הוא מה שמזמינים בשם, והחומר הוא על מה הוא יושב */}
                <span className="block truncate text-sm font-semibold text-stone-900">
                  {group.finish?.name ?? 'בלי גוון'}
                  <span className="text-stone-500"> · {group.material.name}</span>
                </span>
                <span className="num block text-[11px] text-stone-400">
                  פלטה {cm(group.material.sheetWidthMm)}×{cm(group.material.sheetHeightMm)}{' '}
                  {unitLabel()}
                  {group.finish?.hasGrain && ' · כיוון סיבים'}
                </span>
              </span>
              <span className="num shrink-0 text-sm font-bold text-stone-900">
                {group.nest.sheets.length}
              </span>
            </button>

            {openGroup === i && (
              <div className="mt-2 space-y-3">
                {group.nest.oversize.length > 0 && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-900">
                    חלקים גדולים מהפלטה, ולא ניתן לנסר אותם ממנה:{' '}
                    {group.nest.oversize
                      .map((o) => `${o.label} ${cm(o.widthMm)}×${cm(o.heightMm)} ×${o.qty}`)
                      .join(', ')}
                    . צריך לפצל אותם או להזמין לוח גדול יותר.
                  </p>
                )}
                {group.nest.sheets.map((sheet) => (
                  <SheetPlan
                    key={sheet.index}
                    sheet={sheet}
                    sheetW={group.material.sheetWidthMm}
                    sheetH={group.material.sheetHeightMm}
                    showOffcuts={showOffcuts}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        <p className="text-[11px] leading-snug text-stone-400">
          כל חתך חוצה את הלוח מקצה לקצה, והכרסום נגרע בקווי החיתוך
          עצמם. חזיתות וצדדים נשמרים בכיוון הסיבים; מדפים, תחתיות
          וגב מסובבים לניצול טוב יותר.
        </p>
      </div>
    </Sheet>
  );
}

function SheetPlan({
  sheet,
  sheetW,
  sheetH,
  showOffcuts,
}: {
  sheet: NestResult['sheets'][number];
  sheetW: number;
  sheetH: number;
  showOffcuts: boolean;
}) {
  const labels = [...new Set(sheet.parts.map((p) => p.label))];

  /*
   * הפלטה מוצגת שוכבת. מסובבים רק את הקואורדינטות, ולא את הטקסט —
   * מידה שצריך לקרוא בהטיית ראש היא מידה שקוראים לא נכון.
   */
  const box = (x: number, y: number, w: number, h: number) => ({
    x: y,
    y: sheetW - x - w,
    w: h,
    h: w,
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-2">
      <div className="mb-1.5 flex items-baseline gap-2 px-1">
        <span className="text-xs font-medium text-stone-700">פלטה {sheet.index + 1}</span>
        <span className="num text-[11px] text-stone-400">{sheet.usedPct}% ניצולת</span>
      </div>
      {/*
        גובה קבוע ורוחב שנגזר ממנו: פלטה שוכבת על רוחב מסך מלא תפסה
        חצי מסך, ופרויקט עם תשע פלטות היה גלילה בלי סוף. כך רואים
        כמה פלטות בבת אחת ועדיין קוראים את המידות.
      */}
      <svg
        viewBox={`0 0 ${sheetH} ${sheetW}`}
        className="mx-auto block h-[16vh] max-w-full rounded bg-stone-100"
        style={{ aspectRatio: `${sheetH} / ${sheetW}` }}
      >
        {sheet.parts.map((p) => {
          const b = box(p.x, p.y, p.widthMm, p.heightMm);
          return (
            <g key={p.id}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={TONES[labels.indexOf(p.label) % TONES.length]}
                stroke="#78716c"
                strokeWidth={Math.max(sheetH / 400, 2)}
              />
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(Math.min(b.w, b.h) / 5, sheetH / 45)}
                fill="#44403c"
                direction="ltr"
              >
                {cm(p.widthMm)}×{cm(p.heightMm)}
              </text>
            </g>
          );
        })}

        {/* השארית: מה נשאר בין החלק האחרון לקצה הפלטה, במידה אמיתית */}
        {showOffcuts &&
          sheet.offcuts.map((o, i) => {
            const b = box(o.x, o.y, o.widthMm, o.heightMm);
            return (
              <g key={`off-${i}`}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill="#ecfdf5"
                  fillOpacity={0.85}
                  stroke="#059669"
                  strokeDasharray={`${sheetH / 90} ${sheetH / 130}`}
                  strokeWidth={Math.max(sheetH / 350, 2)}
                />
                {/* מידה על הציור רק כשיש לה מקום; אחרת היא ברשימה שמתחת */}
                {b.w > sheetH / 9 && b.h > sheetW / 12 && (
                  <text
                    x={b.x + b.w / 2}
                    y={b.y + b.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(Math.min(b.w, b.h) / 5, sheetH / 45)}
                    fill="#047857"
                    direction="ltr"
                  >
                    {cm(o.heightMm)}×{cm(o.widthMm)}
                  </text>
                )}
              </g>
            );
          })}
      </svg>

      {showOffcuts && (
        <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-emerald-700">
          {sheet.offcuts.length === 0 ? (
            <span className="text-stone-400">אין בפלטה הזו שארית שכדאי לשמור.</span>
          ) : (
            <>
              שארית:{' '}
              <span className="num">
                {sheet.offcuts.map((o) => `${cm(o.heightMm)}×${cm(o.widthMm)}`).join(' · ')}
              </span>{' '}
              {unitLabel()}
            </>
          )}
        </p>
      )}

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
        {showOffcuts && sheet.offcuts.length > 0 && (
          <li className="flex items-center gap-1 text-[10px] text-emerald-700">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm border border-emerald-600 bg-emerald-50"
            />
            שארית
          </li>
        )}
      </ul>
    </div>
  );
}


/**
 * הארגזים בפרויקט שהתבנית שלהם אינה מספיקה לייצור.
 *
 * שורה אחת לכל ארגז, עם השם ועם מה שחסר: "יש בעיה" אינו מידע,
 * ו"חסר מידע לייצור" בלי לומר מה אינו שונה ממנו.
 */
function GapsInProject({ projectId }: { projectId: string }) {
  const units = useLiveQuery(() => unitsRepo.listForProject(projectId), [projectId], []);
  const gaps = units
    .map((u) => ({ u, why: productionGap(u) }))
    .filter((g): g is { u: (typeof units)[number]; why: string } => g.why !== null);
  if (!gaps.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="text-sm font-semibold text-amber-900">
        <span className="num">{gaps.length}</span> ארגזים — חסר מידע לייצור
      </p>
      {gaps.map(({ u, why }) => (
        <p key={u.id} className="mt-1 text-xs leading-snug text-amber-800">
          {u.name}: {why}
        </p>
      ))}
    </div>
  );
}
