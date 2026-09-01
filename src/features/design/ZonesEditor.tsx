import { normalizeHeights, newZone, unitZones, ZONE_LABELS } from '../../catalog/zones';
import { ShelfGaps } from './ShelfGaps';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import type { PlacedUnit, Zone, ZoneKind } from '../../db/types';

const KINDS: ZoneKind[] = ['shelves', 'drawers', 'rod', 'empty'];
const COUNTS = [0, 1, 2, 3, 4, 5, 6];

/**
 * חלוקת פנים הארון לאזורים.
 *
 * זה מה שמאפשר ארון אחד שיש בו גם מגירות למטה, גם מדפים באמצע וגם
 * מוט תלייה למעלה. כל אזור מקבל גובה משלו, והגבהים תמיד מסתכמים
 * לגובה הארון — שינוי באחד בא על חשבון האחרים.
 */
export function ZonesEditor({
  unit,
  onChange,
}: {
  unit: PlacedUnit;
  onChange: (patch: Partial<PlacedUnit>) => void;
}) {
  // האזורים ממלאים את גוף הארון, שהוא הגובה הכולל פחות הרגליים
  const bodyH = Math.max(unit.heightMm - (unit.socleMm ?? 0), 0);
  const zones = unitZones({ ...unit, heightMm: bodyH });

  function write(next: Zone[]) {
    onChange({ zones: normalizeHeights(next, bodyH) });
  }

  function patchZone(id: string, patch: Partial<Zone>) {
    write(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  /**
   * שינוי גובה אזור בא על חשבון האזורים האחרים.
   * כשיש אזור יחיד אין על חשבון מי, ולכן הוא מותח את גובה הארון עצמו.
   */
  function setHeight(id: string, mm: number) {
    const others = zones.filter((z) => z.id !== id);
    if (!others.length) {
      const clamped = Math.max(mm, 50);
      onChange({
        heightMm: clamped + (unit.socleMm ?? 0),
        zones: [{ ...zones[0], heightMm: clamped }],
      });
      return;
    }
    const clamped = Math.min(Math.max(mm, 50), bodyH - 50 * others.length);
    const rest = bodyH - clamped;
    const othersTotal = others.reduce((a, z) => a + z.heightMm, 0);
    write(
      zones.map((z) =>
        z.id === id
          ? { ...z, heightMm: clamped }
          : {
              ...z,
              heightMm: Math.max(
                Math.round(rest * (othersTotal > 0 ? z.heightMm / othersTotal : 1 / others.length)),
                50,
              ),
            },
      ),
    );
  }

  function addZone() {
    const share = Math.round(bodyH / (zones.length + 1));
    write([...zones.map((z) => ({ ...z })), newZone('shelves', share)]);
  }

  function removeZone(id: string) {
    const next = zones.filter((z) => z.id !== id);
    if (!next.length) return;
    write(next);
  }

  function move(id: string, dir: -1 | 1) {
    const i = zones.findIndex((z) => z.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= zones.length) return;
    const next = [...zones];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  }

  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11px] font-medium text-stone-500">פנים הארון</span>
        <span className="text-[10px] text-stone-400">מלמטה למעלה</span>
      </span>

      <ul className="space-y-2">
        {/* מוצג הפוך: האזור העליון בארון מופיע ראשון ברשימה */}
        {[...zones].reverse().map((zone, revIndex) => {
          const index = zones.length - 1 - revIndex;
          return (
            <li key={zone.id} className="rounded-xl border border-stone-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-wrap gap-1">
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      onClick={() => patchZone(zone.id, { ...defaultsFor(k, zone), kind: k })}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        zone.kind === k
                          ? 'bg-oak-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {ZONE_LABELS[k]}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => move(zone.id, 1)}
                  disabled={index === zones.length - 1}
                  aria-label="העלאת האזור"
                  className="rounded-md p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-25"
                >
                  <ArrowUpIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => move(zone.id, -1)}
                  disabled={index === 0}
                  aria-label="הורדת האזור"
                  className="rounded-md p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-25"
                >
                  <ArrowDownIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => removeZone(zone.id)}
                  disabled={zones.length < 2}
                  aria-label="הסרת האזור"
                  className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-25"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>

              <label className="mt-2 flex items-center gap-2 rounded-lg bg-stone-100 px-2 py-1.5">
                <span className="flex-1 text-[11px] text-stone-500">גובה האזור</span>
                <MeasureInput
                  value={zone.heightMm}
                  onChange={(mm) => setHeight(zone.id, mm)}
                  minMm={50}
                  ariaLabel={`גובה אזור ${index + 1}`}
                  className="num w-14 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">ס״מ</span>
              </label>

              {zone.kind === 'shelves' && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {COUNTS.map((n) => (
                      <MiniPill
                        key={n}
                        active={n === (zone.shelves ?? 0)}
                        onClick={() => patchZone(zone.id, { shelves: n, shelfGapsMm: undefined })}
                      >
                        {n}
                      </MiniPill>
                    ))}
                  </div>
                  {(zone.shelves ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <MiniPill
                        active={!zone.glassShelves}
                        onClick={() => patchZone(zone.id, { glassShelves: undefined })}
                      >
                        מדף לוח
                      </MiniPill>
                      <MiniPill
                        active={!!zone.glassShelves}
                        onClick={() => patchZone(zone.id, { glassShelves: true })}
                      >
                        מדף זכוכית
                      </MiniPill>
                    </div>
                  )}
                  <ShelfGaps
                    shelves={zone.shelves ?? 0}
                    heightMm={zone.heightMm}
                    gaps={zone.shelfGapsMm}
                    onChange={(g) => patchZone(zone.id, { shelfGapsMm: g })}
                  />
                </>
              )}

              {zone.kind === 'drawers' && (
                <div className="mt-2 space-y-2">
                  <Row label="שורות">
                    {COUNTS.slice(1).map((n) => (
                      <MiniPill
                        key={n}
                        active={n === (zone.drawers ?? 0)}
                        onClick={() => patchZone(zone.id, { drawers: n })}
                      >
                        {n}
                      </MiniPill>
                    ))}
                  </Row>
                  <Row label="לרוחב">
                    {[1, 2, 3, 4].map((n) => (
                      <MiniPill
                        key={n}
                        active={n === (zone.drawerCols ?? 1)}
                        onClick={() => patchZone(zone.id, { drawerCols: n })}
                      >
                        {n}
                      </MiniPill>
                    ))}
                  </Row>
                  <Row label="סוג">
                    <MiniPill
                      active={zone.drawerStyle !== 'inner'}
                      onClick={() => patchZone(zone.id, { drawerStyle: 'outer' })}
                    >
                      חזית בולטת
                    </MiniPill>
                    <MiniPill
                      active={zone.drawerStyle === 'inner'}
                      onClick={() => patchZone(zone.id, { drawerStyle: 'inner' })}
                    >
                      פנימית
                    </MiniPill>
                  </Row>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        onClick={addZone}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
      >
        <PlusIcon className="size-3.5" />
        אזור נוסף
      </button>

      <p className="mt-1 text-[10px] text-stone-400">
        סך גובה האזורים: <span className="num">{cm(bodyH)}</span> ס״מ
      </p>
    </div>
  );
}

/** ערכי פתיחה סבירים כשמחליפים את סוג האזור. */
function defaultsFor(kind: ZoneKind, zone: Zone): Partial<Zone> {
  if (kind === 'shelves') return { shelves: zone.shelves ?? 2, shelfGapsMm: undefined };
  if (kind === 'drawers') return { drawers: zone.drawers ?? 3, drawerCols: zone.drawerCols ?? 1 };
  return {};
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-stone-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function MiniPill({
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
      className={`num min-w-7 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}
