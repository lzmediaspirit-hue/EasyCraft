import type { CatalogGroup, RoomKind } from '../db/types';

export interface RoomDef {
  kind: RoomKind;
  label: string;
  /** תיאור קצר שמופיע בבחירת החדר */
  hint: string;
  icon: string;
  /** הכרטיסיות שמוצגות בספרייה עבור החדר הזה, לפי הסדר */
  groups: CatalogGroup[];
}

export const ROOMS: RoomDef[] = [
  {
    kind: 'kitchen',
    label: 'מטבח',
    hint: 'תחתונים, עליונים, עמודות ומכשירי חשמל',
    icon: 'kitchen',
    groups: ['base', 'upper', 'tall', 'panel'],
  },
  {
    kind: 'living',
    label: 'סלון',
    hint: 'מזנוני טלוויזיה, ספריות ומדפים',
    icon: 'living',
    groups: ['base', 'upper', 'storage', 'panel'],
  },
  {
    kind: 'bedroom',
    label: 'חדר שינה',
    hint: 'ארונות בגדים, שידות ויחידות עליונות',
    icon: 'bedroom',
    groups: ['storage', 'base', 'upper', 'panel'],
  },
  {
    kind: 'custom',
    label: 'שם חדש',
    hint: 'חדר בהגדרה שלך — כל הספרייה זמינה',
    icon: 'custom',
    groups: ['base', 'upper', 'tall', 'storage', 'panel'],
  },
];

export const GROUP_LABELS: Record<CatalogGroup, string> = {
  base: 'תחתונים',
  upper: 'עליונים',
  tall: 'עמודות',
  storage: 'ארונות',
  panel: 'דפנות ולוחות',
};

export function roomDef(kind: RoomKind): RoomDef {
  return ROOMS.find((r) => r.kind === kind) ?? ROOMS[ROOMS.length - 1];
}

/** סדר כרטיסיות ברירת מחדל, כשלחדר אין הגדרה משלו. */
export const GLYPH_GROUPS_FALLBACK: CatalogGroup[] = [
  'base',
  'upper',
  'tall',
  'storage',
  'panel',
];
