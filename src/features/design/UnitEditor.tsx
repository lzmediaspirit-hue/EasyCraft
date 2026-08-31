import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { glyphDef } from '../../catalog/glyphList';
import { isContainer } from '../../catalog/zones';
import { MATERIAL } from '../../catalog/standards';
import { boardsRepo, finishesRepo } from '../../materials/materialsRepo';
import { ZonesEditor } from './ZonesEditor';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { CloseIcon, PencilIcon, TrashIcon } from '../../ui/icons';
import type { ExposedSides, LedSpot, OpeningMech, PlacedUnit } from '../../db/types';

const DOOR_COUNTS = [0, 1, 2, 3, 4, 5, 6];

const SIDES: { key: keyof ExposedSides; label: string }[] = [
  { key: 'start', label: 'שמאל' },
  { key: 'end', label: 'ימין' },
  { key: 'top', label: 'עליון' },
  { key: 'bottom', label: 'תחתון' },
];

const LED_SPOTS: { key: LedSpot; label: string }[] = [
  { key: 'start', label: 'שמאל' },
  { key: 'end', label: 'ימין' },
  { key: 'top', label: 'עליון' },
  { key: 'bottom', label: 'תחתון' },
  { key: 'shelf', label: 'מתחת למדף' },
];

const OPENINGS: { key: OpeningMech; label: string }[] = [
  { key: 'hinge', label: 'צירים' },
  { key: 'lift', label: 'קלאפה' },
  { key: 'sliding', label: 'הזזה' },
];

/** מידות תקן לכל ציר, לבחירה מהירה. */
const WIDTHS = [150, 200, 300, 400, 450, 500, 600, 700, 800, 900, 1000, 1200];
const HEIGHTS = [350, 450, 600, 700, 720, 900, 1000, 1200, 1600, 2000, 2050, 2200, 2320, 2400];
const DEPTHS = [250, 300, 320, 350, 400, 450, 500, 560, 580, 600, 650];

type Axis = 'w' | 'h' | 'd';

/**
 * הלוח שנפתח כשארגז נבחר.
 *
 * מה שמוצג כאן נגזר ממצב התצוגה: כשרואים חזיתות מוצגות הגדרות החזית —
 * דלתות, מנגנון פתיחה, גוון ודפנות זרות. כשהחזיתות מוסתרות מוצג פנים
 * הארון — אזורים, מדפים ומגירות. כך אין על המסך הגדרות שלא רואים.
 */
export function UnitEditor({
  unit,
  inside,
  onChange,
  onEdit,
  onRemove,
  onClose,
}: {
  unit: PlacedUnit;
  /** מצב התצוגה הנוכחי — חזיתות מוסתרות */
  inside: boolean;
  onChange: (patch: Partial<PlacedUnit>) => void;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [axis, setAxis] = useState<Axis>('w');
  const activeChip = useRef<HTMLButtonElement>(null);
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  const finishes = useLiveQuery(async () => {
    const boards = (await boardsRepo.list()).filter((b) => b.role === 'front');
    const lists = await Promise.all(boards.map((b) => finishesRepo.listForBoard(b.id)));
    return lists.flat();
  }, []);

  const caps = glyphDef(unit.glyph);
  const locked = unit.floorLocked ?? false;
  const exposed = unit.exposed ?? {};
  const led = unit.led ?? [];
  const container = isContainer(unit.glyph);

  const options =
    axis === 'w'
      ? source?.widthOptionsMm?.length
        ? source.widthOptionsMm
        : WIDTHS
      : axis === 'h'
        ? HEIGHTS
        : DEPTHS;
  const currentValue = axis === 'w' ? unit.widthMm : axis === 'h' ? unit.heightMm : unit.depthMm;

  // המידה הפעילה נגללת לתצוגה, אחרת היא נתקעת מחוץ לשורה הנגללת
  useEffect(() => {
    activeChip.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [axis, currentValue]);

  const applyStandard = (mm: number) =>
    onChange(axis === 'w' ? { widthMm: mm } : axis === 'h' ? { heightMm: mm } : { depthMm: mm });

  function toggleSide(key: keyof ExposedSides) {
    onChange({ exposed: { ...exposed, [key]: !exposed[key] } });
  }

  function toggleLed(spot: LedSpot) {
    onChange({ led: led.includes(spot) ? led.filter((s) => s !== spot) : [...led, spot] });
  }

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)]">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-stone-900">{unit.name}</h2>
        <button
          onClick={onEdit}
          aria-label="עריכת הארגז"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-oak-50 hover:text-oak-700"
        >
          <PencilIcon className="size-5" />
        </button>
        <button
          onClick={onRemove}
          aria-label="הסרת הארגז"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-5" />
        </button>
        <button
          onClick={onClose}
          aria-label="סיום עריכה"
          className="-me-2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      {/* בחירת ציר ואז מידת תקן — אותה שורת שבבים משרתת את שלושת המימדים */}
      <div className="mt-3 flex gap-1.5">
        <AxisTab active={axis === 'w'} onClick={() => setAxis('w')} label="רוחב" value={unit.widthMm} />
        <AxisTab active={axis === 'h'} onClick={() => setAxis('h')} label="גובה" value={unit.heightMm} />
        <AxisTab active={axis === 'd'} onClick={() => setAxis('d')} label="עומק" value={unit.depthMm} />
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {options.map((mm) => (
          <button
            key={mm}
            ref={mm === currentValue ? activeChip : undefined}
            onClick={() => applyStandard(mm)}
            className={`num shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mm === currentValue
                ? 'bg-oak-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {cm(mm)}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumBox label="רוחב" value={unit.widthMm} minMm={50} onChange={(mm) => onChange({ widthMm: mm })} />
        <NumBox label="גובה" value={unit.heightMm} minMm={50} onChange={(mm) => onChange({ heightMm: mm })} />
        <NumBox label="עומק" value={unit.depthMm} minMm={50} onChange={(mm) => onChange({ depthMm: mm })} />
      </div>

      {unit.panelThicknessMm !== undefined && (
        <div className="mt-2">
          <NumBox
            label="עובי הלוח"
            value={unit.panelThicknessMm}
            inMm
            onChange={(mm) => onChange({ panelThicknessMm: mm })}
          />
        </div>
      )}

      {inside ? (
        /* ---- פנים הארון ---- */
        container ? (
          <ZonesEditor unit={unit} onChange={onChange} />
        ) : (
          <p className="mt-4 text-xs leading-snug text-stone-500">
            לארגז הזה אין פנים שאפשר לחלק — הוא מכשיר או לוח בודד.
          </p>
        )
      ) : (
        /* ---- החזית ---- */
        <>
          {caps.doors && (
            <>
              <Row label="דלתות" hint="0 = בלי חזית">
                {DOOR_COUNTS.map((n) => (
                  <Pill key={n} active={n === (unit.doors ?? 0)} onClick={() => onChange({ doors: n })}>
                    {n}
                  </Pill>
                ))}
              </Row>

              {(unit.doors ?? 0) > 0 && (
                <>
                  <Row label="מנגנון פתיחה">
                    {OPENINGS.map((o) => (
                      <Pill
                        key={o.key}
                        active={(unit.opening ?? 'hinge') === o.key}
                        onClick={() => onChange({ opening: o.key })}
                      >
                        {o.label}
                      </Pill>
                    ))}
                  </Row>

                  <button
                    onClick={() => onChange({ glassDoors: !unit.glassDoors })}
                    aria-pressed={!!unit.glassDoors}
                    className={`mt-2 self-start rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      unit.glassDoors
                        ? 'bg-oak-600 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    דלתות זכוכית
                  </button>
                </>
              )}
            </>
          )}

          {unit.corner && (
            <Row label="עומק הפינה המתה">
              {[200, 250, 300, 350, 400].map((mm) => (
                <Pill
                  key={mm}
                  active={mm === (unit.blindMm ?? 300)}
                  onClick={() => onChange({ blindMm: mm })}
                >
                  {cm(mm)}
                </Pill>
              ))}
            </Row>
          )}

          <Row label="גוון החזית">
            <Pill active={!unit.finishId} onClick={() => onChange({ finishId: undefined })}>
              ללא
            </Pill>
            {(finishes ?? []).map((f) => (
              <button
                key={f.id}
                onClick={() => onChange({ finishId: f.id })}
                title={f.code ? `${f.name} · ${f.code}` : f.name}
                className={`flex items-center gap-1.5 rounded-lg py-1 pe-2.5 ps-1 text-sm font-medium transition-colors ${
                  unit.finishId === f.id
                    ? 'bg-oak-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span
                  className="size-5 shrink-0 rounded border border-black/10"
                  style={{ background: f.hex }}
                />
                <span className="max-w-20 truncate">{f.name}</span>
              </button>
            ))}
          </Row>

          {(finishes?.length ?? 0) === 0 && (
            <p className="mt-1 text-[10px] text-stone-400">
              אין עדיין גוונים. מגדירים אותם בהגדרות, בקטלוג הגוונים של לוח החזית.
            </p>
          )}

          <Row label="דפנות זרות" hint={`עמוקות ב-${MATERIAL.exposedExtraMm} מ״מ מהארגז`}>
            {SIDES.map((s) => (
              <Pill key={s.key} active={!!exposed[s.key]} onClick={() => toggleSide(s.key)}>
                {s.label}
              </Pill>
            ))}
          </Row>
        </>
      )}

      <Row label="פס לד">
        {LED_SPOTS.map((s) => (
          <Pill key={s.key} active={led.includes(s.key)} onClick={() => toggleLed(s.key)}>
            {s.label}
          </Pill>
        ))}
      </Row>

      <div className="mt-3 flex items-stretch gap-2">
        <button
          onClick={() =>
            onChange({
              floorLocked: !locked,
              ...(locked ? {} : { yMm: unit.socleMm ?? 0 }),
            })
          }
          aria-pressed={locked}
          className={`flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors ${
            locked ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              locked ? 'bg-white/30' : 'bg-stone-300'
            }`}
          >
            <span
              className={`size-4 rounded-full bg-white transition-transform ${
                locked ? '-translate-x-4' : ''
              }`}
            />
          </span>
          הצמדה לרצפה
        </button>

        <div className="min-w-0 flex-1">
          {locked ? (
            <NumBox
              label="גובה רגליים"
              value={unit.socleMm ?? 0}
              onChange={(mm) => onChange({ socleMm: mm || undefined, yMm: mm })}
            />
          ) : (
            <NumBox label="גובה מהרצפה" value={unit.yMm} onChange={(mm) => onChange({ yMm: mm })} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AxisTab({
  active,
  onClick,
  label,
  value,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-2 py-1.5 transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      <span className="block text-[10px] leading-tight opacity-70">{label}</span>
      <span className="num block text-sm leading-tight font-semibold">{cm(value)}</span>
    </button>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11px] font-medium text-stone-500">{label}</span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`num min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function NumBox({
  label,
  value,
  minMm,
  inMm,
  onChange,
}: {
  label: string;
  value: number;
  minMm?: number;
  inMm?: boolean;
  onChange: (mm: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">
        {label}
        {inMm && <span className="text-stone-400"> מ״מ</span>}
      </span>
      <MeasureInput
        value={value}
        onChange={onChange}
        minMm={minMm}
        inMm={inMm}
        ariaLabel={label}
        className="num w-full bg-transparent text-base font-medium text-stone-900 focus:outline-none"
      />
    </label>
  );
}
