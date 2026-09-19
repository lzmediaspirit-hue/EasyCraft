import {
  CORNER_START,
  MIN_BOX,
  baseSpans,
  layoutFor,
  runOf,
  type LayoutKind,
  type Placement,
  type Priority,
  type Proposal,
  type Score,
} from './autoPlan';
import { roomProfile, type Pick, type RoomProfile, type RoomWant } from './roomProfiles';
import type { PlanWall } from './plan';
import { promisedRole } from '../../catalog/roles';
import { featureDef, wallBlocks } from '../projects/wallFeatures';
import { ISLAND } from '../../catalog/kitchenRules';
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

/**
 * הרוחב שהיחידה תונח בו: מרשימת הרוחבים שלה, ובתוך המקום שנשמר לה.
 *
 * `capMm` הוא השטח שהוקצה לתפקיד הזה, ולא כל מה שנשאר על הקיר.
 * בלעדיו הבחירה חמדנית: בקיר חדר שינה ברוחב 1,400, ארון מדפים
 * שרוחביו 500 ו-900 לקח 900 — ואז לארון התלייה ברוחב 600 לא נשאר
 * מקום, וההצעה דיווחה "אין מקום" למרות ש-500 ועוד 600 נכנסים
 * ומשאירים 300 מ״מ פנויים.
 *
 * הרוחב הרחב ביותר שנכנס *בהקצאה* קודם; ורק אם אף אחד לא נכנס בה,
 * נבדק מה שנכנס במקום שנשאר בפועל — כי מוטב יחידה רחבה מכפי
 * שתוכננה מאשר קיר ריק.
 */
function widthIn(item: CatalogItem, pick: Pick, freeMm: number, capMm?: number): number | null {
  const options = [...new Set([item.defaultWidthMm, ...item.widthOptionsMm])]
    .filter((w) => w > 0)
    .sort((a, b) => b - a);
  const fits = (limit: number) => options.find((w) => w <= limit && w >= pick.minMm) ?? null;
  const cap = capMm == null ? freeMm : Math.min(capMm, freeMm);
  return fits(cap) ?? fits(freeMm);
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

/** דרישה שנתבקשה ולא נענתה, בשמה ובסיבתה. */
interface Unmet {
  want: RoomWant;
  why: string;
}

function queueFor(
  profile: RoomProfile,
  input: RoomInput,
  priority: Priority,
): { queue: Chosen[]; unmet: Unmet[] } {
  const queue: Chosen[] = [];
  const unmet: Unmet[] = [];
  /* יחידה נבחרת פעם אחת לחדר: אותו ארגז אינו גם התלייה וגם המדפים */
  const taken = new Set<string>();
  for (const want of profile.wants) {
    /* מה שלא נתבקש אינו חסר — זו בחירה של המשתמש ולא חוסר */
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
      /*
       * כל דרישה שלא נענתה נאמרת, גם כשהיא אינה מותנית באפשרות
       * במסך. עד כאן דווחו רק המותנות, ולכן אמבטיה שאין בספרייה
       * שלה ארגז כיור הציעה אחסון בלבד, בציון 100 וברשימת
       * ויתורים ריקה.
       */
      unmet.push({ want, why: 'אין בספרייה של החדר יחידה כזאת' });
      continue;
    }
    taken.add(item.id);
    queue.push({ want, item });
  }
  return { queue, unmet };
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
    /* ההקצאה אינה קטנה מהמינימום של התפקיד, אחרת שום רוחב לא ייכנס בה */
    const w = Math.max(c.want.pick.minMm, Math.min(c.want.pick.wantMm, left));
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

/** מה שכבר תפוס בחזית של קיר אחד: לרוחב, ולגובה. */
interface Taken {
  wallId: string;
  fromMm: number;
  toMm: number;
  bottomMm: number;
  topMm: number;
}

/** הגובה שיחידה מהספרייה מגיעה אליו, והגובה שהיא מתחילה בו. */
function bandOf(item: CatalogItem): { bottomMm: number; topMm: number } {
  const bottomMm = item.defaultYMm ?? 0;
  return { bottomMm, topMm: bottomMm + item.defaultHeightMm + (item.counterMm ?? 0) };
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
  const { queue, unmet } = queueFor(profile, input, priority);
  if (!queue.length && !unmet.length) return null;

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
      .map((c) => bandOf(c.item).topMm),
    1,
  );
  /*
   * המרווח שהקיר השני בפינה מתחיל ממנו הוא העומק שבאמת עומד שם.
   *
   * קבוע של 675 מ״מ נכון למטבח ולא לחדר ארונות: ארון בעומק 600
   * משאיר פינה חסרה, וארון רדוד גוזל מקום לחינם. העומק הגדול
   * שבין היחידות שנבחרו הוא מה שהפינה חייבת לפנות.
   */
  const deepest = Math.max(...queue.map((c) => c.item.defaultDepthMm), 0);
  const cornerStartMm = deepest > 0 ? deepest + CORNER_FILLER : CORNER_START;
  /*
   * חדר סגור: גם הקיר הראשון נפגש בפינה.
   *
   * הפינה נשמרה עד כאן רק מהקיר השני והלאה, מתוך הנחה שתחילת
   * הרצף היא קצה חופשי. בחדר מלבני סגור זה אינו נכון: הקיר
   * האחרון נפגש בקיר הראשון, ושם אף אחד לא שמר מקום. התוצאה
   * הייתה שני ארונות שחודרים זה לזה בפינת הסגירה, והפותר — בצדק
   * — פסל את כל שלוש ההצעות. בחדר שינה, שירות, אמבטיה, ארונות
   * ומשרד לא נשארה אף פריסה שאפשר להחיל.
   */
  const first = run[0];
  const last = run[run.length - 1];
  const closed =
    run.length > 2 &&
    Math.hypot(last.end.x - first.start.x, last.end.y - first.start.y) < 1;

  /*
   * הקטעים הפנויים, פעם אחת — גם החלוקה וגם ההנחה נשענות עליהם.
   *
   * הקיר הבא שומר לנו את הפינה, אבל רק כשהיא באמת פנויה: סימון
   * חוסם בתוך הרזרבה שלו הופך את הפינה לתפוסה, והשורה הזאת
   * עוצרת לפניה. בלי זה הארון האחרון בקיר עמד בפתח של הקיר הבא.
   */
  const cornerBusy = (wi: number): boolean => {
    const next = wi + 1 < run.length ? run[wi + 1] : closed ? run[0] : null;
    if (!corner || !next) return false;
    return next.wall.features.some(
      (f) => featureDef(f.kind).blocks && f.xMm < cornerStartMm,
    );
  };
  const areas = run.map((p, wi) => ({
    p,
    spans: baseSpans(
      p,
      corner && (wi > 0 || closed) ? cornerStartMm : 0,
      p.wall.lengthMm - (cornerBusy(wi) ? cornerStartMm : 0),
      topMm,
    ),
  }));
  const capacity = areas.reduce(
    (n, a) => n + a.spans.reduce((m, sp) => m + (sp.toMm - sp.fromMm), 0), 0,
  );

  /*
   * מה שכבר עומד, בגובה שהוא עומד בו.
   *
   * הרצפה והקיר תוכננו עד כאן בנפרד, שניהם מתחילת אותו קטע, מתוך
   * הנחה שארון תלוי יושב מעל התחתון. ההנחה נכונה למטבח ואינה
   * נכונה לחדר עם עמודה: ארון עליון שמתחיל ב-1,500 נכנס היישר
   * לתוך ארון בגדים בגובה 2,400. בחדר ילדים, בסלון ובחדר שירות
   * זה קרה על קיר חלק בלי מכשולים בכלל.
   */
  const taken: Taken[] = [];
  const free = (wallId: string, fromMm: number, w: number, band: { bottomMm: number; topMm: number }) =>
    !taken.some((t) =>
      t.wallId === wallId &&
      t.fromMm < fromMm + w && t.toMm > fromMm &&
      t.bottomMm < band.topMm && t.topMm > band.bottomMm);

  const placed = new Set<string>();
  const put = (list: Slot[], wallLevel: boolean) => {
    let queueLeft = [...list];
    for (const { p, spans } of areas) {
      for (const span of spans) {
        let at = span.fromMm;
        while (queueLeft.length && span.toMm - at >= MIN_BOX) {
          const i = queueLeft.findIndex(
            (sl) => widthIn(sl.chosen.item, sl.chosen.want.pick, span.toMm - at, sl.wantMm) !== null,
          );
          if (i < 0) break;
          const slot = queueLeft[i];
          const w = widthIn(slot.chosen.item, slot.chosen.want.pick, span.toMm - at, slot.wantMm)!;
          const band = bandOf(slot.chosen.item);
          /*
           * הסימונים שבקיר, מול הגובה שהיחידה הזאת באמת תופסת.
           *
           * עד כאן ארון תלוי נבדק מול גובה קבוע של 1,450 מ"מ ולא
           * מול עצמו, ולכן ארון מראה שמתחיל ב-1,900 נפסל בגלל
           * חלון שנגמר ב-1,900. הגובה של היחידה הוא מה שקובע.
           */
          if (wallBlocks(p.wall.features, at, w, band.bottomMm, band.topMm)) {
            at += wallLevel ? w : MIN_BOX;
            continue;
          }
          /* ואינו נכנס לתוך מה שכבר עומד שם בגובה הזה */
          if (!free(p.wall.id, at, w, band)) {
            at += MIN_BOX;
            continue;
          }
          queueLeft = [...queueLeft.slice(0, i), ...queueLeft.slice(i + 1)];
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
          taken.push({ wallId: p.wall.id, fromMm: at, toMm: at + w, ...band });
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

  /* ואי, כשנתבקש ויש לו מקום בחדר */
  const island = islandFor(profile, input, units);
  if (island) {
    if (island.place) {
      units.push(island.place);
      placed.add(island.label);
    } else {
      dropped.push(`${island.label} — ${island.why}`);
    }
  }

  if (!units.length) return null;

  /* מה שנתבקש ולא נכנס — בשמו, ולא בשתיקה */
  for (const c of queue) {
    if (!placed.has(c.want.label)) {
      dropped.push(`${c.want.label} — לא נשאר קיר פנוי ברוחב ${c.want.pick.minMm} מ"מ`);
    }
  }
  for (const u of unmet) dropped.push(`${u.want.label} — ${u.why}`);
  if (priority === 'economical') notes.push('בלי יחידות עליונות — הגרסה החסכונית');

  return {
    key: `${profile.room}-${layout}-${priority}`,
    layout,
    priority,
    title: PRIORITY_NAMES[priority],
    layoutName: layoutName(layout, run.length, closed),
    units,
    dropped: [...new Set(dropped)],
    notes: [...new Set(notes)],
    score: scoreRoom(units, queue, unmet, placed, input.plan),
  };
}

/** לוח הסתימה שבין שתי שורות שנפגשות בפינה. */
const CORNER_FILLER = 75;

/**
 * האי שבאמצע החדר, כשהחדר ביקש אותו.
 *
 * האפשרות "אי מגירות" בחדר ארונות הייתה קיימת במסך ולא עשתה דבר:
 * חמישה סבבים נתנו בדיוק אותן יחידות בין מסומן ללא מסומן. כאן
 * היא מיושמת — מתבנית האי שבספרייה, עם בדיקת מעבר סביבו — או
 * נאמרת כמה שלא נכנס. אפשרות שאינה עושה דבר גרועה מאפשרות שאין.
 */
function islandFor(
  profile: RoomProfile,
  input: RoomInput,
  units: Placement[],
): { label: string; place?: Placement; why: string } | null {
  const option = profile.options.find((o) => o.key === 'island');
  if (!option || !input.options.island) return null;
  const label = option.label;

  const item = input.items.find((i) => i.island);
  if (!item) return { label, why: 'אין בספרייה תבנית אי' };

  /*
   * החדר עצמו: התיבה שהקירות תוחמים. האי עומד במרכזה, ומה שנדרש
   * הוא מעבר מכל צדדיו — גם מהקירות וגם ממה שכבר עומד עליהם.
   */
  const pts = input.plan.flatMap((p) => [p.start, p.end]);
  if (pts.length < 3) return { label, why: 'אין מספיק קירות כדי למדוד מעבר' };
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const roomW = Math.max(...xs) - Math.min(...xs);
  const roomD = Math.max(...ys) - Math.min(...ys);

  /* העומק שכבר תפוס לאורך הקירות, משני הצדדים */
  const deepest = Math.max(
    ...units.map((u) => input.items.find((i) => i.id === u.catalogKey)?.defaultDepthMm ?? 0),
    0,
  );
  const freeW = roomW - 2 * deepest;
  const freeD = roomD - 2 * deepest;
  const needW = item.defaultWidthMm + 2 * ISLAND_AISLE;
  const needD = item.defaultDepthMm + 2 * ISLAND_AISLE;
  if (freeW < needW || freeD < needD) {
    return {
      label,
      why: `אין מעבר של ${ISLAND_AISLE} מ"מ סביבו — נדרש חלל של ${Math.round(needW)}×${Math.round(needD)} מ"מ`,
    };
  }

  return {
    label,
    why: '',
    place: {
      catalogKey: item.id,
      wallId: input.plan[0].wall.id,
      xMm: 0,
      widthMm: item.defaultWidthMm,
      level: item.level,
      role: 'island',
      free: {
        xMm: (Math.min(...xs) + Math.max(...xs)) / 2,
        zMm: (Math.min(...ys) + Math.max(...ys)) / 2,
        headingDeg: input.plan[0].headingDeg,
      },
    },
  };
}

/** המעבר שחייב להישאר סביב אי, מכל צדדיו. */
const ISLAND_AISLE = ISLAND.clearMm;

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
 * שם הפריסה לפי מה שבאמת נבנה, ולא לפי סוג הפריסה בלבד.
 *
 * `u` נקרא "שלושה קירות", אבל הוא רץ על כל קיר שימושי שיש. בחדר
 * מלבני סגור הוא רץ על ארבעה, והכותרת שיקרה למי שקרא אותה.
 */
const WALL_COUNT_NAMES = ['', 'קיר אחד', 'שני קירות', 'שלושה קירות', 'ארבעה קירות'];

function layoutName(layout: LayoutKind, walls: number, closed: boolean): string {
  if (layout !== 'u') return LAYOUT_NAMES[layout];
  if (closed) return 'סביב החדר';
  return WALL_COUNT_NAMES[walls] ?? `${walls} קירות`;
}

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
  unmet: Unmet[],
  placed: Set<string>,
  plan: PlanWall[],
): Score {
  const floor = units.filter((u) => u.level !== 'wall');
  const runMm = floor.reduce((n, u) => n + u.widthMm, 0);
  const wallMm = plan.reduce((n, p) => n + p.wall.lengthMm, 0);
  /*
   * החסרים הם שניים: מה שנבחר ולא נכנס, ומה שאין לו בכלל יחידה
   * בספרייה. השני נמחק כאן בשקט, ולכן אמבטיה בלי ארגז כיור קיבלה
   * 100. דרישה שנתבקשה נספרת גם כשלא נמצא לה מועמד.
   */
  const asked = queue.length + unmet.length;
  const missing = queue.filter((c) => !placed.has(c.want.label)).length + unmet.length;
  const covered = wallMm > 0 ? Math.min(runMm / wallMm, 1) : 0;
  const answered = asked ? (asked - missing) / asked : 0;
  /*
   * ותפקיד בסיסי שחסר אינו עוד נקודה פחות: אמבטיה בלי כיור אינה
   * אמבטיה טובה ב-80%. התקרה יורדת לחצי כל עוד הוא חסר.
   */
  const lostEssential =
    unmet.some((u) => u.want.essential) ||
    queue.some((c) => c.want.essential && !placed.has(c.want.label));
  const total = Math.round(60 * answered + 40 * covered);
  return {
    triangle: 0,
    prepMm: 0,
    runMm,
    boxes: units.length,
    missing,
    total: lostEssential ? Math.min(total, 50) : total,
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
