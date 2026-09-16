/**
 * אייקונים — SVG מוטמע, בלי ספריות חיצוניות.
 *
 * כולם נבנים מאותה מעטפת: אותה מסגרת, אותו עובי קו, אותם קצוות
 * מעוגלים. קודם כל אייקון כתב לעצמו את שבע התכונות האלה, והן
 * נדדו — עובי 1.6 לצד 1.9, קצה חד לצד מעוגל — ולכן שורת כפתורים
 * אחת נראתה כאילו נאספה משלושה מקומות. מי שמוסיף אייקון חדש נותן
 * את הצורה בלבד.
 *
 * העובי חריג רק כשהצורה מחייבת: וי, פלוס ומינוס הם קו אחד, והם
 * נעלמים בעובי של צורה מלאה.
 */
type P = { className?: string };

interface Shape {
  /** 24 לרוב האייקונים, 32 לאייקוני החדרים שיש להם יותר פרטים */
  size?: number;
  /** עובי חריג, כשצורה פשוטה נבלעת בעובי הרגיל */
  width?: number;
  /** צורה מלאה ולא קו */
  solid?: boolean;
}

const STROKE = 1.8;

function icon(shape: React.ReactNode, { size = 24, width = STROKE, solid }: Shape = {}) {
  const base = size === 32 ? 'size-7' : 'size-5';
  return function Icon({ className = base }: P) {
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        fill={solid ? 'currentColor' : 'none'}
        stroke={solid ? 'none' : 'currentColor'}
        strokeWidth={solid ? undefined : width}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {shape}
      </svg>
    );
  };
}

/* ---- כללי ---- */

export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />, { width: 2 });
export const MinusIcon = icon(<path d="M5 12h14" />, { width: 2 });
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />, { width: 2 });
/** וי — שלב שהושלם. */
export const CheckIcon = icon(<path d="M5 13l4 4L19 7" />, { width: 2.4 });

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const PhoneIcon = icon(
  <path d="M5 3h3.5l1.8 4.5-2.2 1.6a12 12 0 0 0 5.8 5.8l1.6-2.2L20 14.5V18a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.2 2 2 0 0 1 5 3Z" />,
);

export const UsersIcon = icon(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.4a6.5 6.5 0 0 1 3.5 4.6" />
  </>,
);

/** חץ חזרה — בממשק עברי הוא מצביע ימינה. */
export const BackIcon = icon(<path d="m9 6 6 6-6 6" />, { width: 2 });
export const ChevronIcon = icon(<path d="m15 6-6 6 6 6" />, { width: 2 });

export const TrashIcon = icon(<path d="M4 7h16M10 7V5h4v2M6 7l1 12h10l1-12M10 11v5M14 11v5" />);
export const PencilIcon = icon(<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />);
export const CopyIcon = icon(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>,
);

export const BoxesIcon = icon(
  <>
    <rect x="3" y="12" width="8" height="8" rx="1" />
    <rect x="13" y="12" width="8" height="8" rx="1" />
    <rect x="8" y="4" width="8" height="7" rx="1" />
  </>,
);

/** פעולות נוספות. */
export const DotsIcon = icon(
  <>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </>,
  { solid: true },
);

/* ---- אייקוני חדרים ---- */

const KitchenIcon = icon(
  <>
    <rect x="4" y="4" width="10" height="8" rx="1" />
    <rect x="18" y="4" width="10" height="8" rx="1" />
    <path d="M4 17h24M4 17v11h24V17" />
    <path d="M16 17v11M9 21v3M23 21v3M9 8v1M13 8v1M19 8v1" />
  </>,
  { size: 32, width: 1.6 },
);

const LivingIcon = icon(
  <>
    <rect x="9" y="4" width="14" height="9" rx="1" />
    <path d="M4 19h24v7H4zM4 19v-2a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v2M8 26v2M24 26v2" />
  </>,
  { size: 32, width: 1.6 },
);

const BedroomIcon = icon(
  <>
    <rect x="4" y="4" width="11" height="24" rx="1" />
    <path d="M9.5 4v24M12.5 14v4M6.5 14v4" />
    <path d="M19 20h9v8h-9zM19 20v-3h9v3" />
  </>,
  { size: 32, width: 1.6 },
);

/** חדר שירות: מכונת כביסה וארון מעליה. */
const UtilityIcon = icon(
  <>
    <rect x="6" y="4" width="20" height="7" rx="1" />
    <rect x="6" y="15" width="20" height="13" rx="1" />
    <circle cx="16" cy="21.5" r="4" />
    <path d="M10 7.5h3M21 7.5h1" />
  </>,
  { size: 32, width: 1.6 },
);

const CustomRoomIcon = icon(
  <>
    <path d="M4 13 16 4l12 9v15H4z" />
    <path d="M16 17v7M12.5 20.5h7" />
  </>,
  { size: 32, width: 1.6 },
);

/**
 * אייקון לכל חדר, לפי המפתח ששמור איתו.
 * חדר שהמשתמש הוסיף מקבל את אייקון הבית הכללי.
 */
export const ROOM_ICONS: Record<string, (p: P) => React.ReactElement> = {
  kitchen: KitchenIcon,
  living: LivingIcon,
  bedroom: BedroomIcon,
  utility: UtilityIcon,
  custom: CustomRoomIcon,
};

export function roomIcon(key: string) {
  return ROOM_ICONS[key] ?? CustomRoomIcon;
}

/* ---- קטגוריות בספרייה ---- */

/**
 * אייקון לכל קטגוריה, באותה שפה: מלבן אחד שאומר איפה הדבר עומד.
 *
 * תחתון יושב על הרצפה, עליון תלוי, עמודה נוגעת בשתיהן, ארון הוא
 * גוף עם מדפים, אי עומד לבדו באמצע, מדף הוא קו אחד, ולוח הוא
 * רצועה. ציור קטן של הארגז עצמו אינו מספיק — הוא מזהה מוצר, לא
 * קטגוריה.
 */
const GROUP_ICONS: Record<string, (p: P) => React.ReactElement> = {
  base: icon(
    <>
      <rect x="4" y="12" width="16" height="8" rx="1" />
      <path d="M4 20h16" strokeWidth={2.2} />
    </>,
  ),
  upper: icon(
    <>
      <rect x="4" y="4" width="16" height="8" rx="1" />
      <path d="M4 4h16" strokeWidth={2.2} />
    </>,
  ),
  tall: icon(
    <>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <path d="M6 12h12" />
    </>,
  ),
  storage: icon(
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 10h16M4 15h16" />
    </>,
  ),
  island: icon(
    <>
      <rect x="6" y="10" width="12" height="7" rx="1" />
      <path d="M3 8h18" strokeWidth={2.2} />
    </>,
  ),
  shelf: icon(
    <>
      <path d="M4 11h16" strokeWidth={2.6} />
      <path d="M7 11v3M17 11v3" />
    </>,
  ),
  panel: icon(
    <>
      <rect x="9" y="3" width="6" height="18" rx="1" />
    </>,
  ),
};

export function groupIcon(key: string) {
  return GROUP_ICONS[key] ?? GROUP_ICONS.base;
}

/* ---- מצבי תצוגה בהדמיה ---- */

/** חזית שטוחה — ציור אחד של הקיר. */
export const ElevationIcon = icon(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M3.5 19h17" strokeWidth={2.4} />
  </>,
);

/** מבט תלת־ממדי. */
export const CubeIcon = icon(
  <>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </>,
);

/** מבט על. */
export const PlanIcon = icon(
  <>
    <path d="M4 4h16v16H4z" />
    <path d="M4 9h6V4M20 15h-6v5" />
  </>,
);

/** חזיתות גלויות. */
export const FrontsIcon = icon(
  <>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M12 4v16M9.5 11.2v1.6M14.5 11.2v1.6" />
  </>,
);

/** חזיתות מוסתרות — רואים את פנים הארון. */
export const InsideIcon = icon(
  <>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" strokeDasharray="2.5 2.2" />
    <path d="M6 9.5h12M6 14.5h12" />
  </>,
);

/**
 * מגנט — ההצמדה.
 * פרסה עם שני קטבים, הצורה שכולם מזהים כמשיכה.
 */
export const MagnetIcon = icon(
  <>
    <path d="M6 4v9a6 6 0 0 0 12 0V4" />
    <path d="M6 10h4M14 10h4" />
    <path d="M6 4h4M14 4h4" />
  </>,
);

/** התאמת התצוגה — מסגרת שמושכת את הכול פנימה. */
export const FitIcon = icon(
  <>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </>,
);

/** הדמיה להצגה ללקוח — עין, כי זו השאלה "איך זה ייראה". */
export const EyeIcon = icon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

/**
 * הסתרה — אותה עין, עם קו שחוצה אותה.
 * הארגז לא נמחק ולא השתנה; רק אי אפשר לראות אותו כרגע.
 */
export const EyeOffIcon = icon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5c1.5 0 2.8.4 4 1M19.2 8.6c1.5 1.6 2.3 3.4 2.3 3.4S18 18.5 12 18.5c-1.7 0-3.2-.5-4.5-1.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M4 20 20 4" />
  </>,
);

/* ---- כלי עבודה בהדמיה ---- */

/**
 * סרגל — מדידת המרחק בין שני דברים.
 *
 * הוא ותיו האחות `DimensionsIcon` היו אותה צורה בדיוק, ולכן שני
 * כלים שונים בסרגל אחד נראו כאותו כלי פעמיים. סרגל הוא המכשיר
 * שמודדים בו; מידות הן הקווים שמופיעים על השרטוט.
 */
export const RulerIcon = icon(
  <>
    <rect x="2" y="8" width="20" height="8" rx="1.5" />
    <path d="M7 8v3M12 8v4M17 8v3" />
  </>,
);

/** מידות על הארגזים — קו מידה עם חצים בשני הקצוות. */
export const DimensionsIcon = icon(
  <>
    <path d="M4 12h16" />
    <path d="M7 9l-3 3 3 3M17 9l3 3-3 3" />
    <path d="M4 5v3M20 5v3" />
  </>,
);

/** חישוב חומרים ומחיר. */
export const CalcIcon = icon(
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
  </>,
);

/** השוואת מרווחים. */
export const EqualizeIcon = icon(<path d="M4 7h16M4 12h16M4 17h16" />);

/** עומק אחיד. */
export const DepthIcon = icon(
  <>
    <path d="M3 8h12v12H3z" />
    <path d="M15 8l6-4v12l-6 4M3 8l6-4h12" />
  </>,
);

/** ניסור — פריסת חלקים על פלטה. */
export const NestIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 11h9M12 4v16M16 11h5M16 15h5" />
  </>,
);

export const UndoIcon = icon(
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </>,
);

export const RedoIcon = icon(
  <>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </>,
);

export const CenterIcon = icon(
  <>
    <path d="M12 3v18" />
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M3 12h2M19 12h2" />
  </>,
);

/** שורת הקירות — שלושה קירות זה לצד זה, כמו הלשוניות עצמן. */
export const WallsIcon = icon(
  <>
    <rect x="3" y="7" width="5" height="10" rx="1" />
    <rect x="9.5" y="7" width="5" height="10" rx="1" />
    <rect x="16" y="7" width="5" height="10" rx="1" />
  </>,
);

/** סרגלי הכלים — מפתח ברגים, כי אלה הכלים שעובדים איתם. */
export const ToolsIcon = icon(
  <>
    <path d="M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6l-8.2 8.2a2.2 2.2 0 0 1-3.1-3.1l8.2-8.2Z" />
    <path d="M18 3.2 15.4 5.8" />
  </>,
);

/** מטה קסמים — התכנון האוטומטי, מה שקורה בלחיצה אחת. */
export const WandIcon = icon(
  <>
    <path d="M14.2 4.6 4.6 14.2a1.4 1.4 0 0 0 0 2l1.2 1.2a1.4 1.4 0 0 0 2 0l9.6-9.6a1.4 1.4 0 0 0 0-2l-1.2-1.2a1.4 1.4 0 0 0-2 0Z" />
    <path d="M12.5 6.3 15.7 9.5" />
    <path d="M18.5 3v3M20 4.5h-3M18.5 15v2.5M19.75 16.25h-2.5" />
  </>,
);

/** פינה ישרה — ההצמדה ל-90 מעלות בשרטוט החדר. */
export const CornerIcon = icon(
  <>
    <path d="M5 5v14h14" />
    <path d="M9 19v-4h4" />
  </>,
);

export const SlidersIcon = icon(
  <>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </>,
);

/* ---- חומרים, כסף ותהליך ---- */

/** גוונים — לוח צבעים, כי זו הבחירה שהלקוח עושה בעיניים. */
export const PaletteIcon = icon(
  <>
    <path d="M12 3a9 9 0 0 0 0 18c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" />
    <circle cx="7.5" cy="11.5" r="1.1" />
    <circle cx="11" cy="7.5" r="1.1" />
    <circle cx="15.5" cy="9" r="1.1" />
  </>,
);

/** פלטה — החומר עצמו, לרשימת החומרים. */
export const SheetIcon = icon(
  <>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M8 3v18" />
  </>,
);

/**
 * שיוך גוון לחלק — דגימת לוח, ולא תווית מחיר.
 * התווית אמרה "מחיר" למי שראה אותה, וזו בדיוק הפעולה השנייה.
 */
export const SwatchIcon = icon(
  <>
    <rect x="3.5" y="3.5" width="8" height="17" rx="1.5" />
    <path d="M11.5 8.5 16 6.5a1.5 1.5 0 0 1 2 .8l3 6.7a1.5 1.5 0 0 1-.8 2l-7.5 3.4" />
    <circle cx="7.5" cy="17" r="1.1" />
  </>,
);

/** מכירה — תווית מחיר. */
export const TagIcon = icon(
  <>
    <path d="M11 3H4v7l10 10 7-7L11 3z" />
    <circle cx="7.5" cy="6.5" r="1.2" />
  </>,
);

export const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M4.6 7.5l1.7 1M17.7 15.5l1.7 1M4.6 16.5l1.7-1M17.7 8.5l1.7-1" />
  </>,
);

export const LockIcon = icon(
  <>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </>,
);

export const UnlockIcon = icon(
  <>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 7.5-2" />
  </>,
);

/** שמירה לספרייה — סימנייה. */
export const BookmarkIcon = icon(<path d="M6 4h12v16l-6-4-6 4z" />);

/** מחשבון מהיר. */
export const KeypadIcon = icon(
  <path d="M5 9h14M12 5v8M6 18h5M15.5 16.5l3 3M18.5 16.5l-3 3" />,
);

/** תהליך עבודה — שלבים בשרשרת. */
export const FlowIcon = icon(
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M6 8.5v6a3 3 0 003 3h6.5" />
  </>,
);

/** לוח שנה. */
export const CalendarIcon = icon(
  <>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
);

/** צוות. */
export const TeamIcon = icon(
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0111 0M16 6.2a3 3 0 010 5.6M17 19a5.5 5.5 0 00-1.6-3.9" />
  </>,
);

/** קובץ מצורף. */
export const FileIcon = icon(
  <>
    <path d="M14 3v5h5" />
    <path d="M19 8v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h7z" />
  </>,
);

/** ארכיון — לקוחות שסיימו. */
export const ArchiveIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" />
  </>,
);

/**
 * כוכב — מועדף.
 * מלא = בפנים, ריק = בחוץ. אותה צורה בדיוק, כדי שהמעבר ביניהם
 * ייראה כשינוי מצב ולא כהחלפת כפתור.
 */
export const StarIcon = ({ className = 'size-5', filled = false }: P & { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={STROKE}
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" />
  </svg>
);
