import { Stat } from '../../ui/Stat';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { Sheet } from '../../ui/Sheet';
import { cm, unitLabel } from '../../ui/units';
import type { NestResult } from '../../costing/nesting';
import type { Part, PartGroup } from '../../costing/boards';

/**
 * הצבע על הפלטה אומר לאיזו משפחה החלק שייך.
 *
 * קודם הוא נגזר מהמקום של הסוג *בפלטה הזאת* — `labels.indexOf`
 * על רשימה שנבנתה מחדש לכל פלטה — ולכן "צד" יצא כחול בפלטה אחת
 * וירוק בשנייה, ומקרא כל פלטה סתר את זה שלפניה. הצבע לא אמר
 * כלום, והעין למדה להתעלם ממנו.
 *
 * עכשיו הוא נקבע מהחלק עצמו, ולכן הוא זהה בכל פלטה, בכל גוון
 * ובכל פרויקט. והוא לפי משפחה ולא לפי שם, כי זה מה שעושים עם
 * הערימה שיוצאת מהמסור: מפרידים חזיתות מגוף וממגירות. שני סוגים
 * מאותה משפחה חולקים צבע במכוון — השם המדויק כתוב במקרא, ולחיצה
 * על חתיכה אומרת גם מאיזה ארגז היא.
 */
const FAMILY = {
  front: '#d9b483',
  carcass: '#a8c3d9',
  shelf: '#b8d4b8',
  drawer: '#d9b8c4',
  back: '#c4b5a0',
  rail: '#c9c4a8',
} as const;

/** השם שהחלק נולד איתו ב-`unitParts`, והמשפחה שהוא שייך לה. */
const PART_FAMILY: Record<string, keyof typeof FAMILY> = {
  'דלת': 'front',
  'חזית מגירה': 'front',
  'דופן זרה': 'front',
  'דלת זכוכית': 'front',

  'צד': 'carcass',
  'תחתית ותקרה': 'carcass',
  'חוצץ בין אזורים': 'carcass',

  'מדף': 'shelf',

  'תחתית מגירה': 'drawer',
  'גב מגירה': 'drawer',
  'דופן מגירה': 'drawer',

  'גב': 'back',
  'גב בעובי גוף': 'back',
  'קושרת גב': 'back',

  'קושרת': 'rail',
  'קושרת עליונה': 'rail',
};

const TONES = Object.values(FAMILY);

/**
 * הצבע של סוג החלק.
 *
 * מה שאינו ברשימה הוא לוח בודד, ששמו הוא שם הפריט עצמו ואינו
 * ידוע מראש. הוא מקבל צבע יציב מגיבוב השם — לא בהכרח המשפחה
 * הנכונה, אבל אותו צבע בכל מקום, וזו הנקודה.
 */
export function toneOf(label: string): string {
  const family = PART_FAMILY[label];
  if (family) return FAMILY[family];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

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
          מה שהמאמת העצמאי מצא בפריסה עצמה.

          המנוע שבוחר איפה להניח כל חלק אינו העד הנכון לשאלה אם
          התוצאה תקינה. `checkNesting` נבנה מהקלט ומהתוצאה בלבד,
          ורשימה שאינה ריקה פירושה שאסור לנסר לפי מה שכתוב כאן.
        */}
        <NestProblems groups={groups} />

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
                    parts={group.parts}
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
          לחיצה על חתיכה אומרת מאיזה ארגז היא. כל חתך חוצה את הלוח
          מקצה לקצה, והכרסום נגרע בקווי החיתוך עצמם. חזיתות וצדדים נשמרים בכיוון הסיבים; מדפים, תחתיות
          וגב מסובבים לניצול טוב יותר.
        </p>
      </div>
    </Sheet>
  );
}

function SheetPlan({
  sheet,
  parts,
  sheetW,
  sheetH,
  showOffcuts,
}: {
  sheet: NestResult['sheets'][number];
  /** החלקים כפי שנכנסו לפריסה — `source` של כל חתיכה מצביע לכאן */
  parts: Part[];
  sheetW: number;
  sheetH: number;
  showOffcuts: boolean;
}) {
  const labels = [...new Set(sheet.parts.map((p) => p.label))];
  /*
   * החתיכה שנלחצה.
   *
   * על הפלטה מונחות חמש חתיכות באותה מידה ובאותו שם, והשאלה
   * היחידה שיש לנגר עליהן היא לאיזה ארון כל אחת הולכת. התשובה
   * נכתבת מתחת לציור ולא בבועה מרחפת: על טלפון אין ריחוף, ובועה
   * שנפתחת מעל הפלטה מסתירה בדיוק את מה שרוצים לראות.
   */
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = sheet.parts.find((p) => p.id === picked) ?? null;
  const from = chosen ? parts[chosen.source]?.from : undefined;

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
          const on = p.id === picked;
          const owner = parts[p.source]?.from;
          return (
            <g
              key={p.id}
              onClick={() => setPicked(on ? null : p.id)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPicked(on ? null : p.id);
                }
              }}
              aria-label={`${p.label}${owner ? ` — ${owner}` : ''}`}
            >
              {/* על מחשב די בריחוף; באצבע צריך לחיצה, וזו התשובה שמתחת */}
              <title>{owner ? `${p.label} — ${owner}` : p.label}</title>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={toneOf(p.label)}
                stroke={on ? '#1c1917' : '#78716c'}
                strokeWidth={Math.max(sheetH / 400, 2) * (on ? 3 : 1)}
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

      {/*
        מה נלחץ: הארגז קודם, כי זו השאלה. הסוג והמידה אחריו, כדי
        שלא צריך לחפש את החתיכה בעיניים כדי לוודא שנבחרה הנכונה.
      */}
      {chosen && (
        <p className="mt-1.5 rounded-lg bg-stone-100 px-2 py-1.5 text-[11px] leading-snug text-stone-700">
          <span className="font-semibold text-stone-900">{from ?? 'ארגז לא ידוע'}</span>
          {' · '}
          {chosen.label}
          {' · '}
          <span className="num">
            {cm(chosen.widthMm)}×{cm(chosen.heightMm)} {unitLabel()}
          </span>
          {chosen.rotated && <span className="text-stone-400"> · מסובב</span>}
        </p>
      )}

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
        {labels.map((l) => (
          <li key={l} className="flex items-center gap-1 text-[10px] text-stone-500">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm"
              style={{ background: toneOf(l) }}
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
 * מה שנמצא בפריסה עצמה, בידי מאמת שאינו המנוע שיצר אותה.
 *
 * חלק שנעלם, חלק שיצא מהפלטה, שני חלקים שחופפים או חתך גיליוטינה
 * שלא היה אפשרי — כל אלה חוסמים ניסור, ולכן הם נאמרים בראש המסך
 * ולא נבלעים באחוז ניצולת.
 */
function NestProblems({ groups }: { groups: PartGroup[] }) {
  const all = groups.flatMap((g) => g.problems.map((p) => ({ g, p })));
  if (!all.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
      <p className="text-sm font-semibold text-red-900">
        הפריסה אינה תקינה — אין לנסר לפיה
      </p>
      {all.slice(0, 8).map(({ g, p }, i) => (
        <p key={i} className="mt-1 text-xs leading-snug text-red-800">
          {g.material.name}
          {p.sheet !== undefined ? ` · פלטה ${p.sheet + 1}` : ''}: {p.text}
        </p>
      ))}
      {all.length > 8 && (
        <p className="mt-1 text-xs text-red-700">ועוד {all.length - 8}.</p>
      )}
    </div>
  );
}

