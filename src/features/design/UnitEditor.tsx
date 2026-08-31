import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { glyphDef } from '../../catalog/glyphList';
import { MATERIAL } from '../../catalog/standards';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { CloseIcon, PencilIcon, TrashIcon } from '../../ui/icons';
import type { ExposedSides, PlacedUnit } from '../../db/types';

const COUNTS = [0, 1, 2, 3, 4, 5, 6];

const SIDES: { key: keyof ExposedSides; label: string }[] = [
  { key: 'start', label: 'שמאל' },
  { key: 'end', label: 'ימין' },
  { key: 'top', label: 'עליון' },
  { key: 'bottom', label: 'תחתון' },
];

/**
 * הלוח שנפתח כשארגז נבחר — מחליף את כפתור ההוספה.
 * כאן נעשים השינויים המהירים תוך כדי פגישה עם לקוח:
 * מידות, מדפים ומגירות, ודפנות זרות.
 */
export function UnitEditor({
  unit,
  onChange,
  onEdit,
  onRemove,
  onClose,
}: {
  unit: PlacedUnit;
  onChange: (patch: Partial<PlacedUnit>) => void;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  const widths = source?.widthOptionsMm ?? [];
  const caps = glyphDef(unit.glyph);
  const locked = unit.floorLocked ?? false;
  const exposed = unit.exposed ?? {};
  const innerDrawers = unit.drawerStyle === 'inner';

  function toggleSide(key: keyof ExposedSides) {
    onChange({ exposed: { ...exposed, [key]: !exposed[key] } });
  }

  return (
    <div className="max-h-[62dvh] overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)]">
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

      {widths.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {widths.map((w) => (
            <button
              key={w}
              onClick={() => onChange({ widthMm: w })}
              className={`num shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                w === unit.widthMm
                  ? 'bg-oak-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cm(w)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumBox
          label="רוחב"
          value={unit.widthMm}
          minMm={50}
          onChange={(mm) => onChange({ widthMm: mm })}
        />
        <NumBox
          label="גובה"
          value={unit.heightMm}
          minMm={50}
          onChange={(mm) => onChange({ heightMm: mm })}
        />
        <NumBox
          label="עומק"
          value={unit.depthMm}
          minMm={50}
          onChange={(mm) => onChange({ depthMm: mm })}
        />
      </div>

      {caps.shelves && (
        <Row label="מדפים">
          {COUNTS.map((n) => (
            <Pill key={n} active={n === (unit.shelves ?? 0)} onClick={() => onChange({ shelves: n })}>
              {n}
            </Pill>
          ))}
        </Row>
      )}

      {caps.drawers && (
        <>
          <Row label="מגירות">
            {COUNTS.map((n) => (
              <Pill
                key={n}
                active={n === (unit.drawers ?? 0)}
                onClick={() => onChange({ drawers: n })}
              >
                {n}
              </Pill>
            ))}
          </Row>

          {(unit.drawers ?? 0) > 0 && (
            <>
              <Row label="לרוחב">
                {[1, 2, 3, 4].map((n) => (
                  <Pill
                    key={n}
                    active={n === (unit.drawerCols ?? 1)}
                    onClick={() => onChange({ drawerCols: n })}
                  >
                    {n}
                  </Pill>
                ))}
              </Row>

              <div className="mt-2 flex gap-1.5">
                <StyleCard
                  active={!innerDrawers}
                  onClick={() => onChange({ drawerStyle: 'outer' })}
                  title="חזית בולטת"
                  hint="המגירה נראית מבחוץ"
                />
                <StyleCard
                  active={innerDrawers}
                  onClick={() => onChange({ drawerStyle: 'inner' })}
                  title="מגירה פנימית"
                  hint="דלתות מכסות אותה"
                />
              </div>
            </>
          )}
        </>
      )}

      <Row label="דפנות זרות" hint={`עמוקות ב-${MATERIAL.exposedExtraMm} מ״מ מהארגז`}>
        {SIDES.map((s) => (
          <Pill key={s.key} active={!!exposed[s.key]} onClick={() => toggleSide(s.key)}>
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

        {!locked && (
          <div className="min-w-0 flex-1">
            <NumBox
              label="גובה מהרצפה"
              value={unit.yMm}
              onChange={(mm) => onChange({ yMm: mm })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

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

function StyleCard({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-start transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className={`block text-[11px] ${active ? 'text-white/70' : 'text-stone-400'}`}>
        {hint}
      </span>
    </button>
  );
}

/** תיבת מידה קומפקטית. */
function NumBox({
  label,
  value,
  minMm,
  onChange,
}: {
  label: string;
  value: number;
  minMm?: number;
  onChange: (mm: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <MeasureInput
        value={value}
        onChange={onChange}
        minMm={minMm}
        ariaLabel={label}
        className="num w-full bg-transparent text-base font-medium text-stone-900 focus:outline-none"
      />
    </label>
  );
}
