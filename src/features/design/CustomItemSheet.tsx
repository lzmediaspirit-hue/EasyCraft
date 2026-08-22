import { useState } from 'react';
import { catalogRepo } from '../../catalog/catalogRepo';
import { glyphDef } from '../../catalog/glyphList';
import { autoShelves } from '../../catalog/CabinetGlyph';
import { GROUP_LABELS } from '../../catalog/rooms';
import { KITCHEN } from '../../catalog/standards';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton } from '../../ui/Field';
import { BoxForm, type BoxSpec } from '../../ui/BoxForm';
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
  const [group, setGroup] = useState<CatalogGroup>(item?.group ?? defaultGroup);
  const [rooms, setRooms] = useState<RoomKind[]>(
    item?.rooms ?? (roomKind === 'custom' ? ['kitchen', 'living', 'bedroom'] : [roomKind]),
  );
  const [spec, setSpec] = useState<BoxSpec>({
    name: item?.name ?? '',
    glyph: item?.glyph ?? 'doors',
    doors: item?.doors ?? 2,
    drawers: item?.drawers ?? 3,
    drawerCols: item?.drawerCols ?? 1,
    shelves: item?.shelves ?? autoShelves(item?.defaultHeightMm ?? 720),
    widthMm: item?.defaultWidthMm ?? 600,
    heightMm: item?.defaultHeightMm ?? 720,
    depthMm: item?.defaultDepthMm ?? 580,
    yMm: item?.defaultYMm ?? Y_BY_GROUP[defaultGroup],
    socleMm: item?.socleMm ?? 0,
    counterMm: item?.counterMm ?? 0,
  });

  const canSave = spec.name.trim().length > 0 && spec.widthMm > 0 && spec.heightMm > 0 && rooms.length > 0;

  function changeGroup(g: CatalogGroup) {
    setGroup(g);
    if (!item) setSpec((s) => ({ ...s, yMm: Y_BY_GROUP[g] }));
  }

  async function save() {
    const caps = glyphDef(spec.glyph);
    await catalogRepo.saveCustom({
      id: item?.id,
      rooms,
      group,
      name: spec.name.trim(),
      glyph: spec.glyph,
      doors: caps.doors ? spec.doors : undefined,
      drawers: caps.drawers ? spec.drawers : undefined,
      drawerCols: caps.drawers ? spec.drawerCols : undefined,
      shelves: caps.shelves ? spec.shelves : undefined,
      level: LEVEL_BY_GROUP[group],
      defaultWidthMm: spec.widthMm,
      widthOptionsMm: widthLadder(spec.widthMm),
      defaultHeightMm: spec.heightMm,
      defaultDepthMm: spec.depthMm,
      defaultYMm: spec.yMm,
      socleMm: spec.socleMm || undefined,
      counterMm: spec.counterMm || undefined,
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
        <BoxForm
          value={spec}
          onChange={(patch) => setSpec((s) => ({ ...s, ...patch }))}
          namePlaceholder="למשל: שידה עם שש מגירות"
        />

        <div className="space-y-5 border-t border-stone-100 pt-5">
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
        </div>
      </div>
    </Sheet>
  );
}

/** סולם רוחבים סביב הרוחב שנבחר, מעוגל ל-5 ס"מ. */
function widthLadder(w: number): number[] {
  const raw = [w * 0.5, w * 0.75, w, w * 1.25, w * 1.5];
  const rounded = raw.map((v) => Math.max(50, Math.round(v / 50) * 50));
  return [...new Set(rounded)].sort((a, b) => a - b);
}
