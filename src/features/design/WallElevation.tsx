import { useRef } from 'react';
import { CabinetGlyph, autoShelves, shelfYs } from '../../catalog/CabinetGlyph';
import { glyphDef } from '../../catalog/glyphList';
import { doorCells, unitZones } from '../../catalog/zones';
import { featureDef } from '../projects/wallFeatures';
import { MATERIAL } from '../../catalog/standards';
import { cm } from '../../ui/units';
import { WORK_TONES, isInstalled, tracksWork, workTone } from '../../workflow/unitWork';
import type { PlacedUnit, Wall } from '../../db/types';

/** מרחק הצמדה בין ארגזים ולקצות הקיר (מ"מ). */
/**
 * מרחק ההצמדה במ"מ, ובנוסף מרחק מינימלי במסך.
 *
 * 60 מ"מ הם כ-5 פיקסלים בקיר של 4 מטר על מסך טלפון — קטן מדי כדי
 * לפגוע באצבע, ולכן הארגזים "לא נצמדו לרצפה". סף ההצמדה נגזר גם
 * מקנה המידה של הציור, כך שהוא מרגיש זהה ביד בכל מרחק תצוגה.
 */
const SNAP = 60;
const SNAP_PX = 18;
/** גרירה חופשית נוחתת על סנטימטרים שלמים, לא על מידות שבורות. */
const STEP = 10;

export type MeasureAxis = 'w' | 'h' | 'd';

type Props = {
  wall: Wall;
  units: PlacedUnit[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
  /** הסתרת חזיתות — תצוגת פנים הארונות */
  inside: boolean;
  /** גוון לכל ארגז, לפי מזהה הגוון */
  finishHex: Record<string, string>;
  /** מצב מדידה פעיל, והציר שנמדד */
  measure?: MeasureAxis | null;
  /** רוחב אזורי הפינה בשני קצות הקיר, שנתפסים בידי הקיר השכן */
  corners?: { startMm: number; endMm: number };
  /** קו מידה אנכי לגובה הקיר */
  showHeight?: boolean;
  /**
   * מצב סרגל: הארגזים שנבחרו למדידת המרחק ביניהם.
   * `null` = הסרגל כבוי.
   */
  rulerPair?: string[] | null;
  /**
   * מצב תהליך עבודה: הארגזים נצבעים לפי מה שנעשה בהם, ולא לפי
   * הגוון שנבחר להם. הגרירה מכובה — מי שעומד ליד המסור לא אמור
   * להזיז ארגז בטעות.
   */
  work?: boolean;
};

/**
 * הדמיית חזית של קיר אחד.
 * גרירה מזיזה ארגז לרוחב, ואם הוא לא נעול לרצפה גם לגובה,
 * עם הצמדה לשכנים, לרצפה ולתקרה.
 */
export function WallElevation({
  wall,
  units: allUnits,
  selectedId,
  onSelect,
  onMove,
  inside,
  finishHex,
  measure,
  corners,
  showHeight,
  rulerPair,
  work,
}: Props) {
  /*
   * חיפוי קיר מצויר ראשון: הוא מכסה את הקיר, והארגזים עומדים לפניו.
   * בלי הסדר הזה לוח שנוסף אחרון היה מסתיר את מה שהוא אמור לגבות.
   */
  const layer = (u: PlacedUnit) => (glyphDef(u.glyph).cladding ? 0 : 1);
  const units = [...allUnits].sort((a, b) => layer(a) - layer(b));

  const svgRef = useRef<SVGSVGElement>(null);
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
    /* המיקום האחרון, כדי להחליט על הצמדה בשחרור ולא תוך כדי */
  } | null>(null);

  // כשקו הגובה מוצג צריך מקום לצידו, אחרת המידה נחתכת
  const padX = showHeight ? 420 : 120;
  const padTop = 140;
  const padBottom = 340;
  const vbW = wall.lengthMm + padX * 2;
  const vbH = wall.heightMm + padTop + padBottom;
  const stroke = Math.max(wall.lengthMm / 420, 4);
  /*
   * המרחק הפנוי בין שני הארגזים שנבחרו לסרגל.
   * נמדד מהפאה הפנימית של האחד לפאה הפנימית של השני — זה המרווח
   * שבאמת קיים על הקיר, ולא המרחק בין נקודות ההתחלה שלהם.
   */
  const rulerSpan = (() => {
    if (!rulerPair || rulerPair.length < 2) return null;
    const [a, b] = rulerPair.map((id) => units.find((u) => u.id === id));
    if (!a || !b) return null;
    const left = a.xMm <= b.xMm ? a : b;
    const right = left === a ? b : a;
    const from = left.xMm + left.widthMm;
    const to = right.xMm;
    const mid = (u: PlacedUnit) => u.yMm + u.heightMm / 2;
    return {
      from: Math.min(from, to),
      to: Math.max(from, to),
      gap: Math.max(to - from, 0),
      y: wall.heightMm - Math.round((mid(a) + mid(b)) / 2),
    };
  })();
  const fontSize = Math.max(wall.lengthMm / 40, 70);

  /** גובה המסך של נקודה שנמדדת מהרצפה. */
  const flip = (yFromFloor: number) => wall.heightMm - yFromFloor;

  function beginDrag(e: React.PointerEvent, unit: PlacedUnit) {
    onSelect(unit.id);
    // במצב מדידה ההקשה רק בוחרת ארגז, בלי להזיז אותו בטעות
    if (measure) return;
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
    drag.current = {
      id: unit.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: unit.xMm,
      originY: unit.yMm,
      scale: 1 / ctm.a,
      locked: !!unit.floorLocked,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const unit = units.find((u) => u.id === d.id);
    if (!unit) return;

    const rawX = d.originX + (e.clientX - d.startX) * d.scale;
    // מסך גדל כלפי מטה, הקיר נמדד כלפי מעלה — ולכן הסימן הפוך
    const rawY = d.originY - (e.clientY - d.startY) * d.scale;

    // סף ההצמדה במ"מ, שקול למרחק קבוע על המסך בכל קנה מידה
    const tol = Math.max(SNAP, SNAP_PX * d.scale);
    const x = snapX(rawX, unit, units, wall.lengthMm, corners, tol);
    const y = d.locked ? d.originY : snapY(rawY, unit, units, wall.heightMm, tol);
    onMove(d.id, x, y);
  }

  function endDrag(e: React.PointerEvent) {
    /*
     * שחרור הגרירה לא נוגע בנעילה לרצפה. מי שכיבה את הנעילה רוצה
     * לגרור לגובה, וארגז שנח על הרצפה תוך כדי לא אומר שהחליט
     * להינעל אליה — נעילה חוזרת שם הפכה את המתג לחסר משמעות.
     */
    if (drag.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // לא נתפס מלכתחילה
      }
    }
    drag.current = null;
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
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
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
      {corners && (
        <g pointerEvents="none">
          {corners.startMm > 0 && (
            <CornerBand x={0} width={corners.startMm} height={wall.heightMm} stroke={stroke} />
          )}
          {corners.endMm > 0 && (
            <CornerBand
              x={wall.lengthMm - corners.endMm}
              width={corners.endMm}
              height={wall.heightMm}
              stroke={stroke}
            />
          )}
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
      {units.map((u) => (
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
                width={u.widthMm}
                height={u.socleMm}
                fill="#ddd9d4"
                stroke="#c4bfb8"
                strokeWidth={stroke * 0.7}
              />
              <line
                x1={u.xMm}
                y1={flip(u.yMm + u.socleMm) + u.socleMm * 0.25}
                x2={u.xMm + u.widthMm}
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
              width={u.widthMm + 40}
              height={u.counterMm}
              fill="#78716c"
            />
          )}
        </g>
      ))}

      {/* הארגזים */}
      {units.map((u) => {
        const selected = u.id === selectedId;
        /*
         * בחזית רואים את גוון החזיתות; כשהחזיתות מוסתרות רואים את
         * הגוף עצמו, ולכן הוא נצבע בגוון הגוף — וזה מה שהלקוח יראה
         * כשייפתח הארון.
         */
        const frontFinish = u.frontFinishId ?? u.finishId;
        const shownFinish = inside ? u.carcassFinishId : frontFinish;
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
        // הגובה כולל את הרגליים; הגוף עצמו מתחיל מעליהן
        const carcassH = Math.max(u.heightMm - (u.socleMm ?? 0), 0);
        // הגב יושב עמוק יותר ולכן נראה כהה מעט מהגוף; בלי גב רואים את הקיר
        const backKind = u.backKind ?? 'thin';
        const backFill =
          backKind === 'none' ? null : hex ? shade(hex, backKind === 'carcass' ? 0.9 : 0.82) : '#f0ede8';

        return (
          <g
            key={u.id}
            data-unit-id={u.id}
            transform={`translate(${u.xMm} ${flip(u.yMm + u.heightMm)})`}
            onPointerDown={(e) => (work ? onSelect(u.id) : beginDrag(e, u))}
            className={measure || work ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
          >
            <rect width={u.widthMm} height={carcassH} fill={fill} stroke="transparent" />
            {/* ארגז שהותקן בשטח — וי באמצע, שרואים ממרחק */}
            {work && isInstalled(u) && (
              <path
                d={`M ${u.widthMm * 0.34} ${carcassH * 0.52} L ${u.widthMm * 0.45} ${
                  carcassH * 0.64
                } L ${u.widthMm * 0.68} ${carcassH * 0.36}`}
                fill="none"
                stroke="#059669"
                strokeWidth={stroke * 2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}
            {/* פנים הארון: הגב נראה מאחורי המדפים והמגירות */}
            {inside && backFill && (
              <rect
                x={stroke * 2}
                y={stroke * 2}
                width={Math.max(u.widthMm - stroke * 4, 0)}
                height={Math.max(carcassH - stroke * 4, 0)}
                fill={backFill}
                stroke="transparent"
              />
            )}
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
                shelfGapsMm={u.shelfGapsMm}
                /*
                  הקושרות שהדלתות נתפסות עליהן הן חלק מהאזורים, ולכן
                  הציור צריך את האזורים המחושבים ולא את מה שנשמר.
                  בלי זה ארגז שלא חולק ידנית נצייר בלי הקושרת, ומי
                  שמסתיר את החזיתות לא רואה על מה הדלתות תלויות.
                */
                zones={u.zones?.length || doorCells(u) > 1 ? unitZones(u) : undefined}
                opening={u.opening}
                corner={u.corner}
                blindMm={u.blindMm}
                stroke={selected ? stroke * 1.7 : stroke}
                inside={inside}
              />
            </g>
            {ledStrips(u, stroke, carcassH)}
            {exposedPanels(u, stroke, carcassH)}
            {selected && (
              <rect
                x={-stroke * 2}
                y={-stroke * 2}
                width={u.widthMm + stroke * 4}
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
            {def.label}
          </text>
        );
      })}

      {/*
        דלת שגבוהה מהארגז — כשדלת אחת מכסה שניים.
        מצוירת כמסגרת מעל מה שהיא באמת מכסה, כדי שרואים מיד אם היא
        מגיעה למקום שכבר תפוס.
      */}
      {!inside &&
        units
          .filter((u) => (u.doorGrowTopMm ?? 0) !== 0 || (u.doorGrowBottomMm ?? 0) !== 0)
          .map((u) => {
            const socle = u.socleMm ?? 0;
            const growTop = u.doorGrowTopMm ?? 0;
            const growBottom = u.doorGrowBottomMm ?? 0;
            // הדלת נמדדת מגוף הארגז — הרגליים אינן מכוסות בה
            const bottom = u.yMm + socle - growBottom;
            const top = u.yMm + u.heightMm + growTop;
            return (
              <rect
                key={`door-${u.id}`}
                x={u.xMm}
                y={flip(top)}
                width={u.widthMm}
                height={Math.max(top - bottom, 0)}
                fill="none"
                stroke="#a06236"
                strokeWidth={stroke * 1.2}
                strokeDasharray={`${stroke * 4} ${stroke * 3}`}
                pointerEvents="none"
              />
            );
          })}

      {/*
        מדידה מוצגת על כל הארגזים בבת אחת: כשמודדים קיר רוצים לראות
        את כל המידות יחד, לא ללחוץ על ארגז אחרי ארגז.
      */}
      {measure
        ? units.map((u) => (
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
        סרגל: המרחק הפנוי בין שני ארגזים שנבחרו.
        זו השאלה שנשאלת בשטח — "כמה נשאר ביניהם" — ועד עכשיו היה
        צריך לחשב אותה בראש משתי המידות ומשני המיקומים.
      */}
      {rulerSpan && (
        <g pointerEvents="none">
          <line
            x1={rulerSpan.from}
            y1={rulerSpan.y}
            x2={rulerSpan.to}
            y2={rulerSpan.y}
            stroke="#0f766e"
            strokeWidth={stroke * 1.4}
          />
          {/* שני הקצוות עשויים ליפול על אותה נקודה כשאין מרווח בכלל */}
          {[rulerSpan.from, rulerSpan.to].map((x, i) => (
            <line
              key={i}
              x1={x}
              y1={rulerSpan.y - 90}
              x2={x}
              y2={rulerSpan.y + 90}
              stroke="#0f766e"
              strokeWidth={stroke * 1.4}
            />
          ))}
          <text
            x={(rulerSpan.from + rulerSpan.to) / 2}
            y={rulerSpan.y - 130}
            textAnchor="middle"
            fontSize={Math.max(wall.lengthMm / 34, 95)}
            fontWeight={600}
            fill="#0f766e"
            direction="ltr"
          >
            {cm(rulerSpan.gap)}
          </text>
        </g>
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
  width,
  height,
  stroke,
}: {
  x: number;
  width: number;
  height: number;
  stroke: number;
}) {
  return (
    <rect
      x={x}
      y={0}
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
 * דפנות זרות מסומנות כרצועה מלאה בצד הגלוי.
 * בחזית רואים את עובי הלוח, ולכן הרצועה ברוחב עובי החומר.
 */
function exposedPanels(u: PlacedUnit, stroke: number, bodyH: number) {
  const e = u.exposed;
  if (!e) return null;
  const t = MATERIAL.frontMm;
  const bars: { x: number; y: number; w: number; h: number }[] = [];
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
          fill="#c8935a"
          stroke="#814c2e"
          strokeWidth={stroke * 0.6}
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
          <line x1={u.xMm} y1={y} x2={u.xMm + u.widthMm} y2={y} />
          <line x1={u.xMm} y1={y - tick / 2} x2={u.xMm} y2={y + tick / 2} />
          <line
            x1={u.xMm + u.widthMm}
            y1={y - tick / 2}
            x2={u.xMm + u.widthMm}
            y2={y + tick / 2}
          />
        </g>
        {label(u.xMm + u.widthMm / 2, y + tick * 1.6, cm(u.widthMm))}
      </g>
    );
  }

  if (axis === 'h') {
    const x = u.xMm + u.widthMm + tick * 1.2;
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
  const cx = u.xMm + u.widthMm / 2;
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
      {label(cx, cy + fontSize * 0.35, `${cm(u.depthMm)} ↕`)}
    </g>
  );
}

/** מכהה או מבהיר גוון, כדי להראות שהגב יושב עמוק יותר מהגוף. */
function shade(hex: string, factor: number): string {
  const v = hex.replace('#', '');
  if (v.length < 6) return hex;
  const ch = (i: number) =>
    Math.round(Math.min(parseInt(v.slice(i, i + 2), 16) * factor, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/** האם הגוון כהה מספיק כדי שקווים כהים ייבלעו בו. */
function isDark(hex: string): boolean {
  const v = hex.replace('#', '');
  if (v.length < 6) return false;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

function nearest(value: number, targets: number[], limit: number): number {
  // ברירת המחדל היא הערך המעוגל; יעד הצמדה קרוב מנצח אותה
  let best = Math.round(value / STEP) * STEP;
  let bestDist = limit;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/**
 * מצמיד ארגז לקצות הקיר ולשכנים באותו מפלס.
 *
 * פינה פנויה פתוחה לכל ארגז — היא שייכת למי שיגיע אליה ראשון.
 * פינה שכבר תפוסה בידי ארון של הקיר השכן חסומה, כי שני ארונות
 * באותו מקום בחדר זו התנגשות ולא החלטה. ארגז פינתי מורשה להיכנס
 * לשם בכל מקרה — זה בדיוק מה שהוא נבנה בשבילו.
 *
 * `corners` נמדד מהארונות שבאמת נוגעים בפינה המשותפת, ולכן קיר
 * שכן ריק אינו חוסם כלום.
 */
function snapX(
  x: number,
  unit: PlacedUnit,
  units: PlacedUnit[],
  wallLength: number,
  corners: { startMm: number; endMm: number } | undefined,
  tol: number,
): number {
  const blocked = corners && unit.level !== 'wall' && !unit.corner;
  const min = blocked ? corners.startMm : 0;
  const max = Math.max((blocked ? wallLength - corners.endMm : wallLength) - unit.widthMm, min);

  const targets = [min, max];
  for (const other of units) {
    if (other.id === unit.id || other.level !== unit.level) continue;
    targets.push(other.xMm + other.widthMm, other.xMm - unit.widthMm);
  }
  const snapped = nearest(x, targets, tol);
  return Math.round(Math.min(Math.max(snapped, min), max));
}

/**
 * מצמיד גובה לתקרה ולקצוות של ארגזים אחרים.
 *
 * הרצפה אינה יעד הצמדה כאן במכוון. הפונקציה נקראת רק לארגז שהנעילה
 * לרצפה שלו כבויה — כלומר למי שביקש במפורש להרים אותו — ומגנט לרצפה
 * החזיר אותו לשם בכל פעם. מי שרוצה אותו על הרצפה מדליק את הנעילה,
 * וזה מוריד אותו לאפס בדיוק.
 */
function snapY(
  y: number,
  unit: PlacedUnit,
  units: PlacedUnit[],
  wallHeight: number,
  tol: number,
): number {
  const ceiling = wallHeight - unit.heightMm;
  const targets = [ceiling];
  for (const other of units) {
    if (other.id === unit.id) continue;
    targets.push(other.yMm, other.yMm + other.heightMm, other.yMm - unit.heightMm);
  }
  const snapped = nearest(y, targets, tol);
  return Math.round(Math.min(Math.max(snapped, 0), Math.max(ceiling, 0)));
}
