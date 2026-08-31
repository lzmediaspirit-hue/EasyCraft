import type { PlacedUnit, Wall } from '../../db/types';

/**
 * תצוגה זעירה של קיר — הארונות שעליו כמלבנים.
 * יושבת בתוך לשונית הקיר, כדי שיהיה ברור על איזה קיר עובדים
 * עוד לפני שמחליפים אליו.
 */
export function WallThumb({
  wall,
  units,
  active,
}: {
  wall: Wall;
  units: PlacedUnit[];
  active: boolean;
}) {
  const mine = units.filter((u) => u.wallId === wall.id);
  const line = active ? '#ffffff' : '#57534e';
  const fill = active ? 'rgba(255,255,255,0.55)' : 'rgba(120,113,108,0.45)';

  return (
    <svg
      viewBox={`0 0 ${wall.lengthMm} ${wall.heightMm}`}
      preserveAspectRatio="none"
      className="h-4 w-7 shrink-0 rounded-sm"
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={wall.lengthMm}
        height={wall.heightMm}
        fill="none"
        stroke={line}
        strokeWidth={wall.lengthMm / 40}
      />
      {mine.map((u) => (
        <rect
          key={u.id}
          x={u.xMm}
          y={wall.heightMm - u.yMm - u.heightMm}
          width={u.widthMm}
          height={u.heightMm}
          fill={fill}
        />
      ))}
    </svg>
  );
}
