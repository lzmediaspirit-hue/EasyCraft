import { db } from '../db/db';
import type { TeamMember, UserRole } from '../db/types';

/**
 * כניסה עם שם משתמש וסיסמה.
 *
 * הסיסמה עצמה לא נשמרת בשום מקום: נשמר גיבוב PBKDF2 עם מלח אקראי
 * לכל משתמש, כך שגם מי שפותח את בסיס הנתונים על המכשיר לא רואה
 * אותה ולא יכול להשתמש בה באתר אחר.
 *
 * מה שזה כן ומה שזה לא: זה מפריד בין אנשים באותה נגרייה וקובע מה
 * כל אחד רואה ומורשה לעשות. זה לא מגן על הנתונים מפני מי שיש לו
 * גישה פיזית למכשיר — הכול יושב ב-IndexedDB בלי הצפנה. הגנה
 * אמיתית תגיע עם סנכרון לשרת, ואז הגיבוב הזה כבר יהיה במקום.
 */

const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** מלח אקראי חדש, כמחרוזת hex. */
export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

/** גיבוב סיסמה עם מלח. אותה סיסמה ואותו מלח תמיד נותנים אותו גיבוב. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

/** שם משתמש מנורמל: אותיות קטנות בלי רווחים, כדי שהכניסה תהיה סלחנית. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

export type LoginResult =
  | { ok: true; member: TeamMember }
  | { ok: false; reason: 'notFound' | 'wrongPassword' | 'inactive' };

/** בדיקת שם משתמש וסיסמה מול הצוות. */
export async function login(username: string, password: string): Promise<LoginResult> {
  const key = normalizeUsername(username);
  const member = (await db.team.toArray()).find((m) => m.username === key);
  if (!member) return { ok: false, reason: 'notFound' };
  if (!member.active) return { ok: false, reason: 'inactive' };
  if (!member.passwordHash || !member.passwordSalt) return { ok: false, reason: 'wrongPassword' };
  const hash = await hashPassword(password, member.passwordSalt);
  // השוואה פשוטה מספיקה כאן: אין תוקף מרוחק שיכול למדוד זמנים
  if (hash !== member.passwordHash) return { ok: false, reason: 'wrongPassword' };
  return { ok: true, member };
}

/** האם שם המשתמש פנוי. */
export async function usernameTaken(username: string, exceptId?: string): Promise<boolean> {
  const key = normalizeUsername(username);
  return (await db.team.toArray()).some((m) => m.username === key && m.id !== exceptId);
}

/** האם כבר קיים משתמש כלשהו — אם לא, זו ההתקנה הראשונה. */
export async function hasAnyUser(): Promise<boolean> {
  return (await db.team.count()) > 0;
}

/** קובע או מחליף סיסמה לאיש צוות. */
export async function setPassword(memberId: string, password: string): Promise<void> {
  const salt = newSalt();
  const passwordHash = await hashPassword(password, salt);
  await db.team.update(memberId, { passwordSalt: salt, passwordHash, updatedAt: Date.now() });
}

/* ------------------------------------------------------------------ */
/* מי מחובר                                                            */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'easycraft.session';
const listeners = new Set<() => void>();

/**
 * החיבור נשמר ב-localStorage כדי שהנגר לא יתחבר מחדש בכל פתיחה
 * של האפליקציה. יציאה מפורשת מנקה אותו.
 */
export const session = {
  memberId(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  signIn(memberId: string) {
    try {
      localStorage.setItem(SESSION_KEY, memberId);
    } catch {
      // אחסון חסום — החיבור יחזיק עד רענון
    }
    listeners.forEach((l) => l());
  },
  signOut() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // כלום לנקות
    }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/* ------------------------------------------------------------------ */
/* חשבון המנהל שמגיע עם האפליקציה                                      */
/* ------------------------------------------------------------------ */

export const DEFAULT_ADMIN = { username: 'admin', password: 'admin2026' };

let seeding: Promise<void> | null = null;

/**
 * חשבון מנהל שמגיע מוכן עם האפליקציה.
 *
 * בלעדיו ההתקנה הראשונה מחייבת למלא טופס לפני שרואים משהו, וזה
 * חיכוך מיותר בנגרייה שרק רוצה לפתוח ולעבוד. החשבון נוצר פעם אחת:
 * אם כבר קיים משתמש בשם הזה — לא נוגעים בו, כדי שסיסמה שהוחלפה
 * לא תידרס בטעינה הבאה.
 *
 * הסיסמה הזו ידועה לכל מי שראה את הקוד, ולכן היא נקודת פתיחה ולא
 * הגנה. מסך הכניסה ומסך הצוות מסמנים אותה כל עוד לא הוחלפה.
 */
export function seedAdmin(): Promise<void> {
  seeding ??= runSeed();
  return seeding;
}

async function runSeed(): Promise<void> {
  const exists = (await db.team.toArray()).some((m) => m.username === DEFAULT_ADMIN.username);
  if (exists) return;
  const now = Date.now();
  const salt = newSalt();
  const passwordHash = await hashPassword(DEFAULT_ADMIN.password, salt);
  await db.team.put({
    id: crypto.randomUUID(),
    name: 'מנהל',
    role: 'manager',
    active: true,
    username: DEFAULT_ADMIN.username,
    passwordSalt: salt,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * האם המשתמש עדיין עם סיסמת ברירת המחדל.
 * כך אפשר להזכיר את זה בדיוק במקום שבו זה רלוונטי, ולהפסיק להזכיר
 * ברגע שהסיסמה הוחלפה.
 */
export async function usesDefaultPassword(member: TeamMember): Promise<boolean> {
  if (!member.passwordHash || !member.passwordSalt) return false;
  const hash = await hashPassword(DEFAULT_ADMIN.password, member.passwordSalt);
  return hash === member.passwordHash;
}

/** מה מותר לתפקיד. הפרדה במקום אחד, כדי שלא תתפזר על המסכים. */
export const can = {
  /** לנהל צוות, ליצור משתמשים ולשנות תפקידים */
  manageTeam: (role?: UserRole) => role === 'manager',
  /** לקבוע מחיר, לסמן מכירה ולגעת בתשלומים */
  sell: (role?: UserRole) => role === 'manager',
  /** לשנות הגדרות עסק — לוחות, גוונים וחישוב */
  settings: (role?: UserRole) => role === 'manager',
  /** לערוך את ההדמיה */
  design: (role?: UserRole) => role === 'manager' || role === 'planner',
};
