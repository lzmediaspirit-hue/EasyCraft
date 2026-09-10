import { useMemo } from 'react';
import { buildScene } from './isoScene';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * תמונה קטנה של החדר, לכרטיס הצעה.
 *
 * לא ציור נפרד אלא אותו מנוע שמצייר את ההדמיה הגדולה: אותם לוחות,
 * אותו סדר ואותן פאות. מה שנראה כאן הוא בדיוק מה שיעמוד על הקיר
 * ברגע שההצעה תיבחר, ולא הבטחה שמישהו יצייר בנפרד ותתיישן.
 *
 * התמונה סטטית ואין בה אירועים — היא חלק מכפתור, ומי שנוגע בה
 * בוחר את ההצעה.
 */
export function PlanThumb({
  walls,
  units,
  className = 'h-28 w-full',
}: {
  walls: Wall[];
  units: PlacedUnit[];
  className?: string;
}) {
  const scene = useMemo(
    () =>
      buildScene({
        walls,
        units,
        activeWallId: walls[0]?.id ?? '',
        selectedId: null,
        inside: false,
        finishHex: {},
        /* מצב הצגה: בלי קווי שרטוט בין לוח ללוח, כמו שמראים ללקוח */
        present: true,
        view: { yawDeg: -30, rise: 0.62 },
      }),
    [walls, units],
  );

  const { faces, backdrops, floor, bounds } = scene;
  /* המסגרת שמכילה הכול — פרישה של אלפי נקודות ל-Math.min יקרה */
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [qx, qy] of bounds) {
    if (qx < x0) x0 = qx;
    if (qx > x1) x1 = qx;
    if (qy < y0) y0 = qy;
    if (qy > y1) y1 = qy;
  }
  if (!Number.isFinite(x0)) return null;
  const pad = 300;
  const vbW = x1 - x0 + pad * 2;
  const stroke = Math.max(vbW / 500, 4);

  return (
    <svg
      viewBox={`${x0 - pad} ${y0 - pad} ${vbW} ${y1 - y0 + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <polygon points={floor} fill="#efece7" />
      {backdrops.map((b) => (
        <g key={b.key}>
          {b.thickness.map((t, i) => (
            <polygon key={`th-${i}`} points={t} fill="#e9e5df" />
          ))}
          {b.wall && <polygon points={b.wall} fill="#f2efea" />}
          {b.onWall.map((f) => (
            <polygon key={f.key} points={f.points} fill={f.tone} fillOpacity={0.9} />
          ))}
        </g>
      ))}
      {faces.map((f) => (
        <polygon
          key={f.key}
          points={f.points}
          fill={f.fill}
          fillOpacity={f.glass ? 0.42 : undefined}
          stroke="rgba(87,83,78,0.22)"
          strokeWidth={stroke * 0.4}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
