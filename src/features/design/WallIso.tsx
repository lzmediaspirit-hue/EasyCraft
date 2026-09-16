import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_VIEW, MAX_RISE, MIN_RISE, ORBIT_SLOP, unitScreenBox } from './isoMath';
import type { IsoView } from './isoMath';
import { buildScene } from './isoScene';
import { buildPlan } from './plan';
import { outOfSight } from './designView';
import { LockIcon, UnlockIcon } from '../../ui/icons';
import { solveDrag } from './dragSolve';
import { axesFor, axisLabel, longPress, pickAxis } from './axisLock';
import type { Axis } from './axisLock';
import type { GesturePhase } from './gesture';
import { alongWallMm } from '../../db/types';
import type { PartSettings } from '../../costing/boards';

import type { PlacedUnit, Project, Wall } from '../../db/types';


/**
 * מבט תלת-ממדי על החדר.
 *
 * הציור השטוח מראה מה יהיה על קיר אחד; המבט הזה מראה את כל הקירות
 * יחד, ואיך הכול בנוי — כל לוח מצויר בעובי שלו, ורואים את הצדדים,
 * התחתית, התקרה והמדפים כמו שהם ייצאו מהמסור. זו התמונה שנגר
 * מסתכל בה לפני שהוא חותך, וזו גם התמונה שמסבירה ללקוח מה הוא מקבל.
 *
 * ההיטל איזומטרי: אין נקודת מגוז, ולכן מידה שווה נראית שווה בכל
 * מקום בציור — מה שמתאים לשרטוט עבודה, בניגוד לפרספקטיבה.
 *
 * הקירות משורשרים לפי אותה גיאומטריה שמשמשת את מבט העל, ולכן חדר
 * שנראה נכון מלמעלה נראה נכון גם כאן — כולל חדר שאינו מלבן וחדר
 * עם יותר מארבעה קירות.
 */

export function WallIso({
  walls,
  units,
  activeWallId,
  selectedId,
  flagged,
  onSelect,
  onMoveTo,
  onGesture,
  work,
  onRotate,
  onEdit,
  onBulk,
  inside,
  finishHex,
  present = false,
  project,
  parts,
  snap = true,
  fitAt,
}: {
  /** הפרויקט — ממנו נגזרים הגוונים של מי שלא נבחר לו גוון משלו */
  project?: Project;
  /** העוביים שלפיהם נחתך, כדי שהציור והניסור יסכימו */
  parts?: PartSettings;
  walls: Wall[];

  /** כל הארגזים בפרויקט — המבט הזה מציג את החדר כולו */
  units: PlacedUnit[];
  /** הקיר שעובדים עליו כרגע, מסומן בציור */
  activeWallId: string;
  selectedId: string | null;
  /** מה שאזהרה מדברת עליו — מודלק יחד, ראה `WallElevation` */
  flagged?: Set<string>;
  onSelect: (id: string | null) => void;
  /**
   * הזזת ארגז אל מקום אחר — ואולי אל קיר אחר.
   *
   * גרירה מעבר לקצה הקיר מעבירה את הארגז לקיר השכן, כי בחדר אמיתי
   * פינה היא מקום ולא גבול: מי שגורר ארון לאורך המטבח לא עוצר
   * בפינה ומתחיל מחדש.
   */
  onMoveTo?: (id: string, patch: Partial<PlacedUnit>) => void;
  /**
   * תחילת מחווה וסופה.
   *
   * גרירה אחת היא צעד אחד לביטול, גם כשהיא כותבת לכמה ארגזים.
   * בלי הכרזה מפורשת הגבול נגזר מתגיות ומחלון זמן, וגרירת קבוצה
   * התפרקה לעשרות צעדים שתלויים בקצב האירועים.
   */
  onGesture?: (phase: GesturePhase) => void;
  /** מצב תהליך עבודה: הארגזים נצבעים לפי מה שנעשה בהם */
  work?: boolean;
  /**
   * סיבוב הארגז הנבחר ברבע סיבוב.
   *
   * שני חצים מתחתיו, אחד לכל כיוון — זו התנועה שעושים ביד על
   * ארון אמיתי כשמעמידים אותו בפינה, ולא בחירה מתוך רשימה.
   */
  onRotate?: (id: string, patch: Partial<PlacedUnit>) => void;
  /** עיפרון — פותח את העריכה המהירה של הארגז */
  onEdit?: (id: string) => void;
  /**
   * פעולה על כמה ארגזים שנבחרו יחד.
   *
   * מחיקה, הסתרה ושמירה כפריט אחד הן פעולות על אוסף, ולכן הן
   * יוצאות החוצה כאוסף — המסך שמכיר את בסיס הנתונים מבצע אותן.
   * הזזה נשארת כאן, כי היא תנועה על הציור.
   */
  onBulk?: (ids: string[], action: 'delete' | 'hide' | 'library') => void;
  /** חזיתות מוסתרות — רואים את הגוף והמדפים */
  inside: boolean;
  /** צבע התצוגה לכל גוון, לפי מזהה */
  finishHex: Record<string, string>;
  /**
   * תצוגת הצגה: אותו חדר, בלי שרטוט.
   *
   * הקווים בין הלוחות, שמות הקירות וסימון הארגז הנבחר הם שפה של
   * נגר. הלקוח לא קורא שרטוט — הוא רוצה לראות איך זה ייראה — ולכן
   * במצב הזה נשארים רק המשטחים, עם אור, צל וקרקע.
   */
  present?: boolean;
  /** ההצמדה פעילה. כבויה = הארגז נוחת במקום שהאצבע לקחה אותו */
  snap?: boolean;
  /**
   * התאמת התצוגה.
   *
   * המספר עצמו חסר משמעות; מה שקובע הוא שהוא השתנה. כך כפתור
   * בסרגל הכלים מחזיר את המצלמה לזווית ההתחלתית בלי שהמצב שלה
   * יצטרך לעלות למסך — היא שייכת לרגע ההסתכלות, לא לפרויקט.
   */
  fitAt?: number;
}) {
  /*
   * זווית המבט נשמרת במצב ולא בהגדרות: היא שייכת לרגע ההסתכלות,
   * לא לפרויקט. גרירה על הציור מסובבת אופקית ומרימה או מנמיכה את
   * נקודת המבט — אותה תנועה שעושים ביד על מודל אמיתי.
   */
  const [view, setView] = useState<IsoView>(DEFAULT_VIEW);
  /*
   * אותה אצבע לא יכולה גם לסובב את המבט וגם להזיז ארון: כל תנועה
   * הייתה עושה את שניהם. הנעילה מפרידה ביניהם — וזה
   * גם מה שמונע מהחדר להסתובב בכל פעם שמישהו נגע בארון.
   */
  const [locked, setLocked] = useState(false);
  /** על מי הארגז עומד להינחת — מוצג בזמן הגרירה בלבד */
  const [landing, setLanding] = useState<string | null>(null);
  /*
   * מצב הנחה: הארגז ביד עד שמניחים אותו או מבטלים.
   *
   * כל עוד הוא פתוח החדר אינו מסתובב והאצבע שייכת לארגז בלבד —
   * זו בדיוק התנועה של להעמיד ארון במקום, ובה אין רגע שבו לא ברור
   * מה זז. הביטול מחזיר בדיוק את מה שהיה כשנכנסנו.
   */
  const [placing, setPlacing] = useState<{ ids: string[]; from: PlacedUnit[] } | null>(null);
  /** בחירה מרובה. `null` = המצב כבוי */
  const [picked, setPicked] = useState<string[] | null>(null);
  const drag = useRef<{
    /** הארגז כפי שהיה בתחילת הגרירה — ממנו נמדד הכול, ולכן היא הפיכה */
    from: PlacedUnit;
    /**
     * שאר הקבוצה, כפי שהייתה בתחילת הגרירה.
     *
     * גם הם נמדדים מהמצב ההתחלתי ולא מהמצב הנוכחי: חישוב ההפרש
     * מהמקור והוספתו למיקום שכבר עודכן צבר את אותה תנועה שוב ושוב,
     * והמרווח בין שני ארגזים גדל מ-1,300 ל-3,320 בכמה אירועי מגע.
     */
    mates: PlacedUnit[];
    /** היעד שכבר נבחר להנחה, כדי שהוא לא יקפוץ בין שני שכנים */
    onId?: string;
    startX: number;
    startY: number;
    moved: boolean;
    /* לחיצה ארוכה נדלקה: הגרירה הזו מוגבלת לציר אחד */
    armed?: boolean;
    /* הציר שנעול. ריק אחרי הנעילה ולפני שהכיוון התברר */
    axis?: Axis | null;
  } | null>(null);

  /*
   * לחיצה ארוכה נועלת ציר.
   *
   * אותו סף ואותה סבילות של ציור החזית — הם יושבים ב-`axisLock`
   * ולא כאן, כי מחווה שמרגישה שונה בשני המסכים היא שתי מחוות.
   */
  const press = useRef(longPress());
  /** הציר שננעל, למחוון. `null` בשדה = ננעל ועוד לא נבחר כיוון */
  const [lock, setLock] = useState<{ axis: Axis | null } | null>(null);

  const orbit = useRef<{
    x: number;
    y: number;
    from: IsoView;
    moved: boolean;
    /** הארון שהאצבע ירדה עליו — נקרא בהרפיה */
    hit: string | null;
  } | null>(null);

  /*
   * בניית הסצנה היא העבודה הכבדה של המסך, ולכן היא נעשית רק כשמשהו
   * שנכנס אליה השתנה. בלי זה כל ציור מחדש של המסך — פתיחת מקלדת,
   * מגע בכפתור, רענון של שאילתה — בנה את החדר כולו מחדש.
   */
  const scene = useMemo(
    () =>
      buildScene({
        walls, units, activeWallId, selectedId, inside, finishHex, present, view, project, parts,
        work,
      }),
    [walls, units, activeWallId, selectedId, inside, finishHex, present, view, project, parts, work],

  );
  const { faces, backdrops, marks, floor, bounds, spin } = scene;
  /* הזווית שבאמת מצוירת — היא מוגבלת כדי לא לצאת אל מאחורי הקיר */
  const shown = scene.view;
  const plan = useMemo(() => buildPlan(walls, units), [walls, units]);
  /*
   * הכיוון של הקיר שעובדים עליו, לפיו נעצר הסיבוב לפני שהצופה יוצא
   * אל מאחוריו. הגרירה צריכה את אותו גבול שהתמונה כבר חושבת לפיו.
   */
  const heading = plan.find((p) => p.wall.id === activeWallId)?.headingDeg ?? 0;

  /*
   * החלפת קיר מסובבת את החדר אל מולו.
   *
   * זווית המבט נמדדת ביחס לחדר, לא לקיר, ולכן קיר שכיוונו 90°
   * נראה מהצד בדיוק באותה זווית שבה הראשון נראה מלפנים. מי שלחץ
   * על קיר ב׳ ראה את קיר א׳ מקרוב, וכדי להגיע לקיר שביקש היה
   * צריך לגרור.
   *
   * הכיוון נקרא מתוך ref ולא מרשימת התלויות: שינוי זווית של קיר
   * בעריכה אינו סיבה לחטוף למשתמש את המבט שהוא בחר.
   */
  const headingRef = useRef(heading);
  headingRef.current = heading;
  useEffect(() => {
    setView((v) => ({ ...v, yawDeg: -headingRef.current }));
  }, [activeWallId]);

  /*
   * התאמת התצוגה מסרגל הכלים.
   *
   * המצלמה נשארת כאן — היא שייכת לרגע ההסתכלות ולא לפרויקט —
   * ומה שעובר מבחוץ הוא בקשה ולא מצב. הבקשה הראשונה (`undefined`)
   * אינה מאפסת דבר, כדי שפתיחת המסך לא תחטוף מבט שכבר נבחר.
   */
  useEffect(() => {
    if (fitAt === undefined) return;
    setView({ ...DEFAULT_VIEW, yawDeg: -headingRef.current });
  }, [fitAt]);

  /* המסגרת שמכילה הכול. פרישה של אלפי נקודות לתוך Math.min יקרה, ומעל גבול מסוים גם נופלת */
  const pad = 300;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [qx, qy] of bounds) {
    if (qx < x0) x0 = qx;
    if (qx > x1) x1 = qx;
    if (qy < y0) y0 = qy;
    if (qy > y1) y1 = qy;
  }
  const minX = x0 - pad;
  const minY = y0 - pad;
  const vbW = x1 - x0 + pad * 2;
  const vbH = y1 - y0 + pad * 2;
  const stroke = Math.max(vbW / 700, 3);

  /*
   * הלוחות עצמם. ארון מלא הוא מאות מצולעים, ולכן הם נבנים רק
   * כשהתמונה משתנה: שינוי גודל של החלון — פתיחת מקלדת, סיבוב
   * המכשיר — אינו נוגע בהם בכלל.
   */
  const painted = useMemo(
    () =>
      faces.map((f) => (
        <polygon
          key={f.key}
          points={f.points}
          fill={f.fill}
          /* זכוכית: רואים דרכה את מה שכבר צויר מאחוריה */
          fillOpacity={f.glass ? 0.42 : undefined}
          /*
            בהצגה הקו בין לוח ללוח נעלם: הוא מה שהופך רהיט לשרטוט.
            נשאר קו דק מאוד בגוון המשטח עצמו, כדי שפאה בהירה על
            רקע בהיר עדיין תיראה.
          */
          /*
            ענבר גובר על בחירה: אזהרה מדברת על שני עצמים, והיא
            מה שהמשתמש חיפש כשלחץ עליה.
          */
          stroke={
            present
              ? 'rgba(87,83,78,0.18)'
              : f.unitId && flagged?.has(f.unitId)
                ? '#f59e0b'
                : f.unitId === selectedId
                  ? '#a06236'
                  : '#57534e'
          }
          strokeWidth={
            present
              ? stroke * 0.35
              : (f.unitId && flagged?.has(f.unitId)) || f.unitId === selectedId
                ? stroke * 1.6
                : stroke * 0.7
          }
          strokeLinejoin="round"
          data-unit={f.unitId}
          data-wall-solid={f.featureKind}
          className={f.unitId && !present ? 'cursor-pointer' : undefined}
        />
      )),
    [faces, present, selectedId, flagged, stroke],
  );

  /*
   * כמה יחידות ציור נכנסות לפיקסל אחד.
   *
   * הציור נמתח לגודל המסגרת, ולכן כפתור שנמדד ביחידות הציור מתכווץ
   * יחד איתה: כשהלוח של הארגז פתוח נשאר לתלת־ממד פס נמוך, וחץ בגודל
   * עשרה פיקסלים אי אפשר ללחוץ עליו באצבע. המידה הזאת מחזירה את
   * החצים לגודל אמיתי, בלי קשר לכמה מקום נשאר לתמונה.
   */
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const read = () => {
      const box = el.getBoundingClientRect();
      // preserveAspectRatio ברירת המחדל מכניס את הציור כולו — הצלע הצרה קובעת
      const k = Math.min(box.width / vbW, box.height / vbH);
      if (k > 0) setPxPerUnit(k);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbW, vbH]);

  /*
   * גרירה מסובבת, נגיעה בוחרת.
   * הבחירה נעשית בהרפיה ולא בלחיצה, כי אחרת כל תחילת סיבוב שהתחילה
   * על ארון הייתה בוחרת אותו — והלוח היה נפתח באמצע התנועה.
   */
  /* המשתנים נכתבים בתוך הלולאה; כאן הם כבר סופיים */
  const spinAt: { x: number; y: number } | null = spin;
  const selectedUnit = units.find((u) => u.id === selectedId && !outOfSight(u)) ?? null;

  const screenBox = (id: string) => unitScreenBox(faces, id);

  /**
   * כפתור עגול על הציור, במידות שנשארות אמיתיות בכל זום.
   *
   * `role="button"` ותווית לבדם אינם כפתור: הם אומרים לקורא המסך
   * מה זה, ולא מאפשרים להגיע לזה. בלי `tabIndex` ובלי מקלדת
   * הכפתורים האלה היו נגישים לאצבע בלבד — מי שעובד במקלדת לא
   * יכול היה להזיז או לסובב ארגז בכלל.
   */
  const ringButton = (
    label: string,
    d: string,
    cx: number,
    cy: number,
    r: number,
    onTap: () => void,
    tone = '#a06236',
  ) => (
    <g
      key={label}
      role="button"
      aria-label={label}
      tabIndex={0}
      className="group cursor-pointer focus:outline-none"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => {
        e.stopPropagation();
        onTap();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onTap();
      }}
    >
      {/* טבעת המיקוד: מי שמגיע במקלדת רואה איפה הוא עומד */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 1.25}
        fill="none"
        stroke={tone}
        strokeWidth={r * 0.12}
        className="opacity-0 group-focus:opacity-100"
      />
      <circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke={tone} strokeWidth={r * 0.09} />
      <g
        transform={`translate(${cx} ${cy}) scale(${r / 11})`}
        fill="none"
        stroke={tone}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </g>
    </g>
  );

  /** מה שמחזיר ארגז למקום שממנו יצא — קיר או רצפה, לפי מה שהוא */
  const restore = (u: PlacedUnit): Partial<PlacedUnit> =>
    u.free ? { free: u.free } : { xMm: u.xMm, yMm: u.yMm, wallId: u.wallId };

  /*
   * גרירה: מהאצבע אל מקום בחדר.
   *
   * החשבון עצמו יושב ב-dragSolve, כי הוא מתמטיקה ולא ממשק. כאן
   * נשאר רק מה ששייך למגע — מאיפה התחילה התנועה, ומתי היא נחשבת
   * גרירה ולא נגיעה — ושליחת התוצאה החוצה.
   */
  /**
   * לחיצה ארוכה על ארגז — נעילת ציר.
   *
   * היא עובדת משלושה מצבים, וזו הנקודה: כשהחדר חופשי אצבע על ארון
   * מסובבת את המבט, ומי שרצה להזיז ארון בדיוק אחד היה צריך קודם
   * לנעול את החדר. אחרי חצי שנייה במקום הכוונה ברורה, והאצבע
   * עוברת מהמבט אל הארון — בציר אחד בלבד.
   */
  function armAxis(clientX: number, clientY: number, held: PlacedUnit) {
    if (!onMoveTo || present) return;
    press.current.start(clientX, clientY, () => {
      if (!drag.current) {
        /*
         * מחווה שכבר הוכרזה כסיבוב נשארת סיבוב עד ההרפיה.
         *
         * הביטול בתנועה אמור היה לכבות את המדידה הרבה לפני כאן;
         * זו השורה שאומרת את הכלל עצמו, ולא רק מסתמכת על העיתוי.
         * החלפת סוג מחווה באמצע היא ההפתעה שאין ממנה דרך חזרה.
         */
        if (!orbit.current || orbit.current.moved) return;
        orbit.current = null;
        onGesture?.('start');
        drag.current = { from: held, mates: [], startX: clientX, startY: clientY, moved: true };
        onSelect(held.id);
      }
      drag.current.armed = true;
      drag.current.axis = null;
      setLock({ axis: null });
    });
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !onMoveTo) return;
    /* אצבע שזזה ביטלה את הלחיצה הארוכה — זו גרירה רגילה */
    press.current.move(e.clientX, e.clientY);
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < ORBIT_SLOP) return;
    d.moved = true;

    /*
     * הציר נבחר מהכיוון הראשון שגוררים בו אחרי הנעילה.
     *
     * ההשוואה היא מול הכיוון שבו כל ציר באמת נראה על המסך בזווית
     * הזו, ולא מול "אופקי או אנכי": בתלת־ממד ציר X וציר Z שניהם
     * נראים אלכסוניים, ובחצי מהזוויות הם מתחלפים.
     */
    if (d.armed && !d.axis) {
      const heldWall = plan.find((q) => q.wall.id === d.from.wallId);
      const pick = pickAxis(
        e.clientX - d.startX,
        e.clientY - d.startY,
        axesFor(d.from, true),
        shown,
        heldWall?.headingDeg ?? 0,
      );
      if (!pick) return;
      d.axis = pick;
      setLock({ axis: pick });
    }

    const next = solveDrag({
      from: d.from,
      dxMm: (e.clientX - d.startX) / pxPerUnit,
      dyMm: (e.clientY - d.startY) / pxPerUnit,
      view: shown,
      plan,
      walls,
      units,
      pxPerUnit,
      snap,
      onId: d.onId,
      /* נעילה בגרירה קבוצתית תחול על כל הקבוצה, כי היא זזה כגוף אחד */
      axis: d.axis ?? undefined,
    });
    if (!next) return;
    d.onId = next.onId;

    /*
     * על מי הוא נוחת — כתוב, ולא נרמז בצבע.
     * בציור החזית מצוירים גם קווי היישור עצמם; כאן יש שם היעד
     * בלבד, כי קו על פאה מסובבת בתלת־ממד מטעה יותר משהוא עוזר.
     */
    setLanding(next.onId ? (units.find((u) => u.id === next.onId)?.name ?? null) : null);

    const dx = (next.patch.xMm ?? d.from.xMm) - d.from.xMm;
    const dy = (next.patch.yMm ?? d.from.yMm) - d.from.yMm;

    /* ארגז בודד: כל מה שהפתרון מצא — מעבר קיר, הצמדה, הנחה על אחר */
    if (!d.mates.length) return onMoveTo(d.from.id, next.patch);
    if (!dx && !dy) return;

    /*
     * קבוצה זזה כגוף אחד.
     *
     * הגבול נבדק על כל חברי הקבוצה — כולל זה שהאצבע אוחזת בו.
     * קודם הוא זז במלוא ההפרש והשאר קוצצו לגבול שלהם, ולכן קבוצה
     * שנגררה אל קצה הקיר נדחסה: שני ארגזים שהמרחק ביניהם היה
     * 1,700 מ״מ מצאו את עצמם ב-600.
     */
    const group = [d.from, ...d.mates];
    let limX = dx;
    let limY = dy;
    for (const m of group) {
      /* אי אינו נמדד על קיר, ולכן אין לו גבול לאורכו */
      if (!m.free) {
        const wall = walls.find((w) => w.id === m.wallId);
        if (wall) {
          const room = Math.max(wall.lengthMm - alongWallMm(m), 0);
          limX = Math.min(Math.max(limX, -m.xMm), room - m.xMm);
        }
        limY = Math.max(limY, -m.yMm);
      }
    }
    if (!limX && !limY) return;
    for (const m of group) {
      onMoveTo(
        m.id,
        m.free
          ? { free: { ...m.free, xMm: m.free.xMm + limX } }
          : { xMm: m.xMm + limX, yMm: m.yMm + limY },
      );
    }
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
    <svg
      ref={svgRef}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      className="max-h-full min-h-0 w-full flex-1 touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        /*
         * מה שנגעו בו נשמר כאן ולא נקרא בהרפיה: לכידת המצביע
         * מפנה את כל האירועים הבאים אל ה-SVG עצמו, ולכן בהרפיה
         * כבר אי אפשר לדעת על איזה ארון האצבע ירדה.
         */
        const hit = (e.target as Element).getAttribute?.('data-unit') ?? null;
        const held = hit ? units.find((u) => u.id === hit) : undefined;
        /*
         * מצב הנחה: החדר עומד, וכל תנועה על הציור מזיזה את הארגז
         * שביד — גם כשהאצבע ירדה על הרצפה. אחרת היה צריך לפגוע
         * בארגז בדיוק, וזו בדיוק התנועה שקשה באצבע.
         */
        if (placing && onMoveTo) {
          const anchor = units.find((u) => u.id === placing.ids[0]);
          if (anchor) {
            onGesture?.('start');
            drag.current = {
              from: anchor,
              mates: placing.ids
                .filter((id) => id !== anchor.id)
                .map((id) => units.find((u) => u.id === id))
                .filter((u): u is PlacedUnit => !!u && !u.free),
              startX: e.clientX,
              startY: e.clientY,
              moved: false,
            };
            armAxis(e.clientX, e.clientY, anchor);
            return;
          }

        }
        /*
         * כשהחדר נעול האצבע שייכת לארונות בלבד: אצבע על ארון גוררת
         * אותו, ואצבע על הרצפה לא עושה דבר. חדר שהמשיך להסתובב
         * בזמן שמזיזים ארון הפך כל גרירה להימור על מה יזוז.
         */
        if (locked && !present) {
          if (held && onMoveTo) {
            onGesture?.('start');
            drag.current = {
              from: held,
              mates: [],
              startX: e.clientX,
              startY: e.clientY,
              moved: false,
            };
            armAxis(e.clientX, e.clientY, held);
          } else {
            orbit.current = { x: e.clientX, y: e.clientY, from: view, moved: false, hit };
          }
          return;
        }
        orbit.current = {
          x: e.clientX,
          y: e.clientY,
          from: view,
          moved: false,
          hit,
        };
        /* חדר חופשי: אצבע שנשארת על ארון עוברת ממנו אל הארון עצמו */
        if (held) armAxis(e.clientX, e.clientY, held);
      }}
      onPointerMove={(e) => {
        /*
         * האצבע זזה — וזה נוגע גם למחווה שאינה גרירה.
         *
         * המדידה של הלחיצה הארוכה בוטלה עד כה רק במסלול הגרירה,
         * ולכן סיבוב מצלמה המשיך להריץ אותה: מי שזז 25 פיקסלים
         * והמשיך להחזיק חצי שנייה קיבל את הארון נגרר מתחת לידו,
         * באמצע סיבוב. הביטול שייך לתנועה עצמה ולא למסלול שבחר בה.
         */
        press.current.move(e.clientX, e.clientY);
        if (drag.current) return moveDrag(e);
        const o = orbit.current;
        if (!o) return;
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        if (!o.moved && Math.hypot(dx, dy) < ORBIT_SLOP) return;
        o.moved = true;
        /* חדר נעול או ארגז שביד — המבט אינו זז */
        if (locked || placing) return;
        const box = e.currentTarget.getBoundingClientRect();
        setView({
          // סיבוב מלא כשגוררים על פני רוחב המסך פעמיים, עד גבול הקיר
          yawDeg: Math.min(
            Math.max(o.from.yawDeg - (dx / Math.max(box.width, 1)) * 180, -120 - heading),
            30 - heading,
          ),
          rise: Math.min(
            Math.max(o.from.rise + (dy / Math.max(box.height, 1)) * 1.2, MIN_RISE),
            MAX_RISE,
          ),
        });
      }}
      onPointerUp={(e) => {
        const o = orbit.current;
        const d = drag.current;
        press.current.cancel();
        orbit.current = null;
        drag.current = null;
        if (d) onGesture?.('commit');
        setLanding(null);
        setLock(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        /*
         * גם גרירה מסתיימת בבחירה: ארון שהועבר לקיר אחר צריך שהמסך
         * יעבור אליו, אחרת הלוח שלו נסגר באמצע העבודה.
         */
        if (d) return onSelect(d.from.id);
        if (!o || o.moved) return;
        /* בבחירה מרובה נגיעה מוסיפה ומורידה מהאוסף במקום להחליף אותו */
        if (picked && o.hit) {
          setPicked(picked.includes(o.hit) ? picked.filter((q) => q !== o.hit) : [...picked, o.hit]);
          return;
        }
        onSelect(o.hit);
      }}
      /*
       * ביטול של המערכת אינו סיום של המשתמש.
       *
       * שני המסלולים נכנסו עד כה לאותה שורה, ולכן תנועה שבוטלה
       * נשמרה: בתלת־ממד מ-(970,1270) ל-(2200,1900). מה שביד יורד.
       */
      onPointerCancel={() => {
        press.current.cancel();
        orbit.current = null;
        if (drag.current) onGesture?.('cancel');
        drag.current = null;
        setLanding(null);
        setLock(null);
      }}
    >
      {/*
        תצוגת הצגה: אור רך מלמעלה, קרקע שמתבהרת אל האופק, וצל מתחת
        לכל מה שעומד. שלושת אלה הם מה שהופך מלבנים צבועים לחדר.
      */}
      {present && (
        <defs>
          <linearGradient id="iso-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7f5f2" />
            <stop offset="100%" stopColor="#e8e4de" />
          </linearGradient>
          <linearGradient id="iso-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6e1da" />
            <stop offset="100%" stopColor="#cfc8bd" />
          </linearGradient>
          <linearGradient id="iso-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
          <filter id="iso-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy={vbH / 90} stdDeviation={vbW / 260} floodOpacity="0.22" />
          </filter>
        </defs>
      )}
      {present && (
        <rect x={minX} y={minY} width={vbW} height={vbH} fill="url(#iso-sky)" />
      )}

      {/* הרצפה — מצולע אחד לכל החדר, מתחת לכל השאר */}
      <polygon data-room-floor="" points={floor} fill={present ? 'url(#iso-floor)' : '#f0efec'} />

      {backdrops.map((b) => (
        <g key={b.key}>
          {b.thickness.map((t, i) => (
            <polygon
              key={`th-${i}`}
              data-wall-thickness=""
              points={t}
              fill={present ? '#e9e5df' : '#eceae6'}
              stroke={present ? 'none' : '#e0ddd8'}
              strokeWidth={stroke * 0.7}
            />
          ))}
          {b.wall && (
            <polygon
              points={b.wall}
              fill={present ? '#f2efea' : b.active ? '#faf8f5' : '#f4f3f1'}
              stroke={present ? 'none' : b.active ? '#d6d3d1' : '#e7e5e4'}
              strokeWidth={stroke}
            />
          )}
          {b.onWall.map((f) => (
            <polygon
              key={f.key}
              data-wall-feature={f.kind}
              points={f.points}
              fill={f.tone}
              fillOpacity={present ? 0.9 : 0.55}
              stroke={present ? 'none' : '#a8a29e'}
              strokeWidth={stroke * 0.7}
            />
          ))}
          {/* קו הבסיס מראה איפה הקיר עומד, גם כשהמישור שלו לא מצויר */}
          {!present && (
            <polyline
              points={b.base}
              fill="none"
              stroke={b.active ? '#a8a29e' : '#d6d3d1'}
              strokeWidth={stroke * 1.4}
              strokeLinecap="round"
            />
          )}
        </g>
      ))}

      <g filter={present ? 'url(#iso-shadow)' : undefined}>{painted}</g>

      {/* שכבת האור: מבהירה למעלה ומכהה למטה, על כל התמונה בבת אחת */}
      {present && (
        <rect
          x={minX}
          y={minY}
          width={vbW}
          height={vbH}
          fill="url(#iso-light)"
          pointerEvents="none"
        />
      )}

      {!present &&
        marks.map((m) => (
        <g key={`mark-${m.key}`} pointerEvents="none">
          <path
            d={m.arrow}
            fill="none"
            stroke={m.active ? '#a06236' : '#a8a29e'}
            strokeWidth={stroke * 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x={m.x}
            y={m.y}
            textAnchor="middle"
            fontSize={vbW / 26}
            fill={m.active ? '#a06236' : '#a8a29e'}
            fontWeight={m.active ? 700 : 500}
          >
            {m.label}
          </text>
        </g>
        ))}

      {/*
        טבעת הכפתורים, מעל הארגז הנבחר.

        כאן ולא בלוח הצדדי: כל מה שעושים לארגז עומד לידו, ורואים
        את התוצאה באותה תנועה. במצב הנחה הטבעת מתחלפת בשני כפתורים
        בלבד — להניח או לבטל — כי בזמן שארגז ביד אין פעולה אחרת.
      */}
      {!present && selectedUnit && (() => {
        const b = screenBox(placing ? placing.ids[0] : selectedUnit.id);
        if (!b) return null;
        const r = Math.min(19 / pxPerUnit, vbW / 13);
        const cy = Math.max(b.y0 - r * 1.5, minY + r * 1.2);
        /* כפתור שנדחף אל מחוץ למסגרת אינו כפתור — הטבעת נשארת בתוכה */
        const at = (i: number, n: number) =>
          Math.min(
            Math.max(b.x0 + (b.x1 - b.x0) / 2 + (i - (n - 1) / 2) * r * 2.3, minX + r * 1.2),
            minX + vbW - r * 1.2,
          );

        if (placing) {
          return (
            <g>
              {ringButton(
                'הנחת הארגז',
                'M-6 0 l4 4 l8 -9',
                at(0, 2),
                cy,
                r,
                () => setPlacing(null),
                '#0f766e',
              )}
              {ringButton(
                'ביטול ההזזה',
                'M-5 -5 l10 10 M5 -5 l-10 10',
                at(1, 2),
                cy,
                r,
                () => {
                  for (const u of placing.from) onMoveTo?.(u.id, restore(u));
                  setPlacing(null);
                },
                '#b91c1c',
              )}
            </g>
          );
        }

        const tools: { label: string; d: string; run: () => void }[] = [];
        if (onMoveTo) {
          tools.push({
            label: 'תזוזה',
            d: 'M0 -8 V8 M-8 0 H8 M0 -8 l-3 3 M0 -8 l3 3 M0 8 l-3 -3 M0 8 l3 -3 M-8 0 l3 -3 M-8 0 l3 3 M8 0 l-3 -3 M8 0 l-3 3',
            run: () => {
              const ids = picked?.length ? picked : [selectedUnit.id];
              const from = units.filter((u) => ids.includes(u.id));
              if (from.length) setPlacing({ ids, from });
              setPicked(null);
            },
          });
        }
        if (onBulk) {
          tools.push({
            label: 'בחירה מרובה',
            d: 'M-8 -8 h10 v10 h-10 z M-2 -2 h10 v10 h-10 z',
            run: () => setPicked(picked ? null : [selectedUnit.id]),
          });
        }
        if (onEdit) {
          tools.push({
            label: 'עריכה מהירה',
            d: 'M-7 7 l1.8 -4.6 L3 -7 l4 4 l-9.4 8.2 z M2 -6 l4 4',
            run: () => onEdit(selectedUnit.id),
          });
        }
        return (
          <g>
            {tools.map((t, i) =>
              ringButton(t.label, t.d, at(i, tools.length), cy, r, t.run,
                t.label === 'בחירה מרובה' && picked ? '#0f766e' : '#a06236'),
            )}
          </g>
        );
      })()}

      {/* הארגזים שנבחרו יחד, מסומנים במסגרת */}
      {!present && picked?.map((id) => {
        const b = screenBox(id);
        if (!b) return null;
        return (
          <rect
            key={`pick-${id}`}
            x={b.x0}
            y={b.y0}
            width={b.x1 - b.x0}
            height={b.y1 - b.y0}
            fill="none"
            stroke="#0f766e"
            strokeWidth={stroke * 2}
            strokeDasharray={`${stroke * 4} ${stroke * 3}`}
            pointerEvents="none"
          />
        );
      })}

      {/*
        שני חצי הסיבוב, מתחת לארגז הנבחר.
        כאן ולא בלוח הצדדי: מסובבים ארון כשמסתכלים עליו, ורואים את
        התוצאה באותה תנועה. כל לחיצה היא רבע סיבוב, ושמונה לחיצות
        מחזירות למקום — אין מצב שאי אפשר לצאת ממנו.
      */}
      {spinAt && selectedUnit && onRotate && !placing && !picked && (
        <g>
          {([
            { dir: -1 as const, label: 'סיבוב שמאלה', at: -1 },
            { dir: 1 as const, label: 'סיבוב ימינה', at: 1 },
          ]).map(({ dir, label, at }) => {
            const r = Math.min(17 / pxPerUnit, vbW / 14);
            /*
             * ארון שעומד בתחתית התמונה היה דוחף את החצים אל מחוץ
             * למסגרת. הם נשארים בתוכה גם אז — כפתור שרואים חצי
             * ממנו עדיף על כפתור שנעלם.
             */
            const cx = Math.min(
              Math.max(spinAt.x + at * r * 1.35, minX + r * 1.2),
              minX + vbW - r * 1.2,
            );
            const cy = Math.min(spinAt.y + r * 1.6, minY + vbH - r * 1.2);
            /*
             * ארגז על קיר מסתובב ברבעים ביחס לקיר; אי מסתובב ביחס
             * לחדר, כי אין לו קיר להסתובב ביחס אליו. אותה לחיצה,
             * שני שדות.
             */
            const turn = (v: number) => (((v + dir * 90) % 360) + 360) % 360;
            const next: Partial<PlacedUnit> = selectedUnit.free
              ? { free: { ...selectedUnit.free, headingDeg: turn(selectedUnit.free.headingDeg) } }
              : { rotationDeg: turn(selectedUnit.rotationDeg ?? 0) as 0 | 90 | 180 | 270 };
            return (
              <g
                key={label}
                role="button"
                aria-label={label}
                tabIndex={0}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onRotate(selectedUnit.id, next);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  e.stopPropagation();
                  onRotate(selectedUnit.id, next);
                }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="#ffffff"
                  stroke="#a06236"
                  strokeWidth={r * 0.09}
                />
                {/*
                  חץ מעוקל: קשת של שלושה רבעי מעגל, וראש מלא בקצה
                  שאליו הסיבוב הולך. הקשת והראש נגזרים מאותה זווית,
                  ולכן הראש תמיד יושב על הקצה ובכיוון התנועה.
                */}
                {(() => {
                  const a = r * 0.44;
                  /* נקודה על הקשת. `dir` הופך את הציור, ואיתו גם את כיוון הסיבוב */
                  const at = (deg: number) => {
                    const t = (deg * Math.PI) / 180;
                    return [cx + dir * a * Math.cos(t), cy + a * Math.sin(t)] as const;
                  };
                  const [x0, y0] = at(60);
                  const [x1, y1] = at(-30);
                  const t1 = (-30 * Math.PI) / 180;
                  /* המשיק בקצה, בכיוון שבו הקשת נסגרת */
                  const tx = -Math.sin(t1) * dir;
                  const ty = Math.cos(t1);
                  const hl = r * 0.3;
                  const hw = r * 0.19;
                  const head = [
                    [x1 + tx * hl, y1 + ty * hl],
                    [x1 - ty * hw, y1 + tx * hw],
                    [x1 + ty * hw, y1 - tx * hw],
                  ];
                  return (
                    <>
                      <path
                        d={`M ${x0} ${y0} A ${a} ${a} 0 1 ${dir > 0 ? 1 : 0} ${x1} ${y1}`}
                        fill="none"
                        stroke="#a06236"
                        strokeWidth={r * 0.14}
                        strokeLinecap="round"
                      />
                      <polygon points={head.map((q) => q.join(',')).join(' ')} fill="#a06236" />
                    </>
                  );
                })()}
              </g>
            );
          })}
        </g>
      )}
    </svg>

    {/*
      נעילת החדר.
      סיבוב המבט והזזת ארגז דורשים את אותה אצבע על אותה תמונה, ולכן
      הם אינם יכולים לחיות יחד. נעול — האצבע מזיזה ארונות והחדר עומד
      במקום; פתוח — האצבע מסובבת את החדר ואפשר להסתכל מכל זווית.
    */}
    {onMoveTo && !present && (
      <button
        onClick={() => setLocked((m) => !m)}
        aria-pressed={locked}
        aria-label={locked ? 'שחרור סיבוב החדר' : 'נעילת סיבוב החדר'}
        title={locked ? 'החדר נעול — האצבע מזיזה ארונות' : 'החדר חופשי — האצבע מסובבת את המבט'}
        className={`absolute start-1 top-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors ${
          locked ? 'bg-oak-600 text-white' : 'bg-white/90 text-stone-600 hover:text-oak-700'
        }`}
      >
        {locked ? <LockIcon className="size-3.5" /> : <UnlockIcon className="size-3.5" />}
        {locked ? 'נעול' : 'חופשי'}
      </button>
    )}

    {/*
      פס הפעולות של בחירה מרובה.

      כאן ולא על הציור: הפעולות נוגעות לאוסף ולא למקום מסוים בו,
      ורשימה קריאה עדיפה על עוד כפתורים עגולים שמתחרים על אותו
      מקום. הפס אומר גם כמה נבחרו — בלעדיו לא ברור על מה לוחצים.
    */}
    {picked && onBulk && !present && (
      <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1.5 rounded-2xl bg-stone-900/90 px-2.5 py-2 text-white shadow-lg backdrop-blur">
        <span className="ms-1 me-auto text-xs font-medium">
          {picked.length ? `${picked.length} ארגזים` : 'בחרו ארגזים'}
        </span>
        {[
          { label: 'מחיקה', run: () => { onBulk(picked, 'delete'); setPicked(null); } },
          { label: 'הסתרה', run: () => { onBulk(picked, 'hide'); setPicked(null); } },
          { label: 'שמירה כארגז', run: () => { onBulk(picked, 'library'); setPicked(null); } },
        ].map((a) => (
          <button
            key={a.label}
            disabled={!picked.length}
            onClick={a.run}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/30 disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={() => setPicked(null)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white"
        >
          סיום
        </button>
      </div>
    )}

    {/*
      על מי הארגז נוחת.
      זה גובר על ההנחיה הכללית: ברגע שיש יעד, הוא מה שצריך לדעת.
    */}
    {lock && !present ? (
      /*
        נעילת ציר גוברת על הכול: כשהיא פעילה זה מה שקובע לאן הארגז
        זז, ובלי שהיא כתובה מי שגרר וראה מידה אחת בלבד משתנה חשב
        שהמסך נתקע.
      */
      <span className="pointer-events-none absolute inset-x-0 top-1 mx-auto w-fit rounded-full bg-violet-700 px-3 py-1 text-[11px] font-medium text-white">
        {lock.axis
          ? `נעול ל${axisLabel(lock.axis, plan.find((q) => q.wall.id === drag.current?.from.wallId)?.headingDeg ?? 0)}`
          : 'נעילת ציר — גררו לכיוון שבו להזיז'}
      </span>
    ) : landing && !present ? (
      <span className="pointer-events-none absolute inset-x-0 top-1 mx-auto w-fit rounded-full bg-teal-700 px-3 py-1 text-[11px] font-medium text-white">
        נוחת על {landing}
      </span>
    ) : (
      /* בזמן שארגז ביד, נאמר במפורש שהחדר עומד */
      placing && !present && (
        <span className="pointer-events-none absolute inset-x-0 top-1 mx-auto w-fit rounded-full bg-stone-900/90 px-3 py-1 text-[11px] font-medium text-white">
          גוררים למקום, ואז מניחים
        </span>
      )
    )}

    {/*
      חזרה לזווית ההתחלתית, אחרי שהסתובבנו למקום שקשה לחזור ממנו.
      "התחלתית" היא מול הקיר שעובדים עליו, ולא מול הקיר הראשון.
    */}
    {(view.yawDeg !== -heading || view.rise !== DEFAULT_VIEW.rise) && (
      <button
        onClick={() => setView({ ...DEFAULT_VIEW, yawDeg: -heading })}
        className="absolute end-1 top-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-stone-600 shadow-sm transition-colors hover:text-oak-700"
      >
        זווית התחלתית
      </button>
    )}
    </div>
  );
}
