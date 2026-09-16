import { subscribers } from '../ui/store';
import { clearPref, readPref, writePref } from '../ui/prefs';
import { teamRepo } from './workflowRepo';
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
function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

/** גיבוב סיסמה עם מלח. אותה סיסמה ואותו מלח תמיד נותנים אותו גיבוב. */
async function hashPassword(password: string, salt: string): Promise<string> {
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
  const member = (await teamRepo.list()).find((m) => m.username === key);
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
  return (await teamRepo.list()).some((m) => m.username === key && m.id !== exceptId);
}

/** האם כבר קיים משתמש כלשהו — אם לא, זו ההתקנה הראשונה. */
export async function hasAnyUser(): Promise<boolean> {
  return (await teamRepo.list()).length > 0;
}

/** קובע או מחליף סיסמה לאיש צוות. */
export async function setPassword(memberId: string, password: string): Promise<void> {
  const salt = newSalt();
  const passwordHash = await hashPassword(password, salt);
  await teamRepo.setSecret(memberId, salt, passwordHash);
}

/* ------------------------------------------------------------------ */
/* מי מחובר                                                            */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'easycraft.session';
const bus = subscribers();

/**
 * החיבור נשמר ב-localStorage כדי שהנגר לא יתחבר מחדש בכל פתיחה
 * של האפליקציה. יציאה מפורשת מנקה אותו.
 */
export const session = {
  memberId(): string | null {
    return readPref(SESSION_KEY);
  },
  signIn(memberId: string) {
    writePref(SESSION_KEY, memberId);
    bus.notify();
  },
  signOut() {
    clearPref(SESSION_KEY);
    bus.notify();
  },
  subscribe: bus.subscribe,
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
 * חיכוך מיותר בנגרייה שרק רוצה לפתוח ולעבוד. הוא נוצר רק כשאין אף
 * משתמש — כלומר בהתקנה הראשונה בלבד.
 *
 * הבדיקה היא על קיום צוות ולא על קיום השם "admin": מנהל ששינה את
 * שם המשתמש שלו קיבל בטעינה הבאה חשבון מנהל שני, עם סיסמת ברירת
 * המחדל הידועה, בלי שביקש ובלי שידע.
 *
 * הסיסמה הזו ידועה לכל מי שראה את הקוד, ולכן היא נקודת פתיחה ולא
 * הגנה. מסך הכניסה ומסך הצוות מסמנים אותה כל עוד לא הוחלפה.
 */
export function seedAdmin(): Promise<void> {
  seeding ??= runSeed();
  return seeding;
}

async function runSeed(): Promise<void> {
  if ((await teamRepo.list()).length) return;

  const salt = newSalt();
  const passwordHash = await hashPassword(DEFAULT_ADMIN.password, salt);
  await teamRepo.save({
    name: 'מנהל',
    role: 'manager',
    active: true,
    username: DEFAULT_ADMIN.username,
    passwordSalt: salt,
    passwordHash,
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
  /**
   * לערוך את ההדמיה.
   *
   * המנהל תמיד; התכנת רק בפרויקט שנפתח לו לעריכה. ההדמיה היא מה
   * שהלקוח אישר, ושינוי שלה אחרי האישור הוא שינוי בהזמנה — ולכן
   * הוא עובר דרך המנהל ולא נעשה בשקט.
   */
  design: (role?: UserRole, project?: { editGrantedAt?: number }) =>
    role === 'manager' || (role === 'planner' && !!project?.editGrantedAt),
};
