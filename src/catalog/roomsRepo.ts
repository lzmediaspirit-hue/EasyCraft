import { liveQuery } from 'dexie';

import { db } from '../db/db';
import { CUSTOM_ROOM, type CatalogGroup, type Room, type RoomKind } from '../db/types';
import { CUSTOM_ROOM_DEF, ROOMS_GENERATION, SEED_ROOMS, type SeedRoom } from './rooms';
import { allMine, eraseIds, mine, onlyMine, owned, patchRow } from '../db/rows';
import { settingsRepo } from '../materials/materialsRepo';
import { workshopId } from '../db/workshop';

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

/**
 * לפי איזה פרופיל מתוכנן החדר הזה.
 *
 * `plannerProfile` גובר, ואחריו המזהה עצמו. כך חדר מיובא במזהה
 * UUID עדיין מתוכנן כאמבטיה, וחדר שהנגר הוסיף יכול להצביע על
 * פרופיל קיים — בלי שאף אחד מהם יאבד את זהותו ואת הארגזים שלו.
 */
export function roomPlanKey(kind: RoomKind | undefined): RoomKind | undefined {
  if (!kind) return undefined;
  const room = snapshot.find((r) => r.id === kind);
  return room?.plannerProfile ?? kind;
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
  if (!(await allMine(db.rooms)).length) {
    await db.rooms.bulkPut(SEED_ROOMS.map((r) => ({ ...r, ...owned(), createdAt: now, updatedAt: now })));
  }
  await new Promise<void>((done) => {
    let first = true;
    liveQuery(() => db.rooms.toArray()).subscribe((all) => {
      /* הרשימה החיה רואה את הטבלה כולה, והמסך רואה את הנגרייה */
      snapshot = onlyMine(all)
        .filter((r) => !r.hiddenAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (first) {
        first = false;
        done();
      }
    });
  });
}

/**
 * חדרים מובנים שנוספו אחרי ההתקנה.
 *
 * הזריעה רצה פעם אחת בטבלה ריקה, ולכן מי שהתקין כשהיו ארבעה
 * חדרים — מטבח, סלון, חדר שינה וחדר שירות — נשאר איתם לתמיד.
 * חמשת החדרים שנוספו מאוחר יותר לא הגיעו אליו, והארגזים ששויכו
 * אליהם לא הופיעו בשום רשימה: הספרייה מציגה ארגזים דרך כרטיס
 * חדר, וחדר שאינו קיים אינו מציג דבר.
 *
 * שדרוג ממוקד, כמו במוצרי המערכת: רק חדר מובנה שהדור שלו חדש
 * מהדור שהנגרייה קיבלה, ורק כזה שמעולם לא היה כאן. שני דברים
 * שהוא אינו עושה — הוא אינו דורס חדר קיים, ואינו מחזיר חדר
 * שנמחק בכוונה.
 */
let adding: Promise<number> | null = null;

export function addBuiltinRooms(): Promise<number> {
  /*
   * פעם אחת להרצה. `App` נטען פעמיים במצב הפיתוח של React, ושתי
   * קריאות במקביל ראו את אותם חדרים חסרים ושתיהן הוסיפו אותם —
   * השנייה נפלה על מפתח כפול.
   */
  adding ??= runAdd();
  return adding;
}

async function runAdd(): Promise<number> {
  const settings = await settingsRepo.get();
  if ((settings.roomsGeneration ?? 0) >= ROOMS_GENERATION) return 0;

  const marks = await db.tombstones
    .where('[workshopId+table]')
    .equals([workshopId(), 'rooms'])
    .toArray();
  const erased = new Set(marks.map((m) => m.rowId));

  const now = Date.now();
  /*
   * הקריאה והכתיבה בטרנזקציה אחת: בין "מה חסר" לבין "הוסף" אסור
   * שמישהו אחר יוסיף. חדר מוסתר קיים בטבלה, ולכן הוא אינו חסר —
   * הוא הוסר במפורש, וזו תשובה.
   */
  const added = await db.transaction('rw', db.rooms, async () => {
    const here = new Set((await allMine(db.rooms)).map((r) => r.id));
    const missing = SEED_ROOMS.filter((r) => !here.has(r.id) && !erased.has(r.id)).map((r) => ({
      ...r,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    }));
    if (missing.length) await db.rooms.bulkAdd(missing);
    return missing.length;
  });
  await settingsRepo.save({ roomsGeneration: ROOMS_GENERATION });
  return added;
}

export const roomsRepo = {
  /** כל החדרים הגלויים, לפי הסדר. */
  async all(): Promise<Room[]> {
    const rows = await allMine(db.rooms);
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
    const top = (await allMine(db.rooms)).reduce((n, r) => Math.max(n, r.sortOrder), 0);
    await db.rooms.add({
      id,
      label: input.label.trim(),
      /* תיאור שלא מולא אינו נשמר כמחרוזת ריקה אלא לא נשמר */
      ...(input.hint?.trim() ? { hint: input.hint.trim() } : {}),
      icon: input.icon || 'custom',
      groups: input.groups?.length ? input.groups : CUSTOM_ROOM_DEF.groups,
      sortOrder: top + 10,
      isBuiltin: false,
      ...owned(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async update(id: string, patch: Partial<Omit<Room, 'id'>>): Promise<void> {
    await patchRow(db.rooms, id, patch);
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
    if (room && !mine(room)) return;
    if (!room) return;
    if (room.isBuiltin) await patchRow(db.rooms, id, { hiddenAt: Date.now() });
    else await eraseIds(db.rooms, [id]);
  },

  /** מה שהוסר, כדי שאפשר יהיה להחזיר. */
  async hidden(): Promise<Room[]> {
    return (await allMine(db.rooms)).filter((r) => r.hiddenAt);
  },

  async restore(id: string): Promise<void> {
    await patchRow(db.rooms, id, { hiddenAt: undefined });
  },
};
