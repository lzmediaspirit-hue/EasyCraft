import { useRef, useState } from 'react';
import { CabinetGlyph, autoShelves, shelfYs } from '../../catalog/CabinetGlyph';
import { glyphDef } from '../../catalog/glyphList';
import { isDark, shade } from '../../ui/color';
import { unitZones } from '../../catalog/zones';
import { featureBiteMm, featureDef } from '../projects/wallFeatures';
import { MATERIAL } from '../../catalog/standards';
import { cm } from '../../ui/units';
import { WORK_TONES, isInstalled, tracksWork, workTone } from '../../workflow/unitWork';
import { SNAP, SNAP_PX, snapX, snapY } from './snapping';
import { stackSnap } from './stacking';
import { AxisGuide, DragGuide } from './dragGuide';
import type { Guide } from './dragGuide';
import { axesFor, longPress, pickAxis } from './axisLock';
import type { GesturePhase } from './gesture';
import type { Axis } from './axisLock';
import { blocked } from './collision';
import { unitBox, wallShadow } from './placement';
import type { CornerZones, PlanWall } from './plan';
import { outOfSight } from './designView';
import { RulerMeasure, RulerTargets, rulerSpan } from './wallRuler';
import type { RulerAxis } from './wallRuler';
import { RAIL_WIDTH_MM, alongWallMm, bodyHeightMm, intoRoomMm } from '../../db/types';
import { partChoice, partThicknessMm } from '../../costing/boards';
import type { PartSettings } from '../../costing/boards';
import type { PlacedUnit, Project, RailSides, Wall } from '../../db/types';



export type MeasureAxis = 'w' | 'h' | 'd';

/**
 * "זווית המבט" של ציור החזית.
 *
 * אין בו זווית: הוא מישור. הקבוע הזה קיים כדי שבחירת הציר תשתמש
 * באותו חשבון שמשמש את התלת־ממד — לאורך הקיר יוצא אופקי, הגובה
 * יוצא אנכי — ולא בהשוואה נפרדת שיכולה להסכים איתו או לא.
 */
const FLAT = { yawDeg: 0, rise: 0 };

type Props = {
  wall: Wall;
  units: PlacedUnit[];
  /**
   * כל הארגזים בחדר, וגיאומטריית הקירות.
   *
   * הגרירה כאן מציירת קיר אחד אבל מתנגשת בחדר שלם: ארון על הקיר
   * השכן ואי שעומד באמצע תופסים מקום אמיתי, וחסימה שמסתכלת רק על
   * הקיר הזה הייתה נותנת להיכנס לתוכם.
   */
  allUnits: PlacedUnit[];
  plan: PlanWall[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * הזזת ארגז. חסר = תצוגה בלבד, והגרירה אינה מתחילה כלל.
   *
   * זו הדרך שבה מי שאין לו רשות עריכה אינו מזיז ארגז בטעות: לא
   * מסתירים ממנו את הציור, פשוט אין לאן לשלוח את התנועה.
   */
  onMove?: (id: string, patch: Partial<PlacedUnit>) => void;
  /** הסתרת חזיתות — תצוגת פנים הארונות */
  inside: boolean;
  /** גוון לכל ארגז, לפי מזהה הגוון */
  finishHex: Record<string, string>;
  /** מצב מדידה פעיל, והציר שנמדד */
  measure?: MeasureAxis | null;
  /** רוחב אזורי הפינה בשני קצות הקיר, שנתפסים בידי הקיר השכן */
  corners?: CornerZones;
  /** קו מידה אנכי לגובה הקיר */
  showHeight?: boolean;
  /**
   * מצב סרגל: הארגזים שנבחרו למדידת המרחק ביניהם.
   * `null` = הסרגל כבוי.
   */
  rulerPair?: string[] | null;
  /** הציר שהסרגל מודד בו */
  rulerAxis?: RulerAxis;
  /**
   * מצב תהליך עבודה: הארגזים נצבעים לפי מה שנעשה בהם, ולא לפי
   * הגוון שנבחר להם. הגרירה מכובה — מי שעומד ליד המסור לא אמור
   * להזיז ארגז בטעות.
   */
  work?: boolean;
  /** הפרויקט — ממנו נגזר הגוון של חלק שלא נבחר לו גוון משלו */
  project?: Project;
  /** ההגדרות שמהן נגזר עובי הלוח, כדי שהחזית תסומן בעוביה שלה */
  parts?: PartSettings;
  /**
   * שלבי המחווה — כדי שתנועה אחת תהיה צעד אחד לביטול, וכדי
   * שמחווה שבוטלה לא תיכתב בכלל.
   */
  onGesture?: (phase: GesturePhase) => void;
  /**
   * ההצמדה פעילה.
   *
   * כבויה = הארגז נוחת במקום שהאצבע לקחה אותו, מעוגל לסנטימטר
   * שלם. זה המילוט מהצמדה שמושכת למקום הלא נכון.
   */
  snap?: boolean;
};


/**
 * הדמיית חזית של קיר אחד.
 * גרירה מזיזה ארגז לרוחב, ואם הוא לא נעול לרצפה גם לגובה,
 * עם הצמדה לשכנים, לרצפה ולתקרה.
 */
export function WallElevation({
  wall,
  units: wallUnits,
  allUnits,
  plan,
  selectedId,
  onSelect,
  onMove,
  inside,
  finishHex,
  measure,
  corners,
  showHeight,
  rulerPair,
  rulerAxis = 'w',
  work,
  project,
  parts,
  onGesture,
  snap = true,
}: Props) {

  /*
   * חיפוי קיר מצויר ראשון: הוא מכסה את הקיר, והארגזים עומדים לפניו.
   * בלי הסדר הזה לוח שנוסף אחרון היה מסתיר את מה שהוא אמור לגבות.
   */
  /*
   * עובי החזית שנבחר לארגז הזה — אותו מספר שלפיו הוא נחתך ושלפיו
   * הוא מצויר בתלת־ממד. דופן זרה היא לוח חזית, וסימון שלה בעובי
   * קבוע הראה 18 מ״מ על ארגז שנחתך מ-30.
   */
  const frontMm = (u: PlacedUnit) =>
    parts ? partThicknessMm(u, 'front', parts, project) : MATERIAL.frontMm;

  const layer = (u: PlacedUnit) => (glyphDef(u.glyph).cladding ? 0 : 1);
  const units = [...wallUnits].sort((a, b) => layer(a) - layer(b));
  /*
   * ארגז מוסתר אינו מצויר, אבל נשאר ברשימה: הוא עדיין תופס מקום
   * בקיר, עדיין חוסם גרירה, ועדיין נספר בחומרים ובניסור. ההסתרה
   * היא של העין בלבד.
   */
  const shown = units.filter((u) => !outOfSight(u));
  const here = plan.find((p) => p.wall.id === wall.id);
  /** אי: הצל שלו על הקיר הזה. ארגז רגיל מחזיר ריק ומצויר כרגיל. */
  const free = (u: PlacedUnit) => {
    if (!u.free || !here) return null;
    const b = unitBox(u, plan);
    return b ? wallShadow(b, here) : null;
  };

  const svgRef = useRef<SVGSVGElement>(null);
  /*
   * מה מוצג בזמן הגרירה: על מי הארגז עומד להינחת, ולמה הוא לא
   * עולה. זה מצב של רגע ולא של הפרויקט, ולכן הוא חי כאן ומתאפס
   * בשחרור.
   */
  const [guide, setGuide] = useState<Guide | null>(null);

  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    scale: number;
    /* מצב הנעילה כפי שהיה בתחילת הגרירה. בלעדיו הצמדה שקורית
       באמצע הגרירה הייתה מקפיאה אותה במקום */
    locked: boolean;
    /*
     * אי: המקום שלו ברצפת החדר בתחילת הגרירה.
     *
     * אי אינו נמדד מקיר, ולכן `xMm` שלו רדום. גרירה בחזית עדכנה
     * דווקא אותו — הצורה לא זזה על המסך, והמיקום השמור השתנה בלי
     * שאיש ראה. מה שזז כאן הוא המקום ברצפה, לאורך הקיר שרואים.
     */
    free?: { xMm: number; zMm: number };
    /* היעד שכבר נבחר להנחה — כדי שהוא לא יקפוץ בין שני שכנים */
    onId?: string;
    /* לחיצה ארוכה נדלקה: הגרירה הזו מוגבלת לציר אחד */
    armed?: boolean;
    /* הציר שנעול. ריק אחרי הנעילה ולפני שהכיוון התברר */
    axis?: Axis | null;
  } | null>(null);

  /*
   * לחיצה ארוכה נועלת ציר.
   *
   * המדידה יושבת ב-`axisLock` ולא כאן, כי ציור החזית והתלת־ממד
   * צריכים בדיוק את אותו סף ואת אותה סבילות: שתי מחוות שמרגישות
   * שונה באותה אפליקציה הן שתי אפליקציות.
   */
  const press = useRef(longPress());
  /** מה שמוצג על נעילת הציר. `null` = אין נעילה */
  const [lock, setLock] = useState<{ axis: Axis | null } | null>(null);


  /* הארגז שביד — דרכו עובר קו הציר הנעול */
  const held = lock ? (units.find((u) => u.id === drag.current?.id) ?? null) : null;

  // כשקו הגובה מוצג צריך מקום לצידו, אחרת המידה נחתכת
  const padX = showHeight ? 420 : 120;
  /* מקום מעל הקיר לתוויות הסימונים */
  const padTop = Math.max(140, wall.heightMm * 0.09);
  const padBottom = 340;
  const vbW = wall.lengthMm + padX * 2;
  const vbH = wall.heightMm + padTop + padBottom;
  const stroke = Math.max(wall.lengthMm / 420, 4);
  /* המרווח שנמדד בין שני הקצוות שנבחרו, כשהסרגל פתוח */
  const span = rulerSpan(wall, units, rulerPair, rulerAxis);
  const fontSize = Math.max(wall.lengthMm / 40, 70);
  /** גובה המסך של נקודה שנמדדת מהרצפה. */
  const flip = (yFromFloor: number) => wall.heightMm - yFromFloor;

  function beginDrag(e: React.PointerEvent, unit: PlacedUnit) {
    onSelect(unit.id);
    // במצב מדידה ההקשה רק בוחרת ארגז, בלי להזיז אותו בטעות
    if (measure) return;
    /* תצוגה בלבד: אין למי לשלוח את התנועה, ולכן אין גרירה */
    if (!onMove) return;
    /*
     * קנה המידה נגזר מהטרנספורם האמיתי של ה-SVG ולא מרוחב האלמנט:
     * כשהציור משתלב במסגרת נמוכה הוא מוקטן וממורכז, ואז רוחב
     * האלמנט כבר אינו רוחב הציור — וגרירה לפיו הייתה קופצת.
     */
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm || !ctm.a) return;
    /*
     * תפיסת המצביע היא נוחות ולא תנאי: יש דפדפנים שזורקים כאן על
     * אלמנט SVG פנימי, וכשזה קרה הגרירה בעכבר פשוט לא התחילה.
     * מטפלי התנועה יושבים על ה-SVG עצמו, ולכן היא עובדת גם בלעדיה.
     */
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // אין תפיסה — ה-SVG עדיין מקבל את התנועה
    }
    onGesture?.('start');
    drag.current = {
      id: unit.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: unit.xMm,
      originY: unit.yMm,
      scale: 1 / ctm.a,
      locked: !!unit.floorLocked,
      free: unit.free ? { xMm: unit.free.xMm, zMm: unit.free.zMm } : undefined,
    };
    /*
     * אצבע שנשארת במקום מבקשת דיוק, לא מקום חדש. אחרי חצי שנייה
     * הגרירה הופכת לתנועה בציר אחד, והציר עצמו נבחר מהכיוון
     * הראשון שגוררים בו.
     */
    press.current.start(e.clientX, e.clientY, () => {
      if (!drag.current) return;
      drag.current.armed = true;
      drag.current.axis = null;
      setLock({ axis: null });
    });
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    /* בלי `onMove` הגרירה לא התחילה, ולכן אין כאן תנועה לפתור */
    if (!d || !onMove) return;
    const unit = units.find((u) => u.id === d.id);
    if (!unit) return;
    /* אצבע שזזה ביטלה את הלחיצה הארוכה — זו גרירה רגילה */
    press.current.move(e.clientX, e.clientY);

    /*
     * הציר נבחר מהכיוון הראשון שגוררים בו אחרי הנעילה, ועד שהוא
     * מתברר הארגז אינו זז: תנועה של שלושה פיקסלים אינה אומרת
     * "לגובה" יותר מ"לרוחב", וניחוש כאן נועל את הציר הלא נכון.
     */
    if (d.armed && !d.axis) {
      const pick = pickAxis(
        e.clientX - d.startX,
        e.clientY - d.startY,
        axesFor(unit, false),
        FLAT,
      );
      if (!pick) return;
      d.axis = pick;
      setLock({ axis: pick });
    }
    const axis = d.armed ? (d.axis ?? null) : null;

    const alongMm = (e.clientX - d.startX) * d.scale;
    const rawX = d.originX + alongMm;
    // מסך גדל כלפי מטה, הקיר נמדד כלפי מעלה — ולכן הסימן הפוך
    const rawY = d.originY - (e.clientY - d.startY) * d.scale;

    /*
     * אי זז ברצפת החדר לאורך הקיר שרואים, ולא במידות הקיר שאינן
     * בשימוש אצלו. הכיוון נלקח מהקיר עצמו, ולכן זה עובד גם בקיר
     * שאינו אופקי.
     */
    if (d.free && unit.free && here) {
      const a = (here.headingDeg * Math.PI) / 180;
      /* נעילה לגובה: המקום ברצפה הוא בדיוק מה שהיה, עד המ"מ */
      const next =
        axis === 'y'
          ? { ...unit.free, xMm: d.free.xMm, zMm: d.free.zMm }
          : {
              ...unit.free,
              xMm: Math.round(d.free.xMm + alongMm * Math.cos(a)),
              zMm: Math.round(d.free.zMm + alongMm * Math.sin(a)),
            };
      const y =
        d.locked || axis === 'along' ? d.originY : Math.max(Math.round(rawY), 0);
      const probe = { ...unit, free: next, yMm: y };
      const box = unitBox(probe, plan);
      if (box && !blocked(probe, box, allUnits, plan)) onMove(d.id, { free: next, yMm: y });
      return;
    }


    /*
     * סף ההצמדה במ"מ, שקול למרחק קבוע על המסך בכל קנה מידה.
     * אפס = ההצמדה כבויה, והארגז נוחת בדיוק במקום שהאצבע לקחה
     * אותו: יעד שמרחקו ממנה קטן מאפס אינו קיים.
     */
    const tol = snap ? Math.max(SNAP, SNAP_PX * d.scale) : 0;

    /*
     * הנחה על ארגז אחר קודמת להצמדה הרגילה.
     *
     * כשמניחים ארגז על ארגז מבקשים פינה, ולא שני יעדים נפרדים
     * שבמקרה נפגשו: התחתית של העליון על הראש של התחתון, מיושרת
     * לתחילתו או לסופו. לכן שני הצירים נפתרים כאן יחד, ורק מי
     * שלא מצא פינה ממשיך להצמדה שפותרת כל ציר לבדו.
     */
    /*
     * הנחה על ארגז פותרת שני צירים יחד, ולכן היא אינה קיימת
     * כשנעולים לאחד: פינה שמיישרת גם את הגובה היא בדיוק מה שנעילת
     * "לאורך הקיר" באה למנוע.
     */
    const stack = snap && !d.locked && !axis
      ? stackSnap(unit, rawX, rawY, units, tol, d.onId, wall.lengthMm)
      : null;
    d.onId = stack?.onId;

    const x = stack
      ? stack.xMm
      : axis === 'y'
        ? d.originX
        : snapX(rawX, unit, units, wall.lengthMm, corners, tol);
    // הגובה נמדד ביחס למקום שאליו הארגז הולך, ולא למקום שממנו יצא
    const y = stack
      ? stack.yMm
      : d.locked || axis === 'along'
        ? d.originY
        : snapY(rawY, unit, units, wall.heightMm, tol, x);
    /*
     * שני ארגזים לא עומדים באותו מקום. כשהיעד תפוס מנסים קודם
     * להזיז רק בציר אחד — כך גרירה לאורך קיר מלא עדיין זזה במקום
     * להיתקע — ואם גם זה תפוס, הארגז נשאר איפה שהוא.
     *
     * ארגז שכבר חופף במקום שהוא עומד בו הוא היוצא מן הכלל: חסימה
     * שם הייתה נועלת אותו שם לתמיד, ודווקא ממנו צריך לצאת.
     */
    const hereBox = unitBox(unit, plan);
    const stuck = !!hereBox && blocked(unit, hereBox, allUnits, plan);
    const at = (nx: number, ny: number) => {
      const probe = { ...unit, xMm: nx, yMm: ny };
      const b = unitBox(probe, plan);
      return !!b && (stuck || !blocked(probe, b, allUnits, plan));
    };
    const landed = at(x, y);
    /*
     * כשנעולים לציר אחד אין נפילה לציר השני.
     *
     * שרשרת המילוט הרגילה מזיזה את מה שלא ביקשו להזיז כשהיעד תפוס
     * — וזו בדיוק ההפתעה שהנעילה מונעת. ארגז שאין לו לאן ללכת
     * בציר שלו פשוט נשאר.
     */
    const [fx, fy] = landed
      ? [x, y]
      : axis
        ? [d.axis === 'y' ? d.originX : unit.xMm, d.axis === 'y' ? unit.yMm : d.originY]
        : at(x, unit.yMm)
          ? [x, unit.yMm]
          : at(unit.xMm, y)
            ? [unit.xMm, y]
            : [unit.xMm, unit.yMm];
    onMove(d.id, { xMm: fx, yMm: fy });

    /*
     * מה שמוצג בזמן הגרירה.
     *
     * נעילה לרצפה היא הדבר היחיד כאן שמסרב בשקט: מי שמושך ארגז
     * נעול כלפי מעלה ראה אותו זז לצדדים בלבד, בלי שאיש אמר למה.
     * עכשיו זה כתוב, יחד עם מה לעשות.
     */
    const lifting = !d.locked ? false : Math.abs(rawY - d.originY) > 60;
    setGuide(
      stack && landed
        ? {
            kind: 'stack',
            onId: stack.onId,
            name: units.find((u) => u.id === stack.onId)?.name ?? 'הארגז שמתחת',
            edge: stack.edge,
            onCounter: stack.onCounter,
            xMm: stack.xMm,
            yMm: stack.yMm,
            widthMm: alongWallMm(unit),
          }
        : lifting
          ? { kind: 'locked' }
          : null,
    );
  }

  /**
   * סוף הגרירה — באישור או בביטול.
   *
   * שחרור הגרירה לא נוגע בנעילה לרצפה. מי שכיבה את הנעילה רוצה
   * לגרור לגובה, וארגז שנח על הרצפה תוך כדי לא אומר שהחליט
   * להינעל אליה — נעילה חוזרת שם הפכה את המתג לחסר משמעות.
   *
   * ביטול והרפיה נכנסו עד כה לאותו ענף, ולכן `pointercancel` —
   * שיחה נכנסת, אצבע שנייה, מחווה של המערכת — שמר את התנועה
   * שהמשתמש ביטל. שני שמות, שתי תוצאות.
   */
  function endDrag(e: React.PointerEvent, phase: 'commit' | 'cancel') {
    if (drag.current) {
      onGesture?.(phase);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // לא נתפס מלכתחילה
      }
    }
    press.current.cancel();
    drag.current = null;
    setGuide(null);
    setLock(null);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${-padX} ${-padTop} ${vbW} ${vbH}`}
      className="max-h-full w-full min-h-0 flex-1 touch-pan-y select-none"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
      /*
       * התנועה והשחרור יושבים על ה-SVG ולא על הארגז: כך הגרירה
       * ממשיכה גם כשהמצביע יוצא מהמלבן הקטן, וגם כשתפיסת המצביע
       * לא נתמכת.
       */
      onPointerMove={moveDrag}
      onPointerUp={(e) => endDrag(e, 'commit')}
      /*
        יציאה מהציור בזמן שהכפתור לחוץ קורית רק כשלכידת המצביע לא
        תפסה. המקום האחרון שהוצג הוא מה שנראה, ולכן הוא מה שנשמר.
      */
      onPointerLeave={(e) => endDrag(e, 'commit')}
      /* ביטול של המערכת — שיחה, אצבע שנייה, מחווה של הדפדפן */
      onPointerCancel={(e) => endDrag(e, 'cancel')}
    >
      <rect x={0} y={0} width={wall.lengthMm} height={wall.heightMm} fill="#faf9f7" />
      <rect
        x={0}
        y={0}
        width={wall.lengthMm}
        height={wall.heightMm}
        fill="none"
        stroke="#d6d3d1"
        strokeWidth={stroke}
      />

      {/* אזורי הפינה — שם הארונות של הקיר השכן תופסים מקום */}
      {/*
        רצועת הפינה מסומנת בגובה שהיא באמת תופסת: ארון תחתון בקיר
        השכן חוסם את התחתית, ארון עליון את החלק העליון. פס שנמתח
        על כל הקיר היה מסתיר מקום פנוי.
      */}
      {corners && (
        <g pointerEvents="none">
          {corners.start.map((z) => (
            <CornerBand
              key={`cs-${z.wallLevel}`}
              x={0}
              y={flip(z.yMm + z.heightMm)}
              width={z.depthMm}
              height={z.heightMm}
              stroke={stroke}
            />
          ))}
          {corners.end.map((z) => (
            <CornerBand
              key={`ce-${z.wallLevel}`}
              x={wall.lengthMm - z.depthMm}
              y={flip(z.yMm + z.heightMm)}
              width={z.depthMm}
              height={z.heightMm}
              stroke={stroke}
            />
          ))}
        </g>
      )}

      {/* סימונים על הקיר — מצוירים מתחת לארגזים */}
      {wall.features.map((f) => {
        const def = featureDef(f.kind);
        const w = Math.max(f.widthMm, 90);
        const h = Math.max(f.heightMm, 90);
        return (
          <rect
            key={f.id}
            x={f.xMm}
            y={flip(f.yMm + h)}
            width={w}
            height={h}
            fill={def.tone}
            fillOpacity={0.5}
            stroke={def.tone}
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 4} ${stroke * 3}`}
          />
        );
      })}

      <line
        x1={-padX * 0.6}
        y1={wall.heightMm}
        x2={wall.lengthMm + padX * 0.6}
        y2={wall.heightMm}
        stroke="#57534e"
        strokeWidth={stroke * 1.8}
        strokeLinecap="round"
      />

      {/* רגליים ומשטחי עבודה — נגזרים מהארגז, לא נבחרים בנפרד */}
      {shown.map((u) => (
        <g key={`trim-${u.id}`}>
          {/*
            הסוקל יושב על הרצפה ברוחב מלא, כמו בשטח. הנסיגה שלו
            מהחזית מסומנת בקו ולא בהצרה של המלבן — ארגז שמצויר צר
            יותר בתחתיתו נראה כאילו הוא מרחף.
          */}
          {!!u.socleMm && (
            <>
              <rect
                x={u.xMm}
                y={flip(u.yMm + u.socleMm)}
                width={alongWallMm(u)}
                height={u.socleMm}
                fill="#ddd9d4"
                stroke="#c4bfb8"
                strokeWidth={stroke * 0.7}
              />
              <line
                x1={u.xMm}
                y1={flip(u.yMm + u.socleMm) + u.socleMm * 0.25}
                x2={u.xMm + alongWallMm(u)}
                y2={flip(u.yMm + u.socleMm) + u.socleMm * 0.25}
                stroke="#c4bfb8"
                strokeWidth={stroke * 0.5}
              />
            </>
          )}
          {!!u.counterMm && (
            <rect
              x={u.xMm - 20}
              y={flip(u.yMm + u.heightMm + u.counterMm)}
              width={alongWallMm(u) + 40}
              height={u.counterMm}
              fill="#78716c"
            />
          )}
        </g>
      ))}

      {/* הארגזים */}
      {shown.map((u) => {
        const selected = u.id === selectedId;
        /*
         * בחזית רואים את גוון החזיתות; כשהחזיתות מוסתרות רואים את
         * הגוף עצמו, ולכן הוא נצבע בגוון הגוף — וזה מה שהלקוח יראה
         * כשייפתח הארון.
         */
        /*
         * הגוון נפתר כמו בתמחור: הארגז גובר על הפרויקט. קודם נקרא
         * כאן רק השדה של הארגז, ולכן גוון שנבחר לפרויקט כולו לא הגיע
         * לשרטוט — הלקוח ראה חזית לבנה בזמן שנבחרה לו אדומה.
         */
        const shownFinish = partChoice(u, inside ? 'carcass' : 'front', project).finishId;

        /*
         * במצב תהליך עבודה הצבע הוא הדוח: מי שנכנס למסך רואה מיד
         * מה נתקע ומה מוכן, ולכן הגוון שנבחר ללקוח נדחק הצידה.
         */
        const tone = work && tracksWork(u) ? WORK_TONES[workTone(u)] : null;
        const hex = tone ? tone.fill : shownFinish ? finishHex[shownFinish] : undefined;
        // גוון כהה מחייב קווים בהירים, אחרת האיור נבלע בו
        const dark = hex ? isDark(hex) : false;
        const lineColor = tone
          ? tone.stroke
          : dark
            ? '#f5f5f4'
            : selected
              ? '#814c2e'
              : '#78716c';
        const fill = hex ?? (selected ? '#f4e9d8' : '#ffffff');
        const carcassH = bodyHeightMm(u);
        /*
         * ארגז שאינו פונה אל החדר: מסובב לצד, ואז מה שתופס את הקיר
         * הוא עומקו; או מסובב לגמרי, ואז רואים את גבו. בשני המקרים
         * הדלתות והמגירות אינן נראות, וציורן כאן היה משקר — ולכן
         * הוא מצויר כלוח, עם תווית שאומרת מה רואים.
         */
        const rot = ((u.rotationDeg ?? 0) % 360 + 360) % 360;
        /*
         * אי אינו עומד על הקיר, ולכן הוא מצויר בצל שלו עליו: במקום
         * שבו הוא נופל על ציר הקיר, ברוחב שהוא מסתיר, עם תווית
         * שאומרת כמה הוא רחוק. בלי זה הוא נעלם ממי שעובד בחזית,
         * ועם ציור רגיל הוא היה נראה בדיוק כמו שכנו הצמוד.
         */
        const shadow = free(u);
        const sideOn = !u.free && rot !== 0;
        const uw = shadow ? shadow.widthMm : alongWallMm(u);
        const ux = shadow ? shadow.xMm : u.xMm;
        const awayMm = shadow ? Math.max(shadow.awayMm, 0) : 0;
        // הגב יושב עמוק יותר ולכן נראה כהה מעט מהגוף; בלי גב רואים את הקיר
        const backKind = u.backKind ?? 'thin';
        /* לגב יש גוון משלו כשנבחר לו אחד; אחרת הוא הצללה של מה שרואים */
        const backHex = partChoice(u, 'back', project).finishId;
        const backBase = (backHex && finishHex[backHex]) || hex;
        const backFill =
          backKind === 'none'
            ? null
            : backBase
              ? shade(backBase, backKind === 'carcass' ? 0.9 : 0.82)
              : '#f0ede8';


        return (
          <g
            key={u.id}
            data-unit-id={u.id}
            transform={`translate(${ux} ${flip(u.yMm + u.heightMm)})`}
            onPointerDown={(e) => (work ? onSelect(u.id) : beginDrag(e, u))}
            className={measure || work ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
          >
            <rect width={uw} height={carcassH} fill={fill} stroke="transparent" />
            {/* ארגז שהותקן בשטח — וי באמצע, שרואים ממרחק */}
            {work && isInstalled(u) && (
              <path
                d={`M ${uw * 0.34} ${carcassH * 0.52} L ${uw * 0.45} ${
                  carcassH * 0.64
                } L ${uw * 0.68} ${carcassH * 0.36}`}
                fill="none"
                stroke="#059669"
                strokeWidth={stroke * 2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}
            {/* פנים הארון: הגב נראה מאחורי המדפים והמגירות */}
            {/*
              הגב, כשמסתכלים לתוך הארון. גב מקושרות הוא שתי רצועות
              ולא לוח, וגב בגובה חלקי מגיע רק עד לאן שהוא מגיע —
              ומי שרואה לוח מלא בציור יזמין לוח מלא.
            */}
            {inside && backFill && (
              rails(u).back ? (
                [0, 1].map((i) => (
                  <rect
                    key={`rail${i}`}
                    x={stroke * 2}
                    y={i === 0 ? stroke * 2 : Math.max(carcassH - stroke * 2 - RAIL_WIDTH_MM, 0)}
                    width={Math.max(uw - stroke * 4, 0)}
                    height={Math.min(RAIL_WIDTH_MM, Math.max(carcassH - stroke * 4, 0))}
                    fill={backFill}
                    stroke="transparent"
                  />
                ))
              ) : (
                <rect
                  x={stroke * 2}
                  y={Math.max(carcassH - stroke * 2 - backH(u, carcassH), 0)}
                  width={Math.max(uw - stroke * 4, 0)}
                  height={Math.max(backH(u, carcassH) - stroke * 2, 0)}
                  fill={backFill}
                  stroke="transparent"
                />
              )
            )}
            {sideOn ? (
              /* לוח: מסגרת, קו מקווקו במקום שאליו פונה החזית, ותווית */
              <g color={lineColor} pointerEvents="none">
                <rect
                  width={uw}
                  height={carcassH}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={selected ? stroke * 1.7 : stroke}
                />
                {rot !== 180 && (
                  <line
                    x1={rot === 90 ? stroke * 3 : uw - stroke * 3}
                    y1={0}
                    x2={rot === 90 ? stroke * 3 : uw - stroke * 3}
                    y2={carcassH}
                    stroke="currentColor"
                    strokeWidth={stroke}
                    strokeDasharray={`${stroke * 4} ${stroke * 3}`}
                  />
                )}
                <text
                  x={uw / 2}
                  y={carcassH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(uw * 0.3, carcassH * 0.12, 80)}
                  fill="currentColor"
                >
                  {rot === 180 ? 'גב לחדר' : 'מסובב'}
                </text>
              </g>
            ) : (
              <g color={lineColor}>
                <CabinetGlyph
                  glyph={u.glyph}
                  w={u.widthMm}
                  h={carcassH}
                  doors={u.doors}
                  drawers={u.drawers}
                  drawerCols={u.drawerCols}
                  shelves={u.shelves}
                  drawerStyle={u.drawerStyle}
                  glassDoors={u.glassDoors}
                  handles={u.handles}
                  shelfGapsMm={u.shelfGapsMm}
                  /*
                    האזורים תמיד, ולא רק כשהם נשמרו במפורש.

                    מה שיש בתוך הארון מתואר באזורים — גם כשהם נגזרים
                    משדות פשוטים — וזה מה שהתלת־ממד, רשימת החומרים
                    והניסור קוראים. כשהחזית ציירה לפי הצורה בלבד,
                    ארון מגירות שנבנה על צורה של דלת יצא ריק בחזית
                    ומלא מגירות בתלת־ממד. עכשיו שניהם קוראים אותו דבר.
                  */
                  zones={unitZones(u)}
                  opening={u.opening}
                  corner={u.corner}
                  blindMm={u.blindMm}
                  stroke={selected ? stroke * 1.7 : stroke}
                  inside={inside}
                />
              </g>
            )}
            {!sideOn && ledStrips(u, stroke, carcassH)}
            {!sideOn && sideMarks(u, stroke, carcassH, frontMm(u))}
            {awayMm > 0 && (
              <g pointerEvents="none">
                <rect
                  width={uw}
                  height={carcassH}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth={stroke * 1.2}
                  strokeDasharray={`${stroke * 3} ${stroke * 2.5}`}
                />
                <text
                  x={uw / 2}
                  y={-stroke * 3}
                  textAnchor="middle"
                  fontSize={Math.max(wall.lengthMm / 46, 62)}
                  fill="#0f766e"
                  direction="ltr"
                >
                  {`אי · ${cm(awayMm)} ס״מ מהקיר`}
                </text>
              </g>
            )}
            {selected && (
              <rect
                x={-stroke * 2}
                y={-stroke * 2}
                width={uw + stroke * 4}
                height={carcassH + stroke * 4}
                fill="none"
                stroke="#a06236"
                strokeWidth={stroke * 1.4}
                strokeDasharray={`${stroke * 5} ${stroke * 4}`}
              />
            )}
          </g>
        );
      })}

      {/* תוויות הסימונים — מעל הארגזים, כדי שיישארו קריאות */}
      {wall.features.map((f) => {
        const def = featureDef(f.kind);
        const w = Math.max(f.widthMm, 90);
        const h = Math.max(f.heightMm, 90);
        const center = f.xMm + w / 2;
        const nearStart = center < wall.lengthMm * 0.18;
        const nearEnd = center > wall.lengthMm * 0.82;
        return (
          <text
            key={`label-${f.id}`}
            x={nearStart ? f.xMm : nearEnd ? f.xMm + w : center}
            y={flip(f.yMm + h) - stroke * 5}
            textAnchor={nearStart ? 'start' : nearEnd ? 'end' : 'middle'}
            fontSize={Math.max(wall.lengthMm / 44, 65)}
            fill="#57534e"
            direction="ltr"
          >
            {/* עומק הוא מידה שמשנה תכנון, ולכן הוא נכתב ליד השם */}
            {featureBiteMm(f)
              ? `${def.label} ${cm(Math.abs(featureBiteMm(f)))} ס״מ`
              : def.label}
          </text>
        );
      })}

      {/*
        מדידה מוצגת על כל הארגזים בבת אחת: כשמודדים קיר רוצים לראות
        את כל המידות יחד, לא ללחוץ על ארגז אחרי ארגז.
      */}
      {measure
        ? shown.map((u) => (
            <g key={`measure-${u.id}`}>
              {measureOverlay(u, measure, flip, stroke, fontSize)}
            </g>
          ))
        : null}

      {/* קו מידה של הקיר */}
      <g stroke="#a8a29e" strokeWidth={stroke * 0.9}>
        <line x1={0} y1={wall.heightMm + 150} x2={wall.lengthMm} y2={wall.heightMm + 150} />
        <line x1={0} y1={wall.heightMm + 90} x2={0} y2={wall.heightMm + 210} />
        <line
          x1={wall.lengthMm}
          y1={wall.heightMm + 90}
          x2={wall.lengthMm}
          y2={wall.heightMm + 210}
        />
      </g>
      <text
        x={wall.lengthMm / 2}
        y={wall.heightMm + 300}
        textAnchor="middle"
        fontSize={Math.max(wall.lengthMm / 34, 90)}
        fill="#78716c"
        direction="ltr"
      >
        {cm(wall.lengthMm)}
      </text>

      {/* קו מידה אנכי — גובה הקיר, לצד הציור */}
      {showHeight && (
        <g pointerEvents="none">
          <g stroke="#a8a29e" strokeWidth={stroke * 0.9}>
            <line x1={-160} y1={0} x2={-160} y2={wall.heightMm} />
            <line x1={-220} y1={0} x2={-100} y2={0} />
            <line x1={-220} y1={wall.heightMm} x2={-100} y2={wall.heightMm} />
          </g>
          <text
            x={-250}
            y={wall.heightMm / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(wall.lengthMm / 34, 90)}
            fill="#78716c"
            direction="ltr"
            transform={`rotate(-90 ${-250} ${wall.heightMm / 2})`}
          >
            {cm(wall.heightMm)}
          </text>
        </g>
      )}

      {/*
        הסרגל: היעדים שאפשר לבחור, והמידה שנמדדה ביניהם. שניהם
        יושבים ב-`wallRuler`, כי מדידה היא עבודה בפני עצמה.
      */}
      {rulerPair && (
        <RulerTargets
          wall={wall}
          axis={rulerAxis}
          picked={rulerPair}
          stroke={stroke}
          flip={flip}
          onPick={onSelect}
        />
      )}
      {span && (
        <RulerMeasure span={span} axis={rulerAxis} wall={wall} stroke={stroke} flip={flip} />
      )}

      {/* מה שמוצג בזמן הגרירה: על מי נוחתים, או למה לא עולים */}
      {guide && (
        <DragGuide guide={guide} wall={wall} stroke={stroke} flip={flip} />
      )}
      {/* נעילת ציר — הציר עצמו, ולא רק התוצאה שלו */}
      {lock && held && (
        <AxisGuide
          axis={lock.axis}
          headingDeg={here?.headingDeg ?? 0}
          wall={wall}
          stroke={stroke}
          flip={flip}
          at={{
            xMm: held.free ? wall.lengthMm / 2 : held.xMm + alongWallMm(held) / 2,
            yMm: held.yMm + bodyHeightMm(held) / 2,
          }}
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/**
 * ידיות גרירה למדפים.
 * במצב תצוגת פנים כל מדף בארגז הנבחר הופך לפס שאפשר לגרור, והמרווחים
 * באזור מחושבים מחדש מהמיקומים — כך שגובה המדף נקבע ישירות על הציור.
 */
/** ממיר מיקומי מדפים למרווחים בין מדפים. */
/** סימון אזור פינה — רצועה מקווקוות שבה יושבים ארונות הקיר השכן. */
function CornerBand({
  x,
  y,
  width,
  height,
  stroke,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="#a8a29e"
      fillOpacity={0.14}
      stroke="#a8a29e"
      strokeWidth={stroke}
      strokeDasharray={`${stroke * 4} ${stroke * 3}`}
    />
  );
}

/** פסי לד מסומנים בקו ענבר בצד שבו הם מותקנים. */
function ledStrips(u: PlacedUnit, stroke: number, bodyH: number) {
  if (!u.led?.length) return null;
  const wide = stroke * 2.2;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (const spot of u.led) {
    if (spot === 'start') lines.push({ x1: wide, y1: 0, x2: wide, y2: bodyH });
    else if (spot === 'end')
      lines.push({ x1: u.widthMm - wide, y1: 0, x2: u.widthMm - wide, y2: bodyH });
    else if (spot === 'top') lines.push({ x1: 0, y1: wide, x2: u.widthMm, y2: wide });
    else if (spot === 'bottom')
      lines.push({ x1: 0, y1: bodyH - wide, x2: u.widthMm, y2: bodyH - wide });
    else if (spot === 'shelf') {
      const shelves = u.shelves ?? autoShelves(bodyH);
      for (const y of shelfYs({ shelves, gaps: u.shelfGapsMm }, 0, bodyH)) {
        lines.push({ x1: u.widthMm * 0.08, y1: y + wide, x2: u.widthMm * 0.92, y2: y + wide });
      }
    }
  }

  return (
    <g pointerEvents="none" stroke="#f59e0b" strokeWidth={wide} strokeLinecap="round">
      {lines.map((l, i) => (
        <line key={i} {...l} />
      ))}
    </g>
  );
}

/**
 * מה שמסומן על קצות הארגז: דופן זרה, דופן זכוכית, וצד שלא נבנה.
 *
 * שלושתם אותה צורה — רצועה בעובי הלוח על הקצה — ונבדלים בגוון
 * ובקו, ולכן הם מצוירים יחד. בלי הסימון הזה שלושת המצבים נראים
 * בחזית בדיוק כמו ארגז רגיל.
 */
function sideMarks(u: PlacedUnit, stroke: number, bodyH: number, t: number) {
  const e = u.exposed ?? {};
  const g = u.glassSides ?? {};
  const off = u.omit ?? {};
  const bars: { x: number; y: number; w: number; h: number; glass?: boolean; gone?: boolean }[] = [];
  /* צד שלא נבנה: קו מקווקו במקום הלוח, כדי שרואים שהוא חסר בכוונה */
  if (off.start) bars.push({ x: 0, y: 0, w: t, h: bodyH, gone: true });
  if (off.end) bars.push({ x: u.widthMm - t, y: 0, w: t, h: bodyH, gone: true });
  if (off.top) bars.push({ x: 0, y: 0, w: u.widthMm, h: t, gone: true });
  if (off.bottom) bars.push({ x: 0, y: bodyH - t, w: u.widthMm, h: t, gone: true });
  if (g.start) bars.push({ x: 0, y: 0, w: t, h: bodyH, glass: true });
  if (g.end) bars.push({ x: u.widthMm - t, y: 0, w: t, h: bodyH, glass: true });
  if (e.start) bars.push({ x: 0, y: 0, w: t, h: bodyH });
  if (e.end) bars.push({ x: u.widthMm - t, y: 0, w: t, h: bodyH });
  if (e.top) bars.push({ x: 0, y: 0, w: u.widthMm, h: t });
  if (e.bottom) bars.push({ x: 0, y: bodyH - t, w: u.widthMm, h: t });
  if (!bars.length) return null;

  return (
    <g pointerEvents="none">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill={b.gone ? 'none' : b.glass ? '#bfdbfe' : '#c8935a'}
          stroke={b.gone ? '#a8a29e' : b.glass ? '#3b82f6' : '#814c2e'}
          strokeWidth={stroke * (b.gone ? 0.9 : 0.6)}
          strokeDasharray={b.gone ? `${stroke * 2.5} ${stroke * 2}` : undefined}
        />
      ))}
    </g>
  );
}

/** קו מידה על הארגז שנבחר, בציר שנבחר במצב מדידה. */
function measureOverlay(
  u: PlacedUnit | undefined,
  axis: MeasureAxis,
  flip: (y: number) => number,
  stroke: number,
  fontSize: number,
) {
  if (!u) return null;
  const tick = stroke * 12;
  const color = '#0f766e';
  const label = (
    x: number,
    y: number,
    text: string,
    anchor: 'start' | 'middle' | 'end' = 'middle',
  ) => (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={fontSize}
      fill={color}
      fontWeight="600"
      direction="ltr"
    >
      {text}
    </text>
  );

  if (axis === 'w') {
    const y = flip(u.yMm) + tick * 1.4;
    return (
      <g pointerEvents="none">
        <g stroke={color} strokeWidth={stroke * 1.2}>
          <line x1={u.xMm} y1={y} x2={u.xMm + alongWallMm(u)} y2={y} />
          <line x1={u.xMm} y1={y - tick / 2} x2={u.xMm} y2={y + tick / 2} />
          <line
            x1={u.xMm + alongWallMm(u)}
            y1={y - tick / 2}
            x2={u.xMm + alongWallMm(u)}
            y2={y + tick / 2}
          />
        </g>
        {/* מה שנמדד על הקיר הוא מה שתופס אותו — בארגז מסובב זה עומקו */}
        {label(u.xMm + alongWallMm(u) / 2, y + tick * 1.6, cm(alongWallMm(u)))}
      </g>
    );
  }

  if (axis === 'h') {
    const x = u.xMm + alongWallMm(u) + tick * 1.2;
    const top = flip(u.yMm + u.heightMm);
    const bottom = flip(u.yMm);
    return (
      <g pointerEvents="none">
        <g stroke={color} strokeWidth={stroke * 1.2}>
          <line x1={x} y1={top} x2={x} y2={bottom} />
          <line x1={x - tick / 2} y1={top} x2={x + tick / 2} y2={top} />
          <line x1={x - tick / 2} y1={bottom} x2={x + tick / 2} y2={bottom} />
        </g>
        {label(x + tick * 0.4, (top + bottom) / 2 + fontSize * 0.35, cm(u.heightMm), 'start')}
      </g>
    );
  }

  // העומק אינו נראה בחזית, ולכן מוצג כתווית על הארגז
  const cx = u.xMm + alongWallMm(u) / 2;
  const cy = flip(u.yMm + u.heightMm / 2);
  const boxW = fontSize * 4;
  const boxH = fontSize * 1.7;
  return (
    <g pointerEvents="none">
      <rect
        x={cx - boxW / 2}
        y={cy - boxH / 2}
        width={boxW}
        height={boxH}
        rx={boxH * 0.25}
        fill="#ffffff"
        stroke={color}
        strokeWidth={stroke * 1.2}
      />
      {label(cx, cy + fontSize * 0.35, `${cm(intoRoomMm(u))} ↕`)}
    </g>
  );
}

/** הקושרות של הארגז, כשיש כאלה. */
function rails(u: PlacedUnit): RailSides {
  return u.rails ?? {};
}

/**
 * גובה לוח הגב בציור.
 * ריק = הגב מכסה את הגוף כולו, וזה המצב הרגיל.
 */
function backH(u: PlacedUnit, bodyMm: number): number {
  return Math.min(u.backHeightMm ?? bodyMm, bodyMm);
}
