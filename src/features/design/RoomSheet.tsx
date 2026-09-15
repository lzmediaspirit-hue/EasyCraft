import { useState } from 'react';

import { GROUP_LABELS } from '../../catalog/rooms';
import { roomsRepo } from '../../catalog/roomsRepo';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { ROOM_ICONS, TrashIcon, roomIcon } from '../../ui/icons';
import type { CatalogGroup, Room } from '../../db/types';

const GROUPS: CatalogGroup[] = ['base', 'upper', 'tall', 'storage', 'panel'];

/**
 * חדר חדש בספרייה, או עריכת חדר קיים.
 *
 * חדר הוא מגירה בספרייה: הוא קובע אילו ארגזים מוצעים ובאיזה סדר
 * הכרטיסיות מופיעות. נגר שעובד גם על חדר שירות, משרד או ממ״ד
 * מוסיף אותו כאן, ומאותו רגע הוא חדר לכל דבר — באשף הפרויקט,
 * בסימון הארגזים ובספרייה.
 */
export function RoomSheet({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const [label, setLabel] = useState(room?.label ?? '');
  const [hint, setHint] = useState(room?.hint ?? '');
  const [icon, setIcon] = useState(room?.icon ?? 'custom');
  const [groups, setGroups] = useState<CatalogGroup[]>(room?.groups ?? GROUPS);

  const canSave = label.trim().length > 0 && groups.length > 0;

  async function save() {
    if (room) await roomsRepo.update(room.id, { label: label.trim(), hint: hint.trim(), icon, groups });
    else await roomsRepo.add({ label, hint, icon, groups });
    onClose();
  }

  /*
   * הסרה. חדר שהגיע עם האפליקציה רק יורד מהרשימות, וחדר שהנגר
   * הוסיף נמחק. בשני המקרים ארגזים ופרויקטים אינם נפגעים.
   */
  async function remove() {
    if (!room) return;
    await roomsRepo.remove(room.id);
    onClose();
  }

  return (
    <Sheet
      title={room ? 'עריכת חדר' : 'חדר חדש'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {room && (
            <button
              onClick={remove}
              aria-label="הסרת החדר"
              className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon />
            </button>
          )}
          <div className="flex-1">
            <PrimaryButton disabled={!canSave} onClick={save}>
              שמירה
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="שם החדר" hint="למשל: חדר שירות">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
          />
        </Field>

        <Field label="שורת הסבר" hint="לא חובה">
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            onFocus={selectOnFocus}
            placeholder="מה יש בחדר הזה"
            className={inputClass}
          />
        </Field>

        <Field group label="אייקון">
          <div className="flex flex-wrap gap-2">
            {Object.keys(ROOM_ICONS).map((key) => {
              const Icon = roomIcon(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={`אייקון ${key}`}
                  aria-pressed={key === icon}
                  className={`rounded-2xl border p-2.5 transition-colors ${
                    key === icon
                      ? 'border-oak-600 bg-oak-50 text-oak-700'
                      : 'border-stone-200 text-stone-400 hover:border-oak-300'
                  }`}
                >
                  <Icon className="size-7" />
                </button>
              );
            })}
          </div>
        </Field>

        {/*
          הכרטיסיות של החדר, לפי הסדר שבו לוחצים עליהן — הראשונה
          היא מה שנפתח כשנכנסים לספרייה של החדר.
        */}
        <Field group label="כרטיסיות בספרייה" hint="הראשונה נפתחת">
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <Chip
                key={g}
                active={groups.includes(g)}
                onClick={() =>
                  setGroups((prev) =>
                    prev.includes(g) ? prev.filter((k) => k !== g) : [...prev, g],
                  )
                }
              >
                {GROUP_LABELS[g]}
              </Chip>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
