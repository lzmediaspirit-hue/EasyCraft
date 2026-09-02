import { unitZones, zoneBands, zoneColumns } from '../../catalog/zones';
import { shelfYs } from '../../catalog/CabinetGlyph';
import { glyphDef } from '../../catalog/glyphList';
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
const SIN30 = 0.5;

/** נקודה בעולם → נקודה על המסך, בהיטל איזומטרי. */
function project(x: number, y: number, z: number): [number, number] {
  return [(x - z) * COS30, (x + z) * SIN30 - y];
}

/**
 * העברה ממערכת הקיר לעולם.
 * `x` רץ לאורך הקיר, `z` נכנס אל תוך החדר — בדיוק כמו שהארגזים
 * מוגדרים — והתוצאה היא הרצפה של החדר כולו.
 */
type Tf = (x: number, z: number) => [number, number];

type Face = { points: string; fill: string; key: string; depth: number; unitId?: string };

/**
 * תיבה מלבנית — לוח אחד.
 * מצוירות שלוש הפאות הנראות: חזית, עליונה וצדדית, כל אחת בגוון
 * אחר. ההצללה היא מה שנותן לעין את העובי בלי לצייר אור אמיתי.
 */
function box(
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
    return project(wx, y + dy, wz).join(',');
  };
  const front = [p(0, 0, d), p(w, 0, d), p(w, h, d), p(0, h, d)].join(' ');
  const top = [p(0, h, 0), p(w, h, 0), p(w, h, d), p(0, h, d)].join(' ');
  const side = [p(w, 0, 0), p(w, h, 0), p(w, h, d), p(w, 0, d)].join(' ');
  // מיון לפי המרחק מהצופה: מה שקרוב יותר מצויר אחרון
  const [cx, cz] = tf(x + w / 2, z + d / 2);
  const depth = cx + cz + y * 0.001;
  return [
    { points: side, fill: shade(tone, 0.78), key: `${key}-s`, depth },
    { points: top, fill: shade(tone, 1.12), key: `${key}-t`, depth },
    { points: front, fill: tone, key: `${key}-f`, depth },
  ];
}

function shade(hex: string, factor: number): string {
  const v = hex.replace('#', '');
  if (v.length < 6) return hex;
  const ch = (i: number) =>
    Math.round(Math.min(parseInt(v.slice(i, i + 2), 16) * factor, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

export function WallIso({
  walls,
  units,
  activeWallId,
  selectedId,
  onSelect,
  inside,
  finishHex,
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
}) {
  const t = MATERIAL.carcassMm;
  const plan = buildPlan(walls, units);
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
    const toward = -sin + cos; // המכפלה הפנימית של הנורמל הפנימי עם כיוון הצופה
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
      const add = (f: Face[]) => faces.push(...f.map((face) => ({ ...face, unitId: u.id })));

      /*
       * לוח בודד הוא לוח, לא ארון: אין לו צדדים, תחתית וגב.
       * חיפוי קיר נצמד לקיר עצמו ויושב מאחורי הארגזים; לוח אחר
       * נשאר במקום שהוגדר לו.
       */
      const def = glyphDef(u.glyph);
      if (def.noCarcass) {
        const th = u.panelThicknessMm ?? MATERIAL.frontMm;
        if (def.noCarcass === 'horizontal') {
          add(box(tf, x, u.yMm, def.cladding ? 0 : 0, w, th, d, tone, `${u.id}-slab`));
        } else {
          add(box(tf, x, u.yMm, 0, w, u.heightMm, th, tone, `${u.id}-panel`));
        }
        continue;
      }

      // רגליים
      if (socle > 0) {
        // הסוקל נסוג מהחזית אבל יושב על הרצפה במלוא הרוחב
        add(box(tf, x, u.yMm, 0, w, socle, d - 50, shade(carcassTone, 0.72), `${u.id}-soc`));
      }

      // גוף: שני צדדים, תחתית, תקרה וגב
      const gs = u.glassSides ?? {};
      if (!gs.start) add(box(tf, x, y, 0, t, h, d, carcassTone, `${u.id}-l`));
      if (!gs.end) add(box(tf, x + w - t, y, 0, t, h, d, carcassTone, `${u.id}-r`));
      add(box(tf, x + t, y, 0, w - 2 * t, t, d, carcassTone, `${u.id}-b`));
      add(box(tf, x + t, y + h - t, 0, w - 2 * t, t, d, carcassTone, `${u.id}-t`));
      if ((u.backKind ?? 'thin') !== 'none') {
        add(
          box(tf, x + t, y + t, 0, w - 2 * t, h - 2 * t, 6, shade(carcassTone, 0.86), `${u.id}-bk`),
        );
      }

      // פנים: מדפים וקושרות, לפי התאים
      const bands = zoneBands(unitZones({ ...u, heightMm: h }), h);
      for (const { zone, top, bottom } of bands) {
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
            add(box(tf, cx, zBottom + zh * 0.86, d / 2 - 15, cw, 30, 30, '#a8a29e', `${zk}-rod-${i}`));
          }
          if (cell.content.kind === 'drawers') {
            const rows = cell.content.drawers ?? 1;
            for (let r = 0; r < rows; r++) {
              const dh = zh / rows;
              add(
                box(
                  tf,
                  cx + 10,
                  zBottom + r * dh + 10,
                  d - 40,
                  cw - 20,
                  dh - 20,
                  20,
                  shade(tone, 0.94),
                  `${zk}-dr-${i}-${r}`,
                ),
              );
            }
          }
          cx += cw;
          // קושרת בין תא לתא
          if (i < cells.length - 1) {
            add(box(tf, cx, zBottom, 0, t, zh, d - 20, carcassTone, `${zk}-div-${i}`));
            cx += t;
          }
        });

        // חזית: לוח שמכסה את הפתח, כשלא מסתכלים פנימה
        const allOuterDrawers = cells.every(
          (c) => c.content.kind === 'drawers' && c.content.drawerStyle !== 'inner',
        );
        if (!inside && (u.doors ?? 0) > 0 && !allOuterDrawers) {
          const doors = Math.max(u.doors ?? 1, 1);
          for (let k = 0; k < doors; k++) {
            add(
              box(
                tf,
                x + (w / doors) * k + 2,
                zBottom + 2,
                d,
                w / doors - 4,
                zh - 4,
                MATERIAL.frontMm,
                u.glassDoors ? shade(tone, 1.06) : tone,
                `${zk}-door-${k}`,
              ),
            );
          }
        }
      }

      // דפנות זרות
      const e = u.exposed ?? {};
      const pd = u.exposedDepthMm ?? d + MATERIAL.exposedExtraMm;
      const eTone = u.exposedFinishId ? (finishHex[u.exposedFinishId] ?? tone) : tone;
      if (e.start)
        add(box(tf, x - MATERIAL.frontMm, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-l`));
      if (e.end) add(box(tf, x + w, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-r`));
      if (e.top) add(box(tf, x, y + h, 0, w, MATERIAL.frontMm, pd, eTone, `${u.id}-ep-t`));
    }
  }

  // אלגוריתם הצייר: הרחוק מצויר קודם
  faces.sort((a, b) => a.depth - b.depth);

  const xs = bounds.map((q) => q[0]);
  const ys = bounds.map((q) => q[1]);
  const pad = 300;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const vbW = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const vbH = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const stroke = Math.max(vbW / 700, 3);

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      className="max-h-full min-h-0 w-full flex-1 select-none"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {backdrops.map((b) => (
        <g key={b.key}>
          <polygon points={b.floor} fill="#f0efec" />
          {b.wall && (
            <polygon
              points={b.wall}
              fill={b.active ? '#faf8f5' : '#f4f3f1'}
              stroke={b.active ? '#d6d3d1' : '#e7e5e4'}
              strokeWidth={stroke}
            />
          )}
          {/* קו הבסיס מראה איפה הקיר עומד, גם כשהמישור שלו לא מצויר */}
          <polyline
            points={b.base}
            fill="none"
            stroke={b.active ? '#a8a29e' : '#d6d3d1'}
            strokeWidth={stroke * 1.4}
            strokeLinecap="round"
          />
        </g>
      ))}

      {faces.map((f) => (
        <polygon
          key={f.key}
          points={f.points}
          fill={f.fill}
          stroke={f.unitId === selectedId ? '#a06236' : '#57534e'}
          strokeWidth={f.unitId === selectedId ? stroke * 1.6 : stroke * 0.7}
          strokeLinejoin="round"
          onPointerDown={() => f.unitId && onSelect(f.unitId)}
          className={f.unitId ? 'cursor-pointer' : undefined}
        />
      ))}

      {marks.map((m) => (
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
  );
}
