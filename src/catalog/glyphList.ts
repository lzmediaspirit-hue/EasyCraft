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
  /**
   * אין כאן גוף ארון אמיתי אלא לוח בודד.
   * 'horizontal' — לוח שוכב, שטחו רוחב על עומק (מדף צף, משטח שולחן).
   * 'vertical' — לוח עומד, שטחו רוחב על גובה (פאנל, מרווח).
   */
  noCarcass?: 'horizontal' | 'vertical';
  /**
   * נישה למכשיר. הגוף אמיתי ונבנה מלוחות, אבל החזית היא המכשיר
   * עצמו — ולכן אין כאן דלת לחשב, וגם לא מדפים שנכנסים מאליהם.
   */
  appliance?: boolean;
  /**
   * חיפוי קיר: לוח שנצמד לקיר ויושב מאחורי הארגזים.
   * הוא מכסה קיר, ולא ניצב לפניו, ולכן גם בציור הוא מצויר ראשון.
   */
  cladding?: boolean;
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
  { key: 'carousel', label: 'סחרחרה', appliance: true },
  { key: 'sink', label: 'כיור', appliance: true },
  { key: 'hob', label: 'כיריים', drawers: true, appliance: true },
  { key: 'oven', label: 'תנור', appliance: true },
  { key: 'ovenMicro', label: 'תנור ומיקרוגל', appliance: true },
  { key: 'fridge', label: 'מקרר', appliance: true },
  { key: 'dishwasher', label: 'מדיח', appliance: true },
  { key: 'hood', label: 'קולט אדים', appliance: true },
  { key: 'pantry', label: 'מזווה', shelves: true },
  { key: 'hang', label: 'תלייה' },
  { key: 'hangDouble', label: 'תלייה כפולה' },
  { key: 'sliding', label: 'הזזה', shelves: true },
  { key: 'shoes', label: 'נעליים' },
  { key: 'innerDrawers', label: 'מגירות פנימיות', drawers: true },
  { key: 'mirror', label: 'מראה', shelves: true },
  { key: 'nightstand', label: 'שידה', drawers: true },
  { key: 'blindStart', label: 'פינה מתה שמאל', doors: true, shelves: true },
  { key: 'blindEnd', label: 'פינה מתה ימין', doors: true, shelves: true },
  { key: 'lShape', label: 'פינתי במפגש', doors: true, shelves: true },
  { noCarcass: 'vertical', key: 'plain', label: 'לוח בודד' },
  { noCarcass: 'horizontal', key: 'desk', label: 'שולחן' },
  { key: 'tv', label: 'טלוויזיה', doors: true, drawers: true },
  { noCarcass: 'vertical', key: 'panel', label: 'פאנל', cladding: true },
  { noCarcass: 'horizontal', key: 'slab', label: 'מדף צף' },
  { noCarcass: 'vertical', key: 'spacer', label: 'מרווח' },
];

export function glyphDef(key: string): GlyphDef {
  return GLYPHS.find((g) => g.key === key) ?? GLYPHS[0];
}
