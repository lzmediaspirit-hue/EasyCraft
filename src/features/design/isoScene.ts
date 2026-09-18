import { blindSide, blindWidthMm, shelfFaceOffsets, unitFronts, unitZones, zoneBands, zoneClearBand, zoneColumns } from '../../catalog/zones';
import { clamp } from '../../ui/units';
import { glyphDef } from '../../catalog/glyphList';
import { shade } from '../../ui/color';
import { MATERIAL } from '../../catalog/standards';
import { buildPlan } from './plan';
import { outOfSight } from './designView';
import { wallName } from '../projects/wallLayouts';
import { featureBiteMm, featureDef } from '../projects/wallFeatures';
import {
  WALL_MM,
  frameOf,
  framePoint,
  orderSolids,
  projector,
  roomFloor,
  slab,
  solidFaces,
} from './isoMath';

import { COUNTER_OVERHANG_MM, unitBox, unitFrame, wallAxes } from './placement';
import { APPLIANCES, applianceOf } from '../../catalog/appliances';
import type { UnitBox } from './placement';
import type { PlanWall } from './plan';
import type { Face, Frame, IsoView, Solid, Tf } from './isoMath';
import { RAIL_WIDTH_MM, slabThicknessMm } from '../../db/types';
import { WORK_TONES, tracksWork, workTone } from '../../workflow/unitWork';
import { partChoice, partThicknessMm } from '../../costing/boards';
import type { PartSettings } from '../../costing/boards';
import type { PartRole, PlacedUnit, Project, Wall } from '../../db/types';


/** גוון הזכוכית — מה שרואים דרכו נשאר קר וכחלחל, כמו זכוכית אמיתית. */
const GLASS_TONE = '#dbeafe';
/** פס לד: גוון ענבר, ועובי שנראה מרחוק בלי לתפוס מקום. */
const LED_TONE = '#f59e0b';
const LED_MM = 16;
/** ידית: מוט דק על החזית, בעובי שנראה בלי לגנוב את התמונה. */
const HANDLE_MM = 30;

/**
 * עובי לוח הכיריים שמצויר על המשטח.
 *
 * כיריים אמיתיות בולטות מעל המשטח בכמה מ״מ, וזה כל מה שזה: ציור
 * ולא נפח שנבדק. שער ההתנגשות ומידת הגובה אינם רואים אותו.
 */
const HOB_PLATE_MM = 6;

/** רקע של קיר אחד: המישור, העובי, והסימונים שעליו. */
export interface Backdrop {
  key: string;
  base: string;
  /** מישור הקיר עצמו — מצויר רק כשהוא לא חוסם את המבט */
  wall: string | null;
  /** ראש הקיר והמשקופים בקצותיו — מה שנותן לקיר עובי */
  thickness: string[];
  /** חלונות, דלתות ושקעים, על מישור הקיר */
  onWall: { key: string; kind: string; points: string; tone: string }[];
  active: boolean;
}

/** תווית כיוון של קיר, עם החץ שמראה לאן הוא רץ. */
export interface WallMark {
  key: string;
  label: string;
  x: number;
  y: number;
  arrow: string;
  active: boolean;
}

export interface Scene {
  /** זווית המבט אחרי ההגבלה — לא תמיד מה שביקשו */
  view: IsoView;
  /**
   * הלוחות עצמם, בסדר הציור. הפאות נגזרות מהם.
   *
   * הם יוצאים החוצה כדי שאפשר יהיה לשאול על התמונה שאלה שאינה
   * תלויה בקוד המיון — איזה לוח קרן פוגשת ראשון — ולהשוות אותה
   * למה שנצבע. בלי זה אין דרך לבדוק את סדר הציור אלא בעין.
   */
  solids: Solid[];
  faces: Face[];
  backdrops: Backdrop[];
  marks: WallMark[];
  /** רצפת החדר, מצולע אחד */
  floor: string;
  /** כל מה שחייב להיכנס למסגרת */
  bounds: [number, number][];
  /** הנקודה שמתחת לארגז הנבחר, שעליה יושבים חצי הסיבוב */
  spin: { x: number; y: number } | null;
}

/**
 * בונה את התמונה: מקירות וארגזים אל מצולעים על המסך.
 *
 * הפונקציה טהורה — נכנסים חדר וזווית מבט, יוצאת רשימת פאות מסודרת
 * — ואין בה שום דבר של React. זה מה שמאפשר לתקן כאן את הגיאומטריה
 * בלי לגעת במטפלי האצבע, ולתקן שם כפתור בלי לקרוא מתמטיקה.
 */
export function buildScene({
  walls,
  units,
  activeWallId,
  selectedId,
  inside,
  finishHex,
  present,
  view,
  project,
  parts,
  work,
}: {
  walls: Wall[];
  units: PlacedUnit[];
  activeWallId: string;
  selectedId: string | null;
  inside: boolean;
  finishHex: Record<string, string>;
  present: boolean;
  view: IsoView;
  /** ברירות המחדל של הפרויקט — מהן נגזר הגוון של מי שלא נבחר לו אחד */
  project?: Project;
  /** העוביים שלפיהם נחתך, כדי שהציור והניסור יסכימו */
  parts?: PartSettings;
  /**
   * מצב תהליך עבודה: הצבע הוא הדוח.
   *
   * בחזית הארגזים כבר נצבעו לפי מצב העבודה, ובתלת־ממד הם נשארו
   * בגוון של הלקוח — אותו מסך בדיוק, שתי תשובות שונות לשאלה "מה
   * מוכן". מי שעובד בייצור בתלת־ממד לא ראה שום סטטוס.
   */
  work?: boolean;
}): Scene {

  const plan = buildPlan(walls, units);
  /*
   * הסיבוב נעצר לפני שהצופה יוצא אל מאחורי הקיר שעובדים עליו.
   * מעבר לגבול הזה הקיר נעלם ורואים את גב הארונות — תמונה שאין לה
   * שום שימוש, ובוודאי לא מול לקוח.
   */
  const heading = plan.find((p) => p.wall.id === activeWallId)?.headingDeg ?? 0;
  const shown: IsoView = {
    ...view,
    yawDeg: clamp(view.yawDeg, -120 - heading, 30 - heading),
  };
  const v = projector(shown);
  const toScreen = v.project;
  const solids: Solid[] = [];
  const backdrops: Backdrop[] = [];
  const marks: WallMark[] = [];
  const bounds: [number, number][] = [];
  /* הנקודה שמתחת לארגז הנבחר, שעליה יושבים חצי הסיבוב */
  let spin: { x: number; y: number } | null = null;

  const floorPts = roomFloor(plan).map((q) => toScreen(q.x, 0, q.y));
  const floor = floorPts.map((q) => q.join(',')).join(' ');
  bounds.push(...floorPts);

  for (const p of plan) {
    const s = wallScenery(p, plan, walls, v, activeWallId);
    backdrops.push(s.backdrop);
    if (s.mark) marks.push(s.mark);
    solids.push(...s.solids);
    bounds.push(...s.bounds);
  }

  /*
   * הארגזים, כולם יחד ולא קיר אחרי קיר.
   *
   * כל ארגז יודע לבד איפה הוא עומד — גם אי, שאינו על שום קיר —
   * ולכן אין סיבה לעבור עליהם דרך הקירות. ארגז מוסתר אינו מצויר
   * כאן, אבל נשאר בחומרים, במחיר ובניסור.
   */
  for (const u of units) {
    if (outOfSight(u)) continue;
    const place = unitBox(u, plan);
    if (!place) continue;
    if (u.id === selectedId && !present) spin = spinPoint(u, place, v);
    const first = solids.length;
    solids.push(...unitSolids(u, place, inside, finishHex, project, parts, work));
    /*
     * הארגז נכנס למסגרת גם הוא.
     *
     * המסגרת נבנתה מהרצפה ומהקירות בלבד, ולכן אי שעומד באמצע חדר
     * עם קיר אחד — שבו הרצפה היא הערכה ולא גבול — נחתך מהתמונה
     * כמעט כולו. מה שנשמר בפרויקט חייב להיראות בו.
     *
     * התחום נלקח מהלוחות עצמם ולא ממידות הארגז: משטח עבודה גולש
     * קדימה, דופן זרה עמוקה ממנו, ודלת בולטת מחזיתו.
     */
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = first; i < solids.length; i++) {
      for (let k = 0; k < 3; k++) {
        if (solids[i].lo[k] < lo[k]) lo[k] = solids[i].lo[k];
        if (solids[i].hi[k] > hi[k]) hi[k] = solids[i].hi[k];
      }
    }
    if (solids.length > first) {
      const box = frameOf(unitFrame(place));
      for (const cx of [lo[0], hi[0]]) {
        for (const cy of [lo[1], hi[1]]) {
          for (const cz of [lo[2], hi[2]]) {
            const q = framePoint(box, cx, cy, cz);
            bounds.push(toScreen(q.x, q.y, q.z));
          }
        }
      }
    }
  }



  /*
   * הרחוק מצויר קודם. הסדר נקבע בין הלוחות, ורק אז כל לוח נפרש
   * לפאות שנראות ממנו — כך שאותו סדר משרת את כל הפאות שלו.
   */
  const ordered = orderSolids(solids, v);
  const faces = ordered.flatMap((q) => solidFaces(q, v));

  return { view: shown, solids: ordered, faces, backdrops, marks, floor, bounds, spin };
}

/**
 * הלוחות של ארגז אחד.
 *
 * הארגז נבנה במידות של עצמו, מהרצפה שלו כלפי מעלה, בתוך מסגרת
 * שיודעת איפה הוא עומד בחדר ולאן הוא פונה. הפרדה בין "מה הארגז"
 * לבין "איפה הוא" היא מה שמאפשר לאי ולארון על קיר להיות אותו קוד.
 *
 * מכאן יוצאים לוחות ולא פאות: הסדר ביניהם נקבע אחר כך, בבת אחת
 * לכל החדר, ולכן אין כאן שום החלטה על מי מכסה את מי.
 */
function unitSolids(
  u: PlacedUnit,
  place: UnitBox,
  inside: boolean,
  finishHex: Record<string, string>,
  project?: Project,
  parts?: PartSettings,
  work?: boolean,
): Solid[] {
  const out: Solid[] = [];
  /*
   * הגוון של כל חלק נפתר בדיוק כמו בתמחור: הארגז גובר על הפרויקט,
   * והפרויקט על ברירת המחדל. קודם נקראו כאן רק השדות של הארגז,
   * ולכן גוון שנבחר לפרויקט כולו לא הגיע לשרטוט — הלקוח ראה ארון
   * לבן בזמן שבחרנו לו אדום.
   */
  /*
   * במצב תהליך עבודה הצבע הוא הדוח, ולא הגוון שנבחר ללקוח — אותה
   * החלטה בדיוק שנעשית בציור החזית, ובאותם גוונים.
   */
  const workFill = work && tracksWork(u) ? WORK_TONES[workTone(u)].fill : null;
  const hexOf = (role: PartRole, fallback: string) => {
    if (workFill) return workFill;
    const id = partChoice(u, role, project).finishId;
    return (id && finishHex[id]) || fallback;
  };
  const carcassTone = hexOf('carcass', '#e8dcc8');
  const tone = inside ? hexOf('carcass', '#d9c3a5') : hexOf('front', '#d9c3a5');
  /* אותם עוביים שלפיהם נחתך, ולא מספר קבוע שאולי אינו של הלוח */
  const t = parts ? partThicknessMm(u, 'carcass', parts, project) : MATERIAL.carcassMm;
  const ft = parts ? partThicknessMm(u, 'front', parts, project) : MATERIAL.frontMm;

  /* הסיבוב והמיקום יושבים במסגרת בלבד */
  const frame = frameOf(unitFrame(place));
  const socle = u.socleMm ?? 0;
  const e = u.exposed ?? {};
  /* המעטפת: מה שהארגז תופס בחדר, וממנה נגזרת גם ההתנגשות */
  const envY = u.yMm + socle;
  const envH = Math.max(u.heightMm - socle, 0);
  /*
   * דופן זרה היא חלק מהמעטפת ולא תוספת עליה, בדיוק כמו בחיתוך:
   * הגוף מתכווץ בעוביה. קודם היא נוספה מחוץ לגוף בגודל מלא, וארגז
   * שהוגדר ברוחב 700 צויר ברוחב 736 — רחב מהמידה שלפיה נבדקת
   * ההתנגשות, ולכן שכנים נראו חופפים כשהם רק נוגעים.
   */
  const x = e.start ? ft : 0;
  const y = envY + (e.bottom ? ft : 0);
  const h = Math.max(envH - (e.top ? ft : 0) - (e.bottom ? ft : 0), 0);
  const w = Math.max(u.widthMm - (e.start ? ft : 0) - (e.end ? ft : 0), 0);
  const d = u.depthMm;

  const add = (q: Solid, glass = false) => out.push({ ...q, unitId: u.id, glass });

  /*
   * לוח בודד הוא לוח, לא ארון: אין לו צדדים, תחתית וגב.
   * חיפוי קיר נצמד לקיר עצמו ויושב מאחורי הארגזים; לוח אחר
   * נשאר במקום שהוגדר לו.
   */
  const def = glyphDef(u.glyph);

  /*
   * מכשיר חשמלי הוא מוצר שקונים, ולא ארגז שבונים.
   *
   * תנור, מקרר ומדיח נכנסים למטבח מוכנים: אין להם דפנות שנחתכות,
   * אין מדפים ואין גב, והחזית שלהם היא המכשיר עצמו. עד עכשיו הם
   * צוירו כארון מלא — צדדים, תחתית, תקרה וגב — ועליו הודבקה חזית
   * של מכשיר, ולכן "מקרר" נראה בדיוק כמו ארון עם דלת אפורה.
   *
   * מי שבונה סביבם עמודה מוסיף אותה כארגז נפרד, וזה הארגז שנספר.
   */
  if (def.standalone) {
    for (const part of appliancePieces(u, frame, d, shade(carcassTone, 0.92))) add(part);
    return out;
  }

  /*
   * לוח בודד: העובי הוא אחת ממידותיו ולא מספר שני לצדן, ולכן
   * הציור, החיתוך ובדיקת ההתנגשות מדברים על אותו גוף.
   */
  if (def.noCarcass) {
    const th = slabThicknessMm(u, def.noCarcass);
    if (def.noCarcass === 'horizontal') {
      add(slab(frame, x, u.yMm, 0, w, th, d, tone, `${u.id}-slab`));
    } else {
      add(slab(frame, x, u.yMm, 0, w, u.heightMm, th, tone, `${u.id}-panel`));
    }
    return out;
  }

  // רגליים
  if (socle > 0) {
    // הסוקל נסוג מהחזית אבל יושב על הרצפה במלוא הרוחב
    add(slab(frame, x, u.yMm, 0, w, socle, d - 50, shade(carcassTone, 0.72), `${u.id}-soc`));
  }

  // גוף: שני צדדים, תחתית, תקרה וגב
  const gs = u.glassSides ?? {};
  /*
   * דופן זכוכית היא דופן, ולא חור: היא נבנית, היא נחתכת, והיא
   * נראית. מה שמשתנה הוא שרואים דרכה — ולכן היא מצוירת שקופה
   * ולא נמחקת מהתמונה.
   */
  const off = u.omit ?? {};
  if (!off.start)
    add(slab(frame, x, y, 0, t, h, d, gs.start ? GLASS_TONE : carcassTone, `${u.id}-l`), !!gs.start);
  if (!off.end)
    add(
      slab(frame, x + w - t, y, 0, t, h, d, gs.end ? GLASS_TONE : carcassTone, `${u.id}-r`),
      !!gs.end,
    );
  if (!off.bottom) add(slab(frame, x + t, y, 0, w - 2 * t, t, d, carcassTone, `${u.id}-b`));
  /*
   * התקרה. כשהיא מקושרות היא שתי רצועות ולא לוח — בדיוק מה שיושב
   * מתחת למשטח בארגז תחתון, ומה שרואים כשמסתכלים מלמעלה.
   */
  const rails = u.rails ?? {};
  if (!off.top) {
    if (rails.top) {
      const railD = Math.min(RAIL_WIDTH_MM, d);
      add(slab(frame, x + t, y + h - t, 0, w - 2 * t, t, railD, carcassTone, `${u.id}-t0`));
      add(
        slab(frame, x + t, y + h - t, d - railD, w - 2 * t, t, railD, carcassTone, `${u.id}-t1`),
      );
    } else {
      add(slab(frame, x + t, y + h - t, 0, w - 2 * t, t, d, carcassTone, `${u.id}-t`));
    }
  }
  const back = u.backKind ?? 'thin';
  // גב בעובי גוף נבנה כמו דופן, וגב דק יושב בחריץ — וזה נראה
  const bt = back === 'none' ? 0 : back === 'carcass' ? t : MATERIAL.backMm;
  /*
   * הגב נצבע בגוון שלו כשנבחר לו אחד. קודם הוא תמיד היה הצללה של
   * הגוף, ולכן גב ירוק שנבחר במפורש נראה בכחול של הגוף — בארגז
   * פתוח בלי דלתות זה כל מה שרואים.
   */
  const backTone = shade(hexOf('back', carcassTone), 0.86);

  if (bt && rails.back) {
    /* גב מקושרות: רצועה למעלה ורצועה למטה, ובאמצע רואים את הקיר */
    const railH = Math.min(RAIL_WIDTH_MM, Math.max(h - 2 * t, 0));
    add(slab(frame, x + t, y + t, 0, w - 2 * t, railH, bt, backTone, `${u.id}-bk0`));
    add(
      slab(frame, x + t, y + h - t - railH, 0, w - 2 * t, railH, bt, backTone, `${u.id}-bk1`),
    );
  } else if (bt) {
    /* גב בגובה חלקי יושב על התחתית ומגיע עד לאן שהוא מגיע */
    const full = Math.max(h - 2 * t, 0);
    const backH = Math.min(u.backHeightMm ?? full, full);
    add(slab(frame, x + t, y + t, 0, w - 2 * t, backH, bt, backTone, `${u.id}-bk`));
  }
  /*
   * הפנים מתחיל לפני הגב ולא בתוכו.
   *
   * מדף שהתחיל ב-0 חתך את לוח הגב בארבעה מילימטרים, ולוחות
   * שנחתכים אין ביניהם "מי לפני מי" — ואז הגב, גבוה ורחב, נצבע
   * מעל המדפים ומחק אותם מהתמונה. זה גם פשוט נכון: מדף יושב על
   * הגב, לא בתוכו.
   */
  const inZ = bt;

  /*
   * לד. הפס יושב על הקצה הקדמי, מחוץ למה שהדלת מכסה — בדיוק
   * במקום שבו הוא מותקן ובמקום שבו רואים אותו. פס שצויר מאחורי
   * הדלת היה נעלם בדיוק כשסוגרים את הארון.
   */
  const ledAt = new Set(u.led ?? []);
  const ledBar = (
    lx: number,
    ly: number,
    lw: number,
    lh: number,
    key: string,
    lz = d - LED_MM,
  ) => add(slab(frame, lx, ly, lz, lw, lh, LED_MM, LED_TONE, `${u.id}-led-${key}`));
  if (ledAt.has('top')) ledBar(x, y + h, w, LED_MM, 'top');
  if (ledAt.has('bottom')) ledBar(x, Math.max(y - LED_MM, u.yMm), w, LED_MM, 'bottom');
  if (ledAt.has('start')) ledBar(x - LED_MM, y, LED_MM, h, 'start');
  if (ledAt.has('end')) ledBar(x + w, y, LED_MM, h, 'end');

  // פנים: מדפים וקושרות, לפי התאים
  const bands = zoneBands(unitZones({ ...u, heightMm: h }), h);
  bands.forEach(({ zone, top, bottom }, bi) => {
    // מפתח הציור נגזר גם מהאזור: אותו גובה יחסי חוזר בכמה אזורים
    const zk = `${u.id}-${zone.id}`;
    // zoneBands עובד בקואורדינטות ציור (y כלפי מטה); כאן y כלפי מעלה
    const zBottom = y + (h - bottom);
    const zTop = y + (h - top);
    const zh = zTop - zBottom;
    /*
     * הרווח הנקי של האזור — אחרי התחתית, התקרה והחוצצים.
     * המדפים נתלים בתוכו ולא ברצועה כולה, ולכן "שלושה מדפים"
     * הם ארבעה מרווחים שווים באמת. זו אותה הגדרה שממנה נגזרת
     * המידה הפנימית על הדו־ממד — ולכן הן אינן יכולות להיפרד.
     */
    const clear = zoneClearBand({ top, bottom }, bi, h, t);
    const clearBottom = y + clear.fromMm;
    const cols = zoneColumns(zone);
    /* אזור רדוד — מדף מעל משטח עבודה — נכנס פחות לחדר מהארון עצמו */
    const zd = Math.min(zone.depthMm ?? d, d);
    const innerX = x + t;
    const innerW = w - 2 * t;
    const usableW = innerW - Math.max(cols.length - 1, 0) * t;
    const cells = cols.length
      ? cols.map((c) => ({ content: c, share: c.widthShare || 1 / cols.length }))
      : [{ content: zone, share: 1 }];

    let cx = innerX;
    cells.forEach((cell, i) => {
      const cw = usableW * cell.share;
      const shelves = cell.content.kind === 'shelves' ? (cell.content.shelves ?? 0) : 0;
      const glassShelf = !!cell.content.glassShelves;
      if (shelves > 0) {
        for (const sy of shelfFaceOffsets(clear.sizeMm, shelves, cell.content.shelfGapsMm, t)) {
          const shelfY = clearBottom + sy;
          add(
            slab(frame, cx, shelfY, inZ, cw, t, zd - 20 - inZ, glassShelf ? GLASS_TONE : carcassTone, `${zk}-sh-${i}-${sy}`),
            glassShelf,
          );
          if (ledAt.has('shelf')) {
            /* פס שמתחת למדף יושב בתוך הארון, ולכן הוא נסתר מאחורי הדלת ומאחורי הדופן */
            ledBar(cx, shelfY - LED_MM, cw, LED_MM, `sh-${zone.id}-${i}-${sy}`, d - 40 - LED_MM);
          }
        }
      }
      if (cell.content.kind === 'rod') {
        add(slab(frame, cx, zBottom + zh * 0.86, zd / 2 - 15, cw, 30, 30, '#a8a29e', `${zk}-rod-${i}`));
      }
      if (cell.content.kind === 'drawers') {
        const rows = cell.content.drawers ?? 1;
        /* מגירות זו לצד זו — אותה רשת בדיוק שהחזית מציירת */
        const drawerCols = Math.max(cell.content.drawerCols ?? 1, 1);
        const hidden = cell.content.drawerStyle === 'inner';
        /*
         * מגירה חיצונית היא חזית לכל דבר: היא יושבת באותו מישור
         * של הדלתות ובאותו עובי. מגירה פנימית נסוגה פנימה
         * ונראית רק כשמסתכלים לתוך הארון — בדיוק כמו בציור
         * החזית.
         */
        for (let r = 0; r < rows && (!hidden || inside); r++) {
          for (let col = 0; col < drawerCols; col++) {
            const dh = zh / rows;
            const dw = cw / drawerCols;
            add(
              slab(
                frame,
                cx + col * dw + 6,
                zBottom + r * dh + 6,
                hidden ? zd - 60 : zd,
                dw - 12,
                dh - 12,
                hidden ? 20 : ft,
                shade(tone, hidden ? 0.94 : 1),
                `${zk}-dr-${i}-${r}-${col}`,
              ),
            );
          }
        }
      }
      cx += cw;
      // קושרת בין תא לתא
      if (i < cells.length - 1) {
        add(slab(frame, cx, zBottom, inZ, t, zh, zd - 20 - inZ, carcassTone, `${zk}-div-${i}`));
        cx += t;
      }
    });

    /*
     * חוצץ בין אזורים — מדף קבוע שמחלק את הארון לשניים.
     * הוא נספר כלוח בחישוב, ולכן הוא צריך להיראות כלוח ולא
     * כקו: שני תאים זה אומר שיש ביניהם משהו.
     */
    if (bi > 0) {
      add(slab(frame, x + t, zBottom - t, inZ, w - 2 * t, t, d - inZ, carcassTone, `${zk}-sep`));
    }
  });

  /*
   * החזיתות: לוח שמכסה את הפתח, כשלא מסתכלים פנימה.
   *
   * החזית נגזרת מהאזורים ולא מצוירת לכל אזור בנפרד — דלת אחת
   * יכולה לכסות כמה תאים, וזה בדיוק מה שרואים בארון אמיתי.
   */
  if (!inside) {
    /*
     * בפינה מתה הדלת יושבת רק על החלק הנגיש; מה שנחסם על ידי
     * הארון שעל הקיר הסמוך מקבל לוח סתימה באותו גוון. דלת על
     * כל הרוחב הייתה מבטיחה ללקוח פתח שאי אפשר לפתוח.
     */
    const blind = blindWidthMm(u);
    const atStart = blindSide(u) === 'blindStart';
    const openX = atStart ? blind : 0;
    const openW = w - blind;
    for (const [fi, f] of unitFronts({ ...u, heightMm: h }, h).entries()) {
      const fh = f.toMm - f.fromMm;
      if (fh <= 0) continue;
      if (blind) {
        add(
          slab(
            frame,
            atStart ? x : x + openW,
            y + f.fromMm + 2,
            d,
            blind,
            fh - 4,
            ft,
            tone,
            `${u.id}-blind-${fi}`,
          ),
        );
      }
      const dw = openW / f.doors;
      for (let k = 0; k < f.doors; k++) {
        const dx = x + openX + dw * k;
        add(
          slab(
            frame,
            dx + 2,
            y + f.fromMm + 2,
            d,
            dw - 4,
            fh - 4,
            ft,
            u.glassDoors ? GLASS_TONE : tone,
            `${u.id}-door-${fi}-${k}`,
          ),
          u.glassDoors,
        );
        /*
         * ידית, בצד שבו הדלת נפתחת: דלת בודדת נפתחת מהקצה, וזוג
         * נפתח מהמפגש שביניהן — אותו כלל בדיוק שהחזית מציירת.
         */
        if (u.handles) {
          const inset = Math.min(dw * 0.12, 60);
          const hx = f.doors === 1 || k % 2 === 0 ? dx + dw - inset : dx + inset;
          add(
            slab(
              frame,
              hx - HANDLE_MM / 2,
              y + f.fromMm + fh * 0.36,
              d + ft,
              HANDLE_MM,
              fh * 0.28,
              HANDLE_MM,
              '#57534e',
              `${u.id}-hdl-${fi}-${k}`,
            ),
          );
        }
      }
    }
  }

  /*
   * מכשיר חשמלי בלי דלת — מקרר, תנור, מדיח — מקבל חזית משלו.
   * בלי זה הוא נראה בתלת־ממד כארגז פתוח, ולקוח שרואה חור במטבח
   * לא חושב "מקרר".
   */
  if (def.appliance && !(u.doors ?? 0)) {
    /*
     * החזית הזאת אינה לוח שנחתך אלא פני המכשיר עצמו, ולכן היא
     * אינה נגזרת מעובי החזית שנבחר לארגז — מקרר אינו נעשה עבה
     * יותר כשבוחרים לחזיתות לוח של 30 מ״מ.
     */
    add(
      slab(frame, x + 2, y + 2, d, w - 4, h - 4, MATERIAL.frontMm, '#d6d3d1', `${u.id}-app`),
    );
  }

  /*
   * משטח העבודה — מה שהעין תופסת ראשון במטבח. הוא יושב על הארגז
   * וגולש מעט קדימה, כמו שיש אמיתי.
   *
   * לצדדים הוא אינו גולש: משטח רץ ברצף על כל השורה, ושני ארגזים
   * צמודים שכל אחד מהם מרחיב את שלו החוצה יוצרים שני לוחות באותו
   * מקום ממש. סדר הציור בין שניים כאלה אינו מוגדר, וזה בדיוק מה
   * שהעין תופסת כהבהוב כשמסובבים את החדר.
   */
  if (u.counterMm) {
    /* המשטח רץ על כל רוחב הארגז, גם מעל דופן זרה */
    add(
      slab(
        frame, 0, u.yMm + u.heightMm, 0, u.widthMm, u.counterMm, d + COUNTER_OVERHANG_MM, '#78716c', `${u.id}-cnt`,
      ),
    );
    /*
     * הכיריים, על המשטח.
     *
     * ארגז כיריים נראה כמו כל ארגז מגירות אחר, ולכן אי אפשר היה
     * לדעת מהתמונה איפה הן. הן מצוירות כאן ולא נבנות: הן יושבות
     * *על* המשטח בעובי של כמה מ״מ, ואינן מוסיפות לגובה שהארגז
     * תופס — `physicalHeightMm` נשאר הארון ועוד המשטח.
     *
     * מי שמצייר אותן הוא הארגז שמצהיר שהוא ארגז כיריים, בדיוק כפי
     * שארון תנור מצהיר על נישת תנור. שם לבדו אינו מצייר דבר.
     */
    if (u.applianceType === 'hob') {
      const std = APPLIANCES.hob;
      const hw = Math.min(std.widthMm, Math.max(u.widthMm - MATERIAL.carcassMm * 2, 0));
      const hd = Math.min(std.depthMm, Math.max(d - MATERIAL.carcassMm, 0));
      add(
        slab(
          frame,
          (u.widthMm - hw) / 2,
          u.yMm + u.heightMm + u.counterMm,
          (d - hd) / 2,
          hw,
          HOB_PLATE_MM,
          hd,
          '#1c1917',
          `${u.id}-hob`,
        ),
      );
    }
  }

  /* דפנות זרות — בתוך המעטפת, לא מעליה */
  const pd = u.exposedDepthMm ?? d + MATERIAL.exposedExtraMm;
  const eTone = hexOf('exposed', tone);
  if (e.start) add(slab(frame, 0, envY, 0, ft, envH, pd, eTone, `${u.id}-ep-l`));
  if (e.end) add(slab(frame, u.widthMm - ft, envY, 0, ft, envH, pd, eTone, `${u.id}-ep-r`));
  if (e.top) add(slab(frame, 0, envY + envH - ft, 0, u.widthMm, ft, pd, eTone, `${u.id}-ep-t`));
  if (e.bottom) add(slab(frame, 0, envY, 0, u.widthMm, ft, pd, eTone, `${u.id}-ep-b`));
  return out;
}


/**
 * הנקודה שמתחת לארגז, שעליה יושבים חצי הסיבוב.
 *
 * החצים יושבים מתחת לארון, ולכן הם נמדדים מהפינה התחתונה שנראית
 * הכי נמוכה על המסך — לא מהמרכז. איזו פינה זו תלוי בזווית המבט,
 * ולכן היא נבחרת ולא מונחת מראש.
 */
function spinPoint(
  u: PlacedUnit,
  place: UnitBox,
  v: ReturnType<typeof projector>,
): { x: number; y: number } {
  const tfu = unitFrame(place);
  const [cxw, czw] = tfu(u.widthMm / 2, u.depthMm / 2);
  const [sx] = v.project(cxw, u.yMm, czw);
  const low = Math.max(
    ...(
      [
        [0, 0],
        [u.widthMm, 0],
        [0, u.depthMm],
        [u.widthMm, u.depthMm],
      ] as const
    ).map(([lx, lz]) => {
      const [px, pz] = tfu(lx, lz);
      return v.project(px, u.yMm, pz)[1];
    }),
  );
  return { x: sx, y: low };
}

/**
 * הרקע של קיר אחד: המישור, העובי, הסימונים שעליו, ומה שעומד לפניו.
 *
 * הקיר הוא רקע ולא רהיט, ולכן הוא נבנה בנפרד מהארגזים — חוץ מעמוד
 * ומדרגה, שעומדים באותו מרחב כמו הארונות וחייבים להסתיר ולהיות
 * מוסתרים יחד איתם.
 */
function wallScenery(
  p: PlanWall,
  plan: PlanWall[],
  walls: Wall[],
  v: ReturnType<typeof projector>,
  activeWallId: string,
): { backdrop: Backdrop; mark: WallMark | null; solids: Solid[]; bounds: [number, number][] } {
  const project = v.project;
  const out: Solid[] = [];
  const bounds: [number, number][] = [];
  let mark: WallMark | null = null;
  const { dir, normal } = wallAxes(p);
  /* z חיובי נכנס אל תוך החדר — ולכן הוא נמדד על הנורמל הפנימי */
  const tf: Tf = (x, z) => [
    p.start.x + x * dir.x + z * normal.x,
    p.start.y + x * dir.z + z * normal.z,
  ];
  const w0 = p.wall;
  const at = (x: number, y: number, z: number): [number, number] => {
    const [wx, wz] = tf(x, z);
    return project(wx, y, wz);
  };
  const poly = (pts: [number, number][]) => pts.map((q) => q.join(',')).join(' ');

  /*
   * הרצפה וקו הבסיס מצוירים לכל קיר — בלעדיהם ארון על קיר צדדי
   * נראה מרחף בחלל. מישור הקיר עצמו מצויר רק כשהחדר נמצא בצידו
   * הקרוב לצופה: קיר שעומד בין הצופה לחדר היה מסתיר את הכול,
   * וחדר סגור היה נראה קופסה אטומה במקום חדר.
   */
  // המכפלה הפנימית של הנורמל הפנימי של הקיר עם הכיוון אל הצופה
  const toward = v.toward(normal.x, normal.z);
  const facing = toward > 0.01;
  const len = w0.lengthMm;
  const hgt = w0.heightMm;
  const backdrop: Backdrop = {
    key: w0.id,
    base: poly([at(0, 0, 0), at(len, 0, 0)]),
    wall: facing ? poly([at(0, 0, 0), at(len, 0, 0), at(len, hgt, 0), at(0, hgt, 0)]) : null,
    /*
     * ראש הקיר ושני המשקופים. אלה שלושת המקומות שבהם העין רואה
     * שלקיר יש עובי — למעלה ובשתי הפינות — ולכן זה כל מה שצריך
     * לצייר כדי שהחדר יפסיק להיראות כמו מישור נייר.
     */
    thickness: facing
      ? [
          poly([at(0, hgt, 0), at(len, hgt, 0), at(len, hgt, -WALL_MM), at(0, hgt, -WALL_MM)]),
          poly([at(0, 0, 0), at(0, hgt, 0), at(0, hgt, -WALL_MM), at(0, 0, -WALL_MM)]),
          poly([at(len, 0, 0), at(len, hgt, 0), at(len, hgt, -WALL_MM), at(len, 0, -WALL_MM)]),
        ]
      : [],
    /*
     * חלון, פתח ושקע מצוירים על הקיר גם כאן ולא רק בחזית: מי
     * שמסתובב בחדר רוצה לראות שהארון עומד מתחת לחלון, ולא לחזור
     * למבט אחר כדי לבדוק.
     *
     * כאן רק מה ששטוח על הקיר או נכנס לתוכו. עמוד ומדרגה, שבולטים
     * אל החדר, אינם כאן אלא בין הארונות — הם עומדים באותו מרחב
     * ולכן הם צריכים להסתיר ולהיות מוסתרים יחד איתם.
     */
    onWall: facing
      ? w0.features
          .filter((f) => featureBiteMm(f) <= 0)
          .flatMap((f) => {
            const x1 = f.xMm;
            const x2 = f.xMm + f.widthMm;
            const y1 = f.yMm;
            const y2 = f.yMm + f.heightMm;
            const tone = featureDef(f.kind).tone;
            // נישה נכנסת אל תוך הקיר, ולכן העומק שלה שלילי
            const back = featureBiteMm(f);
            const flat = {
              key: f.id,
              kind: f.kind,
              tone,
              points: poly([at(x1, y1, back), at(x2, y1, back), at(x2, y2, back), at(x1, y2, back)]),
            };
            if (!back) return [flat];
            return [
              flat,
              {
                key: `${f.id}-top`,
                kind: f.kind,
                tone: shade(tone, 1.08),
                points: poly([at(x1, y2, 0), at(x2, y2, 0), at(x2, y2, back), at(x1, y2, back)]),
              },
              {
                key: `${f.id}-side`,
                kind: f.kind,
                tone: shade(tone, 0.84),
                points: poly([at(x1, y1, 0), at(x1, y2, 0), at(x1, y2, back), at(x1, y1, back)]),
              },
            ];
          })
      : [],
    active: w0.id === activeWallId,
  };

  for (const q of [
    at(0, 0, 0),
    at(len, 0, 0),
    at(0, hgt, 0),
    at(len, hgt, 0),
    at(0, hgt, -WALL_MM),
    at(len, hgt, -WALL_MM),
  ]) {
    bounds.push(q);
  }

  /*
   * סימון כיוון: מאיזה קצה הקיר מתחיל ולאן הוא רץ. בשני קירות
   * אפשר להסתדר בלי זה, אבל מרגע שיש שלושה אי אפשר לדעת אם
   * "קיר ג׳" הולך ימינה או שמאלה — וזה משנה לכל מידה שנמדדת ממנו.
   */
  if (plan.length > 2) {
    const tail = at(w0.lengthMm * 0.06, 60, -160);
    const head = at(w0.lengthMm * 0.3, 60, -160);
    const barb1 = at(w0.lengthMm * 0.3 - w0.lengthMm * 0.05, 60, -160 - 120);
    const barb2 = at(w0.lengthMm * 0.3 - w0.lengthMm * 0.05, 60, -160 + 120);
    const label = at(w0.lengthMm * 0.36, 60, -420);
    mark = {
      key: w0.id,
      label: wallName(walls.indexOf(w0)),
      x: label[0],
      y: label[1],
      arrow: `M ${tail.join(' ')} L ${head.join(' ')} M ${barb1.join(' ')} L ${head.join(
        ' ',
      )} L ${barb2.join(' ')}`,
      active: w0.id === activeWallId,
    };
    bounds.push(label, tail);
  }

  /*
   * עמוד ומדרגה: תיבה שעומדת בחדר, ולכן היא נכנסת ללוחות יחד עם
   * הארונות ולא לרקע. עמוד שצויר ברקע היה נעלם מאחורי כל ארון
   * שעומד לידו — וזה בדיוק העמוד שהנגר צריך לראות.
   */
  const wallFrame = frameOf(tf);
  for (const f of w0.features) {
    const bite = featureBiteMm(f);
    if (bite <= 0) continue;
    out.push({
      ...slab(wallFrame, f.xMm, f.yMm, 0, f.widthMm, f.heightMm, bite, featureDef(f.kind).tone, `${w0.id}-${f.id}`),
      featureKind: f.kind,
    });
  }
  return { backdrop, mark, solids: out, bounds };
}

/* ------------------------------------------------------------------ */
/* מכשירי החשמל                                                        */
/* ------------------------------------------------------------------ */

/** גוונים שמזהים מכשיר: מתכת, זכוכית כהה ופאנל פיקוד. */
const APPLIANCE_TONES = {
  steel: '#d6d3d1',
  dark: '#3f3f46',
  panel: '#71717a',
  handle: '#a1a1aa',
};

/**
 * המכשיר כפי שמזהים אותו, ולא קופסה עם חזית אפורה.
 *
 * חמשת המכשירים העצמאיים קיבלו עד כה גוף אחד וחזית אחת, ולכן
 * מקרר, תנור ומדיח נראו זהים בתלת־ממד — אין חלון תנור, אין
 * חלוקת מקרר, ואין מבנה קולט. הציור אינו משנה את המעטפת
 * הפיזית: הוא מחלק את אותו נפח לחלקים שאפשר לזהות, וכל מידה
 * נגזרת מהמכשיר עצמו ולא מוזזת מחוצה לו.
 *
 * הדגם הוא גנרי במכוון — הוא אינו מתיימר להיות דגם של יצרן
 * מסוים, והוא נגזר מ`applianceType` ולא מהאיור שנבחר לרשימה.
 */
function appliancePieces(
  u: PlacedUnit,
  frame: Frame,
  d: number,
  bodyTone: string,
): Solid[] {
  const w = u.widthMm;
  const h = u.heightMm;
  const y = u.yMm;
  const front = MATERIAL.frontMm;
  const out: Solid[] = [];
  /* הגוף, ועליו חזית מתכת — המשותף לכולם */
  out.push(slab(frame, 0, y, 0, w, h, d, bodyTone, `${u.id}-appliance`));
  /*
   * פרט על החזית יושב *עליה*, ולא בתוכה.
   *
   * כל הפרטים התחילו באותו מישור קדמי, והזכוכית רק בלטה שני מ״מ
   * יותר מהדלת. שני גופים שחולקים נפח משאירים את סדר הציור להכרעת
   * המיון, והוא צבע את הדלת אחרונה — התנור והמיקרוגל יצאו מתכת
   * חלקה, בלי החלון שכן נבנה. מה שנפתר כאן אינו הצבע אלא
   * הגאומטריה: `zFrom` מתחיל את הפרט במקום שבו הדלת נגמרת, וכך
   * אין נפח משותף ואין מה למיין.
   */
  const face = (
    key: string, fx: number, fy: number, fw: number, fh: number, tone: string,
    zFrom = 0, thick = front,
  ) => out.push(
    slab(frame, fx, y + fy, d + zFrom, Math.max(fw, 0), Math.max(fh, 0), thick, tone, `${u.id}-${key}`),
  );

  const type = applianceOf(u)?.type;
  const pad = Math.min(w * 0.04, 24);

  if (type === 'oven' || type === 'micro' || type === 'ovenMicro') {
    /* חלון כהה עם ידית מעליו, ופאנל פיקוד בראש */
    const panelH = Math.min(h * 0.16, 90);
    const boxes = type === 'ovenMicro' ? 2 : 1;
    const each = (h - panelH) / boxes;
    face('panel', pad, h - panelH, w - pad * 2, panelH - 6, APPLIANCE_TONES.panel);
    for (let i = 0; i < boxes; i++) {
      const base = i * each;
      face(`door${i}`, pad, base + 6, w - pad * 2, each - 12, APPLIANCE_TONES.steel);
      face(`glass${i}`, pad * 2, base + each * 0.28, w - pad * 4, each * 0.46, APPLIANCE_TONES.dark, front, 2);
      face(`grip${i}`, pad * 2, base + each * 0.82, w - pad * 4, 26, APPLIANCE_TONES.handle, front + 2, 12);
    }
    return out;
  }

  if (type === 'fridge') {
    /* שתי דלתות — מקרר ומקפיא — וידית אנכית לכל אחת */
    const freezer = h * 0.32;
    face('fridgeDoor', pad, freezer + 6, w - pad * 2, h - freezer - pad, APPLIANCE_TONES.steel);
    face('freezerDoor', pad, pad, w - pad * 2, freezer - pad, APPLIANCE_TONES.steel);
    const grip = Math.max(w * 0.06, 30);
    face('grip1', w - pad - grip, freezer + 40, grip, h - freezer - 100, APPLIANCE_TONES.handle, front, 12);
    face('grip2', w - pad - grip, pad + 30, grip, Math.max(freezer - 90, 40), APPLIANCE_TONES.handle, front, 12);
    return out;
  }

  if (type === 'dishwasher') {
    /* פאנל פיקוד בראש, דלת אחת מתחתיו, וידית לרוחבה */
    const panelH = Math.min(h * 0.12, 80);
    face('panel', pad, h - panelH, w - pad * 2, panelH - 6, APPLIANCE_TONES.panel);
    face('door', pad, pad, w - pad * 2, h - panelH - pad - 8, APPLIANCE_TONES.steel);
    face('grip', pad * 2, h - panelH - 40, w - pad * 4, 26, APPLIANCE_TONES.handle, front, 14);
    return out;
  }

  if (type === 'hood') {
    /* מכסה רחב בתחתית, וארובה צרה מעליו */
    const canopy = Math.min(h * 0.45, 200);
    out.push(slab(frame, 0, y, 0, w, canopy, d, APPLIANCE_TONES.steel, `${u.id}-canopy`));
    const chimney = w * 0.34;
    out.push(slab(
      frame, (w - chimney) / 2, y + canopy, 0, chimney, Math.max(h - canopy, 0), d * 0.5,
      APPLIANCE_TONES.steel, `${u.id}-chimney`,
    ));
    face('filter', pad, 6, w - pad * 2, Math.max(canopy - 24, 0), APPLIANCE_TONES.dark, 0, 6);
    return out;
  }

  /* מכשיר שאין לו דגם — חזית מתכת אחת, ונאמר שזה כל מה שידוע */
  face('app', 6, 6, w - 12, Math.max(h - 12, 0), APPLIANCE_TONES.steel);
  return out;
}
