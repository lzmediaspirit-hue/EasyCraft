/** אייקונים — SVG מוטמע, בלי ספריות חיצוניות. */
type P = { className?: string };

export const PlusIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SearchIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const PhoneIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 3h3.5l1.8 4.5-2.2 1.6a12 12 0 0 0 5.8 5.8l1.6-2.2L20 14.5V18a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.2 2 2 0 0 1 5 3Z" />
  </svg>
);

export const CloseIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" className={className} aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const UsersIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.4a6.5 6.5 0 0 1 3.5 4.6" />
  </svg>
);

/** חץ חזרה — בממשק עברי הוא מצביע ימינה. */
export const BackIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const ChevronIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const TrashIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 7h16M10 7V5h4v2M6 7l1 12h10l1-12M10 11v5M14 11v5" />
  </svg>
);

export const PencilIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
  </svg>
);

export const BoxesIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="12" width="8" height="8" rx="1" />
    <rect x="13" y="12" width="8" height="8" rx="1" />
    <rect x="8" y="4" width="8" height="7" rx="1" />
  </svg>
);

/* ---- אייקוני חדרים ---- */

export const KitchenIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="4" y="4" width="10" height="8" rx="1" />
    <rect x="18" y="4" width="10" height="8" rx="1" />
    <path d="M4 17h24M4 17v11h24V17" />
    <path d="M16 17v11M9 21v3M23 21v3M9 8v1M13 8v1M19 8v1" />
  </svg>
);

export const LivingIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="9" y="4" width="14" height="9" rx="1" />
    <path d="M4 19h24v7H4zM4 19v-2a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v2M8 26v2M24 26v2" />
  </svg>
);

export const BedroomIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="4" y="4" width="11" height="24" rx="1" />
    <path d="M9.5 4v24M12.5 14v4M6.5 14v4" />
    <path d="M19 20h9v8h-9zM19 20v-3h9v3" />
  </svg>
);

export const CustomRoomIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 13 16 4l12 9v15H4z" />
    <path d="M16 17v7M12.5 20.5h7" />
  </svg>
);

/** חזיתות גלויות. */
export const FrontsIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M12 4v16M9.5 11.2v1.6M14.5 11.2v1.6" />
  </svg>
);

/** חזיתות מוסתרות — רואים את פנים הארון. */
export const InsideIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" strokeDasharray="2.5 2.2" />
    <path d="M6 9.5h12M6 14.5h12" />
  </svg>
);

export const SettingsIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M4.6 7.5l1.7 1M17.7 15.5l1.7 1M4.6 16.5l1.7-1M17.7 8.5l1.7-1" />
  </svg>
);

/** סרגל מדידה. */
export const RulerIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2" y="8" width="20" height="8" rx="1.5" />
    <path d="M7 8v3M12 8v4M17 8v3" />
  </svg>
);

/** חישוב חומרים ומחיר. */
export const CalcIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
  </svg>
);

/** השוואת מרווחים. */
export const EqualizeIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" className={className} aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

/** נורת לד. */
export const LedIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1h6c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3Z" />
  </svg>
);

/** מבט על. */
export const PlanIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 4h16v16H4z" />
    <path d="M4 9h6V4M20 15h-6v5" />
  </svg>
);

/** עומק אחיד. */
export const DepthIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 8h12v12H3z" />
    <path d="M15 8l6-4v12l-6 4M3 8l6-4h12" />
  </svg>
);

export const LockIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const UnlockIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 7.5-2" />
  </svg>
);

/** הוספת אזור בתוך הארון. */
export const ZoneIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M4 10h16M4 15h16" />
  </svg>
);

export const ArrowUpIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const ArrowDownIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

/** שמירה לספרייה — סימנייה. */
export const BookmarkIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M6 4h12v16l-6-4-6 4z" />
  </svg>
);

/** מחשבון מהיר. */
export const KeypadIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 9h14M12 5v8M6 18h5M15.5 16.5l3 3M18.5 16.5l-3 3" />
  </svg>
);

/** וי — שלב שהושלם. */
export const CheckIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

/** תהליך עבודה — שלבים בשרשרת. */
export const FlowIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M6 8.5v6a3 3 0 003 3h6.5" />
  </svg>
);

/** לוח שנה. */
export const CalendarIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

/** צוות. */
export const TeamIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0111 0M16 6.2a3 3 0 010 5.6M17 19a5.5 5.5 0 00-1.6-3.9" />
  </svg>
);

/** קובץ מצורף. */
export const FileIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M14 3v5h5" />
    <path d="M19 8v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h7z" />
  </svg>
);

/** מכירה — תווית מחיר. */
export const TagIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M11 3H4v7l10 10 7-7L11 3z" />
    <circle cx="7.5" cy="6.5" r="1.2" />
  </svg>
);

/** ארכיון — לקוחות שסיימו. */
export const ArchiveIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" />
  </svg>
);

/** פעולות נוספות. */
export const DotsIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);

/** ניסור — פריסת חלקים על פלטה. */
export const NestIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 11h9M12 4v16M16 11h5M16 15h5" />
  </svg>
);

/** מבט תלת־ממדי. */
export const CubeIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
);

export const UndoIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const RedoIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);

export const CopyIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const CenterIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 3v18" />
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M3 12h2M19 12h2" />
  </svg>
);

export const SlidersIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
