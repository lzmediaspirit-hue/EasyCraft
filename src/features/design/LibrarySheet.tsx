import { itemSpec } from '../../catalog/roles';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { GLYPH_GROUPS_FALLBACK, GROUP_LABELS } from '../../catalog/rooms';
import { roomDef, roomsRepo } from '../../catalog/roomsRepo';
import { CabinetThumbnail, ProductionGap, cabinetSize } from '../../catalog/CabinetThumbnail';
import { glyphDef } from '../../catalog/glyphList';
import { CustomItemSheet } from './CustomItemSheet';
import { RoomSheet } from './RoomSheet';
import { Sheet } from '../../ui/Sheet';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { CloseIcon, PencilIcon, PlusIcon, SearchIcon, StarIcon, TrashIcon, groupIcon, roomIcon } from '../../ui/icons';

import {
  CUSTOM_ROOM,
  type CatalogGroup,
  type CatalogItem,
  type Room,
  type RoomKind,
} from '../../db/types';

/**
 * תצוגות הספרייה: התפריט, המועדפים, ספרייה לכל חדר, ותיקיית הדפנות.
 *
 * החדר הוא שדה ולא ערך בתוך האיחוד, מפני שמזהה חדר הוא מחרוזת
 * חופשית מאז שהחדרים הם נתונים — וחדר בשם "panel" היה בולע את
 * תיקיית הדפנות.
 */
type View =
  | { kind: 'menu' }
  | { kind: 'favorites' }
  | { kind: 'panel' }
  | { kind: 'room'; id: RoomKind };

const MENU: View = { kind: 'menu' };


/**
 * הספרייה.
 *
 * המסך הראשון הוא תפריט ולא רשימה: המועדפים — מה שבאמת מרכיבים —
 * ואחריהם הספרייה של כל חדר. קודם הוא היה רשימה שטוחה של "ארגזים
 * נפוצים", וברגע שהספרייה כולה היא של הנגרייה הרשימה הזו חזרה על
 * עצמה: אותם ארגזים, פעם בלי חדר ופעם לפי חדר.
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
  const savedRooms = useLiveQuery(() => roomsRepo.all(), [], []);
  const hiddenRooms = useLiveQuery(() => roomsRepo.hidden(), [], []);
  /*
   * מאיפה נפתחת הספרייה.
   *
   * בהוספה לקיר — ישר בספרייה של החדר שהפרויקט נפתח בו: זה מה
   * שמחפשים ברגע הזה, ושלב תפריט באמצע הוא לחיצה מיותרת בכל ארגז.
   * בניהול הספרייה — בתפריט, כי שם בוחרים לאן ללכת.
   */
  const [view, setView] = useState<View>(
    !manage && roomKind && roomKind !== CUSTOM_ROOM ? { kind: 'room', id: roomKind } : MENU,
  );
  const [group, setGroup] = useState<CatalogGroup | null>(null);
  /*
   * חיפוש לפי שם.
   *
   * ספרייה של שישים ארגזים מחולקת לחדרים ולקטגוריות, ולכן מי שיודע
   * בדיוק מה הוא מחפש — "ארגז תנור ומגירה" — צריך לנחש באיזה חדר
   * הוא שמור ולפתוח שתי רמות. החיפוש חוצה את הכול: הוא מסתכל על
   * הספרייה כולה, בלי קשר לחדר, לקטגוריה ולמסך שפתוח.
   */
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  /* הפריט שעומד להימחק, עד שהשאלה נענית */
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const [editRoom, setEditRoom] = useState<Room | 'new' | null>(null);

  /** מה שהוקלד, מנורמל — רווחים כפולים וגרשיים לא אמורים להכשיל חיפוש */
  const needle = normalize(query);

  const pool = useMemo(() => {
    if (!items) return [];
    /*
     * חיפוש גובר על המסך שפתוח: מי שמקליד שם מחפש אותו בספרייה
     * כולה, ולא בחדר שהוא במקרה נמצא בו.
     */
    if (needle) return items.filter((i) => normalize(i.name).includes(needle));
    if (view.kind === 'menu') return [];
    /* ארגזים מועדפים — מה שסומן בכוכב, בלי קשר לחדר ולקטגוריה */
    if (view.kind === 'favorites') return items.filter((i) => i.favorite);
    if (view.kind === 'panel') return items.filter((i) => i.group === 'panel');
    return items.filter((i) => i.group !== 'panel' && i.rooms.includes(view.id));
  }, [items, view, needle]);

  /* מה שנכנס לספרייה של חדר — אותו חשבון שמייצר את הרשימה עצמה */
  const inRoom = (kind: RoomKind) =>
    (items ?? []).filter((i) => i.group !== 'panel' && i.rooms.includes(kind)).length;
  const favorites = (items ?? []).filter((i) => i.favorite).length;



  const groups = useMemo(() => {
    const present = new Set(pool.map((i) => i.group));
    const order = view.kind === 'room' ? roomDef(view.id).groups : GLYPH_GROUPS_FALLBACK;
    return order.filter((g) => present.has(g));
  }, [pool, view]);

  const activeGroup = group && groups.includes(group) ? group : groups[0];
  /*
   * בחיפוש אין לשוניות קטגוריה: התוצאה היא כל מה שנקרא כך, ולחתוך
   * אותה לפי קטגוריה היה מסתיר בדיוק את מה שחיפשו.
   */
  const visible = !needle && groups.length > 1 ? pool.filter((i) => i.group === activeGroup) : pool;

  const title =
    needle
      ? 'חיפוש בספרייה'
      : view.kind === 'favorites'
      ? 'ארגזים מועדפים'
      : view.kind === 'menu'
        ? 'ספרייה'
        : view.kind === 'panel'
          ? 'דפנות ולוחות'
          : roomDef(view.id).label;

  function goTo(next: View) {
    setView(next);
    setGroup(null);
  }

  return (
    <>
      <Sheet
        title={title}
        onClose={onClose}
        onBack={view.kind === 'menu' ? undefined : () => goTo(MENU)}
        tall
      >
        {/*
          שדה החיפוש קודם לכול, גם בתפריט: מי שיודע את שם הארגז לא
          צריך לבחור חדר ואז קטגוריה כדי להגיע אליו.
        */}
        <div className="relative mb-4">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-stone-400">
            <SearchIcon className="size-4" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="חיפוש ארגז לפי שם"
            placeholder="חיפוש ארגז לפי שם"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 ps-9 pe-9 text-sm text-stone-800 placeholder:text-stone-400 focus:border-oak-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="ניקוי החיפוש"
              className="absolute inset-y-0 end-2 flex items-center rounded-lg px-1 text-stone-400 transition-colors hover:text-oak-700"
            >
              <CloseIcon className="size-4" />
            </button>
          )}
        </div>

        {needle && (
          <p className="mb-3 text-xs text-stone-500">
            {visible.length === 0
              ? 'אין ארגז בשם הזה'
              : `${visible.length === 1 ? 'ארגז אחד' : `${visible.length} ארגזים`} בכל הספרייה`}
          </p>
        )}

        {/*
          הקטגוריות. אייקון ותווית יחד: אייקון לבדו הוא חידה, ותווית
          לבדה נקראת לאט. `aria-pressed` הוא מה שאומר לקורא המסך מה
          נבחר — צבע לבדו אינו אומר דבר למי שאינו רואה אותו.
        */}
        {!needle && groups.length > 1 && (
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="קטגוריות">
            {groups.map((g) => {
              const Icon = groupIcon(g);
              return (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  aria-pressed={g === activeGroup}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    g === activeGroup
                      ? 'bg-oak-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <Icon className="size-4" />
                  {GROUP_LABELS[g]}
                </button>
              );
            })}
          </div>
        )}

        {(needle || view.kind !== 'menu') && (
        <div className="grid grid-cols-3 gap-2.5">
          {visible.map((item) => (
            <div key={item.id} className="relative">
              <button
                onClick={() => (manage ? setEditing(item) : onAdd?.(item))}
                className="flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-2.5 text-center transition-colors hover:border-oak-400 hover:bg-oak-50 active:bg-oak-100"
              >
                <span className="text-stone-500">
                  <CabinetThumbnail item={item} className="h-14 w-full" />
                </span>
                <span className="text-[11px] leading-tight font-medium text-stone-800">
                  {item.name}
                </span>
                <span className="num text-[10px] text-stone-400">
                  {cabinetSize(item)}
                  {/* ללוח בודד העובי הוא המידה עצמה, ולכן הוא נגזר ולא נשמר */}
                  {thicknessOf(item) && <> · {thicknessOf(item)} מ״מ</>}
                </span>
                {/* מה שהתבנית אינה יודעת לבנות — ליד הארגז, ולא בהערה נסתרת */}
                <ProductionGap item={itemSpec(item)} className="w-full" />
              </button>
              {/*
                כוכב: הארגז נכנס למועדפים או יוצא מהם. זו רשימת
                העבודה של הנגרייה, ולכן היא נקבעת מכאן — מול הארגז —
                ולא במסך הגדרות נפרד.
              */}
              <button
                onClick={() => catalogRepo.setFavorite(item.id, !item.favorite)}
                aria-label={`${item.favorite ? 'הסרת' : 'הוספת'} ${item.name} מהמועדפים`}
                aria-pressed={!!item.favorite}
                className={`absolute bottom-1 start-1 rounded-lg p-1 transition-colors ${
                  item.favorite
                    ? 'text-oak-500 hover:text-oak-700'
                    : 'text-stone-300 hover:bg-stone-100 hover:text-oak-600'
                }`}
              >
                <StarIcon className="size-3.5" filled={!!item.favorite} />
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
                מחיקה מהספרייה. נגר לא בונה את כל מה שמגיע עם
                האפליקציה, ורשימה שחצייה לא רלוונטי היא רשימה שקשה
                למצוא בה.

                היא נשאלת לפני שהיא קורית: מחיקה היא מחיקה, ואין
                יותר "ארגזים שהוסרו" להחזיר מהם. ארגזים שכבר הונחו
                בפרויקטים אינם נוגעים בזה.
              */}
              <button
                onClick={() => setDeleting(item)}
                aria-label={`מחיקת ${item.name} מהספרייה`}
                className="absolute top-1 end-1 rounded-lg p-1 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="size-3.5" />
              </button>

              {/*
                סדר ידני, בשני כפתורים.

                גרירה של ריבוע בתוך רשת עובדת באצבע בלבד; כפתור
                מעלה וכפתור מטה עובדים גם בעכבר, גם במקלדת וגם
                בקורא מסך — וזו החלופה הנגישה, לא תוספת לצדה.

                הם יושבים מתחת לכרטיס ולא עליו: כפתור קטן שמרחף על
                כרטיס גונב ממנו את הלחיצה, וזה בדיוק מה שקרה.
              */}
              {manage && !needle && (
                <div className="mt-1 flex justify-center gap-1">
                  <button
                    onClick={() => void catalogRepo.move(item.id, -1)}
                    aria-label={`הקדמת ${item.name} בסדר הספרייה`}
                    className="rounded-md bg-stone-100 px-2 text-xs text-stone-500 transition-colors hover:bg-stone-200 hover:text-oak-700"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => void catalogRepo.move(item.id, 1)}
                    aria-label={`איחור ${item.name} בסדר הספרייה`}
                    className="rounded-md bg-stone-100 px-2 text-xs text-stone-500 transition-colors hover:bg-stone-200 hover:text-oak-700"
                  >
                    ▼
                  </button>
                </div>
              )}
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
        )}

        {/* מהספרייה הקלאסית נכנסים לספריות המפורטות */}
        {view.kind === 'menu' && (
          <section>
            {/*
              המועדפים ראשונים: זו רשימת העבודה של הנגרייה — מה
              שבאמת מרכיבים — ולכן היא מה שמחפשים, לא מה שמדפדפים בו.
            */}
            <button
              onClick={() => goTo({ kind: 'favorites' })}
              className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-oak-200 bg-oak-50 p-3 text-start transition-colors hover:border-oak-400"
            >
              <span className="text-oak-600">
                <StarIcon className="size-7" filled />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-900">ארגזים מועדפים</span>
                <span className="num block text-[11px] text-oak-700/70">
                  {favorites} ארגזים
                </span>
              </span>
            </button>

            {/* בתפריט אין רשת ארגזים, ולכן הדרך לארגז חדש היא שורה */}
            <button
              onClick={() => setEditing('new')}
              className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-3 text-start text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
            >
              <PlusIcon className="size-6" />
              <span className="text-sm font-medium">ארגז משלי</span>
            </button>

            <div className="mb-2.5 flex items-center gap-2">
              <h3 className="flex-1 text-sm font-semibold text-stone-700">ספריות לפי חדר</h3>
              {/*
                חדר הוא מגירה בספרייה, ולא רשימה סגורה: מי שעובד גם
                על חדר שירות או על משרד מוסיף אותו כאן.
              */}
              <button
                onClick={() => setEditRoom('new')}
                className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200"
              >
                <PlusIcon className="size-3.5" />
                חדר
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {savedRooms.map((room) => {
                const Icon = roomIcon(room.icon);
                const n = inRoom(room.id);

                return (
                  <div key={room.id} className="relative">
                    <button
                      onClick={() => goTo({ kind: 'room', id: room.id })}
                      className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 pe-9 text-start transition-colors hover:border-oak-400 hover:bg-oak-50"
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
                    <button
                      onClick={() => setEditRoom(room)}
                      aria-label={`עריכת ${room.label}`}
                      className="absolute top-1 end-1 rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-stone-100 hover:text-oak-600"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => goTo({ kind: 'panel' })}
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

        {/* חדר שהוסר — אותה דלת חזרה כמו לארגז שהוסר */}
        {view.kind === 'menu' && !!hiddenRooms.length && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-2.5">
            <span className="min-w-0 flex-1 text-xs text-stone-600">
              <span className="num">{hiddenRooms.length}</span> חדרים הוסרו
            </span>
            <button
              onClick={() => hiddenRooms.forEach((r) => roomsRepo.restore(r.id))}
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

      {editRoom && (
        <RoomSheet room={editRoom === 'new' ? null : editRoom} onClose={() => setEditRoom(null)} />
      )}

      {deleting && (
        <ConfirmSheet
          title="מחיקת ארגז מהספרייה"
          what={deleting.code ? `${deleting.name} · ${deleting.code}` : deleting.name}
          impact="הארגז יורד מהספרייה ולא יהיה אפשר להחזיר אותו. ארגזים שכבר הונחו בפרויקטים אינם נמחקים — כל אחד מהם שמר את המידות שלו בעצמו."
          onConfirm={() => void catalogRepo.remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {editing && (
        <CustomItemSheet
          item={editing === 'new' ? null : editing}
          roomKind={view.kind === 'room' ? view.id : roomKind}
          defaultGroup={activeGroup ?? 'base'}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/**
 * השוואת שמות סלחנית.
 *
 * "ארגז  תנור" ו"ארגז תנור" הם אותו ארגז, וכך גם מי שהקליד גרש
 * ישר במקום גרשיים עבריים. חיפוש שנכשל על רווח כפול הוא חיפוש
 * שהנגר מפסיק להשתמש בו.
 */
/**
 * עובי הלוח של פריט ספרייה, לפריט שהוא לוח בודד בלבד.
 * לוח מונח עוביו הוא גובהו, ולוח עומד עוביו הוא עומקו.
 */
function thicknessOf(item: CatalogItem): number | null {
  const flat = glyphDef(item.glyph).noCarcass;
  if (!flat) return null;
  return flat === 'horizontal' ? item.defaultHeightMm : item.defaultDepthMm;
}

function normalize(value: string): string {
  return value
    .trim()
    .replace(/["\u05f4\u201c\u201d]/g, '"')
    .replace(/['\u05f3\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
