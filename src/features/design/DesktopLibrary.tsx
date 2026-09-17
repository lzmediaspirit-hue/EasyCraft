import { itemSpec } from '../../catalog/roles';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { catalogRepo } from '../../catalog/catalogRepo';
import { roomsRepo } from '../../catalog/roomsRepo';
import { CabinetThumbnail, ProductionGap, cabinetSize } from '../../catalog/CabinetThumbnail';
import { GROUP_LABELS } from '../../catalog/rooms';
import { cabinetNameKey } from '../../catalog/names';
import type { CatalogItem, CatalogGroup } from '../../db/types';

/**
 * הספרייה כפאנל קבוע, במסך רחב.
 *
 * בנייד היא גיליון שנפתח ונסגר, כי אין מקום לשניהם. במחשב יש:
 * הקיר באמצע, הספרייה בצד, ואפשר להניח ארגז אחרי ארגז בלי לפתוח
 * ולסגור בכל פעם. זה אותו מידע ואותם נתונים — רק בלי הגיליון.
 *
 * הוא מוסתר ב-CSS מתחת ל-1200 פיקסל, ולכן בנייד הוא אינו קיים על
 * המסך ואינו נכנס לסדר המקלדת.
 */
export function DesktopLibrary({
  roomKind,
  onAdd,
}: {
  roomKind: string;
  onAdd: (item: CatalogItem) => void;
}) {
  const items = useLiveQuery(() => catalogRepo.all(), [], []);
  const rooms = useLiveQuery(() => roomsRepo.all(), [], []);
  const [room, setRoom] = useState(roomKind);
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');

  const needle = cabinetNameKey(query);
  const visible = items.filter(
    (i) =>
      i.group !== 'panel' &&
      (!room || i.rooms.includes(room)) &&
      (!group || i.group === group) &&
      (!needle || cabinetNameKey(i.name).includes(needle)),
  );

  const field = 'w-full rounded-lg border border-stone-300 bg-white p-2 text-sm';

  return (
    <aside className="desktop-library" aria-label="ספריית ארגזים">
      <h2 className="text-base font-semibold text-stone-800">ספריית ארגזים</h2>

      <label className="block text-xs text-stone-500">
        חיפוש
        <input className={field} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label className="block text-xs text-stone-500">
        חדר
        <select className={field} value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">כל החדרים</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-stone-500">
        מיקום
        <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">כל המיקומים</option>
          {(Object.keys(GROUP_LABELS) as CatalogGroup[])
            .filter((g) => g !== 'panel')
            .map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
        </select>
      </label>

      <p className="num text-xs text-stone-400">{visible.length} ארגזים</p>

      <div className="grid grid-cols-2 gap-2">
        {visible.map((item) => (
          <button
            key={item.id}
            onClick={() => onAdd(item)}
            aria-label={`הוספת ${item.name}`}
            className="flex flex-col items-center gap-1 rounded-xl border border-stone-200 bg-white p-2 text-center transition-colors hover:border-oak-400 hover:bg-oak-50"
          >
            <CabinetThumbnail item={item} className="h-14 w-full text-stone-500" />
            <span className="text-[11px] leading-tight font-medium text-stone-800">{item.name}</span>
            <span className="num text-[10px] text-stone-400">{cabinetSize(item)}</span>
            <ProductionGap item={itemSpec(item)} className="w-full" />
          </button>
        ))}
      </div>
    </aside>
  );
}
