import { useState } from 'react';
import { catalogRepo } from '../../catalog/catalogRepo';
import { GLYPHS } from '../../catalog/glyphList';
import { GlyphPreview } from '../../catalog/GlyphPreview';
import { GROUP_LABELS } from '../../catalog/rooms';
import { KITCHEN } from '../../catalog/standards';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass } from '../../ui/Field';
import { cmToMm, mmToCm } from '../../ui/units';
import { TrashIcon } from '../../ui/icons';
import type { CatalogGroup, CatalogItem, RoomKind, UnitLevel } from '../../db/types';

const GROUPS: CatalogGroup[] = ['base', 'upper', 'tall', 'storage'];
const ROOM_CHIPS: { kind: RoomKind; label: string }[] = [
  { kind: 'kitchen', label: 'מטבח' },
  { kind: 'living', label: 'סלון' },
  { kind: 'bedroom', label: 'חדר שינה' },
];

/** המפלס נגזר מהקבוצה — פחות החלטות למשתמש. */
const LEVEL_BY_GROUP: Record<CatalogGroup, UnitLevel> = {
  base: 'floor',
  upper: 'wall',
  tall: 'tall',
  storage: 'floor',
};

/** גובה תחתית ברירת מחדל לפי קבוצה. */
const Y_BY_GROUP: Record<CatalogGroup, number> = {
  base: KITCHEN.socleH,
  upper: KITCHEN.upperBottom,
  tall: KITCHEN.socleH,
  storage: 80,
};

const NEEDS_DOORS = new Set(['doors', 'doorDrawer', 'glass', 'corner']);
const NEEDS_DRAWERS = new Set(['drawers', 'doorDrawer', 'hob', 'nightstand']);

/** בניית ארגז חדש לספרייה, או עריכת ארגז קיים. */
export function CustomItemSheet({
  item,
  roomKind,
  defaultGroup,
  onClose,
}: {
  item: CatalogItem | null;
  roomKind: RoomKind;
  defaultGroup: CatalogGroup;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [glyph, setGlyph] = useState(item?.glyph ?? 'doors');
  const [group, setGroup] = useState<CatalogGroup>(item?.group ?? defaultGroup);
  const [doors, setDoors] = useState(item?.doors ?? 2);
  const [drawers, setDrawers] = useState(item?.drawers ?? 3);
  const [rooms, setRooms] = useState<RoomKind[]>(
    item?.rooms ?? (roomKind === 'custom' ? ['kitchen', 'living', 'bedroom'] : [roomKind]),
  );
  const [widthCm, setWidthCm] = useState(String(mmToCm(item?.defaultWidthMm ?? 600)));
  const [heightCm, setHeightCm] = useState(String(mmToCm(item?.defaultHeightMm ?? 720)));
  const [depthCm, setDepthCm] = useState(String(mmToCm(item?.defaultDepthMm ?? 580)));
  const [yCm, setYCm] = useState(String(mmToCm(item?.defaultYMm ?? Y_BY_GROUP[defaultGroup])));
  const [socleCm, setSocleCm] = useState(String(mmToCm(item?.socleMm ?? 0)));
  const [counterCm, setCounterCm] = useState(String(mmToCm(item?.counterMm ?? 0)));

  const widthMm = cmToMm(Number(widthCm) || 0);
  const heightMm = cmToMm(Number(heightCm) || 0);
  const canSave = name.trim().length > 0 && widthMm > 0 && heightMm > 0 && rooms.length > 0;

  function changeGroup(g: CatalogGroup) {
    setGroup(g);
    if (!item) setYCm(String(mmToCm(Y_BY_GROUP[g])));
  }

  async function save() {
    await catalogRepo.saveCustom({
      id: item?.id,
      rooms,
      group,
      name: name.trim(),
      glyph,
      doors: NEEDS_DOORS.has(glyph) ? doors : undefined,
      drawers: NEEDS_DRAWERS.has(glyph) ? drawers : undefined,
      level: LEVEL_BY_GROUP[group],
      defaultWidthMm: widthMm,
      widthOptionsMm: widthLadder(widthMm),
      defaultHeightMm: heightMm,
      defaultDepthMm: cmToMm(Number(depthCm) || 0),
      defaultYMm: cmToMm(Number(yCm) || 0),
      socleMm: cmToMm(Number(socleCm) || 0) || undefined,
      counterMm: cmToMm(Number(counterCm) || 0) || undefined,
      note: item?.note,
    });
    onClose();
  }

  async function remove() {
    if (item && !item.isBuiltin) {
      await catalogRepo.removeCustom(item.id);
      onClose();
    }
  }

  return (
    <Sheet
      title={item ? 'עריכת ארגז' : 'ארגז חדש'}
      onClose={onClose}
      tall
      footer={
        <div className="flex items-center gap-2">
          {item && !item.isBuiltin && (
            <button
              onClick={remove}
              aria-label="מחיקה מהספרייה"
              className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon />
            </button>
          )}
          <div className="flex-1">
            <PrimaryButton disabled={!canSave} onClick={save}>
              שמירה בספרייה
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4">
          <span className="text-stone-500">
            <GlyphPreview
              glyph={glyph}
              widthMm={widthMm || 600}
              heightMm={heightMm || 720}
              doors={doors}
              drawers={drawers}
              className="h-20 w-20"
            />
          </span>
          <p className="text-sm leading-snug text-stone-500">
            כך הארגז ייראה על הקיר, בפרופורציה של המידות שהזנת.
          </p>
        </div>

        <Field label="שם הארגז">
          <input
            autoFocus={!item}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="למשל: ארגז תבלינים צר"
          />
        </Field>

        <Field label="קבוצה בספרייה">
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <Chip key={g} active={g === group} onClick={() => changeGroup(g)}>
                {GROUP_LABELS[g]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="באילו חדרים יופיע">
          <div className="flex flex-wrap gap-1.5">
            {ROOM_CHIPS.map((r) => (
              <Chip
                key={r.kind}
                active={rooms.includes(r.kind)}
                onClick={() =>
                  setRooms((prev) =>
                    prev.includes(r.kind) ? prev.filter((k) => k !== r.kind) : [...prev, r.kind],
                  )
                }
              >
                {r.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="איור">
          <div className="grid grid-cols-5 gap-1.5">
            {GLYPHS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGlyph(g.key)}
                title={g.label}
                className={`flex flex-col items-center gap-0.5 rounded-xl border p-1.5 transition-colors ${
                  g.key === glyph
                    ? 'border-oak-500 bg-oak-50 text-oak-700'
                    : 'border-stone-200 bg-white text-stone-400 hover:border-oak-300'
                }`}
              >
                <GlyphPreview
                  glyph={g.key}
                  widthMm={600}
                  heightMm={720}
                  doors={2}
                  drawers={3}
                  className="h-8 w-full"
                />
                <span className="w-full truncate text-[9px] leading-none">{g.label}</span>
              </button>
            ))}
          </div>
        </Field>

        {(NEEDS_DOORS.has(glyph) || NEEDS_DRAWERS.has(glyph)) && (
          <div className="grid grid-cols-2 gap-3">
            {NEEDS_DOORS.has(glyph) && (
              <Field label="דלתות">
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <Chip key={n} active={n === doors} onClick={() => setDoors(n)}>
                      <span className="num">{n}</span>
                    </Chip>
                  ))}
                </div>
              </Field>
            )}
            {NEEDS_DRAWERS.has(glyph) && (
              <Field label="מגירות">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Chip key={n} active={n === drawers} onClick={() => setDrawers(n)}>
                      <span className="num">{n}</span>
                    </Chip>
                  ))}
                </div>
              </Field>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-5">
          <NumField label="רוחב" value={widthCm} onChange={setWidthCm} />
          <NumField label="גובה" value={heightCm} onChange={setHeightCm} />
          <NumField label="עומק" value={depthCm} onChange={setDepthCm} />
          <NumField label="גובה מהרצפה" value={yCm} onChange={setYCm} />
          <NumField label="סוקל" value={socleCm} onChange={setSocleCm} />
          <NumField label="משטח עבודה" value={counterCm} onChange={setCounterCm} />
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function Chip({
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
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} hint='ס"מ'>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        inputMode="numeric"
        className={`${inputClass} num text-end`}
      />
    </Field>
  );
}

/** סולם רוחבים סביב הרוחב שנבחר, מעוגל ל-5 ס"מ. */
function widthLadder(w: number): number[] {
  const raw = [w * 0.5, w * 0.75, w, w * 1.25, w * 1.5];
  const rounded = raw.map((v) => Math.max(50, Math.round(v / 50) * 50));
  return [...new Set(rounded)].sort((a, b) => a - b);
}
