import { zoneCells } from '../../catalog/zones';
import type { Zone } from '../../db/types';

/**
 * מה יש בתא, בציור קטן.
 *
 * שורת טקסט אומרת "3 מדפים", אבל העין מזהה מדפים לפני שהיא קוראת.
 * בארון עם חמישה תאים זה ההבדל בין לסרוק רשימה לבין להסתכל על
 * הארון.
 */
export function ZoneIcon({ zone }: { zone: Zone }) {
  const cells = zoneCells(zone);
  const w = 26;
  const h = 22;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-6 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden="true"
    >
      <rect x={0.7} y={0.7} width={w - 1.4} height={h - 1.4} rx={2} />
      {cells.map(({ content, share }, i) => {
        const cw = (w - 1.4) * share;
        const cx = 0.7 + (w - 1.4) * cells.slice(0, i).reduce((a, c) => a + c.share, 0);
        return (
          <g key={i} transform={`translate(${cx} 0)`}>
            {i > 0 && <line x1={0} y1={0.7} x2={0} y2={h - 0.7} />}
            {content.kind === 'shelves' &&
              [0.35, 0.62].map((f) => (
                <line key={f} x1={cw * 0.15} y1={h * f} x2={cw * 0.85} y2={h * f} />
              ))}
            {content.kind === 'drawers' &&
              [0.28, 0.52, 0.76].map((f) => (
                <rect
                  key={f}
                  x={cw * 0.15}
                  y={h * f - 3}
                  width={Math.max(cw * 0.7, 1)}
                  height={5}
                  rx={1}
                  strokeDasharray={content.drawerStyle === 'inner' ? '2 2' : undefined}
                />
              ))}
            {content.kind === 'rod' && (
              <>
                <line x1={cw * 0.15} y1={h * 0.3} x2={cw * 0.85} y2={h * 0.3} />
                <path d={`M ${cw * 0.5} ${h * 0.3} v ${h * 0.22}`} />
                <path d={`M ${cw * 0.32} ${h * 0.75} L ${cw * 0.5} ${h * 0.52} L ${cw * 0.68} ${h * 0.75}`} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
