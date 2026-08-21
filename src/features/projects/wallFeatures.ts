import type { WallFeatureKind } from '../../db/types';

export interface FeatureDef {
  kind: WallFeatureKind;
  label: string;
  /** מידות וגובה ברירת מחדל במ"מ */
  w: number;
  h: number;
  y: number;
  /** צבע הסימון בהדמיה */
  tone: string;
}

export const FEATURE_DEFS: FeatureDef[] = [
  { kind: 'window', label: 'חלון', w: 1000, h: 1200, y: 900, tone: '#7dd3fc' },
  { kind: 'door', label: 'דלת / פתח', w: 900, h: 2100, y: 0, tone: '#a8a29e' },
  { kind: 'socket', label: 'שקע חשמל', w: 100, h: 100, y: 1100, tone: '#fbbf24' },
  { kind: 'water', label: 'נקודת מים', w: 100, h: 100, y: 500, tone: '#60a5fa' },
  { kind: 'pillar', label: 'עמוד / פינוי', w: 300, h: 2600, y: 0, tone: '#d6d3d1' },
  { kind: 'niche', label: 'נישה', w: 600, h: 600, y: 1000, tone: '#e7e5e4' },
];

export function featureDef(kind: WallFeatureKind): FeatureDef {
  return FEATURE_DEFS.find((f) => f.kind === kind) ?? FEATURE_DEFS[0];
}
