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
