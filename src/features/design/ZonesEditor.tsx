import {
  MAX_BODY_MM,
  MIN_ZONE_MM,
  ZONE_LABELS,
  contentDefaults,
  mergeZone,
  newZone,
  normalizeHeights,
  requiredBody,
  splitZone,
  unitZones,
  zoneColumns,
} from '../../catalog/zones';
import { ShelfGaps } from './ShelfGaps';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { ArrowDownIcon, ArrowUpIcon, LockIcon, PlusIcon, TrashIcon, UnlockIcon } from '../../ui/icons';
import type { PlacedUnit, Zone, ZoneColumn, ZoneContent, ZoneKind } from '../../db/types';

const KINDS: ZoneKind[] = ['shelves', 'drawers', 'rod', 'empty', 'wine'];
const COUNTS = [0, 1, 2, 3, 4, 5, 6];

/**
 * חלוקת פנים הארון.
 *
 * הארון הוא ערימת אזורים מלמטה למעלה, וכל אזור אפשר לחלק בקושרות
 * לעמודות. רמת עומק אחת מספיקה כדי לתאר ארון אמיתי — חלל פתוח,
 * מדף, קושרת עם שני תאים, ומעליה עוד מדף — בלי מבנה רקורסיבי
 * שקשה לערוך בטלפון.
 *
 * גובה אזור אפשר לנעול: מתקן תלייה צריך 120 ס"מ ומגירה פנימית 90,
 * וגובה כזה אינו נתון למשא ומתן. כשהנעולים לא נכנסים — הארון גדל.
 */
export function ZonesEditor({
  unit,
  onChange,
}: {
  unit: PlacedUnit;
  onChange: (patch: Partial<PlacedUnit>) => void;
}) {
  const socle = unit.socleMm ?? 0;
  const bodyH = Math.max(unit.heightMm - socle, 0);
  const zones = unitZones({ ...unit, heightMm: bodyH });

  /**
   * כותב אזורים חזרה לארון.
   * אם הגבהים הנעולים מחייבים גוף גבוה יותר — הארון גדל איתם,
   * במקום לדחוס תוכן שיש לו מידה אמיתית.
   */
  function write(next: Zone[]) {
    const needed = requiredBody(next, bodyH);
    onChange({
      zones: normalizeHeights(next, needed),
      ...(needed !== bodyH ? { heightMm: needed + socle } : {}),
    });
  }

  function patchZone(id: string, patch: Partial<Zone>) {
    write(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function patchColumn(zoneId: string, colId: string, patch: Partial<ZoneColumn>) {
    write(
      zones.map((z) =>
        z.id === zoneId
          ? { ...z, columns: (z.columns ?? []).map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : z,
      ),
    );
  }

  /** שינוי גובה אזור בא על חשבון האזורים הגמישים שסביבו. */
  function setHeight(id: string, mm: number) {
    const clamped = Math.max(mm, MIN_ZONE_MM);
    const next = zones.map((z) => (z.id === id ? { ...z, heightMm: clamped } : z));
    const others = next.filter((z) => z.id !== id && !z.fixedHeight);
    // אין למי להעביר את ההפרש — הארון עצמו משנה גובה
    if (!others.length) {
      const needed = next.reduce((a, z) => a + z.heightMm, 0);
      onChange({ zones: next, heightMm: needed + socle });
      return;
    }
    write(next);
  }

  function addZone() {
    write([...zones.map((z) => ({ ...z })), newZone('shelves', Math.round(bodyH / (zones.length + 1)))]);
  }

  function removeZone(id: string) {
    const next = zones.filter((z) => z.id !== id);
    if (next.length) write(next);
  }

  function move(id: string, dir: -1 | 1) {
    const i = zones.findIndex((z) => z.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= zones.length) return;
    const next = [...zones];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  }

  const total = zones.reduce((a, z) => a + z.heightMm, 0);

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
          const columns = zoneColumns(zone);
          return (
            <li key={zone.id} className="rounded-xl border border-stone-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-wrap gap-1">
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      onClick={() =>
                        patchZone(zone.id, {
                          ...contentDefaults(k, zone.heightMm),
                          columns: undefined,
                        })
                      }
                      disabled={columns.length > 0}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        zone.kind === k && !columns.length
                          ? 'bg-oak-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-40'
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

              {/* גובה האזור, ונעילה שלו */}
              <div className="mt-2 flex items-center gap-1.5">
                <label className="flex flex-1 items-center gap-2 rounded-lg bg-stone-100 px-2 py-1.5">
                  <span className="flex-1 text-[11px] text-stone-500">גובה האזור</span>
                  <MeasureInput
                    value={zone.heightMm}
                    onChange={(mm) => setHeight(zone.id, mm)}
                    minMm={MIN_ZONE_MM}
                    ariaLabel={`גובה אזור ${index + 1}`}
                    className="num w-14 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
                  />
                  <span className="text-[10px] text-stone-400">ס״מ</span>
                </label>
                <button
                  onClick={() => patchZone(zone.id, { fixedHeight: !zone.fixedHeight })}
                  aria-pressed={!!zone.fixedHeight}
                  aria-label={`נעילת גובה אזור ${index + 1}`}
                  title="גובה נעול — הארון גדל כדי להכיל אותו"
                  className={`shrink-0 rounded-lg p-2 transition-colors ${
                    zone.fixedHeight
                      ? 'bg-oak-600 text-white'
                      : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {zone.fixedHeight ? (
                    <LockIcon className="size-4" />
                  ) : (
                    <UnlockIcon className="size-4" />
                  )}
                </button>
              </div>

              {/* קושרות: כמה תאים לרוחב */}
              <div className="mt-2 flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-stone-500">קושרות</span>
                <div className="flex flex-wrap gap-1">
                  <MiniPill
                    active={!columns.length}
                    onClick={() => patchZone(zone.id, mergeZone(zone))}
                  >
                    ללא
                  </MiniPill>
                  {[2, 3, 4].map((n) => (
                    <MiniPill
                      key={n}
                      active={columns.length === n}
                      onClick={() => write(zones.map((z) => (z.id === zone.id ? splitZone(z, n) : z)))}
                    >
                      {n} תאים
                    </MiniPill>
                  ))}
                </div>
              </div>

              {/* עומק שונה מעומק הארון */}
              <DepthRow
                label="עומק האזור"
                value={zone.depthMm}
                fallback={unit.depthMm}
                onChange={(mm) => patchZone(zone.id, { depthMm: mm })}
              />

              {/* תוכן: תא אחד, או תא לכל עמודה */}
              {columns.length ? (
                <ul className="mt-2 space-y-2">
                  {columns.map((col, i) => (
                    <li key={col.id} className="rounded-lg bg-stone-50 p-2">
                      <span className="mb-1.5 block text-[10px] font-medium text-stone-500">
                        תא {i + 1}
                      </span>
                      <ContentEditor
                        content={col}
                        heightMm={zone.heightMm}
                        depthFallback={zone.depthMm ?? unit.depthMm}
                        label={`תא ${i + 1}`}
                        onChange={(patch) => patchColumn(zone.id, col.id, patch)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <ContentEditor
                  content={zone}
                  heightMm={zone.heightMm}
                  depthFallback={unit.depthMm}
                  label={`אזור ${index + 1}`}
                  onChange={(patch) => patchZone(zone.id, patch)}
                />
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
        סך גובה האזורים: <span className="num">{cm(total)}</span> ס״מ
        {zones.some((z) => z.fixedHeight) && ' · גובה נעול מכתיב את גובה הארון'}
      </p>

      {bodyH > MAX_BODY_MM && (
        <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
          גוף הארון <span className="num">{cm(bodyH)}</span> ס״מ — מעל{' '}
          <span className="num">{cm(MAX_BODY_MM)}</span> ס״מ קשה להרים, להוביל ולהתקין,
          ולרוב עדיף לפצל לשני ארונות.
        </p>
      )}
    </div>
  );
}

/** תוכן של תא — משרת גם אזור שלם וגם עמודה בתוך קושרת. */
function ContentEditor({
  content,
  heightMm,
  depthFallback,
  label,
  onChange,
}: {
  content: ZoneContent;
  heightMm: number;
  depthFallback: number;
  label: string;
  onChange: (patch: Partial<ZoneContent>) => void;
}) {
  return (
    <>
      {/* בעמודה אפשר גם להחליף את סוג התוכן */}
      <div className="mt-2 flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <MiniPill
            key={k}
            active={content.kind === k}
            onClick={() => onChange(contentDefaults(k, heightMm))}
          >
            {ZONE_LABELS[k]}
          </MiniPill>
        ))}
      </div>

      {content.kind === 'shelves' && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {COUNTS.map((n) => (
              <MiniPill
                key={n}
                active={n === (content.shelves ?? 0)}
                onClick={() => onChange({ shelves: n, shelfGapsMm: undefined })}
              >
                {n}
              </MiniPill>
            ))}
          </div>
          {(content.shelves ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <MiniPill
                active={!content.glassShelves}
                onClick={() => onChange({ glassShelves: undefined })}
              >
                מדף לוח
              </MiniPill>
              <MiniPill
                active={!!content.glassShelves}
                onClick={() => onChange({ glassShelves: true })}
              >
                מדף זכוכית
              </MiniPill>
            </div>
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
        <div className="mt-2 space-y-2">
          <Row label="שורות">
            {COUNTS.slice(1).map((n) => (
              <MiniPill
                key={n}
                active={n === (content.drawers ?? 0)}
                onClick={() => onChange({ drawers: n })}
              >
                {n}
              </MiniPill>
            ))}
          </Row>
          <Row label="לרוחב">
            {[1, 2, 3, 4].map((n) => (
              <MiniPill
                key={n}
                active={n === (content.drawerCols ?? 1)}
                onClick={() => onChange({ drawerCols: n })}
              >
                {n}
              </MiniPill>
            ))}
          </Row>
          <Row label="סוג">
            <MiniPill
              active={content.drawerStyle !== 'inner'}
              onClick={() => onChange({ drawerStyle: 'outer' })}
            >
              חזית בולטת
            </MiniPill>
            <MiniPill
              active={content.drawerStyle === 'inner'}
              onClick={() => onChange({ drawerStyle: 'inner' })}
            >
              פנימית
            </MiniPill>
          </Row>
        </div>
      )}

      {content.kind === 'wine' && (
        <div className="mt-2 space-y-2">
          <Row label="שורות">
            {[2, 3, 4, 5, 6].map((n) => (
              <MiniPill
                key={n}
                active={n === (content.wineRows ?? 3)}
                onClick={() => onChange({ wineRows: n })}
              >
                {n}
              </MiniPill>
            ))}
          </Row>
          <Row label="לרוחב">
            {[2, 3, 4, 5, 6].map((n) => (
              <MiniPill
                key={n}
                active={n === (content.wineCols ?? 4)}
                onClick={() => onChange({ wineCols: n })}
              >
                {n}
              </MiniPill>
            ))}
          </Row>
          <p className="text-[10px] leading-snug text-stone-400">
            אלכסונים מצטלבים שיוצרים מעוינים לבקבוק שוכב. מספר הלוחות
            בחישוב הוא הערכה — הנגר חותך לפי שרטוט.
          </p>
        </div>
      )}

      <DepthRow
        label={`עומק ${label}`}
        value={content.depthMm}
        fallback={depthFallback}
        onChange={(mm) => onChange({ depthMm: mm })}
      />
    </>
  );
}

/** עומק שאפשר לחרוג בו מעומק הארון, או להשאיר כמותו. */
function DepthRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value?: number;
  fallback: number;
  onChange: (mm: number | undefined) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="w-16 shrink-0 text-[11px] text-stone-500">{label}</span>
      <MiniPill active={value === undefined} onClick={() => onChange(undefined)}>
        כמו הארון
      </MiniPill>
      <label className="flex flex-1 items-center gap-1 rounded-lg bg-stone-100 px-2 py-1">
        <MeasureInput
          value={value ?? fallback}
          onChange={(mm) => onChange(mm)}
          minMm={80}
          ariaLabel={label}
          className="num w-full bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
        />
        <span className="shrink-0 text-[10px] text-stone-400">ס״מ</span>
      </label>
    </div>
  );
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
      className={`num min-w-7 shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}
