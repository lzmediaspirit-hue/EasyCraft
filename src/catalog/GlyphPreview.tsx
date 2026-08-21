import { CabinetGlyph } from './CabinetGlyph';

/**
 * תצוגה מוקטנת של ארגז, בפרופורציה האמיתית שלו —
 * כך שהאייקון בספרייה כבר מספר איך הארגז ייראה על הקיר.
 */
export function GlyphPreview({
  glyph,
  widthMm,
  heightMm,
  doors,
  drawers,
  className = 'h-14 w-full',
}: {
  glyph: string;
  widthMm: number;
  heightMm: number;
  doors?: number;
  drawers?: number;
  className?: string;
}) {
  const pad = Math.max(widthMm, heightMm) * 0.06;
  const stroke = Math.max(widthMm, heightMm) / 55;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${widthMm + pad * 2} ${heightMm + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <CabinetGlyph
        glyph={glyph}
        w={widthMm}
        h={heightMm}
        doors={doors}
        drawers={drawers}
        stroke={stroke}
      />
    </svg>
  );
}
