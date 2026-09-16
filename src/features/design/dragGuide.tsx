import { axisLabel } from './axisLock';
import type { Axis } from './axisLock';
import type { Wall } from '../../db/types';

/*
 * מה שמוצג בזמן שגוררים.
 *
 * הגרירה עצמה יושבת בציור החזית, והחשבון שלה ב-`stacking`. כאן רק
 * מה שהעין רואה ברגע הזה — על מי הארגז עומד לנחות, לאיזו פינה, ולמה
 * הוא לא עולה. זו שכבה נפרדת כי היא נמחקת בשחרור: היא אינה חלק
 * מהשרטוט, והיא לא נשמרת לשום מקום.
 */

/** מה שמוצג בזמן גרירה — הנחה על ארגז, או נעילה שמונעת הרמה. */
export type Guide =
  | {
      kind: 'stack';
      onId: string;
      /** שם הארגז שנוחתים עליו — כדי שלא יהיה ספק על מי */
      name: string;
      edge: 'start' | 'end';
      onCounter: boolean;
      xMm: number;
      yMm: number;
      widthMm: number;
    }
  | { kind: 'locked' };

/**
 * הקו שמסביר את ההנחה.
 *
 * הנגר צריך לדעת שלושה דברים ברגע הזה: שהארגז עומד להינחת, על מי,
 * ולאיזו פינה. קו אופקי במשטח שנוחתים עליו, קו אנכי בפינה שאליה
 * מיושרים, ושם היעד כתוב — ולא צבע שמשתנה בשקט.
 */
export function DragGuide({
  guide,
  wall,
  stroke,
  flip,
}: {
  guide: Guide;
  wall: Wall;
  stroke: number;
  flip: (y: number) => number;
}) {
  const fontSize = Math.max(wall.lengthMm / 44, 62);

  if (guide.kind === 'locked') {
    return (
      <text
        x={wall.lengthMm / 2}
        y={flip(wall.heightMm) + fontSize * 1.6}
        textAnchor="middle"
        fontSize={fontSize}
        fill="#b45309"
        pointerEvents="none"
      >
        נעול לרצפה — כבה את הנעילה בעריכת הארגז כדי להרים
      </text>
    );
  }

  const { xMm, yMm, widthMm, edge, name, onCounter } = guide;
  const edgeX = edge === 'start' ? xMm : xMm + widthMm;
  const label = `על ${name} · ${edge === 'start' ? 'פינת ההתחלה' : 'פינת הסוף'}${
    onCounter ? ' · על המשטח' : ''
  }`;

  return (
    <g pointerEvents="none">
      {/* משטח ההנחה */}
      <line
        x1={Math.min(xMm, edgeX) - 240}
        y1={flip(yMm)}
        x2={Math.max(xMm + widthMm, edgeX) + 240}
        y2={flip(yMm)}
        stroke="#0d9488"
        strokeWidth={stroke * 1.6}
        strokeDasharray={`${stroke * 5} ${stroke * 4}`}
      />
      {/* הפינה שאליה מיושרים */}
      <line
        x1={edgeX}
        y1={flip(yMm) - 220}
        x2={edgeX}
        y2={flip(yMm) + 260}
        stroke="#0d9488"
        strokeWidth={stroke * 1.6}
        strokeDasharray={`${stroke * 5} ${stroke * 4}`}
      />
      {/* רפאים: המקום שהארגז ינחת בו */}
      <rect
        x={xMm}
        y={flip(yMm)}
        width={widthMm}
        height={Math.max(fontSize * 0.7, 40)}
        fill="#0d9488"
        fillOpacity={0.14}
      />
      <text
        x={edgeX}
        y={flip(yMm) - 300}
        textAnchor="middle"
        fontSize={fontSize}
        fill="#0f766e"
      >
        {label}
      </text>
    </g>
  );
}


/**
 * הציר שננעל — קו ושם.
 *
 * נעילה שאי אפשר לראות היא תקלה: מי שגרר ולא הבין למה רק מידה אחת
 * זזה חשב שהאפליקציה נתקעה. הקו עובר דרך הארגז בכיוון שבו הוא
 * רשאי לזוז, והשם כתוב מעליו — כולל ציר העולם, כשהקיר מיושר לאחד
 * מהם. מוסכמת הצירים: X ו-Z הם הרצפה, Y הוא הגובה.
 */
export function AxisGuide({
  axis,
  headingDeg,
  wall,
  stroke,
  flip,
  at,
}: {
  axis: Axis | null;
  headingDeg: number;
  wall: Wall;
  stroke: number;
  flip: (y: number) => number;
  /** מרכז הארגז שנגרר — דרכו עובר הקו */
  at: { xMm: number; yMm: number };
}) {
  const fontSize = Math.max(wall.lengthMm / 44, 62);
  const label = axis ? `נעול ל${axisLabel(axis, headingDeg)}` : 'נעילת ציר — גררו לכיוון שבו להזיז';
  const flat = axis === 'along' || axis === 'x' || axis === 'z';
  return (
    <g pointerEvents="none">
      {axis && (
        <line
          x1={flat ? -wall.lengthMm : at.xMm}
          y1={flat ? flip(at.yMm) : flip(0)}
          x2={flat ? wall.lengthMm * 2 : at.xMm}
          y2={flat ? flip(at.yMm) : flip(wall.heightMm)}
          stroke="#7c3aed"
          strokeWidth={stroke * 1.4}
          strokeDasharray={`${stroke * 4} ${stroke * 3}`}
        />
      )}
      <text
        x={wall.lengthMm / 2}
        y={flip(wall.heightMm) - fontSize * 0.6}
        textAnchor="middle"
        fontSize={fontSize}
        fill="#6d28d9"
      >
        {label}
      </text>
    </g>
  );
}
