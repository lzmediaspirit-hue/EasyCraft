import type { StageKey, UserRole } from '../db/types';

export interface StageDef {
  key: StageKey;
  label: string;
  /** התפקיד שהשלב מחכה לו */
  role: UserRole | 'customer';
  /** מה בעצם קורה בשלב — נאמר במילים של השטח */
  hint: string;
  /** שלב שאפשר לדלג עליו, כי לא כל פרויקט עובר אותו */
  skippable?: boolean;
  /** שלב שנקבע לו מועד ונכנס ללוח השנה */
  scheduled?: boolean;
}

/**
 * תהליך העבודה של פרויקט, לפי הסדר.
 *
 * הסדר הוא גם ההיגיון: שלב נפתח רק כשהשלב שלפניו נסגר, ולכן אי
 * אפשר לחתוך לוחות לפני שהלקוח אישר את ההדמיה. זו הנקודה של
 * התהליך — לא לעקוב אחרי עבודה, אלא למנוע עבודה מיותרת.
 */
export const STAGES: StageDef[] = [
  {
    key: 'brief',
    label: 'פתיחת פרויקט',
    role: 'manager',
    hint: 'המנהל מעביר לתכנת את מידות הקיר, הסגנון וההנחיות',
  },
  {
    key: 'design',
    label: 'תכנון',
    role: 'planner',
    hint: 'התכנת בונה את הקיר בהדמיה',
  },
  {
    key: 'approval',
    label: 'אישור הלקוח',
    role: 'customer',
    hint: 'הלקוח מאשר את ההדמיה לפני שנוגעים בחומר',
  },
  {
    key: 'files',
    label: 'קבצים לייצור',
    role: 'planner',
    hint: 'פירוק לוחות, תמונות הדמיה והוראות הרכבה לנגר',
  },
  {
    key: 'cutting',
    label: 'חיתוך',
    role: 'carpenter',
    hint: 'ניסור הלוחות לפי רשימת החיתוך',
  },
  {
    key: 'edging',
    label: 'קנטים',
    role: 'carpenter',
    hint: 'הדבקת קנטים לחלקים החתוכים',
  },
  {
    key: 'assembly',
    label: 'הרכבה',
    role: 'carpenter',
    hint: 'הרכבת הארונות בנגרייה',
  },
  {
    key: 'install',
    label: 'התקנה',
    role: 'installer',
    hint: 'התקנה אצל הלקוח. לא כל פרויקט מותקן על ידינו',
    skippable: true,
    scheduled: true,
  },
];

export function stageDef(key: StageKey): StageDef {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}

export const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'מנהל',
  planner: 'תכנת',
  carpenter: 'נגר',
  installer: 'מתקין',
};

/** מי יכול לקחת שלב על עצמו. נגר יכול גם להתקין — בעסק קטן זה אותו אדם. */
export function canOwn(role: UserRole, stageRole: StageDef['role']): boolean {
  if (role === 'manager') return true;
  if (stageRole === 'customer') return false;
  if (stageRole === 'installer') return role === 'installer' || role === 'carpenter';
  return role === stageRole;
}
