/**
 * המגירות שאפשר לפתוח ממסך ההדמיה.
 *
 * אחת בכל רגע: כולן מכסות את המסך, ושתיים פתוחות יחד הן מצב שלא
 * קיים בממשק — רק בקוד שהחזיק דגל נפרד לכל אחת.
 */
export type SheetName =
  | 'library'
  | 'autoPlan'
  | 'edit'
  | 'materials'
  | 'nesting'
  | 'sale'
  | 'depth'
  | 'plan'
  | 'present'
  | 'wallTools'
  | 'bulk'
  | 'finishes'
  | 'warnings';
