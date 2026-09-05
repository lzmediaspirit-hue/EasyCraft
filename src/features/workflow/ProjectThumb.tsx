import { WORK_TONES, tracksWork, workTone } from '../../workflow/unitWork';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * תמונה זעירה של הפרויקט כולו — כל הקירות זה לצד זה, והארגזים
 * צבועים לפי מצב העבודה שלהם.
 *
 * זה מה שהופך שורה ברשימה לפרויקט מוכר: הנגר זוכר את המטבח שלו
 * לפי הצורה, לא לפי השם. הצבע כאן הוא אותו צבע שבהדמיה, כדי שמה
 * שרואים ברשימה יהיה מה שנפתח בלחיצה.
 */
export function ProjectThumb({
  walls,
  units,
  className = 'h-12 w-20',
}: {
  walls: Wall[];
  units: PlacedUnit[];
  className?: string;
}) {
  if (!walls.length) return null;

  /* הקירות נפרסים לרוחב, עם רווח קטן ביניהם כדי שיישארו נפרדים */
  const gap = Math.max(...walls.map((w) => w.lengthMm)) * 0.05;
  const height = Math.max(...walls.map((w) => w.heightMm));
  let x = 0;
  const placed = walls.map((w) => {
    const at = x;
    x += w.lengthMm + gap;
    return { wall: w, x: at };
  });
  const width = Math.max(x - gap, 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMax meet"
      className={`${className} shrink-0 rounded-md bg-stone-100`}
      aria-hidden="true"
    >
      {placed.map(({ wall, x: wx }) => (
        <g key={wall.id} transform={`translate(${wx} 0)`}>
          <rect
            x={0}
            y={height - wall.heightMm}
            width={wall.lengthMm}
            height={wall.heightMm}
            fill="none"
            stroke="#d6d3d1"
            strokeWidth={width / 200}
          />
          {units
            .filter((u) => u.wallId === wall.id)
            .map((u) => {
              // ארגז שאינו נספר בייצור מצויר אפור: הוא נמצא, ולא בעבודה
              const tone = tracksWork(u) ? WORK_TONES[workTone(u)] : null;
              return (
                <rect
                  key={u.id}
                  x={u.xMm}
                  y={height - u.yMm - u.heightMm}
                  width={u.widthMm}
                  height={u.heightMm}
                  fill={tone?.fill ?? '#f5f5f4'}
                  stroke={tone?.stroke ?? '#d6d3d1'}
                  strokeWidth={width / 300}
                />
              );
            })}
        </g>
      ))}
    </svg>
  );
}
