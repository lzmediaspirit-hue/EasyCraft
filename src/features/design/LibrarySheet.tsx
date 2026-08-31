import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { GLYPH_GROUPS_FALLBACK, GROUP_LABELS, roomDef } from '../../catalog/rooms';
import { GlyphPreview } from '../../catalog/GlyphPreview';
import { CustomItemSheet } from './CustomItemSheet';
import { Sheet } from '../../ui/Sheet';
import { cm } from '../../ui/units';
import { PencilIcon, PlusIcon } from '../../ui/icons';
import type { CatalogGroup, CatalogItem, RoomKind } from '../../db/types';

/**
 * ספריית המוצרים — מסוננת לחדר שבו עובדים כרגע.
 *
 * המסך הראשון מציג רק את הארגזים הנפוצים, כדי שהבחירה תהיה מהירה.
 * כל השאר יושבים מאחורי "ארגזים נוספים".
 */
export function LibrarySheet({
  roomKind,
  onAdd,
  onClose,
}: {
  roomKind: RoomKind;
  onAdd: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  const items = useLiveQuery(() => catalogRepo.forRoom(roomKind), [roomKind]);
  const [group, setGroup] = useState<CatalogGroup | null>(null);
  const [showRest, setShowRest] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);

  const groups = useMemo(() => {
    if (!items) return [];
    const pool = showRest ? items.filter((i) => !i.common) : items.filter((i) => i.common);
    const present = new Set(pool.map((i) => i.group));
    const ordered = roomDef(roomKind).groups.filter((g) => present.has(g));
    return ordered.length ? ordered : GLYPH_GROUPS_FALLBACK.filter((g) => present.has(g));
  }, [items, roomKind, showRest]);

  const activeGroup = group && groups.includes(group) ? group : groups[0];
  const visible = (items ?? []).filter(
    (i) => i.group === activeGroup && (showRest ? !i.common : !!i.common),
  );
  const restCount = (items ?? []).filter((i) => !i.common).length;

  return (
    <>
      <Sheet
        title={showRest ? 'ארגזים נוספים' : 'ספריית המוצרים'}
        onClose={onClose}
        onBack={showRest ? () => setShowRest(false) : undefined}
        tall
      >
        {groups.length > 1 && (
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  g === activeGroup
                    ? 'bg-oak-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {visible.map((item) => (
            <div key={item.id} className="relative">
              <button
                onClick={() => onAdd(item)}
                className="flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-2.5 text-center transition-colors hover:border-oak-400 hover:bg-oak-50 active:bg-oak-100"
              >
                <span className="text-stone-500">
                  <GlyphPreview
                    glyph={item.glyph}
                    widthMm={item.defaultWidthMm}
                    heightMm={item.defaultHeightMm}
                    doors={item.doors}
                    drawers={item.drawers}
                    drawerCols={item.drawerCols}
                    shelves={item.shelves}
                    className="h-14 w-full"
                  />
                </span>
                <span className="text-[11px] leading-tight font-medium text-stone-800">
                  {item.name}
                </span>
                <span className="num text-[10px] text-stone-400">{cm(item.defaultWidthMm)}</span>
              </button>
              <button
                onClick={() => setEditing(item)}
                aria-label={`עריכת ${item.name}`}
                className="absolute top-1 start-1 rounded-lg p-1 text-stone-300 transition-colors hover:bg-stone-100 hover:text-oak-600"
              >
                <PencilIcon className="size-3.5" />
              </button>
            </div>
          ))}

          {!showRest && restCount > 0 && (
            <button
              onClick={() => {
                setShowRest(true);
                setGroup(null);
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-2.5 text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
            >
              <span className="num text-lg font-semibold">{restCount}</span>
              <span className="text-[11px] leading-tight font-medium">ארגזים נוספים</span>
            </button>
          )}

          <button
            onClick={() => setEditing('new')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-2.5 text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-6" />
            <span className="text-[11px] leading-tight font-medium">ארגז משלי</span>
          </button>
        </div>

        {visible.some((i) => i.note) && (
          <ul className="mt-5 space-y-1.5 border-t border-stone-100 pt-4">
            {visible
              .filter((i) => i.note)
              .map((i) => (
                <li key={i.id} className="text-xs leading-snug text-stone-500">
                  <span className="font-medium text-stone-700">{i.name}: </span>
                  {i.note}
                </li>
              ))}
          </ul>
        )}
      </Sheet>

      {editing && (
        <CustomItemSheet
          item={editing === 'new' ? null : editing}
          roomKind={roomKind}
          defaultGroup={activeGroup ?? 'base'}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
