import {
  CORNER_START,
  MIN_BOX,
  baseSpans,
  layoutFor,
  runOf,
  upperBlocked,
  type LayoutKind,
  type Placement,
  type Priority,
  type Proposal,
  type Score,
} from './autoPlan';
import { roomProfile, type Pick, type RoomProfile, type RoomWant } from './roomProfiles';
import type { PlanWall } from './plan';
import { promisedRole } from '../../catalog/roles';
import type { CatalogItem, RoomKind, Wall } from '../../db/types';

/**
 * תכנון אוטומטי לחדר שאינו מטבח.
 *
 * המנוע של המטבח בנוי סביב משולש עבודה ומכשירי חשמל, ואלה אינם
 * קיימים בחדר ארונות או במשרד. מה שכן משותף: קיר, פתחים, ורצף
 * יחידות שממלאות אותו לפי סדר חשיבות.
 *
 * ההבדל הגדול מהמטבח: כאן אין מפתחות של ארגזי תקן. כל יחידה
 * נבחרת מהספרייה של הנגרייה לפי מה שהיא *עושה* — האיור שהנגר בחר
 * לה — ומה שנשמר הוא המזהה של הפריט עצמו. כך ארון התלייה שהנגר
 * בנה הוא זה שנכנס להצעה, ולא העתק שלו.
 */

export interface RoomInput {
  room: RoomKind;
  walls: Wall[];
  plan: PlanWall[];
  /** הספרייה של הנגרייה — רק ממנה נבחרים ארגזים */
  items: CatalogItem[];
  /** מה שסומן במסך, לפי מפתחות הפרופיל */
  options: Record<string, boolean>;
}

/** יחידה שנבחרה בפועל: מה רצינו, ומה נמצא. */
interface Chosen {
  want: RoomWant;
  item: CatalogItem;
}

/**
 * הפריט בספרייה שממלא את התפקיד.
 *
 * האיור קודם לכול — הוא ההצהרה של הנגר על מה שהארגז עושה. אחריו
 * המפלס, ואז קרבת הרוחב. פריט שאינו מצהיר על היכולת אינו נבחר
 * בכלל: ארון מדפים אינו ארון תלייה גם אם הוא באותו גובה.
 */
function choose(
  items: CatalogItem[],
  pick: Pick,
  taken: Set<string>,
  special: boolean,
  repeat: boolean,
): CatalogItem | undefined {
  const fits = items.filter((i) => {
    if (i.level !== pick.level) return false;
    if (pick.group && i.group !== pick.group) return false;
    if (pick.glyphs && !pick.glyphs.includes(i.glyph)) return false;
    /* יחידה שכבר מילאה תפקיד אחר אינה ממלאת גם את זה */
    if (taken.has(i.id)) return false;
    /*
     * ארון מילוי אינו ארון כיור.
     *
     * "ארון כיור מגירות" מצויר כמגירות, ולכן הוא התאים למילוי
     * הכללי — ובאמבטיה יצאו שלושה ארונות כיור על קיר אחד. תפקיד
     * כללי אינו לוקח יחידה שהשם שלה מבטיח מכשיר או שירות; תפקיד
     * שמבקש אותם במפורש כן.
     */
    if (!special && promisedRole(i.name)) return false;
    return true;
  });
  if (!fits.length) return undefined;
  /* מה שהאיור הראשון ברשימה מתאר עדיף — הרשימה מסודרת לפי העדפה */
  const rank = (i: CatalogItem) => pick.glyphs?.indexOf(i.glyph) ?? 0;
  return [...fits].sort((a, b) => {
    const byGlyph = rank(a) - rank(b);
    if (byGlyph) return byGlyph;
    /* ואז מה שהנגר סימן כנפוץ, ואז מה שקרוב לרוחב המבוקש */
    const byCommon = Number(!!b.common) - Number(!!a.common);
    if (byCommon) return byCommon;
    /*
     * ארון תלוי שחוזר לאורך הקיר הוא הרדוד שבהם.
     *
     * "ארון מעל מכונת כביסה" עמוק 600 מ״מ כי הוא יושב מעל מכונה,
     * ושישה כאלה לאורך הקיר בולטים אל תוך החדר. הכלל הזה נכון
     * לתלוי בלבד: ארון תחתון שחוזר צריך דווקא את עומק הקו, ושם
     * קרבת הרוחב היא שמכריעה.
     */
    if (repeat && pick.level === 'wall' && a.defaultDepthMm !== b.defaultDepthMm) {
      return a.defaultDepthMm - b.defaultDepthMm;
    }
    return (
      Math.abs(a.defaultWidthMm - pick.wantMm) - Math.abs(b.defaultWidthMm - pick.wantMm)
    );
  })[0];
}

/** הרוחב שהיחידה תונח בו: מרשימת הרוחבים שלה, ובתוך מה שנשאר. */
function widthIn(item: CatalogItem, pick: Pick, freeMm: number): number | null {
  const options = [...new Set([item.defaultWidthMm, ...item.widthOptionsMm])]
    .filter((w) => w > 0)
    .sort((a, b) => b - a);
  /* הרחב ביותר שנכנס, ולא צר מהמינימום של התפקיד */
  const fit = options.find((w) => w <= freeMm && w >= pick.minMm);
  if (fit) return fit;
  /* ואם אף רוחב תקן אינו נכנס — היחידה אינה נכנסת כאן */
  return null;
}

/**
 * הרצף שהחדר נבנה ממנו, אחרי שסוננו מה שלא נתבקש ומה שאין בספרייה.
 *
 * מה שנתבקש ואין לו פריט אינו מדולג בשקט — הוא חוזר ברשימת
 * "לא נכנס" עם הסיבה.
 */
/** האיורים שמצהירים על יכולת, ולכן אינם חומר מילוי. */
const SPECIAL_GLYPHS = [
  'sink', 'mirror', 'hang', 'hangDouble', 'shoes', 'glass', 'open',
  'shelves', 'innerDrawers', 'lShape',
];

function queueFor(
  profile: RoomProfile,
  input: RoomInput,
  priority: Priority,
  dropped: string[],
): Chosen[] {
  const out: Chosen[] = [];
  /* יחידה נבחרת פעם אחת לחדר: אותו ארגז אינו גם התלייה וגם המדפים */
  const taken = new Set<string>();
  for (const want of profile.wants) {
    if (want.needs && !input.options[want.needs]) continue;
    if (want.skipWhenPlain && priority === 'economical') continue;
    /*
     * תפקיד "מיוחד" הוא כזה שמבקש יכולת מוצהרת — כיור, מראה,
     * תלייה, נעליים. תפקיד כללי הוא מילוי, והוא אינו רשאי לקחת
     * יחידה מיוחדת.
     */
    const special = SPECIAL_GLYPHS.some((g) => want.pick.glyphs?.includes(g));
    const item = choose(input.items, want.pick, taken, special, !!want.repeat);
    if (!item) {
      if (want.needs) dropped.push(`${want.label} — אין בספרייה של החדר יחידה כזאת`);
      continue;
    }
    taken.add(item.id);
    out.push({ want, item });
  }
  return out;
}

/** יחידה אחת שמחכה למקום: מה נבחר, ובאיזה רוחב היא מבקשת לשבת. */
interface Slot {
  chosen: Chosen;
  wantMm: number;
}

/**
 * מחלק את הקיר בין התפקידים לפני שמניחים ארגז אחד.
 *
 * בלי זה המילוי חמדן: יחידת התלייה חוזרת על עצמה עד שנגמר הקיר,
 * וחדר הארונות יוצא בלי מדפים, בלי מגירות ובלי נעליים — כולם
 * ברשימת "לא נכנס", כולם בגלל הראשון בתור. קודם כל תפקיד מקבל
 * מקום אחד, ורק מה שנשאר מתחלק בין החוזרים.
 */
function slotsFor(queue: Chosen[], capacityMm: number): Slot[] {
  const once = queue.filter((c) => !c.want.repeat);
  const many = queue.filter((c) => c.want.repeat);

  /* שמורה: הרוחב המזערי של כל תפקיד שאינו חוזר */
  let left = capacityMm;
  const out: Slot[] = [];
  for (const c of once) {
    if (left < c.want.pick.minMm) continue;
    const w = Math.min(c.want.pick.wantMm, left);
    out.push({ chosen: c, wantMm: w });
    left -= w;
  }

  /*
   * ומה שנשאר מתחלק בין החוזרים בסבב: שני תפקידים חוזרים אינם
   * "הראשון לוקח הכול" אלא אחד־אחד, עד שאין מקום לאף אחד.
   */
  let guard = 0;
  while (many.length && guard < 80) {
    const before = left;
    for (const c of many) {
      if (left < c.want.pick.minMm) continue;
      const w = Math.min(c.want.pick.wantMm, left);
      out.push({ chosen: c, wantMm: w });
      left -= w;
      guard++;
    }
    if (left === before) break;
  }
  return out;
}

function buildRoomProposal(
  profile: RoomProfile,
  input: RoomInput,
  layout: LayoutKind,
  priority: Priority,
): Proposal | null {
  const run = runOf(input.plan, layout);
  if (!run.length) return null;

  const units: Placement[] = [];
  const dropped: string[] = [];
  const notes: string[] = [];
  const queue = queueFor(profile, input, priority, dropped);
  if (!queue.length) return null;

  const corner = layout === 'l' || layout === 'u';
  /*
   * הגובה שהיחידות מגיעות אליו — הגבוהה שבהן.
   *
   * ארון בגדים בגובה 2.4 מטר אינו עובר מתחת לחלון, גם כשהחלון
   * גבוה. החישוב שמרני במכוון: הצעה שחוצה חלון נפסלת ממילא
   * בפתירה, ועדיף להציע נכון מאשר להציע ולהיפסל.
   */
  const topMm = Math.max(
    ...queue
      .filter((c) => c.item.level !== 'wall')
      .map((c) => (c.item.defaultYMm ?? 0) + c.item.defaultHeightMm),
    1,
  );
  /* הקטעים הפנויים, פעם אחת — גם החלוקה וגם ההנחה נשענות עליהם */
  const areas = run.map((p, wi) => ({
    p,
    spans: baseSpans(p, corner && wi > 0 ? CORNER_START : 0, p.wall.lengthMm, topMm),
  }));
  const capacity = areas.reduce(
    (n, a) => n + a.spans.reduce((m, sp) => m + (sp.toMm - sp.fromMm), 0), 0,
  );

  /*
   * הרצפה והקיר אינם מתחרים על אותו מקום: ארון תלוי יושב מעל
   * התחתון, ולכן לכל מפלס חלוקה משלו על אותו אורך קיר.
   */
  const placed = new Set<string>();
  const put = (list: Slot[], wallLevel: boolean) => {
    let queueLeft = [...list];
    for (const { p, spans } of areas) {
      for (const span of spans) {
        let at = span.fromMm;
        while (queueLeft.length && span.toMm - at >= MIN_BOX) {
          const i = queueLeft.findIndex(
            (sl) => widthIn(sl.chosen.item, sl.chosen.want.pick, span.toMm - at) !== null,
          );
          if (i < 0) break;
          const slot = queueLeft[i];
          queueLeft = [...queueLeft.slice(0, i), ...queueLeft.slice(i + 1)];
          const w = widthIn(slot.chosen.item, slot.chosen.want.pick, span.toMm - at)!;
          /* ארון תלוי אינו נכנס לתוך חלון; תחתונים כבר סוננו ב-`baseSpans` */
          if (wallLevel && upperBlocked(p.wall, at, w)) {
            at += w;
            continue;
          }
          units.push({
            /*
             * המזהה של הפריט עצמו, ולא מפתח של ארגז תקן: הפתירה
             * מוצאת אותו ישירות, בלי לנחש מה דומה לו.
             */
            catalogKey: slot.chosen.item.id,
            wallId: p.wall.id,
            xMm: Math.round(at),
            widthMm: w,
            level: slot.chosen.item.level,
            role: slot.chosen.want.role,
          });
          placed.add(slot.chosen.want.label);
          at += w;
        }
      }
    }
  };

  const onFloor = queue.filter((c) => c.item.level !== 'wall');
  const onWall = queue.filter((c) => c.item.level === 'wall');
  put(slotsFor(onFloor, capacity), false);
  put(slotsFor(onWall, capacity), true);

  if (!units.length) return null;

  /* מה שנתבקש ולא נכנס — בשמו, ולא בשתיקה */
  for (const c of queue) {
    if (!placed.has(c.want.label)) {
      dropped.push(`${c.want.label} — לא נשאר קיר פנוי ברוחב ${c.want.pick.minMm} מ"מ`);
    }
  }
  if (priority === 'economical') notes.push('בלי יחידות עליונות — הגרסה החסכונית');

  return {
    key: `${profile.room}-${layout}-${priority}`,
    layout,
    priority,
    title: PRIORITY_NAMES[priority],
    layoutName: LAYOUT_NAMES[layout],
    units,
    dropped: [...new Set(dropped)],
    notes: [...new Set(notes)],
    score: scoreRoom(units, queue, placed, input.plan),
  };
}

const PRIORITY_NAMES: Record<Priority, string> = {
  ergonomic: 'נוח לשימוש',
  storage: 'מקסימום אחסון',
  economical: 'חסכוני',
};

const LAYOUT_NAMES: Record<LayoutKind, string> = {
  single: 'קיר אחד',
  galley: 'שני קירות',
  l: 'פינה',
  u: 'שלושה קירות',
};

/**
 * הניקוד של חדר שאינו מטבח.
 *
 * אין כאן משולש עבודה ואין משטח הכנה — יש קיר, ומה שממלא אותו.
 * שני דברים נמדדים: כמה מהתפקידים שנתבקשו באמת נכנסו, וכמה
 * מהקיר נוצל. השדות של המטבח נשארים אפס במכוון: מספר שאינו
 * נמדד כאן לא יוצג כאילו נמדד.
 */
function scoreRoom(
  units: Placement[],
  queue: Chosen[],
  placed: Set<string>,
  plan: PlanWall[],
): Score {
  const floor = units.filter((u) => u.level !== 'wall');
  const runMm = floor.reduce((n, u) => n + u.widthMm, 0);
  const wallMm = plan.reduce((n, p) => n + p.wall.lengthMm, 0);
  const missing = queue.filter((c) => !placed.has(c.want.label)).length;
  const covered = wallMm > 0 ? Math.min(runMm / wallMm, 1) : 0;
  const answered = queue.length ? (queue.length - missing) / queue.length : 0;
  return {
    triangle: 0,
    prepMm: 0,
    runMm,
    boxes: units.length,
    missing,
    total: Math.round(60 * answered + 40 * covered),
  };
}

/** כל ההצעות לחדר, מהטובה לפחות. */
export function planRoom(input: RoomInput): Proposal[] {
  const profile = roomProfile(input.room);
  if (!profile) return [];
  const layout = layoutFor(input.plan);
  if (!layout) return [];
  const out: Proposal[] = [];
  const seen = new Map<string, Proposal>();
  for (const priority of ['ergonomic', 'storage', 'economical'] as const) {
    const p = buildRoomProposal(profile, input, layout, priority);
    if (!p) continue;
    const sig = p.units.map((u) => `${u.catalogKey}|${u.wallId}|${u.xMm}|${u.widthMm}`).sort().join(';');
    const twin = seen.get(sig);
    if (twin) p.notes.push(`אותה פריסה כמו "${twin.title}"`);
    else seen.set(sig, p);
    out.push(p);
  }
  return out;
}

/** שם היחידה בהצעה של חדר — מהספרייה, כי משם היא נבחרה. */
export function roomPlacementName(p: Placement, items: CatalogItem[]): string {
  return items.find((i) => i.id === p.catalogKey)?.name ?? 'ארגז';
}
