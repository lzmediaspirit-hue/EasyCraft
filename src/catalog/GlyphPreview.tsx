import { CabinetGlyph, type GlyphProps } from './CabinetGlyph';

type Props = Omit<GlyphProps, 'w' | 'h' | 'stroke'> & {
  widthMm: number;
  heightMm: number;
  className?: string;
};

/**
 * תצוגה מוקטנת של ארגז, בפרופורציה האמיתית שלו —
 * כך שהאייקון בספרייה כבר מספר איך הארגז ייראה על הקיר.
 */
export function GlyphPreview({
  widthMm,
  heightMm,
  className = 'h-14 w-full',
  ...glyph
}: Props) {
  const pad = Math.max(widthMm, heightMm) * 0.06;
  const stroke = Math.max(widthMm, heightMm) / 55;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${widthMm + pad * 2} ${heightMm + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <CabinetGlyph {...glyph} w={widthMm} h={heightMm} stroke={stroke} />
    </svg>
  );
}
