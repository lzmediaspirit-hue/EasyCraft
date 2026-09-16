import { buildPlan, planUnits, DEFAULT_TURN_DEG } from './plan';
import { outOfSight } from './designView';
import { wallName } from '../projects/wallLayouts';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { selectOnFocus } from '../../ui/Field';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import type { PlacedUnit, Wall } from '../../db/types';
import { rad } from './placement';

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
  onAddWall,
  onRemoveWall,
}: {
  walls: Wall[];
  units: PlacedUnit[];
  activeWallId: string;
  onSelectWall: (id: string) => void;
  onChangeWall: (id: string, patch: Partial<Wall>) => void;
  /** הוספת קיר בסוף השרשרת — חדר לא תמיד מסתיים בארבעה קירות */
  onAddWall: () => void;
  onRemoveWall: (id: string) => void;
  /** העליונים יורדים מהתמונה */
}) {
  const plan = buildPlan(walls, units);
  const boxes = planUnits(plan, units);
  const clashes = boxes.filter((b) => b.clash);

  const pts = [...plan.flatMap((p) => [p.start, p.end]), ...boxes.flatMap((b) => b.corners)];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
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
            const a = rad(p.headingDeg);
            const nx = -Math.sin(a);
            const ny = Math.cos(a);
            const d = p.depthMm;
            return (
              <g key={p.wall.id} onClick={() => onSelectWall(p.wall.id)} className="cursor-pointer">
                {/* רצועת העומק נשארת כרקע חיוור; הארונות עצמם מצוירים מעליה */}
                {d > 0 && (
                  <path
                    d={`M ${p.start.x} ${p.start.y} L ${p.end.x} ${p.end.y} L ${p.end.x + nx * d} ${
                      p.end.y + ny * d
                    } L ${p.start.x + nx * d} ${p.start.y + ny * d} Z`}
                    fill={active ? '#f2e6d5' : '#f5f5f4'}
                    stroke="none"
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

          {/*
            כל ארון כמלבן ברוחב ובעומק שלו. ארון שחודר לתוך ארון
            אחר מסומן באדום — זו התנגשות שבמבט חזית לא רואים בכלל.
          */}
          {/* ארגז מוסתר עדיין נמדד ונבדק להתנגשות, רק אינו מצויר */}
          {boxes.filter((b) => !outOfSight(b.unit)).map((b) => (
            <g key={b.unit.id} pointerEvents="none">
              <polygon
                data-plan-unit={b.unit.id}
                points={b.corners.map((c) => `${c.x},${c.y}`).join(' ')}
                fill={b.clash ? '#fecaca' : b.unit.level === 'wall' ? '#e7e5e4' : '#d9b483'}
                fillOpacity={b.unit.level === 'wall' ? 0.55 : 0.9}
                stroke={b.clash ? '#dc2626' : '#a06236'}
                strokeWidth={stroke * (b.clash ? 1.2 : 0.6)}
                strokeDasharray={b.unit.level === 'wall' ? `${stroke * 4} ${stroke * 3}` : undefined}
              />
              <text
                x={b.center.x}
                y={b.center.y + fontSize * 0.3}
                textAnchor="middle"
                fontSize={fontSize * 0.8}
                fill={b.clash ? '#7f1d1d' : '#44403c'}
                direction="ltr"
              >
                {cm(b.unit.widthMm)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {clashes.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl border border-red-200 bg-red-50 p-3">
          {[...new Set(clashes.map((c) => c.unit.name))].map((name) => (
            <li key={name} className="text-sm leading-snug text-red-900">
              {name} חודר לתוך ארון אחר
            </li>
          ))}
        </ul>
      )}

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

            {walls.length > 1 && (
              <button
                onClick={() => onRemoveWall(wall.id)}
                aria-label={`מחיקת ${wallName(i)}`}
                className="shrink-0 rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="size-4" />
              </button>
            )}

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

      <button
        onClick={onAddWall}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:border-oak-400 hover:text-oak-700"
      >
        <PlusIcon className="size-4" />
        קיר נוסף
      </button>

      <p className="text-xs leading-snug text-stone-500">
        פנייה של 90° היא פינה ישרה. שנה את הזווית כדי לתאר חדר שאינו מלבן.
        כל מלבן הוא ארון ברוחב ובעומק שלו; מקווקו הוא ארון תלוי, ואדום
        הוא ארון שחודר לתוך ארון אחר.
      </p>
    </div>
  );
}
