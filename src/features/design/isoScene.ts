import { blindSide, blindWidthMm, unitFronts, unitZones, zoneBands, zoneColumns } from '../../catalog/zones';
import { clamp } from '../../ui/units';
import { shelfYs } from '../../catalog/CabinetGlyph';
import { glyphDef } from '../../catalog/glyphList';
import { shade } from '../../ui/color';
import { MATERIAL } from '../../catalog/standards';
import { buildPlan } from './plan';
import { outOfSight } from './designView';
import { wallName } from '../projects/wallLayouts';
import { featureBiteMm, featureDef } from '../projects/wallFeatures';
import { WALL_MM, frameOf, orderSolids, projector, roomFloor, slab, solidFaces } from './isoMath';
import { unitBox, unitFrame } from './placement';
import type { UnitBox } from './placement';
import type { PlanWall } from './plan';
import type { Face, IsoView, Solid, Tf } from './isoMath';
import { RAIL_WIDTH_MM } from '../../db/types';
import type { PlacedUnit, Wall } from '../../db/types';

/** גוון הזכוכית — מה שרואים דרכו נשאר קר וכחלחל, כמו זכוכית אמיתית. */
const GLASS_TONE = '#dbeafe';
/** פס לד: גוון ענבר, ועובי שנראה מרחוק בלי לתפוס מקום. */
const LED_TONE = '#f59e0b';
const LED_MM = 16;
/** ידית: מוט דק על החזית, בעובי שנראה בלי לגנוב את התמונה. */
const HANDLE_MM = 30;

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
}: {
  walls: Wall[];
  units: PlacedUnit[];
  activeWallId: string;
  selectedId: string | null;
  inside: boolean;
  finishHex: Record<string, string>;
  present: boolean;
  view: IsoView;
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
  const project = v.project;
  const solids: Solid[] = [];
  const backdrops: Backdrop[] = [];
  const marks: WallMark[] = [];
  const bounds: [number, number][] = [];
  /* הנקודה שמתחת לארגז הנבחר, שעליה יושבים חצי הסיבוב */
  let spin: { x: number; y: number } | null = null;

  const floorPts = roomFloor(plan).map((q) => project(q.x, 0, q.y));
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
    solids.push(...unitSolids(u, place, inside, finishHex));
  }

  /*
   * הרחוק מצויר קודם. הסדר נקבע בין הלוחות, ורק אז כל לוח נפרש
   * לפאות שנראות ממנו — כך שאותו סדר משרת את כל הפאות שלו.
   */
  const faces = orderSolids(solids, v).flatMap((q) => solidFaces(q, v));

  return { view: shown, faces, backdrops, marks, floor, bounds, spin };
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
): Solid[] {
  const t = MATERIAL.carcassMm;
  const out: Solid[] = [];
  const frontId = inside ? u.carcassFinishId : (u.frontFinishId ?? u.finishId);
  const tone = (frontId && finishHex[frontId]) || '#d9c3a5';
  const carcassTone = u.carcassFinishId ? (finishHex[u.carcassFinishId] ?? '#e8dcc8') : '#e8dcc8';

  /* הסיבוב והמיקום יושבים במסגרת בלבד */
  const frame = frameOf(unitFrame(place));
  const socle = u.socleMm ?? 0;
  const x = 0;
  const y = u.yMm + socle;
  const h = Math.max(u.heightMm - socle, 0);
  const w = u.widthMm;
  const d = u.depthMm;
  const add = (q: Solid, glass = false) => out.push({ ...q, unitId: u.id, glass });

  /*
   * לוח בודד הוא לוח, לא ארון: אין לו צדדים, תחתית וגב.
   * חיפוי קיר נצמד לקיר עצמו ויושב מאחורי הארגזים; לוח אחר
   * נשאר במקום שהוגדר לו.
   */
  const def = glyphDef(u.glyph);
  if (def.noCarcass) {
    const th = u.panelThicknessMm ?? MATERIAL.frontMm;
    if (def.noCarcass === 'horizontal') {
      add(slab(frame, x, u.yMm, def.cladding ? 0 : 0, w, th, d, tone, `${u.id}-slab`));
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
  const backTone = shade(carcassTone, 0.86);
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
        for (const sy of shelfYs({ shelves, gaps: cell.content.shelfGapsMm }, 0, zh)) {
          const shelfY = zBottom + (zh - sy);
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
                hidden ? 20 : MATERIAL.frontMm,
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
            MATERIAL.frontMm,
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
            MATERIAL.frontMm,
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
              d + MATERIAL.frontMm,
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
    add(
      slab(frame, x + 2, y + 2, d, w - 4, h - 4, MATERIAL.frontMm, '#d6d3d1', `${u.id}-app`),
    );
  }

  /*
   * משטח העבודה — מה שהעין תופסת ראשון במטבח. הוא יושב על
   * הארגז, גולש מעט לצדדים ומעט קדימה, בדיוק כמו שיש אמיתי.
   */
  if (u.counterMm) {
    add(
      slab(frame, x - 20, u.yMm + u.heightMm, 0, w + 40, u.counterMm, d + 20, '#78716c', `${u.id}-cnt`),
    );
  }

  // דפנות זרות
  const e = u.exposed ?? {};
  const pd = u.exposedDepthMm ?? d + MATERIAL.exposedExtraMm;
  const eTone = u.exposedFinishId ? (finishHex[u.exposedFinishId] ?? tone) : tone;
  if (e.start)
    add(
      slab(frame, x - MATERIAL.frontMm, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-l`),
    );
  if (e.end)
    add(slab(frame, x + w, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-r`));
  if (e.top) add(slab(frame, x, y + h, 0, w, MATERIAL.frontMm, pd, eTone, `${u.id}-ep-t`));
  if (e.bottom)
    add(slab(frame, x, y - MATERIAL.frontMm, 0, w, MATERIAL.frontMm, pd, eTone, `${u.id}-ep-b`));
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
  const rad = (p.headingDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tf: Tf = (x, z) => [p.start.x + x * cos - z * sin, p.start.y + x * sin + z * cos];
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
  const toward = v.toward(-sin, cos);
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
     */
    /*
     * שטוח על הקיר, או נכנס לתוכו. עמוד ומדרגה, שבולטים אל
     * החדר, אינם כאן אלא בין הארונות — הם עומדים באותו מרחב
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
