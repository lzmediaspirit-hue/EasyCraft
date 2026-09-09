import { unitFronts, unitZones, zoneBands, zoneColumns } from '../../catalog/zones';
import { shelfYs } from '../../catalog/CabinetGlyph';
import { glyphDef } from '../../catalog/glyphList';
import { shade } from '../../ui/color';
import { MATERIAL } from '../../catalog/standards';
import { buildPlan } from './plan';
import { outOfSight } from './designView';
import { wallName } from '../projects/wallLayouts';
import { featureBiteMm, featureDef } from '../projects/wallFeatures';
import { L_AWAY, L_FACE, WALL_MM, box, projector, roomFloor } from './isoMath';
import { unitBox, unitFrame } from './placement';
import type { Face, IsoView, Tf } from './isoMath';
import type { PlacedUnit, Wall } from '../../db/types';

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
  noUppers,
  finishHex,
  present,
  view,
}: {
  walls: Wall[];
  units: PlacedUnit[];
  activeWallId: string;
  selectedId: string | null;
  inside: boolean;
  noUppers?: boolean;
  finishHex: Record<string, string>;
  present: boolean;
  view: IsoView;
}): Scene {
  const t = MATERIAL.carcassMm;
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
    base: string;
    /** מישור הקיר עצמו — מצויר רק כשהוא לא חוסם את המבט */
    wall: string | null;
    /** ראש הקיר והמשקופים בקצותיו — מה שנותן לקיר עובי */
    thickness: string[];
    /** חלונות, דלתות ושקעים, על מישור הקיר */
    onWall: { key: string; kind: string; points: string; tone: string }[];
    active: boolean;
  }[] = [];
  const marks: { key: string; label: string; x: number; y: number; arrow: string; active: boolean }[] = [];
  const bounds: [number, number][] = [];
  /* הנקודה שמתחת לארגז הנבחר, שעליה יושבים חצי הסיבוב */
  let spin: { x: number; y: number } | null = null;

  const floorPts = roomFloor(plan).map((q) => project(q.x, 0, q.y));
  const floor = floorPts.map((q) => q.join(',')).join(' ');
  bounds.push(...floorPts);

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
    const facing = toward > 0.01;
    const len = w0.lengthMm;
    const hgt = w0.heightMm;
    backdrops.push({
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
    });

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

    /*
     * עמוד ומדרגה: תיבה שעומדת בחדר, ולכן היא נכנסת לרשימת הפאות
     * יחד עם הארונות ולא לרקע. עמוד שצויר ברקע היה נעלם מאחורי כל
     * ארון שעומד לידו — וזה בדיוק העמוד שהנגר צריך לראות.
     */
    for (const f of w0.features) {
      const bite = featureBiteMm(f);
      if (bite <= 0) continue;
      const tone = featureDef(f.kind).tone;
      const [cx, cz] = tf(f.xMm + f.widthMm / 2, bite / 2);
      const group = v.depth(cx, f.yMm + f.heightMm / 2, cz);
      faces.push(
        ...box(v, tf, f.xMm, f.yMm, 0, f.widthMm, f.heightMm, bite, tone, `${w0.id}-${f.id}`).map(
          (face) => ({ ...face, layer: L_FACE.body, group, featureKind: f.kind }),
        ),
      );
    }

    }
  /*
   * הארגזים, כולם יחד ולא קיר אחרי קיר.
   *
   * כל ארגז יודע לבד איפה הוא עומד — גם אי, שאינו על שום קיר —
   * ולכן אין סיבה לעבור עליהם דרך הקירות. ארגז מוסתר אינו מצויר
   * כאן, אבל נשאר בחומרים, במחיר ובניסור.
   */
  for (const u of units) {
    if (outOfSight(u, noUppers)) continue;
    const place = unitBox(u, plan);
    if (!place) continue;
    const frontId = inside ? u.carcassFinishId : (u.frontFinishId ?? u.finishId);
    const tone = (frontId && finishHex[frontId]) || '#d9c3a5';
    const carcassTone = u.carcassFinishId ? (finishHex[u.carcassFinishId] ?? '#e8dcc8') : '#e8dcc8';

    /*
     * הארגז מצויר במידות של עצמו, בתוך מסגרת שיודעת איפה הוא עומד
     * ולאן הוא פונה. הסיבוב והמיקום יושבים במסגרת בלבד.
     */
    const tfu = unitFrame(place);
    if (u.id === selectedId && !present) {
      /*
       * החצים יושבים מתחת לארון, ולכן הם נמדדים מהפינה התחתונה
       * שנראית הכי נמוכה על המסך — לא מהמרכז. איזו פינה זו תלוי
       * בזווית המבט, ולכן היא נבחרת ולא מונחת מראש.
       */
      const [cxw, czw] = tfu(u.widthMm / 2, u.depthMm / 2);
      const [sx] = v.project(cxw, u.yMm, czw);
      const low = Math.max(
        ...([
          [0, 0],
          [u.widthMm, 0],
          [0, u.depthMm],
          [u.widthMm, u.depthMm],
        ] as const).map(([lx, lz]) => {
          const [px, pz] = tfu(lx, lz);
          return v.project(px, u.yMm, pz)[1];
        }),
      );
      spin = { x: sx, y: low };
    }
    /*
     * לאן פונה החזית: אם מישור הדלת קרוב לצופה יותר ממישור הגב,
     * רואים אותה — ואם לא, היא מאחורי הארון.
     */
    const [fwx, fwz] = tfu(u.widthMm / 2, u.depthMm);
    const [bwx, bwz] = tfu(u.widthMm / 2, 0);
    const L = v.toward(fwx, fwz) >= v.toward(bwx, bwz) ? L_FACE : L_AWAY;
    const socle = u.socleMm ?? 0;
    const x = 0;
    const y = u.yMm + socle;
    const h = Math.max(u.heightMm - socle, 0);
    const w = u.widthMm;
    const d = u.depthMm;
    /*
     * הארון כולו מסודר מול שאר הארונות לפי מרכזו, ובתוכו הסדר
     * הוא סדר הבנייה: גוף, פנים, חזית ומשטח. כך חזית תמיד מכסה
     * את מה שמאחוריה, גם כשהמדף שמאחוריה רחב ממנה.
     */
    const [gx, gz] = tfu(u.widthMm / 2, u.depthMm / 2);
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
        add(box(v, tfu, x, u.yMm, def.cladding ? 0 : 0, w, th, d, tone, `${u.id}-slab`), L.front);
      } else {
        add(box(v, tfu, x, u.yMm, 0, w, u.heightMm, th, tone, `${u.id}-panel`), L.front);
      }
      continue;
    }

    // רגליים
    if (socle > 0) {
      // הסוקל נסוג מהחזית אבל יושב על הרצפה במלוא הרוחב
      add(box(v, tfu, x, u.yMm, 0, w, socle, d - 50, shade(carcassTone, 0.72), `${u.id}-soc`), L.body);
    }

    // גוף: שני צדדים, תחתית, תקרה וגב
    const gs = u.glassSides ?? {};
    if (!gs.start) add(box(v, tfu, x, y, 0, t, h, d, carcassTone, `${u.id}-l`), L.body);
    if (!gs.end) add(box(v, tfu, x + w - t, y, 0, t, h, d, carcassTone, `${u.id}-r`), L.body);
    add(box(v, tfu, x + t, y, 0, w - 2 * t, t, d, carcassTone, `${u.id}-b`), L.body);
    add(box(v, tfu, x + t, y + h - t, 0, w - 2 * t, t, d, carcassTone, `${u.id}-t`), L.body);
    if ((u.backKind ?? 'thin') !== 'none') {
      add(
        box(v, tfu, x + t, y + t, 0, w - 2 * t, h - 2 * t, 6, shade(carcassTone, 0.86), `${u.id}-bk`),
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
                tfu,
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
          add(box(v, tfu, cx, zBottom + zh * 0.86, d / 2 - 15, cw, 30, 30, '#a8a29e', `${zk}-rod-${i}`));
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
                tfu,
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
          add(box(v, tfu, cx, zBottom, 0, t, zh, d - 20, carcassTone, `${zk}-div-${i}`));
          cx += t;
        }
      });

      /*
       * חוצץ בין אזורים — מדף קבוע שמחלק את הארון לשניים.
       * הוא נספר כלוח בחישוב, ולכן הוא צריך להיראות כלוח ולא
       * כקו: שני תאים זה אומר שיש ביניהם משהו.
       */
      if (bi > 0) {
        add(box(v, tfu, x + t, zBottom - t, 0, w - 2 * t, t, d, carcassTone, `${zk}-sep`));
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
              tfu,
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
              tfu,
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
        box(v, tfu, x + 2, y + 2, d, w - 4, h - 4, MATERIAL.frontMm, '#d6d3d1', `${u.id}-app`),
        L.front,
      );
    }

    /*
     * משטח העבודה — מה שהעין תופסת ראשון במטבח. הוא יושב על
     * הארגז, גולש מעט לצדדים ומעט קדימה, בדיוק כמו שיש אמיתי.
     */
    if (u.counterMm) {
      add(
        box(v, tfu, x - 20, u.yMm + u.heightMm, 0, w + 40, u.counterMm, d + 20, '#78716c', `${u.id}-cnt`),
        L.top,
      );
    }

    // דפנות זרות
    const e = u.exposed ?? {};
    const pd = u.exposedDepthMm ?? d + MATERIAL.exposedExtraMm;
    const eTone = u.exposedFinishId ? (finishHex[u.exposedFinishId] ?? tone) : tone;
    if (e.start)
      add(
        box(v, tfu, x - MATERIAL.frontMm, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-l`),
        L.top,
      );
    if (e.end)
      add(box(v, tfu, x + w, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-r`), L.top);
    if (e.top) add(box(v, tfu, x, y + h, 0, w, MATERIAL.frontMm, pd, eTone, `${u.id}-ep-t`), L.top);
  }

  /*
   * אלגוריתם הצייר: הרחוק מצויר קודם. הארונות מסודרים ביניהם לפי
   * המרחק שלהם, ובתוך כל ארון לפי השכבה — כך שחזית לעולם אינה
   * נצבעת על ידי הפנים של הארון שלה.
   */
  faces.sort((a, b) => a.group - b.group || a.layer - b.layer || a.depth - b.depth);

  return { view: shown, faces, backdrops, marks, floor, bounds, spin };
}
