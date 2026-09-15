import { liveQuery } from 'dexie';

import { db } from '../db/db';
import { CUSTOM_ROOM, type CatalogGroup, type Room, type RoomKind } from '../db/types';
import { CUSTOM_ROOM_DEF, SEED_ROOMS, type SeedRoom } from './rooms';

/**
 * החדרים — נתונים, לא רשימה בקוד.
 *
 * הרבה מסכים שואלים "איך קוראים לחדר הזה" בתוך ציור, ולא במקום
 * שאפשר להמתין בו לבסיס הנתונים. לכן מוחזק כאן צילום מצב מעודכן
 * של הטבלה, ו-`roomDef` עונה ממנו מיד. ההרשמה נפתחת בזריעה ומכאן
 * הצילום מתעדכן בכל שינוי — כולל שינוי שנעשה בלשונית אחרת.
 */
let snapshot: Room[] = [];

/** החדרים הגלויים, לפי הסדר. */
export function rooms(): Room[] {
  return snapshot;
}

/**
 * הגדרת חדר לפי מזהה.
 *
 * חדר שנמחק אחרי שנפתח בו פרויקט אינו נמצא כאן, ולכן התשובה
 * האחרונה היא "חדר בהגדרה אישית" — הפרויקט שומר את שמו בעצמו
 * וממשיך להיפתח כרגיל.
 */
export function roomDef(kind: RoomKind): SeedRoom {
  if (kind === CUSTOM_ROOM) return CUSTOM_ROOM_DEF;
  return snapshot.find((r) => r.id === kind) ?? SEED_ROOMS.find((r) => r.id === kind) ?? CUSTOM_ROOM_DEF;
}

let seeding: Promise<void> | null = null;

export function seedRooms(): Promise<void> {
  seeding ??= runSeed();
  return seeding;
}

async function runSeed(): Promise<void> {
  const now = Date.now();
  /*
   * זריעה רק לטבלה ריקה, כמו בספריית הארגזים: מי שמחק חדר שהגיע
   * עם האפליקציה לא אמור למצוא אותו שוב בפתיחה הבאה.
   */
  if (!(await db.rooms.count())) {
    await db.rooms.bulkPut(SEED_ROOMS.map((r) => ({ ...r, createdAt: now, updatedAt: now })));
  }
  await new Promise<void>((done) => {
    let first = true;
    liveQuery(() => db.rooms.toArray()).subscribe((rows) => {
      snapshot = rows.filter((r) => !r.hiddenAt).sort((a, b) => a.sortOrder - b.sortOrder);
      if (first) {
        first = false;
        done();
      }
    });
  });
}

export const roomsRepo = {
  /** כל החדרים הגלויים, לפי הסדר. */
  async all(): Promise<Room[]> {
    const rows = await db.rooms.toArray();
    return rows.filter((r) => !r.hiddenAt).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async add(input: {
    label: string;
    hint?: string;
    icon?: string;
    groups?: CatalogGroup[];
  }): Promise<string> {
    const now = Date.now();
    const id = crypto.randomUUID();
    const top = (await db.rooms.toArray()).reduce((n, r) => Math.max(n, r.sortOrder), 0);
    await db.rooms.add({
      id,
      label: input.label.trim(),
      hint: input.hint?.trim() || '',
      icon: input.icon || 'custom',
      groups: input.groups?.length ? input.groups : CUSTOM_ROOM_DEF.groups,
      sortOrder: top + 10,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async update(id: string, patch: Partial<Omit<Room, 'id'>>): Promise<void> {
    await db.rooms.update(id, { ...patch, updatedAt: Date.now() });
  },

  /**
   * הסרת חדר.
   *
   * חדר שהגיע עם האפליקציה רק יורד מהרשימות ואפשר להחזיר אותו;
   * חדר שהמשתמש הוסיף נמחק. בשני המקרים ארגזים שסומנו לחדר הזה
   * אינם נמחקים — הם פשוט מפסיקים להופיע תחתיו.
   */
  async remove(id: string): Promise<void> {
    const room = await db.rooms.get(id);
    if (!room) return;
    if (room.isBuiltin) await db.rooms.update(id, { hiddenAt: Date.now() });
    else await db.rooms.delete(id);
  },

  /** מה שהוסר, כדי שאפשר יהיה להחזיר. */
  async hidden(): Promise<Room[]> {
    return (await db.rooms.toArray()).filter((r) => r.hiddenAt);
  },

  async restore(id: string): Promise<void> {
    await db.rooms.update(id, { hiddenAt: undefined, updatedAt: Date.now() });
  },
};
