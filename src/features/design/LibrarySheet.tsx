import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { GLYPH_GROUPS_FALLBACK, GROUP_LABELS, ROOMS, roomDef } from '../../catalog/rooms';
import { GlyphPreview } from '../../catalog/GlyphPreview';
import { CustomItemSheet } from './CustomItemSheet';
import { Sheet } from '../../ui/Sheet';
import { cm } from '../../ui/units';
import { BedroomIcon, KitchenIcon, LivingIcon, PencilIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import type { CatalogGroup, CatalogItem, RoomKind } from '../../db/types';

/** תצוגות הספרייה: הקלאסית, ספרייה לכל חדר, ותיקיית הדפנות. */
type View = 'classic' | RoomKind | 'panel';

const ROOM_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  kitchen: KitchenIcon,
  living: LivingIcon,
  bedroom: BedroomIcon,
};

/**
 * ספריית המוצרים.
 *
 * המסך הראשון הוא הספרייה הקלאסית: ארגזי הבסיס שמתאימים לכל חדר,
 * ושמהם אפשר לגזור כל שינוי. משם נכנסים לספרייה של חדר מסוים,
 * או לתיקיית הדפנות והלוחות הבודדים.
 */
export function LibrarySheet({
  roomKind,
  onAdd,
  manage,
  onClose,
}: {
  roomKind: RoomKind;
  /** הוספה לקיר. במצב ניהול אין לאן להוסיף, ולכן היא לא נדרשת. */
  onAdd?: (item: CatalogItem) => void;
  /**
   * מצב ניהול: לחיצה על פריט פותחת אותו לעריכה במקום להוסיף אותו
   * לקיר. כך אפשר לבנות ולתחזק את הספרייה גם בלי פרויקט פתוח.
   */
  manage?: boolean;
  onClose: () => void;
}) {
  const items = useLiveQuery(() => catalogRepo.all(), []);
  const removed = useLiveQuery(() => catalogRepo.removed(), []);
  const [view, setView] = useState<View>('classic');
  const [group, setGroup] = useState<CatalogGroup | null>(null);
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);

  /*
   * "נפוץ" ו"מתאים לחדר" הן שתי שאלות נפרדות.
   *
   * ארגז שהמשתמש בנה מסומן כנפוץ, ולכן הוא הופיע בספרייה הקלאסית של
   * כל חדר — גם כשסימן לו חדר שינה בלבד — ובו בזמן נעדר מרשימת חדר
   * השינה עצמה, כי היא סיננה החוצה את הנפוצים. הבחירה של המשתמש
   * קובעת איפה הוא מוצע; הנפוצוּת קובעת רק אם הוא בעמוד הראשון.
   */
  const pool = useMemo(() => {
    if (!items) return [];
    const fitsRoom = (i: CatalogItem) =>
      manage || roomKind === 'custom' || i.rooms.includes(roomKind);
    if (view === 'classic') {
      return items.filter((i) => i.common && i.group !== 'panel' && fitsRoom(i));
    }
    if (view === 'panel') return items.filter((i) => i.group === 'panel');
    return items.filter((i) => i.group !== 'panel' && i.rooms.includes(view));
  }, [items, view, manage, roomKind]);


  const groups = useMemo(() => {
    const present = new Set(pool.map((i) => i.group));
    const order = view === 'classic' || view === 'panel'
      ? GLYPH_GROUPS_FALLBACK
      : roomDef(view).groups;
    return order.filter((g) => present.has(g));
  }, [pool, view]);

  const activeGroup = group && groups.includes(group) ? group : groups[0];
  const visible = groups.length > 1 ? pool.filter((i) => i.group === activeGroup) : pool;

  const titles: Record<View, string> = {
    classic: 'ספרייה קלאסית',
    kitchen: 'מטבח',
    living: 'סלון',
    bedroom: 'חדר שינה',
    custom: 'הכול',
    panel: 'דפנות ולוחות',
  };

  function goTo(next: View) {
    setView(next);
    setGroup(null);
  }

  return (
    <>
      <Sheet
        title={manage && view === 'classic' ? 'ספריית המוצרים' : titles[view]}
        onClose={onClose}
        onBack={view === 'classic' ? undefined : () => goTo('classic')}
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
                onClick={() => (manage ? setEditing(item) : onAdd?.(item))}
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
                    zones={item.zones}
                    corner={item.corner}
                    blindMm={item.blindMm}
                    className="h-14 w-full"
                  />
                </span>
                <span className="text-[11px] leading-tight font-medium text-stone-800">
                  {item.name}
                </span>
                <span className="num text-[10px] text-stone-400">
                  {cm(item.defaultWidthMm)}
                  {item.panelThicknessMm && <> · {item.panelThicknessMm} מ״מ</>}
                </span>
              </button>
              {/* במצב ניהול הלחיצה על הפריט עצמו כבר פותחת עריכה */}
              {!manage && (
                <button
                  onClick={() => setEditing(item)}
                  aria-label={`עריכת ${item.name}`}
                  className="absolute top-1 start-1 rounded-lg p-1 text-stone-300 transition-colors hover:bg-stone-100 hover:text-oak-600"
                >
                  <PencilIcon className="size-3.5" />
                </button>
              )}
              {/*
                הסרה מהספרייה. נגר לא בונה את כל מה שמגיע עם
                האפליקציה, ורשימה שחצייה לא רלוונטי היא רשימה שקשה
                למצוא בה. מה שהוסר נשמר וניתן להחזרה, וארגזים
                שכבר הונחו בפרויקטים אינם נוגעים בזה.
              */}
              <button
                onClick={() => catalogRepo.remove(item.id)}
                aria-label={`הסרת ${item.name} מהספרייה`}
                className="absolute top-1 end-1 rounded-lg p-1 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setEditing('new')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-2.5 text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-6" />
            <span className="text-[11px] leading-tight font-medium">ארגז משלי</span>
          </button>
        </div>

        {/* מהספרייה הקלאסית נכנסים לספריות המפורטות */}
        {view === 'classic' && (
          <section className="mt-6 border-t border-stone-100 pt-5">
            <h3 className="mb-2.5 text-sm font-semibold text-stone-700">ספריות לפי חדר</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {ROOMS.filter((r) => r.kind !== 'custom').map((room) => {
                const Icon = ROOM_ICONS[room.icon];
                const n = (items ?? []).filter(
                  (i) => i.group !== 'panel' && !i.common && i.rooms.includes(room.kind),
                ).length;
                return (
                  <button
                    key={room.kind}
                    onClick={() => goTo(room.kind)}
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-start transition-colors hover:border-oak-400 hover:bg-oak-50"
                  >
                    <span className="text-oak-600">
                      <Icon className="size-7" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-stone-900">
                        {room.label}
                      </span>
                      <span className="num block text-[11px] text-stone-400">{n} ארגזים</span>
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => goTo('panel')}
                className="col-span-2 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-start transition-colors hover:border-oak-400 hover:bg-oak-50"
              >
                <span className="grid size-7 place-items-center text-oak-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                    className="size-6" aria-hidden="true">
                    <rect x="3" y="5" width="5" height="14" rx="1" />
                    <rect x="10" y="5" width="4" height="14" rx="1" />
                    <rect x="16" y="5" width="5" height="14" rx="1" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-900">
                    דפנות ולוחות בודדים
                  </span>
                  <span className="block text-[11px] text-stone-400">
                    מידות ועובי משלהם
                  </span>
                </span>
              </button>
            </div>
          </section>
        )}

        {/*
          מה שהוסר. השורה מופיעה רק כשיש מה להחזיר — הסרה שאי אפשר
          לבטל היא דלת בכיוון אחד, וזה לא מה שנגר מצפה מכפתור פח.
        */}
        {!!removed?.length && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-2.5">
            <span className="min-w-0 flex-1 text-xs text-stone-600">
              <span className="num">{removed.length}</span> ארגזים הוסרו מהספרייה
            </span>
            <button
              onClick={() => catalogRepo.restoreAll()}
              className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              החזרה
            </button>
          </div>
        )}

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
          roomKind={view === 'classic' || view === 'panel' ? roomKind : view}
          defaultGroup={activeGroup ?? 'base'}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
