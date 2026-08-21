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
