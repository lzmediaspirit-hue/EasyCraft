import { useRef } from 'react';
import { CabinetGlyph } from '../../catalog/CabinetGlyph';
import { featureDef } from '../projects/wallFeatures';
import { cm } from '../../ui/units';
import type { PlacedUnit, Wall } from '../../db/types';

/** מרחק הצמדה בין ארגזים ולקצות הקיר (מ"מ). */
const SNAP = 60;

type Props = {
  wall: Wall;
  units: PlacedUnit[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number) => void;
};

/**
 * הדמיית חזית של קיר אחד — ציור 2D פשוט של ארגזים.
 * גרירה אופקית מזיזה ארגז, עם הצמדה לשכן ולקצה הקיר.
 */
export function WallElevation({ wall, units, selectedId, onSelect, onMove }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; startX: number; originX: number; scale: number } | null>(null);

  const padX = 120;
  const padTop = 140;
  const padBottom = 340;
  const vbW = wall.lengthMm + padX * 2;
  const vbH = wall.heightMm + padTop + padBottom;
  const stroke = Math.max(wall.lengthMm / 420, 4);

  /** גובה המסך של נקודה שנמדדת מהרצפה. */
  const flip = (yFromFloor: number) => wall.heightMm - yFromFloor;

  function beginDrag(e: React.PointerEvent, unit: PlacedUnit) {
    onSelect(unit.id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: unit.id,
      startX: e.clientX,
      originX: unit.xMm,
      scale: vbW / rect.width,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const unit = units.find((u) => u.id === d.id);
    if (!unit) return;
    const raw = d.originX + (e.clientX - d.startX) * d.scale;
    onMove(d.id, snap(raw, unit, units, wall.lengthMm));
  }

  function endDrag(e: React.PointerEvent) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${-padX} ${-padTop} ${vbW} ${vbH}`}
      className="w-full touch-pan-y select-none"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {/* הקיר עצמו */}
      <rect x={0} y={0} width={wall.lengthMm} height={wall.heightMm} fill="#faf9f7" />
      <rect
        x={0}
        y={0}
        width={wall.lengthMm}
        height={wall.heightMm}
        fill="none"
        stroke="#d6d3d1"
        strokeWidth={stroke}
      />

      {/* סימונים על הקיר — מצוירים מתחת לארגזים */}
      {wall.features.map((f) => {
        const def = featureDef(f.kind);
        const w = Math.max(f.widthMm, 90);
        const h = Math.max(f.heightMm, 90);
        return (
          <g key={f.id}>
            <rect
              x={f.xMm}
              y={flip(f.yMm + h)}
              width={w}
              height={h}
              fill={def.tone}
              fillOpacity={0.5}
              stroke={def.tone}
              strokeWidth={stroke}
              strokeDasharray={`${stroke * 4} ${stroke * 3}`}
            />
          </g>
        );
      })}

      {/* רצפה */}
      <line
        x1={-padX * 0.6}
        y1={wall.heightMm}
        x2={wall.lengthMm + padX * 0.6}
        y2={wall.heightMm}
        stroke="#57534e"
        strokeWidth={stroke * 1.8}
        strokeLinecap="round"
      />

      {/* סוקלים ומשטחי עבודה — נגזרים מהארגז, לא נבחרים בנפרד */}
      {units.map((u) => (
        <g key={`trim-${u.id}`}>
          {!!u.socleMm && (
            <rect
              x={u.xMm + u.widthMm * 0.03}
              y={flip(u.socleMm)}
              width={u.widthMm * 0.94}
              height={u.socleMm}
              fill="#e7e5e4"
              stroke="#d6d3d1"
              strokeWidth={stroke * 0.7}
            />
          )}
          {!!u.counterMm && (
            <rect
              x={u.xMm - 20}
              y={flip(u.yMm + u.heightMm + u.counterMm)}
              width={u.widthMm + 40}
              height={u.counterMm}
              fill="#78716c"
            />
          )}
        </g>
      ))}

      {/* הארגזים */}
      {units.map((u) => {
        const selected = u.id === selectedId;
        return (
          <g
            key={u.id}
            transform={`translate(${u.xMm} ${flip(u.yMm + u.heightMm)})`}
            onPointerDown={(e) => beginDrag(e, u)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="cursor-grab active:cursor-grabbing"
          >
            <rect
              width={u.widthMm}
              height={u.heightMm}
              fill={selected ? '#f4e9d8' : '#ffffff'}
              stroke="transparent"
            />
            <g className={selected ? 'text-oak-700' : 'text-stone-500'}>
              <CabinetGlyph
                glyph={u.glyph}
                w={u.widthMm}
                h={u.heightMm}
                doors={u.doors}
                drawers={u.drawers}
                stroke={selected ? stroke * 1.7 : stroke}
              />
            </g>
            {selected && (
              <rect
                x={-stroke * 2}
                y={-stroke * 2}
                width={u.widthMm + stroke * 4}
                height={u.heightMm + stroke * 4}
                fill="none"
                stroke="#a06236"
                strokeWidth={stroke * 1.4}
                strokeDasharray={`${stroke * 5} ${stroke * 4}`}
              />
            )}
          </g>
        );
      })}

      {/* תוויות הסימונים — מעל הארגזים, כדי שיישארו קריאות */}
      {wall.features.map((f) => {
        const def = featureDef(f.kind);
        const w = Math.max(f.widthMm, 90);
        const h = Math.max(f.heightMm, 90);
        // התווית נצמדת פנימה בקצוות, כדי שלא תיחתך מחוץ לציור
        const center = f.xMm + w / 2;
        const nearStart = center < wall.lengthMm * 0.18;
        const nearEnd = center > wall.lengthMm * 0.82;
        return (
          <text
            key={`label-${f.id}`}
            x={nearStart ? f.xMm : nearEnd ? f.xMm + w : center}
            y={flip(f.yMm + h) - stroke * 5}
            textAnchor={nearStart ? 'start' : nearEnd ? 'end' : 'middle'}
            fontSize={Math.max(wall.lengthMm / 44, 65)}
            fill="#57534e"
            direction="ltr"
          >
            {def.label}
          </text>
        );
      })}

      {/* קו מידה של הקיר */}
      <g stroke="#a8a29e" strokeWidth={stroke * 0.9}>
        <line x1={0} y1={wall.heightMm + 150} x2={wall.lengthMm} y2={wall.heightMm + 150} />
        <line x1={0} y1={wall.heightMm + 90} x2={0} y2={wall.heightMm + 210} />
        <line
          x1={wall.lengthMm}
          y1={wall.heightMm + 90}
          x2={wall.lengthMm}
          y2={wall.heightMm + 210}
        />
      </g>
      <text
        x={wall.lengthMm / 2}
        y={wall.heightMm + 300}
        textAnchor="middle"
        fontSize={Math.max(wall.lengthMm / 34, 90)}
        fill="#78716c"
        direction="ltr"
      >
        {cm(wall.lengthMm)}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/** מצמיד ארגז לקצות הקיר ולשכנים באותו מפלס. */
function snap(x: number, unit: PlacedUnit, units: PlacedUnit[], wallLength: number): number {
  const targets = [0, wallLength - unit.widthMm];
  for (const other of units) {
    if (other.id === unit.id || other.level !== unit.level) continue;
    targets.push(other.xMm + other.widthMm, other.xMm - unit.widthMm);
  }
  let best = x;
  let bestDist = SNAP;
  for (const t of targets) {
    const d = Math.abs(t - x);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return Math.round(Math.min(Math.max(best, 0), Math.max(wallLength - unit.widthMm, 0)));
}
