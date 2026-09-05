import { glyphDef } from '../catalog/glyphList';
import { unitCells } from '../catalog/zones';
import type { PlacedUnit, UnitWork, UserRole } from '../db/types';

/**
 * מצב הארגז בייצור, ומה שמותר לכל תפקיד לסמן בו.
 *
 * הצבע על הקיר הוא הדוח: מי שנכנס למסך רואה בשנייה מה נתקע ומה
 * מוכן, בלי לפתוח רשימה. לכן הצבע נגזר מהסימונים ולא נשמר בנפרד —
 * מצב ששמור פעמיים מתפצל.
 */

export type WorkTone = 'idle' | 'cutting' | 'assembly' | 'done' | 'issue';

export const WORK_TONES: Record<WorkTone, { fill: string; stroke: string; label: string }> = {
  idle: { fill: '#ffffff', stroke: '#a8a29e', label: 'לא התחיל' },
  cutting: { fill: '#fef3c7', stroke: '#d97706', label: 'בחיתוך' },
  assembly: { fill: '#fed7aa', stroke: '#ea580c', label: 'בהרכבה' },
  done: { fill: '#d1fae5', stroke: '#059669', label: 'מורכב' },
  issue: { fill: '#fecaca', stroke: '#dc2626', label: 'בעיה' },
};

/** האם לארגז יש חזיתות שצריך להתקין. */
export function hasFronts(u: PlacedUnit): boolean {
  return (
    (u.doors ?? 0) > 0 ||
    unitCells(u).some(({ content: c }) => c.kind === 'drawers' && c.drawerStyle !== 'inner')
  );
}

/** האם לארגז יש דפנות זרות שצריך להתקין. */
export function hasPanels(u: PlacedUnit): boolean {
  const e = u.exposed ?? {};
  return !!(e.start || e.end || e.top || e.bottom);
}

/**
 * ארגז נחשב מורכב כשיש עליו קנטים, הוא הורכב, והחזיתות והדפנות
 * הזרות שלו במקומן. ארגז בלי חזיתות או בלי דפנות זרות לא מחכה
 * להן — אחרת ארון פתוח לעולם לא היה מגיע לירוק.
 */
export function isComplete(u: PlacedUnit): boolean {
  const w = u.work ?? {};
  if (!w.edged || !w.assembled) return false;
  if (hasFronts(u) && !w.fronts) return false;
  if (hasPanels(u) && !w.panels) return false;
  return true;
}

/** הצבע של הארגז על הקיר, לפי מה שסומן בו. */
export function workTone(u: PlacedUnit): WorkTone {
  const w = u.work ?? {};
  if (w.issue) return 'issue';
  if (w.installed || isComplete(u)) return 'done';
  // כתום מרגע שיש קנטים — זה הרגע שבו הארגז עובר מהמסור לשולחן
  if (w.edged || w.assembled) return 'assembly';
  if (w.cut || w.filesReady) return 'cutting';
  return 'idle';
}

/** תיאור קצר של מה שנעשה בארגז, לשורה ברשימה. */
export function workSummary(u: PlacedUnit): string {
  const w = u.work ?? {};
  if (w.issue) return w.issue;
  if (w.installed) return 'הותקן';
  if (isComplete(u)) return 'מורכב ומוכן להתקנה';
  const done = [
    w.filesReady && 'קבצים',
    w.cut && 'נחתך',
    w.edged && 'קנטים',
    w.assembled && 'הורכב',
    w.fronts && 'חזיתות',
    w.panels && 'דפנות',
  ].filter(Boolean);
  return done.length ? done.join(' · ') : 'עוד לא התחיל';
}

/** סימון בודד בארגז, והתפקידים שרשאים לגעת בו. */
export interface WorkFlag {
  key: keyof Omit<UnitWork, 'issue' | 'issueBy'>;
  label: string;
  hint: string;
  roles: UserRole[];
}

/**
 * מי מסמן מה.
 *
 * התכנת מסמן שהקבצים מוכנים — זה סוף העבודה שלו. משם והלאה הנגר
 * מסמן, כי הוא זה שמחזיק את הארגז ביד. המנהל רואה הכול ויכול לתקן
 * הכול, כי הוא זה שנשאל כשמשהו לא מסתדר.
 */
export const WORK_FLAGS: WorkFlag[] = [
  {
    key: 'filesReady',
    label: 'קבצים מוכנים',
    hint: 'קובצי החיתוך של הארגז מוכנים למסור',
    roles: ['manager', 'planner'],
  },
  { key: 'cut', label: 'נחתך', hint: 'הלוחות של הארגז יצאו מהמסור', roles: ['manager', 'carpenter'] },
  { key: 'edged', label: 'קנטים', hint: 'הקנטים הודבקו', roles: ['manager', 'carpenter'] },
  { key: 'assembled', label: 'הורכב', hint: 'הגוף מורכב', roles: ['manager', 'carpenter'] },
  { key: 'fronts', label: 'חזיתות', hint: 'הדלתות והמגירות מותקנות', roles: ['manager', 'carpenter'] },
  { key: 'panels', label: 'דפנות זרות', hint: 'הדפנות הזרות במקומן', roles: ['manager', 'carpenter'] },
  {
    key: 'installed',
    label: 'הותקן',
    hint: 'הארגז עומד אצל הלקוח',
    roles: ['manager', 'carpenter', 'installer'],
  },
];

/** הסימונים שרלוונטיים לארגז הזה — ארגז בלי חזיתות לא מחכה להן. */
export function flagsFor(u: PlacedUnit): WorkFlag[] {
  return WORK_FLAGS.filter((f) => {
    if (f.key === 'fronts') return hasFronts(u);
    if (f.key === 'panels') return hasPanels(u);
    return true;
  });
}

/** האם התפקיד רשאי לסמן את הדגל הזה. */
export const mayFlag = (flag: WorkFlag, role: UserRole | undefined): boolean =>
  !!role && flag.roles.includes(role);

/** לוח בודד אינו ארגז, ולכן אין לו תהליך הרכבה. */
export const tracksWork = (u: PlacedUnit): boolean => !glyphDef(u.glyph).noCarcass;
