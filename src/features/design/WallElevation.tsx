import { useRef } from 'react';
import { CabinetGlyph, autoShelves, shelfYs } from '../../catalog/CabinetGlyph';
import { unitZones, zoneBands } from '../../catalog/zones';
import { featureDef } from '../projects/wallFeatures';
import { MATERIAL } from '../../catalog/standards';
import { cm } from '../../ui/units';
import type { PlacedUnit, Wall } from '../../db/types';

/** מרחק הצמדה בין ארגזים ולקצות הקיר (מ"מ). */
const SNAP = 60;
/** גרירה חופשית נוחתת על סנטימטרים שלמים, לא על מידות שבורות. */
const STEP = 10;

export type MeasureAxis = 'w' | 'h' | 'd';

type Props = {
  wall: Wall;
  units: PlacedUnit[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
  /** הסתרת חזיתות — תצוגת פנים הארונות */
  inside: boolean;
  /** גוון לכל ארגז, לפי מזהה הגוון */
  finishHex: Record<string, string>;
  /** מצב מדידה פעיל, והציר שנמדד */
  measure?: MeasureAxis | null;
  /** רוחב אזורי הפינה בשני קצות הקיר, שנתפסים בידי הקיר השכן */
  corners?: { startMm: number; endMm: number };
  /** גרירת מדף בתוך הארון, במצב תצוגת פנים */
  onMoveShelf?: (unitId: string, zoneId: string, gapsMm: number[]) => void;
};

/**
 * הדמיית חזית של קיר אחד.
 * גרירה מזיזה ארגז לרוחב, ואם הוא לא נעול לרצפה גם לגובה,
 * עם הצמדה לשכנים, לרצפה ולתקרה.
 */
export function WallElevation({
  wall,
  units,
  selectedId,
  onSelect,
  onMove,
  inside,
  finishHex,
  measure,
  corners,
  onMoveShelf,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const shelfDrag = useRef<{ unitId: string; zoneId: string; index: number } | null>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    scale: number;
  } | null>(null);

  const padX = 120;
  const padTop = 140;
  const padBottom = 340;
  const vbW = wall.lengthMm + padX * 2;
  const vbH = wall.heightMm + padTop + padBottom;
  const stroke = Math.max(wall.lengthMm / 420, 4);
  const fontSize = Math.max(wall.lengthMm / 40, 70);

  /** גובה המסך של נקודה שנמדדת מהרצפה. */
  const flip = (yFromFloor: number) => wall.heightMm - yFromFloor;

  function beginDrag(e: React.PointerEvent, unit: PlacedUnit) {
    onSelect(unit.id);
    // במצב מדידה ההקשה רק בוחרת ארגז, בלי להזיז אותו בטעות
    if (measure) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: unit.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: unit.xMm,
      originY: unit.yMm,
      scale: vbW / rect.width,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const unit = units.find((u) => u.id === d.id);
    if (!unit) return;

    const rawX = d.originX + (e.clientX - d.startX) * d.scale;
    // מסך גדל כלפי מטה, הקיר נמדד כלפי מעלה — ולכן הסימן הפוך
    const rawY = d.originY - (e.clientY - d.startY) * d.scale;

    const x = snapX(rawX, unit, units, wall.lengthMm, corners);
    const y = unit.floorLocked ? unit.yMm : snapY(rawY, unit, units, wall.heightMm);
    onMove(d.id, x, y);
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

      {/* אזורי הפינה — שם הארונות של הקיר השכן תופסים מקום */}
      {corners && (
        <g pointerEvents="none">
          {corners.startMm > 0 && (
            <CornerBand x={0} width={corners.startMm} height={wall.heightMm} stroke={stroke} />
          )}
          {corners.endMm > 0 && (
            <CornerBand
              x={wall.lengthMm - corners.endMm}
              width={corners.endMm}
              height={wall.heightMm}
              stroke={stroke}
            />
          )}
        </g>
      )}

      {/* סימונים על הקיר — מצוירים מתחת לארגזים */}
      {wall.features.map((f) => {
        const def = featureDef(f.kind);
        const w = Math.max(f.widthMm, 90);
        const h = Math.max(f.heightMm, 90);
        return (
          <rect
            key={f.id}
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
        );
      })}

      <line
        x1={-padX * 0.6}
        y1={wall.heightMm}
        x2={wall.lengthMm + padX * 0.6}
        y2={wall.heightMm}
        stroke="#57534e"
        strokeWidth={stroke * 1.8}
        strokeLinecap="round"
      />

      {/* רגליים ומשטחי עבודה — נגזרים מהארגז, לא נבחרים בנפרד */}
      {units.map((u) => (
        <g key={`trim-${u.id}`}>
          {!!u.socleMm && (
            <rect
              x={u.xMm + u.widthMm * 0.03}
              y={flip(u.yMm + u.socleMm)}
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
        /*
         * בחזית רואים את גוון החזיתות; כשהחזיתות מוסתרות רואים את
         * הגוף עצמו, ולכן הוא נצבע בגוון הגוף — וזה מה שהלקוח יראה
         * כשייפתח הארון.
         */
        const frontFinish = u.frontFinishId ?? u.finishId;
        const shownFinish = inside ? u.carcassFinishId : frontFinish;
        const hex = shownFinish ? finishHex[shownFinish] : undefined;
        // גוון כהה מחייב קווים בהירים, אחרת האיור נבלע בו
        const dark = hex ? isDark(hex) : false;
        const lineColor = dark ? '#f5f5f4' : selected ? '#814c2e' : '#78716c';
        const fill = hex ?? (selected ? '#f4e9d8' : '#ffffff');
        // הגובה כולל את הרגליים; הגוף עצמו מתחיל מעליהן
        const carcassH = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
        // הגב יושב עמוק יותר ולכן נראה כהה מעט מהגוף; בלי גב רואים את הקיר
        const backKind = u.backKind ?? 'thin';
        const backFill =
          backKind === 'none' ? null : hex ? shade(hex, backKind === 'carcass' ? 0.9 : 0.82) : '#f0ede8';

        return (
          <g
            key={u.id}
            transform={`translate(${u.xMm} ${flip(u.yMm + u.heightMm)})`}
            onPointerDown={(e) => beginDrag(e, u)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={measure ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
          >
            <rect width={u.widthMm} height={carcassH} fill={fill} stroke="transparent" />
            {/* פנים הארון: הגב נראה מאחורי המדפים והמגירות */}
            {inside && backFill && (
              <rect
                x={stroke * 2}
                y={stroke * 2}
                width={Math.max(u.widthMm - stroke * 4, 0)}
                height={Math.max(carcassH - stroke * 4, 0)}
                fill={backFill}
                stroke="transparent"
              />
            )}
            <g color={lineColor}>
              <CabinetGlyph
                glyph={u.glyph}
                w={u.widthMm}
                h={carcassH}
                doors={u.doors}
                drawers={u.drawers}
                drawerCols={u.drawerCols}
                shelves={u.shelves}
                drawerStyle={u.drawerStyle}
                glassDoors={u.glassDoors}
                shelfGapsMm={u.shelfGapsMm}
                zones={u.zones}
                opening={u.opening}
                corner={u.corner}
                blindMm={u.blindMm}
                stroke={selected ? stroke * 1.7 : stroke}
                inside={inside}
              />
            </g>
            {ledStrips(u, stroke, carcassH)}
            {exposedPanels(u, stroke, carcassH)}
            {selected && (
              <rect
                x={-stroke * 2}
                y={-stroke * 2}
                width={u.widthMm + stroke * 4}
                height={carcassH + stroke * 4}
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

      {/* מדפים נגררים — רק כשרואים את פנים הארון ורק בארגז הנבחר */}
      {inside && onMoveShelf && selectedId
        ? shelfHandles({
            u: units.find((u) => u.id === selectedId),
            wallHeight: wall.heightMm,
            padTop,
            vbW,
            stroke,
            svgRef,
            dragRef: shelfDrag,
            onMoveShelf,
          })
        : null}

      {/* מדידה של הארגז שנבחר */}
      {measure && selectedId
        ? measureOverlay(
            units.find((u) => u.id === selectedId),
            measure,
            flip,
            stroke,
            fontSize,
          )
        : null}

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

/**
 * ידיות גרירה למדפים.
 * במצב תצוגת פנים כל מדף בארגז הנבחר הופך לפס שאפשר לגרור, והמרווחים
 * באזור מחושבים מחדש מהמיקומים — כך שגובה המדף נקבע ישירות על הציור.
 */
function shelfHandles({
  u,
  wallHeight,
  padTop,
  vbW,
  stroke,
  svgRef,
  dragRef,
  onMoveShelf,
}: {
  u: PlacedUnit | undefined;
  wallHeight: number;
  padTop: number;
  vbW: number;
  stroke: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
  dragRef: React.RefObject<{ unitId: string; zoneId: string; index: number } | null>;
  onMoveShelf: (unitId: string, zoneId: string, gapsMm: number[]) => void;
}) {
  if (!u) return null;
  const flip = (yFromFloor: number) => wallHeight - yFromFloor;
  const handles: React.ReactNode[] = [];

  const bodyH = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
  for (const { zone, top, bottom } of zoneBands(unitZones({ ...u, heightMm: bodyH }), bodyH)) {
    if (zone.kind !== 'shelves' || !(zone.shelves ?? 0)) continue;
    const zoneH = bottom - top;
    // מיקומי המדפים ביחס לתחתית האזור, מלמטה למעלה
    const ys = shelfYs({ shelves: zone.shelves ?? 0, gaps: zone.shelfGapsMm }, top, bottom);
    const positions = ys.map((y) => bottom - y).sort((a, b) => a - b);

    positions.forEach((posFromBottom, index) => {
      // המרה חזרה לגובה על הקיר: תחתית האזור נמדדת מתחתית הארגז
      const zoneBottomFromUnitBottom = (u.socleMm ?? 0) + (bodyH - bottom);
      const yOnWall = u.yMm + zoneBottomFromUnitBottom + posFromBottom;

      const move = (clientY: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        // מסך → קואורדינטות הציור → גובה מהרצפה → גובה בתוך האזור
        const scale = vbW / rect.width;
        const drawY = (clientY - rect.top) * scale - padTop;
        const fromFloor = wallHeight - drawY;
        const raw = fromFloor - u.yMm - zoneBottomFromUnitBottom;
        const lo = (positions[index - 1] ?? 0) + 20;
        const hi = (positions[index + 1] ?? zoneH) - 20;
        const clamped = Math.round(Math.min(Math.max(raw, lo), hi) / 10) * 10;

        const next = [...positions];
        next[index] = clamped;
        onMoveShelf(u.id, zone.id, gapsFromPositions(next, zoneH));
      };

      handles.push(
        <rect
          key={`sh-${zone.id}-${index}`}
          x={u.xMm}
          y={flip(yOnWall) - stroke * 5}
          width={u.widthMm}
          height={stroke * 10}
          fill="#0f766e"
          fillOpacity={0.16}
          stroke="#0f766e"
          strokeWidth={stroke * 0.8}
          className="cursor-ns-resize"
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            dragRef.current = { unitId: u.id, zoneId: zone.id, index };
          }}
          onPointerMove={(e) => {
            if (dragRef.current?.zoneId !== zone.id || dragRef.current.index !== index) return;
            e.stopPropagation();
            move(e.clientY);
          }}
          onPointerUp={(e) => {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        />,
      );
    });
  }

  return <g>{handles}</g>;
}

/** ממיר מיקומי מדפים למרווחים בין מדפים. */
function gapsFromPositions(positions: number[], zoneH: number): number[] {
  const gaps: number[] = [];
  let prev = 0;
  for (const p of positions) {
    gaps.push(Math.max(Math.round(p - prev), 20));
    prev = p;
  }
  gaps.push(Math.max(Math.round(zoneH - prev), 20));
  return gaps;
}

/** סימון אזור פינה — רצועה מקווקוות שבה יושבים ארונות הקיר השכן. */
function CornerBand({
  x,
  width,
  height,
  stroke,
}: {
  x: number;
  width: number;
  height: number;
  stroke: number;
}) {
  return (
    <rect
      x={x}
      y={0}
      width={width}
      height={height}
      fill="#a8a29e"
      fillOpacity={0.14}
      stroke="#a8a29e"
      strokeWidth={stroke}
      strokeDasharray={`${stroke * 4} ${stroke * 3}`}
    />
  );
}

/** פסי לד מסומנים בקו ענבר בצד שבו הם מותקנים. */
function ledStrips(u: PlacedUnit, stroke: number, bodyH: number) {
  if (!u.led?.length) return null;
  const wide = stroke * 2.2;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (const spot of u.led) {
    if (spot === 'start') lines.push({ x1: wide, y1: 0, x2: wide, y2: bodyH });
    else if (spot === 'end')
      lines.push({ x1: u.widthMm - wide, y1: 0, x2: u.widthMm - wide, y2: bodyH });
    else if (spot === 'top') lines.push({ x1: 0, y1: wide, x2: u.widthMm, y2: wide });
    else if (spot === 'bottom')
      lines.push({ x1: 0, y1: bodyH - wide, x2: u.widthMm, y2: bodyH - wide });
    else if (spot === 'shelf') {
      const shelves = u.shelves ?? autoShelves(bodyH);
      for (const y of shelfYs({ shelves, gaps: u.shelfGapsMm }, 0, bodyH)) {
        lines.push({ x1: u.widthMm * 0.08, y1: y + wide, x2: u.widthMm * 0.92, y2: y + wide });
      }
    }
  }

  return (
    <g pointerEvents="none" stroke="#f59e0b" strokeWidth={wide} strokeLinecap="round">
      {lines.map((l, i) => (
        <line key={i} {...l} />
      ))}
    </g>
  );
}

/**
 * דפנות זרות מסומנות כרצועה מלאה בצד הגלוי.
 * בחזית רואים את עובי הלוח, ולכן הרצועה ברוחב עובי החומר.
 */
function exposedPanels(u: PlacedUnit, stroke: number, bodyH: number) {
  const e = u.exposed;
  if (!e) return null;
  const t = MATERIAL.frontMm;
  const bars: { x: number; y: number; w: number; h: number }[] = [];
  if (e.start) bars.push({ x: 0, y: 0, w: t, h: bodyH });
  if (e.end) bars.push({ x: u.widthMm - t, y: 0, w: t, h: bodyH });
  if (e.top) bars.push({ x: 0, y: 0, w: u.widthMm, h: t });
  if (e.bottom) bars.push({ x: 0, y: bodyH - t, w: u.widthMm, h: t });
  if (!bars.length) return null;

  return (
    <g pointerEvents="none">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill="#c8935a"
          stroke="#814c2e"
          strokeWidth={stroke * 0.6}
        />
      ))}
    </g>
  );
}

/** קו מידה על הארגז שנבחר, בציר שנבחר במצב מדידה. */
function measureOverlay(
  u: PlacedUnit | undefined,
  axis: MeasureAxis,
  flip: (y: number) => number,
  stroke: number,
  fontSize: number,
) {
  if (!u) return null;
  const tick = stroke * 12;
  const color = '#0f766e';
  const label = (
    x: number,
    y: number,
    text: string,
    anchor: 'start' | 'middle' | 'end' = 'middle',
  ) => (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={fontSize}
      fill={color}
      fontWeight="600"
      direction="ltr"
    >
      {text}
    </text>
  );

  if (axis === 'w') {
    const y = flip(u.yMm) + tick * 1.4;
    return (
      <g pointerEvents="none">
        <g stroke={color} strokeWidth={stroke * 1.2}>
          <line x1={u.xMm} y1={y} x2={u.xMm + u.widthMm} y2={y} />
          <line x1={u.xMm} y1={y - tick / 2} x2={u.xMm} y2={y + tick / 2} />
          <line
            x1={u.xMm + u.widthMm}
            y1={y - tick / 2}
            x2={u.xMm + u.widthMm}
            y2={y + tick / 2}
          />
        </g>
        {label(u.xMm + u.widthMm / 2, y + tick * 1.6, cm(u.widthMm))}
      </g>
    );
  }

  if (axis === 'h') {
    const x = u.xMm + u.widthMm + tick * 1.2;
    const top = flip(u.yMm + u.heightMm);
    const bottom = flip(u.yMm);
    return (
      <g pointerEvents="none">
        <g stroke={color} strokeWidth={stroke * 1.2}>
          <line x1={x} y1={top} x2={x} y2={bottom} />
          <line x1={x - tick / 2} y1={top} x2={x + tick / 2} y2={top} />
          <line x1={x - tick / 2} y1={bottom} x2={x + tick / 2} y2={bottom} />
        </g>
        {label(x + tick * 0.4, (top + bottom) / 2 + fontSize * 0.35, cm(u.heightMm), 'start')}
      </g>
    );
  }

  // העומק אינו נראה בחזית, ולכן מוצג כתווית על הארגז
  const cx = u.xMm + u.widthMm / 2;
  const cy = flip(u.yMm + u.heightMm / 2);
  const boxW = fontSize * 4;
  const boxH = fontSize * 1.7;
  return (
    <g pointerEvents="none">
      <rect
        x={cx - boxW / 2}
        y={cy - boxH / 2}
        width={boxW}
        height={boxH}
        rx={boxH * 0.25}
        fill="#ffffff"
        stroke={color}
        strokeWidth={stroke * 1.2}
      />
      {label(cx, cy + fontSize * 0.35, `${cm(u.depthMm)} ↕`)}
    </g>
  );
}

/** מכהה או מבהיר גוון, כדי להראות שהגב יושב עמוק יותר מהגוף. */
function shade(hex: string, factor: number): string {
  const v = hex.replace('#', '');
  if (v.length < 6) return hex;
  const ch = (i: number) =>
    Math.round(Math.min(parseInt(v.slice(i, i + 2), 16) * factor, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/** האם הגוון כהה מספיק כדי שקווים כהים ייבלעו בו. */
function isDark(hex: string): boolean {
  const v = hex.replace('#', '');
  if (v.length < 6) return false;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

function nearest(value: number, targets: number[], limit: number): number {
  // ברירת המחדל היא הערך המעוגל; יעד הצמדה קרוב מנצח אותה
  let best = Math.round(value / STEP) * STEP;
  let bestDist = limit;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/**
 * מצמיד ארגז לקצות הקיר ולשכנים באותו מפלס.
 * אזור הפינה תפוס על ידי ארונות הקיר השכן, ולכן ארגז רגיל נעצר לפניו —
 * רק ארגז פינתי מורשה להיכנס לשם.
 */
function snapX(
  x: number,
  unit: PlacedUnit,
  units: PlacedUnit[],
  wallLength: number,
  corners?: { startMm: number; endMm: number },
): number {
  const blocked = corners && unit.level !== 'wall' && !unit.corner;
  const min = blocked ? corners.startMm : 0;
  const max = Math.max((blocked ? wallLength - corners.endMm : wallLength) - unit.widthMm, min);

  const targets = [min, max];
  for (const other of units) {
    if (other.id === unit.id || other.level !== unit.level) continue;
    targets.push(other.xMm + other.widthMm, other.xMm - unit.widthMm);
  }
  const snapped = nearest(x, targets, SNAP);
  return Math.round(Math.min(Math.max(snapped, min), max));
}

/** מצמיד גובה לרצפה, לתקרה, ולקצוות של ארגזים אחרים. */
function snapY(y: number, unit: PlacedUnit, units: PlacedUnit[], wallHeight: number): number {
  const ceiling = wallHeight - unit.heightMm;
  // הרצפה היא 0: תחתית הארגז כוללת את הרגליים, ולכן אין יעד נפרד להן
  const targets = [0, ceiling];
  for (const other of units) {
    if (other.id === unit.id) continue;
    targets.push(other.yMm, other.yMm + other.heightMm, other.yMm - unit.heightMm);
  }
  const snapped = nearest(y, targets, SNAP);
  return Math.round(Math.min(Math.max(snapped, 0), Math.max(ceiling, 0)));
}
