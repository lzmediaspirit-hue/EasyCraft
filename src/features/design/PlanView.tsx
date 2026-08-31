import { buildPlan, DEFAULT_TURN_DEG } from './plan';
import { wallName } from '../projects/wallLayouts';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { selectOnFocus } from '../../ui/Field';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * מבט על של החדר.
 *
 * הקירות משורשרים לפי האורך והזווית שלהם, והרצועה הכהה לאורך כל קיר
 * היא עומק הארונות שעליו. כך רואים מיד איפה שתי שורות ארונות נפגשות
 * בפינה — שם הן מתנגשות בפועל.
 */
export function PlanView({
  walls,
  units,
  activeWallId,
  onSelectWall,
  onChangeWall,
}: {
  walls: Wall[];
  units: PlacedUnit[];
  activeWallId: string;
  onSelectWall: (id: string) => void;
  onChangeWall: (id: string, patch: Partial<Wall>) => void;
}) {
  const plan = buildPlan(walls, units);

  const xs = plan.flatMap((p) => [p.start.x, p.end.x]);
  const ys = plan.flatMap((p) => [p.start.y, p.end.y]);
  const pad = 700;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const stroke = Math.max(Math.max(w, h) / 260, 8);
  const fontSize = Math.max(Math.max(w, h) / 28, 90);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-2">
        <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="w-full select-none">
          {plan.map((p) => {
            const active = p.wall.id === activeWallId;
            // הרצועה מצוירת בצד אחד של הקיר, בעובי הארונות שעליו
            const rad = (p.headingDeg * Math.PI) / 180;
            const nx = -Math.sin(rad);
            const ny = Math.cos(rad);
            const d = p.depthMm;
            return (
              <g key={p.wall.id} onClick={() => onSelectWall(p.wall.id)} className="cursor-pointer">
                {d > 0 && (
                  <path
                    d={`M ${p.start.x} ${p.start.y} L ${p.end.x} ${p.end.y} L ${p.end.x + nx * d} ${
                      p.end.y + ny * d
                    } L ${p.start.x + nx * d} ${p.start.y + ny * d} Z`}
                    fill={active ? '#d9b483' : '#e7e5e4'}
                    stroke={active ? '#a06236' : '#d6d3d1'}
                    strokeWidth={stroke * 0.5}
                  />
                )}
                <line
                  x1={p.start.x}
                  y1={p.start.y}
                  x2={p.end.x}
                  y2={p.end.y}
                  stroke={active ? '#1c1917' : '#78716c'}
                  strokeWidth={active ? stroke * 1.6 : stroke}
                  strokeLinecap="round"
                />
                <text
                  x={(p.start.x + p.end.x) / 2 - nx * 260}
                  y={(p.start.y + p.end.y) / 2 - ny * 260}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill={active ? '#1c1917' : '#78716c'}
                  fontWeight={active ? 700 : 400}
                  direction="ltr"
                >
                  {cm(p.wall.lengthMm)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="space-y-1.5">
        {walls.map((wall, i) => {
          const mine = units.filter((u) => u.wallId === wall.id);
          return (
          <li
            key={wall.id}
            className={`rounded-xl border px-3 py-2 ${
              wall.id === activeWallId ? 'border-oak-400 bg-oak-50' : 'border-stone-200 bg-white'
            }`}
          >
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectWall(wall.id)}
              className="min-w-0 flex-1 text-start text-sm font-medium text-stone-800"
            >
              {wallName(i)}
            </button>

            <label className="flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1">
              <span className="text-[10px] text-stone-500">אורך</span>
              <MeasureInput
                value={wall.lengthMm}
                onChange={(mm) => onChangeWall(wall.id, { lengthMm: mm })}
                minMm={300}
                ariaLabel={`אורך ${wallName(i)}`}
                className="num w-12 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
              />
            </label>

            {i > 0 && (
              <label className="flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1">
                <span className="text-[10px] text-stone-500">פנייה</span>
                <input
                  value={wall.turnDeg ?? DEFAULT_TURN_DEG}
                  onChange={(e) =>
                    onChangeWall(wall.id, { turnDeg: Number(e.target.value) || 0 })
                  }
                  onFocus={selectOnFocus}
                  type="number"
                  inputMode="numeric"
                  aria-label={`זווית ${wallName(i)}`}
                  className="num w-10 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">°</span>
              </label>
            )}
          </div>

          {/* שמות הארונות שעל הקיר והמידה של כל אחד */}
          {mine.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 border-t border-stone-200/70 pt-1.5">
              {mine.map((u) => (
                <li key={u.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className="min-w-0 flex-1 truncate text-stone-600">{u.name}</span>
                  <span className="num shrink-0 text-stone-500">
                    {cm(u.widthMm)}×{cm(u.heightMm)}×{cm(u.depthMm)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </li>
          );
        })}
      </ul>

      <p className="text-xs leading-snug text-stone-500">
        פנייה של 90° היא פינה ישרה. שנה את הזווית כדי לתאר חדר שאינו מלבן —
        הרצועה לאורך כל קיר היא עומק הארונות שעליו, ושם שתי שורות נפגשות.
      </p>
    </div>
  );
}
