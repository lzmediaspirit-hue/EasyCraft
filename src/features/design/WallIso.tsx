import { useRef, useState } from 'react';
import { unitFronts, unitZones, zoneBands, zoneColumns } from '../../catalog/zones';
import { shelfYs } from '../../catalog/CabinetGlyph';
import { glyphDef } from '../../catalog/glyphList';
import { shade } from '../../ui/color';
import { MATERIAL } from '../../catalog/standards';
import { buildPlan } from './plan';
import { wallName } from '../projects/wallLayouts';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * מבט תלת-ממדי על החדר.
 *
 * הציור השטוח מראה מה יהיה על קיר אחד; המבט הזה מראה את כל הקירות
 * יחד, ואיך הכול בנוי — כל לוח מצויר בעובי שלו, ורואים את הצדדים,
 * התחתית, התקרה והמדפים כמו שהם ייצאו מהמסור. זו התמונה שנגר
 * מסתכל בה לפני שהוא חותך, וזו גם התמונה שמסבירה ללקוח מה הוא מקבל.
 *
 * ההיטל איזומטרי: אין נקודת מגוז, ולכן מידה שווה נראית שווה בכל
 * מקום בציור — מה שמתאים לשרטוט עבודה, בניגוד לפרספקטיבה.
 *
 * הקירות משורשרים לפי אותה גיאומטריה שמשמשת את מבט העל, ולכן חדר
 * שנראה נכון מלמעלה נראה נכון גם כאן — כולל חדר שאינו מלבן וחדר
 * עם יותר מארבעה קירות.
 */

const COS30 = Math.cos(Math.PI / 6);

/** זווית המבט: סיבוב סביב הציר האנכי, והגובה שממנו מסתכלים. */
export interface IsoView {
  /** מעלות. 0 = המבט ההתחלתי */
  yawDeg: number;
  /**
   * שיטוח המישור האופקי, בין מבט כמעט מהצד למבט כמעט מלמעלה.
   * 0.5 הוא ההיטל האיזומטרי המוכר.
   */
  rise: number;
}

/*
 * שכבות הציור בתוך ארון.
 *
 * הגוף והפנים חולקים שכבה אחת ומסודרים ביניהם לפי מרחק — דופן
 * ימנית באמת עומדת לפני המדף שמאחוריה. החזית לעומת זאת מכסה תמיד:
 * מדף שנמתח על כל רוחב הארון "קרוב" יותר מדלת שמכסה רק חצי ממנו,
 * ובלי שכבה נפרדת הוא היה נצבע עליה.
 */
const L = { body: 0, inside: 0, front: 1, top: 2 };

const DEFAULT_VIEW: IsoView = { yawDeg: 0, rise: 0.5 };
const MIN_RISE = 0.12;
const MAX_RISE = 0.95;

/** מרחק בפיקסלים שמעליו הגרירה היא סיבוב מבט ולא בחירת ארון. */
const ORBIT_SLOP = 6;

/**
 * בונה את פונקציית ההיטל לזווית מבט נתונה.
 * הסיבוב נעשה סביב הציר האנכי לפני ההיטל, ולכן החדר מסתובב והמידות
 * נשארות נכונות — זו עדיין הטלה מקבילה ולא פרספקטיבה.
 */
function projector(view: IsoView) {
  const rad = (view.yawDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const project = (x: number, y: number, z: number): [number, number] => {
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;
    return [(rx - rz) * COS30, (rx + rz) * view.rise - y];
  };
  /** המרחק מהצופה במישור הרצפה — לפיו קיר הוא רקע או חסימה */
  const toward = (x: number, z: number): number => x * (cos + sin) + z * (cos - sin);
  /*
   * המרחק מהצופה בשלושת הממדים.
   *
   * קו המבט בהיטל הזה הוא הכיוון (1, 2·rise, 1) במערכת המסובבת:
   * מה שקדימה, ימינה ולמעלה — קרוב יותר. בלי המרכיב האנכי ארון
   * עליון וארון תחתון שנפגשים על המסך היו מסודרים לפי מזל.
   */
  const depth = (x: number, y: number, z: number): number =>
    toward(x, z) + 2 * view.rise * y;
  return { project, toward, depth };
}

/**
 * העברה ממערכת הקיר לעולם.
 * `x` רץ לאורך הקיר, `z` נכנס אל תוך החדר — בדיוק כמו שהארגזים
 * מוגדרים — והתוצאה היא הרצפה של החדר כולו.
 */
type Tf = (x: number, z: number) => [number, number];

type Face = {
  points: string;
  fill: string;
  key: string;
  depth: number;
  /*
   * שכבת הציור בתוך הארון: גוף, פנים, חזית, משטח. מרחק לבדו לא
   * מספיק — מדף שנמתח על כל רוחב הארון "רחוק" פחות מדלת שמכסה רק
   * חצי ממנו, ובלי השכבות הוא היה נצבע עליה.
   */
  layer: number;
  /** הארון שהפאה שייכת לו, לפי המרחק שלו — הארונות מסודרים ביניהם */
  group: number;
  unitId?: string;
};

/**
 * תיבה מלבנית — לוח אחד.
 * מצוירות שלוש הפאות הנראות: חזית, עליונה וצדדית, כל אחת בגוון
 * אחר. ההצללה היא מה שנותן לעין את העובי בלי לצייר אור אמיתי.
 */
function box(
  view: ReturnType<typeof projector>,
  tf: Tf,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tone: string,
  key: string,
): Face[] {
  const p = (dx: number, dy: number, dz: number) => {
    const [wx, wz] = tf(x + dx, z + dz);
    return view.project(wx, y + dy, wz).join(',');
  };
  const front = [p(0, 0, d), p(w, 0, d), p(w, h, d), p(0, h, d)].join(' ');
  const top = [p(0, h, 0), p(w, h, 0), p(w, h, d), p(0, h, d)].join(' ');
  const side = [p(w, 0, 0), p(w, h, 0), p(w, h, d), p(w, 0, d)].join(' ');
  /*
   * מיון לפי המרחק מהצופה: מה שקרוב יותר מצויר אחרון, והמרחק של
   * לוח נמדד בפינה הקרובה ביותר שלו ולא במרכזו.
   *
   * מרכז מטעה כשמשווים לוח גדול ללוח קטן: דופן הארון נמדדת באמצע
   * הגובה, ומדף שיושב גבוה נמדד גבוה ממנה — ואז המדף נצבע על הדופן
   * שעומדת לפניו. הפינה הקרובה שייכת לשני הלוחות באותה מידה.
   *
   * שלוש הפאות של אותה תיבה חולקות את הפינה, ולכן הן שומרות על
   * הסדר שבו נכתבו: צד, עליונה, ואז חזית.
   */
  const [nx, nz] = tf(x + w, z + d);
  const depth = view.depth(nx, y + h, nz);
  return [
    { points: side, fill: shade(tone, 0.78), key: `${key}-s`, depth, layer: 0, group: 0 },
    { points: top, fill: shade(tone, 1.12), key: `${key}-t`, depth, layer: 0, group: 0 },
    { points: front, fill: tone, key: `${key}-f`, depth, layer: 0, group: 0 },
  ];
}


export function WallIso({
  walls,
  units,
  activeWallId,
  selectedId,
  onSelect,
  inside,
  finishHex,
  present = false,
}: {
  walls: Wall[];
  /** כל הארגזים בפרויקט — המבט הזה מציג את החדר כולו */
  units: PlacedUnit[];
  /** הקיר שעובדים עליו כרגע, מסומן בציור */
  activeWallId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** חזיתות מוסתרות — רואים את הגוף והמדפים */
  inside: boolean;
  finishHex: Record<string, string>;
  /**
   * תצוגת הצגה: אותו חדר, בלי שרטוט.
   *
   * הקווים בין הלוחות, שמות הקירות וסימון הארגז הנבחר הם שפה של
   * נגר. הלקוח לא קורא שרטוט — הוא רוצה לראות איך זה ייראה — ולכן
   * במצב הזה נשארים רק המשטחים, עם אור, צל וקרקע.
   */
  present?: boolean;
}) {
  const t = MATERIAL.carcassMm;
  /*
   * זווית המבט נשמרת במצב ולא בהגדרות: היא שייכת לרגע ההסתכלות,
   * לא לפרויקט. גרירה על הציור מסובבת אופקית ומרימה או מנמיכה את
   * נקודת המבט — אותה תנועה שעושים ביד על מודל אמיתי.
   */
  const [view, setView] = useState<IsoView>(DEFAULT_VIEW);
  const orbit = useRef<{ x: number; y: number; from: IsoView; moved: boolean } | null>(null);

  const plan = buildPlan(walls, units);
  /*
   * הסיבוב נעצר לפני שהצופה יוצא אל מאחורי הקיר שעובדים עליו.
   * מעבר לגבול הזה הקיר נעלם ורואים את גב הארונות — תמונה שאין לה
   * שום שימוש, ובוודאי לא מול לקוח.
   */
  const heading = plan.find((p) => p.wall.id === activeWallId)?.headingDeg ?? 0;
  const shown: IsoView = {
    ...view,
    yawDeg: Math.min(Math.max(view.yawDeg, -120 - heading), 30 - heading),
  };
  const v = projector(shown);
  const project = v.project;
  const faces: Face[] = [];
  const backdrops: {
    key: string;
    floor: string;
    base: string;
    /** מישור הקיר עצמו — מצויר רק כשהוא לא חוסם את המבט */
    wall: string | null;
    active: boolean;
  }[] = [];
  const marks: { key: string; label: string; x: number; y: number; arrow: string; active: boolean }[] = [];
  const bounds: [number, number][] = [];

  for (const p of plan) {
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
    backdrops.push({
      key: w0.id,
      floor: poly([at(0, 0, 0), at(w0.lengthMm, 0, 0), at(w0.lengthMm, 0, 800), at(0, 0, 800)]),
      base: poly([at(0, 0, 0), at(w0.lengthMm, 0, 0)]),
      wall:
        toward > 0.01
          ? poly([
              at(0, 0, 0),
              at(w0.lengthMm, 0, 0),
              at(w0.lengthMm, w0.heightMm, 0),
              at(0, w0.heightMm, 0),
            ])
          : null,
      active: w0.id === activeWallId,
    });

    for (const q of [
      at(0, 0, 0),
      at(w0.lengthMm, 0, 0),
      at(0, w0.heightMm, 0),
      at(w0.lengthMm, w0.heightMm, 0),
      at(0, 0, 800),
      at(w0.lengthMm, 0, 800),
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
      marks.push({
        key: w0.id,
        label: wallName(walls.indexOf(w0)),
        x: label[0],
        y: label[1],
        arrow: `M ${tail.join(' ')} L ${head.join(' ')} M ${barb1.join(' ')} L ${head.join(
          ' ',
        )} L ${barb2.join(' ')}`,
        active: w0.id === activeWallId,
      });
      bounds.push(label, tail);
    }

    for (const u of units.filter((x) => x.wallId === w0.id)) {
      const frontId = inside ? u.carcassFinishId : (u.frontFinishId ?? u.finishId);
      const tone = (frontId && finishHex[frontId]) || '#d9c3a5';
      const carcassTone = u.carcassFinishId ? (finishHex[u.carcassFinishId] ?? '#e8dcc8') : '#e8dcc8';

      const socle = u.socleMm ?? 0;
      const x = u.xMm;
      const y = u.yMm + socle;
      const h = Math.max(u.heightMm - socle, 0);
      const w = u.widthMm;
      const d = u.depthMm;
      /*
       * הארון כולו מסודר מול שאר הארונות לפי מרכזו, ובתוכו הסדר
       * הוא סדר הבנייה: גוף, פנים, חזית ומשטח. כך חזית תמיד מכסה
       * את מה שמאחוריה, גם כשהמדף שמאחוריה רחב ממנה.
       */
      const [gx, gz] = tf(u.xMm + u.widthMm / 2, u.depthMm / 2);
      const group = v.depth(gx, u.yMm + u.heightMm / 2, gz);
      const add = (f: Face[], layer = L.inside) =>
        faces.push(...f.map((face) => ({ ...face, unitId: u.id, layer, group })));

      /*
       * לוח בודד הוא לוח, לא ארון: אין לו צדדים, תחתית וגב.
       * חיפוי קיר נצמד לקיר עצמו ויושב מאחורי הארגזים; לוח אחר
       * נשאר במקום שהוגדר לו.
       */
      const def = glyphDef(u.glyph);
      if (def.noCarcass) {
        const th = u.panelThicknessMm ?? MATERIAL.frontMm;
        if (def.noCarcass === 'horizontal') {
          add(box(v, tf, x, u.yMm, def.cladding ? 0 : 0, w, th, d, tone, `${u.id}-slab`), L.front);
        } else {
          add(box(v, tf, x, u.yMm, 0, w, u.heightMm, th, tone, `${u.id}-panel`), L.front);
        }
        continue;
      }

      // רגליים
      if (socle > 0) {
        // הסוקל נסוג מהחזית אבל יושב על הרצפה במלוא הרוחב
        add(box(v, tf, x, u.yMm, 0, w, socle, d - 50, shade(carcassTone, 0.72), `${u.id}-soc`), L.body);
      }

      // גוף: שני צדדים, תחתית, תקרה וגב
      const gs = u.glassSides ?? {};
      if (!gs.start) add(box(v, tf, x, y, 0, t, h, d, carcassTone, `${u.id}-l`), L.body);
      if (!gs.end) add(box(v, tf, x + w - t, y, 0, t, h, d, carcassTone, `${u.id}-r`), L.body);
      add(box(v, tf, x + t, y, 0, w - 2 * t, t, d, carcassTone, `${u.id}-b`), L.body);
      add(box(v, tf, x + t, y + h - t, 0, w - 2 * t, t, d, carcassTone, `${u.id}-t`), L.body);
      if ((u.backKind ?? 'thin') !== 'none') {
        add(
          box(v, tf, x + t, y + t, 0, w - 2 * t, h - 2 * t, 6, shade(carcassTone, 0.86), `${u.id}-bk`),
          L.body,
        );
      }

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
          if (shelves > 0) {
            for (const sy of shelfYs({ shelves, gaps: cell.content.shelfGapsMm }, 0, zh)) {
              add(
                box(
                  v,
                  tf,
                  cx,
                  zBottom + (zh - sy),
                  0,
                  cw,
                  t,
                  d - 20,
                  carcassTone,
                  `${zk}-sh-${i}-${sy}`,
                ),
              );
            }
          }
          if (cell.content.kind === 'rod') {
            add(box(v, tf, cx, zBottom + zh * 0.86, d / 2 - 15, cw, 30, 30, '#a8a29e', `${zk}-rod-${i}`));
          }
          if (cell.content.kind === 'drawers') {
            const rows = cell.content.drawers ?? 1;
            const hidden = cell.content.drawerStyle === 'inner';
            /*
             * מגירה חיצונית היא חזית לכל דבר: היא יושבת באותו מישור
             * של הדלתות ובאותו עובי. מגירה פנימית נסוגה פנימה
             * ונראית רק כשמסתכלים לתוך הארון — בדיוק כמו בציור
             * החזית.
             */
            for (let r = 0; r < rows && (!hidden || inside); r++) {
              const dh = zh / rows;
              add(
                box(
                  v,
                  tf,
                  cx + 6,
                  zBottom + r * dh + 6,
                  hidden ? d - 60 : d,
                  cw - 12,
                  dh - 12,
                  hidden ? 20 : MATERIAL.frontMm,
                  shade(tone, hidden ? 0.94 : 1),
                  `${zk}-dr-${i}-${r}`,
                ),
                hidden ? L.inside : L.front,
              );
            }
          }
          cx += cw;
          // קושרת בין תא לתא
          if (i < cells.length - 1) {
            add(box(v, tf, cx, zBottom, 0, t, zh, d - 20, carcassTone, `${zk}-div-${i}`));
            cx += t;
          }
        });

        /*
         * חוצץ בין אזורים — מדף קבוע שמחלק את הארון לשניים.
         * הוא נספר כלוח בחישוב, ולכן הוא צריך להיראות כלוח ולא
         * כקו: שני תאים זה אומר שיש ביניהם משהו.
         */
        if (bi > 0) {
          add(box(v, tf, x + t, zBottom - t, 0, w - 2 * t, t, d, carcassTone, `${zk}-sep`));
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
        const blind =
          u.corner === 'blindStart' || u.corner === 'blindEnd'
            ? Math.min(Math.max(u.blindMm ?? 0, w * 0.1), w * 0.7)
            : 0;
        const openX = u.corner === 'blindStart' ? blind : 0;
        const openW = w - blind;
        for (const [fi, f] of unitFronts({ ...u, heightMm: h }, h).entries()) {
          const fh = f.toMm - f.fromMm;
          if (fh <= 0) continue;
          if (blind) {
            add(
              box(
                v,
                tf,
                u.corner === 'blindStart' ? x : x + openW,
                y + f.fromMm + 2,
                d,
                blind,
                fh - 4,
                MATERIAL.frontMm,
                tone,
                `${u.id}-blind-${fi}`,
              ),
              L.front,
            );
          }
          for (let k = 0; k < f.doors; k++) {
            add(
              box(
                v,
                tf,
                x + openX + (openW / f.doors) * k + 2,
                y + f.fromMm + 2,
                d,
                openW / f.doors - 4,
                fh - 4,
                MATERIAL.frontMm,
                u.glassDoors ? shade(tone, 1.06) : tone,
                `${u.id}-door-${fi}-${k}`,
              ),
              L.front,
            );
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
          box(v, tf, x + 2, y + 2, d, w - 4, h - 4, MATERIAL.frontMm, '#d6d3d1', `${u.id}-app`),
          L.front,
        );
      }

      /*
       * משטח העבודה — מה שהעין תופסת ראשון במטבח. הוא יושב על
       * הארגז, גולש מעט לצדדים ומעט קדימה, בדיוק כמו שיש אמיתי.
       */
      if (u.counterMm) {
        add(
          box(v, tf, x - 20, u.yMm + u.heightMm, 0, w + 40, u.counterMm, d + 20, '#78716c', `${u.id}-cnt`),
          L.top,
        );
      }

      // דפנות זרות
      const e = u.exposed ?? {};
      const pd = u.exposedDepthMm ?? d + MATERIAL.exposedExtraMm;
      const eTone = u.exposedFinishId ? (finishHex[u.exposedFinishId] ?? tone) : tone;
      if (e.start)
        add(
          box(v, tf, x - MATERIAL.frontMm, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-l`),
          L.top,
        );
      if (e.end)
        add(box(v, tf, x + w, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-r`), L.top);
      if (e.top) add(box(v, tf, x, y + h, 0, w, MATERIAL.frontMm, pd, eTone, `${u.id}-ep-t`), L.top);
    }
  }

  /*
   * אלגוריתם הצייר: הרחוק מצויר קודם. הארונות מסודרים ביניהם לפי
   * המרחק שלהם, ובתוך כל ארון לפי השכבה — כך שחזית לעולם אינה
   * נצבעת על ידי הפנים של הארון שלה.
   */
  faces.sort((a, b) => a.group - b.group || a.layer - b.layer || a.depth - b.depth);

  const xs = bounds.map((q) => q[0]);
  const ys = bounds.map((q) => q[1]);
  const pad = 300;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const vbW = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const vbH = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const stroke = Math.max(vbW / 700, 3);

  /*
   * גרירה מסובבת, נגיעה בוחרת.
   * הבחירה נעשית בהרפיה ולא בלחיצה, כי אחרת כל תחילת סיבוב שהתחילה
   * על ארון הייתה בוחרת אותו — והלוח היה נפתח באמצע התנועה.
   */
  const moved = () => !!orbit.current?.moved;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      className="max-h-full min-h-0 w-full flex-1 touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        orbit.current = { x: e.clientX, y: e.clientY, from: view, moved: false };
      }}
      onPointerMove={(e) => {
        const o = orbit.current;
        if (!o) return;
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        if (!o.moved && Math.hypot(dx, dy) < ORBIT_SLOP) return;
        o.moved = true;
        const box = e.currentTarget.getBoundingClientRect();
        setView({
          // סיבוב מלא כשגוררים על פני רוחב המסך פעמיים, עד גבול הקיר
          yawDeg: Math.min(
            Math.max(o.from.yawDeg - (dx / Math.max(box.width, 1)) * 180, -120 - heading),
            30 - heading,
          ),
          rise: Math.min(
            Math.max(o.from.rise + (dy / Math.max(box.height, 1)) * 1.2, MIN_RISE),
            MAX_RISE,
          ),
        });
      }}
      onPointerUp={(e) => {
        const wasOrbit = moved();
        orbit.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (wasOrbit) return;
        const id = (e.target as Element).getAttribute?.('data-unit') ?? null;
        onSelect(id);
      }}
      onPointerCancel={() => {
        orbit.current = null;
      }}
    >
      {/*
        תצוגת הצגה: אור רך מלמעלה, קרקע שמתבהרת אל האופק, וצל מתחת
        לכל מה שעומד. שלושת אלה הם מה שהופך מלבנים צבועים לחדר.
      */}
      {present && (
        <defs>
          <linearGradient id="iso-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7f5f2" />
            <stop offset="100%" stopColor="#e8e4de" />
          </linearGradient>
          <linearGradient id="iso-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6e1da" />
            <stop offset="100%" stopColor="#cfc8bd" />
          </linearGradient>
          <linearGradient id="iso-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
          <filter id="iso-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy={vbH / 90} stdDeviation={vbW / 260} floodOpacity="0.22" />
          </filter>
        </defs>
      )}
      {present && (
        <rect x={minX} y={minY} width={vbW} height={vbH} fill="url(#iso-sky)" />
      )}

      {backdrops.map((b) => (
        <g key={b.key}>
          <polygon points={b.floor} fill={present ? 'url(#iso-floor)' : '#f0efec'} />
          {b.wall && (
            <polygon
              points={b.wall}
              fill={present ? '#f2efea' : b.active ? '#faf8f5' : '#f4f3f1'}
              stroke={present ? 'none' : b.active ? '#d6d3d1' : '#e7e5e4'}
              strokeWidth={stroke}
            />
          )}
          {/* קו הבסיס מראה איפה הקיר עומד, גם כשהמישור שלו לא מצויר */}
          {!present && (
            <polyline
              points={b.base}
              fill="none"
              stroke={b.active ? '#a8a29e' : '#d6d3d1'}
              strokeWidth={stroke * 1.4}
              strokeLinecap="round"
            />
          )}
        </g>
      ))}

      <g filter={present ? 'url(#iso-shadow)' : undefined}>
        {faces.map((f) => (
          <polygon
            key={f.key}
            points={f.points}
            fill={f.fill}
            /*
              בהצגה הקו בין לוח ללוח נעלם: הוא מה שהופך רהיט לשרטוט.
              נשאר קו דק מאוד בגוון המשטח עצמו, כדי שפאה בהירה על
              רקע בהיר עדיין תיראה.
            */
            stroke={
              present
                ? 'rgba(87,83,78,0.18)'
                : f.unitId === selectedId
                  ? '#a06236'
                  : '#57534e'
            }
            strokeWidth={
              present ? stroke * 0.35 : f.unitId === selectedId ? stroke * 1.6 : stroke * 0.7
            }
            strokeLinejoin="round"
            data-unit={f.unitId}
            className={f.unitId && !present ? 'cursor-pointer' : undefined}
          />
        ))}
      </g>

      {/* שכבת האור: מבהירה למעלה ומכהה למטה, על כל התמונה בבת אחת */}
      {present && (
        <rect
          x={minX}
          y={minY}
          width={vbW}
          height={vbH}
          fill="url(#iso-light)"
          pointerEvents="none"
        />
      )}

      {!present &&
        marks.map((m) => (
        <g key={`mark-${m.key}`} pointerEvents="none">
          <path
            d={m.arrow}
            fill="none"
            stroke={m.active ? '#a06236' : '#a8a29e'}
            strokeWidth={stroke * 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x={m.x}
            y={m.y}
            textAnchor="middle"
            fontSize={vbW / 26}
            fill={m.active ? '#a06236' : '#a8a29e'}
            fontWeight={m.active ? 700 : 500}
          >
            {m.label}
          </text>
        </g>
        ))}
    </svg>

    {/* חזרה לזווית ההתחלתית, אחרי שהסתובבנו למקום שקשה לחזור ממנו */}
    {(view.yawDeg !== DEFAULT_VIEW.yawDeg || view.rise !== DEFAULT_VIEW.rise) && (
      <button
        onClick={() => setView(DEFAULT_VIEW)}
        className="absolute end-1 top-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-stone-600 shadow-sm transition-colors hover:text-oak-700"
      >
        זווית התחלתית
      </button>
    )}
    </div>
  );
}
