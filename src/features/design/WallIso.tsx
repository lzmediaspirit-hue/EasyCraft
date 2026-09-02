import { unitZones, zoneBands, zoneColumns } from '../../catalog/zones';
import { shelfYs } from '../../catalog/CabinetGlyph';
import { MATERIAL } from '../../catalog/standards';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * מבט תלת-ממדי על הקיר.
 *
 * הציור השטוח מראה מה יהיה על הקיר; המבט הזה מראה איך זה בנוי —
 * כל לוח מצויר בעובי שלו, ורואים את הצדדים, התחתית, התקרה והמדפים
 * כמו שהם ייצאו מהמסור. זו התמונה שנגר מסתכל בה לפני שהוא חותך,
 * וזו גם התמונה שמסבירה ללקוח מה הוא מקבל.
 *
 * ההיטל איזומטרי: אין נקודת מגוז, ולכן מידה שווה נראית שווה בכל
 * מקום בציור — מה שמתאים לשרטוט עבודה, בניגוד לפרספקטיבה.
 */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

/** נקודה בעולם → נקודה על המסך, בהיטל איזומטרי. */
function project(x: number, y: number, z: number): [number, number] {
  return [(x - z) * COS30, (x + z) * SIN30 - y];
}

type Face = { points: string; fill: string; key: string; depth: number };

/**
 * תיבה מלבנית — לוח אחד.
 * מצוירות שלוש הפאות הנראות: חזית, עליונה וצדדית, כל אחת בגוון
 * אחר. ההצללה היא מה שנותן לעין את העובי בלי לצייר אור אמיתי.
 */
function box(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tone: string,
  key: string,
): Face[] {
  const p = (dx: number, dy: number, dz: number) => project(x + dx, y + dy, z + dz).join(',');
  const front = [p(0, 0, d), p(w, 0, d), p(w, h, d), p(0, h, d)].join(' ');
  const top = [p(0, h, 0), p(w, h, 0), p(w, h, d), p(0, h, d)].join(' ');
  const side = [p(w, 0, 0), p(w, h, 0), p(w, h, d), p(w, 0, d)].join(' ');
  // מיון לפי המרחק מהצופה: מה שקרוב יותר מצויר אחרון
  const depth = x + z + y * 0.001;
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
  wall,
  units,
  selectedId,
  onSelect,
  inside,
  finishHex,
}: {
  wall: Wall;
  units: PlacedUnit[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** חזיתות מוסתרות — רואים את הגוף והמדפים */
  inside: boolean;
  finishHex: Record<string, string>;
}) {
  const t = MATERIAL.carcassMm;
  const faces: (Face & { unitId?: string })[] = [];

  // רצפה וקיר, כדי שהארונות לא ירחפו בחלל
  const floorPts = [
    project(0, 0, 0),
    project(wall.lengthMm, 0, 0),
    project(wall.lengthMm, 0, 800),
    project(0, 0, 800),
  ]
    .map((p) => p.join(','))
    .join(' ');
  const wallPts = [
    project(0, 0, 0),
    project(wall.lengthMm, 0, 0),
    project(wall.lengthMm, wall.heightMm, 0),
    project(0, wall.heightMm, 0),
  ]
    .map((p) => p.join(','))
    .join(' ');

  for (const u of units) {
    const tone =
      (inside ? u.carcassFinishId : (u.frontFinishId ?? u.finishId)) &&
      finishHex[(inside ? u.carcassFinishId : (u.frontFinishId ?? u.finishId))!]
        ? finishHex[(inside ? u.carcassFinishId : (u.frontFinishId ?? u.finishId))!]
        : '#d9c3a5';
    const carcassTone = u.carcassFinishId ? (finishHex[u.carcassFinishId] ?? '#e8dcc8') : '#e8dcc8';

    const socle = u.socleMm ?? 0;
    const x = u.xMm;
    const y = u.yMm + socle;
    const h = Math.max(u.heightMm - socle, 0);
    const w = u.widthMm;
    const d = u.depthMm;
    const add = (f: Face[]) => faces.push(...f.map((x) => ({ ...x, unitId: u.id })));

    // רגליים
    if (socle > 0) {
      add(box(x + 20, u.yMm, 40, w - 40, socle, d - 60, shade(carcassTone, 0.7), `${u.id}-soc`));
    }

    // גוף: שני צדדים, תחתית, תקרה וגב
    const gs = u.glassSides ?? {};
    if (!gs.start) add(box(x, y, 0, t, h, d, carcassTone, `${u.id}-l`));
    if (!gs.end) add(box(x + w - t, y, 0, t, h, d, carcassTone, `${u.id}-r`));
    add(box(x + t, y, 0, w - 2 * t, t, d, carcassTone, `${u.id}-b`));
    add(box(x + t, y + h - t, 0, w - 2 * t, t, d, carcassTone, `${u.id}-t`));
    if ((u.backKind ?? 'thin') !== 'none') {
      add(box(x + t, y + t, 0, w - 2 * t, h - 2 * t, 6, shade(carcassTone, 0.86), `${u.id}-bk`));
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
            add(box(cx, zBottom + (zh - sy), 0, cw, t, d - 20, carcassTone, `${zk}-sh-${i}-${sy}`));
          }
        }
        if (cell.content.kind === 'rod') {
          add(box(cx, zBottom + zh * 0.86, d / 2 - 15, cw, 30, 30, '#a8a29e', `${zk}-rod-${i}`));
        }
        if (cell.content.kind === 'drawers') {
          const rows = cell.content.drawers ?? 1;
          for (let r = 0; r < rows; r++) {
            const dh = zh / rows;
            add(
              box(
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
          add(box(cx, zBottom, 0, t, zh, d - 20, carcassTone, `${zk}-div-${i}`));
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
    if (e.start) add(box(x - MATERIAL.frontMm, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-l`));
    if (e.end) add(box(x + w, y, 0, MATERIAL.frontMm, h, pd, eTone, `${u.id}-ep-r`));
    if (e.top) add(box(x, y + h, 0, w, MATERIAL.frontMm, pd, eTone, `${u.id}-ep-t`));
  }

  // אלגוריתם הצייר: הרחוק מצויר קודם
  faces.sort((a, b) => a.depth - b.depth);

  const pts = [
    project(0, 0, 0),
    project(wall.lengthMm, 0, 0),
    project(0, wall.heightMm, 0),
    project(wall.lengthMm, wall.heightMm, 800),
    project(0, 0, 800),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
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
      <polygon points={floorPts} fill="#f0efec" />
      <polygon points={wallPts} fill="#f7f6f4" stroke="#e7e5e4" strokeWidth={stroke} />

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
    </svg>
  );
}
