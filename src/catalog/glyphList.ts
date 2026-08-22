/**
 * האיורים הזמינים כשבונים או עורכים ארגז.
 *
 * לכל איור מוגדר מה בכלל אפשר לכוונן בו — כך שבטופס העריכה מופיעות
 * רק ההגדרות שרלוונטיות לארגז שנבחר.
 */
export interface GlyphDef {
  key: string;
  label: string;
  /** לארגז יש חזית דלתות שאפשר לקבוע את מספרן */
  doors?: boolean;
  /** לארגז יש מגירות — שורות, ואפשר גם עמודות זו לצד זו */
  drawers?: boolean;
  /** לארגז יש מדפים פנימיים */
  shelves?: boolean;
}

export const GLYPHS: GlyphDef[] = [
  { key: 'doors', label: 'דלתות', doors: true, shelves: true },
  { key: 'drawers', label: 'מגירות', drawers: true },
  { key: 'doorDrawer', label: 'דלת ומגירה', doors: true, drawers: true, shelves: true },
  { key: 'open', label: 'פתוח', shelves: true },
  { key: 'shelves', label: 'מדפים', shelves: true },
  { key: 'glass', label: 'ויטרינה', doors: true, shelves: true },
  { key: 'lift', label: 'קלאפה', shelves: true },
  { key: 'shutter', label: 'תריס', shelves: true },
  { key: 'corner', label: 'פינתי', doors: true, shelves: true },
  { key: 'carousel', label: 'סחרחרה' },
  { key: 'sink', label: 'כיור' },
  { key: 'hob', label: 'כיריים', drawers: true },
  { key: 'oven', label: 'תנור' },
  { key: 'ovenMicro', label: 'תנור ומיקרוגל', doors: true },
  { key: 'fridge', label: 'מקרר' },
  { key: 'dishwasher', label: 'מדיח' },
  { key: 'hood', label: 'קולט אדים' },
  { key: 'pantry', label: 'מזווה', shelves: true },
  { key: 'hang', label: 'תלייה' },
  { key: 'hangDouble', label: 'תלייה כפולה' },
  { key: 'sliding', label: 'הזזה', shelves: true },
  { key: 'shoes', label: 'נעליים' },
  { key: 'innerDrawers', label: 'מגירות פנימיות', drawers: true },
  { key: 'mirror', label: 'מראה', shelves: true },
  { key: 'nightstand', label: 'שידה', drawers: true },
  { key: 'desk', label: 'שולחן' },
  { key: 'tv', label: 'טלוויזיה', doors: true, drawers: true },
  { key: 'panel', label: 'פאנל' },
  { key: 'slab', label: 'מדף צף' },
  { key: 'spacer', label: 'מרווח' },
];

export function glyphDef(key: string): GlyphDef {
  return GLYPHS.find((g) => g.key === key) ?? GLYPHS[0];
}
