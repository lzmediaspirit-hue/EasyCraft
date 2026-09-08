import { Pill } from '../../ui/Pill';
import { useState } from 'react';
import {
  MAX_BODY_MM,
  MIN_ZONE_MM,
  ZONE_LABELS,
  contentDefaults,
  contentSummary,
  mergeZone,
  normalizeHeights,
  removeColumn,
  requiredBody,
  splitByShelf,
  splitZone,
  unitZones,
  zoneColumns,
} from '../../catalog/zones';
import { ShelfGaps } from './ShelfGaps';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { BackIcon, LockIcon, PlusIcon, TrashIcon, UnlockIcon } from '../../ui/icons';
import type { PlacedUnit, Zone, ZoneContent, ZoneKind } from '../../db/types';

const KINDS: ZoneKind[] = ['shelves', 'drawers', 'rod', 'empty'];
const COUNTS = [0, 1, 2, 3, 4, 5, 6];

/** לאן העורך מכוון עכשיו: כל הארון, אזור אחד, או תא בתוך אזור. */
type Focus = { zoneId: string; columnId?: string } | null;

/**
 * עריכת פנים הארון בניווט, לא ברשימה.
 *
 * הנגר חושב בפעולות: שמים מדף — נוצרים שני תאים; שמים קושרת — כל
 * תא נחצה לשניים. לכן המסך הראשי מראה את התאים כמו שהם יושבים
 * בארון, ונכנסים לתא כדי לערוך אותו לבד. כך אין רשימת הגדרות
 * ארוכה של כל הארון על מסך אחד, ואפשר לעבוד באצבע.
 */
export function InteriorEditor({
  unit,
  onChange,
}: {
  unit: PlacedUnit;
  onChange: (patch: Partial<PlacedUnit>) => void;
}) {
  const [focus, setFocus] = useState<Focus>(null);
  const socle = unit.socleMm ?? 0;
  const bodyH = Math.max(unit.heightMm - socle, 0);
  const zones = unitZones({ ...unit, heightMm: bodyH });

  /** כותב אזורים חזרה; גובה נעול שלא נכנס מגדיל את הארון. */
  function write(next: Zone[]) {
    const needed = requiredBody(next, bodyH);
    onChange({
      zones: normalizeHeights(next, needed),
      ...(needed !== bodyH ? { heightMm: needed + socle } : {}),
    });
  }

  const patchZone = (id: string, patch: Partial<Zone>) =>
    write(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));

  const patchColumn = (zoneId: string, colId: string, patch: Partial<ZoneContent>) =>
    write(
      zones.map((z) =>
        z.id === zoneId
          ? { ...z, columns: (z.columns ?? []).map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : z,
      ),
    );

  const zone = focus ? zones.find((z) => z.id === focus.zoneId) : undefined;
  const column = zone && focus?.columnId ? zoneColumns(zone).find((c) => c.id === focus.columnId) : undefined;

  /* ---------- תא בתוך קושרת ---------- */
  if (zone && column) {
    return (
      <Panel
        title={`תא ${zoneColumns(zone).findIndex((c) => c.id === column.id) + 1}`}
        subtitle={contentSummary(column)}
        onBack={() => setFocus({ zoneId: zone.id })}
        onRemove={() => {
          write(zones.map((z) => (z.id === zone.id ? removeColumn(z, column.id) : z)));
          setFocus({ zoneId: zone.id });
        }}
        removeLabel="הסרת התא"
      >
        <ContentEditor
          content={column}
          heightMm={zone.heightMm}
          onChange={(patch) => patchColumn(zone.id, column.id, patch)}
        />
      </Panel>
    );
  }

  /* ---------- אזור אחד ---------- */
  if (zone) {
    const columns = zoneColumns(zone);
    const index = zones.indexOf(zone);
    return (
      <Panel
        title={`תא ${index + 1}`}
        subtitle={`${cm(zone.heightMm)} ס״מ · ${
          columns.length ? `${columns.length} תאים לרוחב` : contentSummary(zone)
        }`}
        onBack={() => setFocus(null)}
        onRemove={
          zones.length > 1
            ? () => {
                write(zones.filter((z) => z.id !== zone.id));
                setFocus(null);
              }
            : undefined
        }
        removeLabel="הסרת התא"
      >
        {/* גובה התא ונעילתו */}
        <div className="flex items-center gap-1.5">
          <label className="flex flex-1 items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-2">
            <span className="flex-1 text-xs text-stone-500">גובה התא</span>
            <MeasureInput
              value={zone.heightMm}
              onChange={(mm) => setHeight(zone.id, mm)}
              minMm={MIN_ZONE_MM}
              ariaLabel="גובה התא"
              className="num w-14 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
            />
            <span className="text-[10px] text-stone-400">ס״מ</span>
          </label>
          <button
            onClick={() => patchZone(zone.id, { fixedHeight: !zone.fixedHeight })}
            aria-pressed={!!zone.fixedHeight}
            aria-label="נעילת גובה התא"
            title="גובה נעול — הארון גדל כדי להכיל אותו"
            className={`shrink-0 rounded-lg p-2 transition-colors ${
              zone.fixedHeight ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-400'
            }`}
          >
            {zone.fixedHeight ? <LockIcon className="size-4" /> : <UnlockIcon className="size-4" />}
          </button>
        </div>

        {columns.length ? (
          <>
            <span className="mt-3 block text-[11px] font-medium text-stone-500">
              התאים שבתוך התא הזה
            </span>
            <ul className="mt-1.5 space-y-1.5">
              {columns.map((c, i) => (
                <li key={c.id}>
                  <CellRow
                    title={`תא ${i + 1}`}
                    summary={contentSummary(c)}
                    onClick={() => setFocus({ zoneId: zone.id, columnId: c.id })}
                  />
                </li>
              ))}
            </ul>
            <button
              onClick={() => patchZone(zone.id, mergeZone(zone))}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 py-2 text-xs font-medium text-stone-600 transition-colors hover:border-red-200 hover:text-red-600"
            >
              <TrashIcon className="size-3.5" />
              הסרת הקושרת
            </button>
          </>
        ) : (
          <>
            <ContentEditor
              content={zone}
              heightMm={zone.heightMm}
              onChange={(patch) => patchZone(zone.id, patch)}
            />
            <button
              onClick={() => write(zones.map((z) => (z.id === zone.id ? splitZone(z, 2) : z)))}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2.5 text-xs font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
            >
              <PlusIcon className="size-3.5" />
              קושרת — חלוקה לשני תאים לרוחב
            </button>
          </>
        )}
      </Panel>
    );
  }

  /* ---------- כל הארון ---------- */
  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11px] font-medium text-stone-500">פנים הארון</span>
        <span className="text-[10px] text-stone-400">הקש על תא כדי לערוך אותו</span>
      </span>

      <ul className="space-y-1.5">
        {/* מוצג הפוך: התא העליון בארון ראשון ברשימה */}
        {[...zones].reverse().map((z, revIndex) => {
          const index = zones.length - 1 - revIndex;
          const columns = zoneColumns(z);
          return (
            <li key={z.id}>
              <CellRow
                title={`תא ${index + 1}`}
                summary={`${cm(z.heightMm)} ס״מ · ${
                  columns.length ? `${columns.length} תאים לרוחב` : contentSummary(z)
                }`}
                locked={z.fixedHeight}
                onClick={() => setFocus({ zoneId: z.id })}
              />
            </li>
          );
        })}
      </ul>

      <button
        onClick={() =>
          write(zones.flatMap((z) => (z.id === zones[zones.length - 1].id ? splitByShelf(z) : [z])))
        }
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2.5 text-xs font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
      >
        <PlusIcon className="size-3.5" />
        מדף מפריד — חלוקה לשני תאים לגובה
      </button>

      {bodyH > MAX_BODY_MM && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
          גוף הארון <span className="num">{cm(bodyH)}</span> ס״מ — מעל{' '}
          <span className="num">{cm(MAX_BODY_MM)}</span> קשה להוביל ולהתקין.
        </p>
      )}
    </div>
  );

  /** שינוי גובה תא בא על חשבון התאים הגמישים; אין כאלה — הארון גדל. */
  function setHeight(id: string, mm: number) {
    const clamped = Math.max(mm, MIN_ZONE_MM);
    const next = zones.map((z) => (z.id === id ? { ...z, heightMm: clamped } : z));
    if (!next.some((z) => z.id !== id && !z.fixedHeight)) {
      onChange({ zones: next, heightMm: next.reduce((a, z) => a + z.heightMm, 0) + socle });
      return;
    }
    write(next);
  }
}

/** מסך משנה של העורך, עם חזרה ומחיקה. */
function Panel({
  title,
  subtitle,
  onBack,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onRemove?: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="חזרה"
          className="-ms-1 shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <BackIcon className="size-4" />
        </button>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-stone-900">{title}</span>
          <span className="block truncate text-[11px] text-stone-400">{subtitle}</span>
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={removeLabel}
            className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function CellRow({
  title,
  summary,
  locked,
  onClick,
}: {
  title: string;
  summary: string;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-start transition-colors hover:border-oak-400"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-stone-800">
          {title}
          {locked && <LockIcon className="ms-1.5 inline size-3 text-oak-600" />}
        </span>
        <span className="block truncate text-[11px] text-stone-400">{summary}</span>
      </span>
      <BackIcon className="size-4 shrink-0 rotate-180 text-stone-300" />
    </button>
  );
}

/** תוכן של תא — משרת גם אזור וגם עמודה בתוך קושרת. */
function ContentEditor({
  content,
  heightMm,
  onChange,
}: {
  content: ZoneContent;
  heightMm: number;
  onChange: (patch: Partial<ZoneContent>) => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <Pill size="sm"
            key={k}
            active={content.kind === k}
            onClick={() => onChange(contentDefaults(k, heightMm))}
          >
            {ZONE_LABELS[k]}
          </Pill>
        ))}
      </div>

      {content.kind === 'shelves' && (
        <>
          <Row label="מדפים">
            {COUNTS.map((n) => (
              <Pill size="sm"
                key={n}
                active={n === (content.shelves ?? 0)}
                onClick={() => onChange({ shelves: n, shelfGapsMm: undefined })}
              >
                {n}
              </Pill>
            ))}
          </Row>
          {(content.shelves ?? 0) > 0 && (
            <Row label="חומר">
              <Pill size="sm"
                active={!content.glassShelves}
                onClick={() => onChange({ glassShelves: undefined })}
              >
                לוח
              </Pill>
              <Pill size="sm" active={!!content.glassShelves} onClick={() => onChange({ glassShelves: true })}>
                זכוכית
              </Pill>
            </Row>
          )}
          <ShelfGaps
            shelves={content.shelves ?? 0}
            heightMm={heightMm}
            gaps={content.shelfGapsMm}
            onChange={(g) => onChange({ shelfGapsMm: g })}
          />
        </>
      )}

      {content.kind === 'drawers' && (
        <>
          <Row label="שורות">
            {COUNTS.slice(1).map((n) => (
              <Pill size="sm"
                key={n}
                active={n === (content.drawers ?? 0)}
                onClick={() => onChange({ drawers: n })}
              >
                {n}
              </Pill>
            ))}
          </Row>
          <Row label="לרוחב">
            {[1, 2, 3, 4].map((n) => (
              <Pill size="sm"
                key={n}
                active={n === (content.drawerCols ?? 1)}
                onClick={() => onChange({ drawerCols: n })}
              >
                {n}
              </Pill>
            ))}
          </Row>
          <Row label="סוג">
            <Pill size="sm"
              active={content.drawerStyle !== 'inner'}
              onClick={() => onChange({ drawerStyle: 'outer' })}
            >
              חזית בולטת
            </Pill>
            <Pill size="sm"
              active={content.drawerStyle === 'inner'}
              onClick={() => onChange({ drawerStyle: 'inner' })}
            >
              פנימית
            </Pill>
          </Row>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-stone-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

