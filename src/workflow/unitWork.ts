import { glyphDef } from '../catalog/glyphList';
import { unitCells } from '../catalog/zones';
import type { PlacedUnit, TrackStage, UnitWork, UserRole, WorkTrack } from '../db/types';

/**
 * מצב הארגז בייצור, ומה שמותר לכל תפקיד לסמן בו.
 *
 * ארגז אינו דבר אחד שנע קדימה: הגוף נחתך, מקונט ומורכב בזמן אחד,
 * החזיתות בזמן אחר, והדופן הזרה לפעמים מגיעה רק בהתקנה. לכן לכל
 * אחד מסלול משלו — וארגז יכול לעמוד מותקן אצל הלקוח בלי חזיתות,
 * וזה מצב חוקי ולא שגיאה.
 *
 * הצבע על הקיר הוא הדוח: מי שנכנס למסך רואה בשנייה מה נתקע ומה
 * מוכן, בלי לפתוח רשימה. הצבע נגזר מהמסלולים ולא נשמר בנפרד —
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

/** שלב במסלול: מי מסמן אותו ומה הוא אומר. */
export interface StageDef {
  key: Exclude<TrackStage, 'none'>;
  label: string;
  /** מי רשאי לסמן אותו */
  roles: UserRole[];
}

/**
 * השרשרת המלאה.
 *
 * התכנת מוציא את הקבצים — זה סוף העבודה שלו — ומשם הנגר מסמן, כי
 * הוא זה שמחזיק את הלוח ביד. אי אפשר לדלג: קנט לפני חיתוך אינו
 * מצב שקיים בשטח, ולכן הוא גם לא מצב שאפשר לסמן.
 */
export const STAGE_CHAIN: StageDef[] = [
  { key: 'ready', label: 'מוכן לחיתוך', roles: ['manager', 'planner'] },
  { key: 'cut', label: 'נחתך', roles: ['manager', 'carpenter'] },
  { key: 'edged', label: 'קנטים', roles: ['manager', 'carpenter'] },
  { key: 'assembled', label: 'הורכב', roles: ['manager', 'carpenter'] },
  { key: 'installed', label: 'הותקן', roles: ['manager', 'carpenter', 'installer'] },
];

/** מסלול בארגז: השם שלו, ואילו שלבים בכלל שייכים לו. */
export interface TrackDef {
  key: WorkTrack;
  label: string;
  /** השלב האחרון שיש לו משמעות במסלול הזה */
  last: Exclude<TrackStage, 'none'>;
  hint: string;
}

export const TRACKS: TrackDef[] = [
  { key: 'carcass', label: 'גוף', last: 'installed', hint: 'הצדדים, התחתית והתקרה' },
  /*
   * הגב נחתך בנפרד כשהוא בעובי אחר, ומשם הוא כבר חלק מהגוף:
   * לא מקנטים אותו ולא מרכיבים אותו לבד.
   */
  { key: 'back', label: 'גב', last: 'cut', hint: 'נחתך בנפרד, בעובי אחר' },
  { key: 'fronts', label: 'חזיתות', last: 'installed', hint: 'דלתות וחזיתות מגירה' },
  { key: 'panels', label: 'דפנות זרות', last: 'installed', hint: 'הצדדים הגלויים' },
];

export const stageIndex = (s: TrackStage): number =>
  s === 'none' ? -1 : STAGE_CHAIN.findIndex((x) => x.key === s);

/** האם לארגז יש חזיתות שצריך להתקין. */
function hasFronts(u: PlacedUnit): boolean {
  return (
    (u.doors ?? 0) > 0 ||
    unitCells(u).some(({ content: c }) => c.kind === 'drawers' && c.drawerStyle !== 'inner')
  );
}

/** האם לארגז יש דפנות זרות שצריך להתקין. */
function hasPanels(u: PlacedUnit): boolean {
  const e = u.exposed ?? {};
  return !!(e.start || e.end || e.top || e.bottom);
}

/** לוח בודד אינו ארגז, ומכשיר חשמלי נקנה — לשניהם אין תהליך הרכבה. */
export const tracksWork = (u: PlacedUnit): boolean => {
  const def = glyphDef(u.glyph);
  return !def.noCarcass && !def.standalone;
};

/** המסלולים שקיימים בארגז הזה. */
export function tracksOf(u: PlacedUnit): TrackDef[] {
  if (!tracksWork(u)) return [];
  return TRACKS.filter((t) => {
    if (t.key === 'fronts') return hasFronts(u);
    if (t.key === 'panels') return hasPanels(u);
    // גב דק הוא לוח אחר בעובי אחר, ולכן הוא נחתך בנפרד
    if (t.key === 'back') return (u.backKind ?? 'thin') === 'thin';
    return true;
  });
}

export const stageOf = (u: PlacedUnit, track: WorkTrack): TrackStage =>
  u.work?.tracks?.[track] ?? 'none';

/**
 * האם מותר להעביר מסלול לשלב מסוים.
 *
 * שלוש מגבלות, וכולן מהשטח: אי אפשר לדלג שלב, אי אפשר לסמן שלב
 * שאינו בתפקיד שלך, ואי אפשר להתקין חזיתות על ארגז שעוד לא עומד
 * במקומו.
 */
export function canAdvance(
  u: PlacedUnit,
  track: TrackDef,
  to: Exclude<TrackStage, 'none'>,
  /** מי שנכנס באמת — ממנו נגזרת הסמכות */
  role: UserRole | undefined,
  /** הפרויקט שהארגז שייך לו — ממנו נקרא אם העבודה בכלל נפתחה */
  project?: { soldAt?: number },
  /**
   * התפקיד שנבחר לצפייה, כשהוא אינו התפקיד האמיתי.
   *
   * מה שמותר הוא החיתוך של השניים, ולא הנמוך מביניהם: היכולות אינן
   * מוכלות זו בזו — תכנת מכין קבצים לחיתוך ונגר מסמן שנחתך — ולכן
   * "צפייה כנגר" נתנה לתכנת בדיוק את מה שאין לו. מנהל שצופה כנגר
   * מצומצם ליכולות הנגר, וזו בדיוק מטרת הצפייה.
   */
  shown?: UserRole,
): { ok: boolean; why?: string } {
  const def = STAGE_CHAIN.find((s) => s.key === to)!;
  if (!role || !def.roles.includes(role)) return { ok: false, why: 'לא בתפקיד שלך' };
  if (shown && shown !== role && !def.roles.includes(shown)) {
    return { ok: false, why: `לא בתפקיד ${shown === 'installer' ? 'המתקין' : shown === 'carpenter' ? 'הנגר' : shown === 'planner' ? 'התכנת' : 'המנהל'} שנבחר לצפייה` };
  }
  /*
   * ייצור מתחיל אחרי המכירה.
   *
   * ארגז שסומן "מוכן לחיתוך" ואז "נחתך" בפרויקט שעוד לא נמכר הוא
   * לוח שנצרך מהמלאי על חשבון עבודה שאיש לא הזמין. המסך כבר אומר
   * "תהליך העבודה נפתח אחרי המכירה", וכאן זה גם נאכף.
   */
  if (project && !project.soldAt && stageIndex(to) >= 0) {
    return { ok: false, why: 'הפרויקט עוד לא נמכר' };
  }

  if (stageIndex(to) > stageIndex(track.last)) return { ok: false, why: 'לא שייך למסלול הזה' };

  const current = stageIndex(stageOf(u, track.key));
  // צעד אחורה תמיד מותר: טעות בסימון היא דבר שקורה
  if (stageIndex(to) <= current) return { ok: true };
  if (stageIndex(to) > current + 1) return { ok: false, why: 'צריך לסמן את השלב שלפניו' };

  if (to === 'installed' && track.key !== 'carcass') {
    const body = stageOf(u, 'carcass');
    if (stageIndex(body) < stageIndex('installed')) {
      return { ok: false, why: 'הגוף עוד לא הותקן' };
    }
  }
  return { ok: true };
}

/** מעביר מסלול לשלב, או מבטל אותו כשלוחצים על השלב הנוכחי. */
export function withStage(
  work: UnitWork | undefined,
  track: WorkTrack,
  to: Exclude<TrackStage, 'none'>,
): UnitWork {
  const tracks = { ...(work?.tracks ?? {}) };
  const current = tracks[track] ?? 'none';
  // לחיצה על השלב הנוכחי מחזירה אחורה — כך מתקנים סימון שגוי
  tracks[track] = current === to ? (STAGE_CHAIN[stageIndex(to) - 1]?.key ?? 'none') : to;
  return { ...work, tracks };
}

/** הצבע של הארגז על הקיר, לפי המסלול שהכי מפגר. */
export function workTone(u: PlacedUnit): WorkTone {
  if (u.work?.issue) return 'issue';
  const tracks = tracksOf(u);
  if (!tracks.length) return 'idle';
  const stages = tracks.map((t) => stageIndex(stageOf(u, t.key)));
  const max = Math.max(...stages);
  if (max < 0) return 'idle';
  /*
   * ירוק רק כשכל מסלול הגיע להרכבה או להתקנה. ארגז שעומד בשטח בלי
   * חזיתות אינו מורכב — הוא רק מותקן, וזה מה שהווי מספר.
   *
   * הסף נמדד מול סוף המסלול ולא מול שלב קבוע: הגב נגמר בחיתוך, ולכן
   * דרישה ל"הורכב" ממנו השאירה ארגז גמור לגמרי בצבע של הרכבה — 100%
   * בהתקדמות, וכתום על הקיר.
   */
  const ripe = (t: TrackDef) =>
    stageIndex(stageOf(u, t.key)) >= Math.min(stageIndex('assembled'), stageIndex(t.last));
  if (tracks.every(ripe)) return 'done';
  if (max >= stageIndex('edged')) return 'assembly';

  if (max >= stageIndex('ready')) return 'cutting';
  return 'idle';
}

/** האם הגוף כבר עומד אצל הלקוח — זה מה שהווי על הארגז מספר. */
export const isInstalled = (u: PlacedUnit): boolean =>
  stageOf(u, 'carcass') === 'installed';

/** תיאור קצר של מה שנעשה בארגז, לשורה ברשימה. */
export function workSummary(u: PlacedUnit): string {
  if (u.work?.issue) return u.work.issue;
  const tracks = tracksOf(u);
  if (!tracks.length) return 'לא נספר בייצור';
  const parts = tracks
    .filter((t) => stageOf(u, t.key) !== 'none')
    .map((t) => `${t.label}: ${STAGE_CHAIN[stageIndex(stageOf(u, t.key))].label}`);
  return parts.length ? parts.join(' · ') : 'עוד לא התחיל';
}

/**
 * כמה מהעבודה בפרויקט כבר נעשתה, כשבר בין 0 ל-1.
 *
 * נמדד לפי המסלולים ולא לפי הארגזים: ארגז שהגוף שלו הותקן והחזיתות
 * עוד לא נחתכו אינו "חצי", אלא בדיוק מה שהמסלולים אומרים. כל מסלול
 * נספר עד השלב האחרון שלו — לגב זה חיתוך, ולגוף התקנה — כי מסלול
 * שהגיע לסופו סיים את חלקו גם אם הוא קצר משכניו.
 *
 * ארגזים שאינם נספרים בייצור, כמו מכשירי חשמל ולוחות בודדים,
 * יוצאים מהחשבון לגמרי: הם לא עבודה שאפשר להתקדם בה.
 */
export function workProgress(units: PlacedUnit[]): number {
  let done = 0;
  let total = 0;
  for (const u of units) {
    for (const t of tracksOf(u)) {
      const last = stageIndex(t.last);
      total += last + 1;
      done += Math.min(stageIndex(stageOf(u, t.key)) + 1, last + 1);
    }
  }
  return total > 0 ? done / total : 0;
}
