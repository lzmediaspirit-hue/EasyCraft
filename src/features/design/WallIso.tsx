import { useLayoutEffect, useRef, useState } from 'react';
import { COS30, DEFAULT_VIEW, MAX_RISE, MIN_RISE, ORBIT_SLOP } from './isoMath';
import type { IsoView } from './isoMath';
import { buildScene } from './isoScene';
import { buildPlan, cornerZones } from './plan';
import { outOfSight } from './designView';
import { SNAP, SNAP_PX, collides, snapX, snapY } from './snapping';
import type { PlacedUnit, Wall } from '../../db/types';

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
  onSelect,
  onMoveTo,
  onRotate,
  inside,
  noUppers,
  finishHex,
  present = false,
}: {
  walls: Wall[];
  /** כל הארגזים בפרויקט — המבט הזה מציג את החדר כולו */
  units: PlacedUnit[];
  /** הקיר שעובדים עליו כרגע, מסומן בציור */
  activeWallId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * הזזת ארגז אל מקום אחר — ואולי אל קיר אחר.
   *
   * גרירה מעבר לקצה הקיר מעבירה את הארגז לקיר השכן, כי בחדר אמיתי
   * פינה היא מקום ולא גבול: מי שגורר ארון לאורך המטבח לא עוצר
   * בפינה ומתחיל מחדש.
   */
  onMoveTo?: (id: string, xMm: number, yMm: number, wallId: string) => void;
  /**
   * סיבוב הארגז הנבחר ברבע סיבוב.
   *
   * שני חצים מתחתיו, אחד לכל כיוון — זו התנועה שעושים ביד על
   * ארון אמיתי כשמעמידים אותו בפינה, ולא בחירה מתוך רשימה.
   */
  onRotate?: (id: string, deg: 0 | 90 | 180 | 270) => void;
  /** חזיתות מוסתרות — רואים את הגוף והמדפים */
  inside: boolean;
  /** העליונים יורדים מהתמונה */
  noUppers?: boolean;
  finishHex: Record<string, string>;
  /**
   * תצוגת הצגה: אותו חדר, בלי שרטוט.
   *
   * הקווים בין הלוחות, שמות הקירות וסימון הארגז הנבחר הם שפה של
   * נגר. הלקוח לא קורא שרטוט — הוא רוצה לראות איך זה ייראה — ולכן
   * במצב הזה נשארים רק המשטחים, עם אור, צל וקרקע.
   */
  present?: boolean;
}) {
  /*
   * זווית המבט נשמרת במצב ולא בהגדרות: היא שייכת לרגע ההסתכלות,
   * לא לפרויקט. גרירה על הציור מסובבת אופקית ומרימה או מנמיכה את
   * נקודת המבט — אותה תנועה שעושים ביד על מודל אמיתי.
   */
  const [view, setView] = useState<IsoView>(DEFAULT_VIEW);
  /*
   * אותה אצבע לא יכולה גם לסובב את המבט וגם להזיז ארון: כל תנועה
   * הייתה עושה את שניהם. המתג מפריד ביניהם — צפייה או הזזה — וזה
   * גם מה שמונע מהחדר להסתובב בכל פעם שמישהו נגע בארון.
   */
  const [moving, setMoving] = useState(false);
  const drag = useRef<{
    id: string;
    /** הקיר שממנו יצאה הגרירה — לפיו נמדד הכיוון על המסך */
    wallId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    locked: boolean;
    moved: boolean;
  } | null>(null);
  const orbit = useRef<{
    x: number;
    y: number;
    from: IsoView;
    moved: boolean;
    /** הארון שהאצבע ירדה עליו — נקרא בהרפיה */
    hit: string | null;
  } | null>(null);

  const scene = buildScene({
    walls,
    units,
    activeWallId,
    selectedId,
    inside,
    noUppers,
    finishHex,
    present,
    view,
  });
  const { faces, backdrops, marks, floor, bounds, spin } = scene;
  /* הזווית שבאמת מצוירת — היא מוגבלת כדי לא לצאת אל מאחורי הקיר */
  const shown = scene.view;
  const plan = buildPlan(walls, units);
  /*
   * הכיוון של הקיר שעובדים עליו, לפיו נעצר הסיבוב לפני שהצופה יוצא
   * אל מאחוריו. הגרירה צריכה את אותו גבול שהתמונה כבר חושבת לפיו.
   */
  const heading = plan.find((p) => p.wall.id === activeWallId)?.headingDeg ?? 0;

  const xs = bounds.map((q) => q[0]);
  const ys = bounds.map((q) => q[1]);
  const pad = 300;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const vbW = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const vbH = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const stroke = Math.max(vbW / 700, 3);

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
  const selectedUnit = units.find((u) => u.id === selectedId && !outOfSight(u, noUppers)) ?? null;

  /*
   * הזזת ארון על המסך, בחזרה למידות של החדר.
   *
   * תנועה אופקית של האצבע היא תנועה לאורך הקיר, ותנועה אנכית היא
   * תערובת של גובה ושל אותה תנועה לאורך הקיר — כי בהיטל איזומטרי
   * גם הליכה לאורך הקיר מטפסת על המסך. שתי המשוואות האלה נפתרות
   * כאן, ולכן הארון הולך אחרי האצבע ולא באלכסון משלו.
   */
  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !onMoveTo) return;
    const unit = units.find((u) => u.id === d.id);
    const from = plan.find((q) => q.wall.id === d.wallId);
    if (!unit || !from) return;

    const mdx = (e.clientX - d.startX) / pxPerUnit;
    const mdy = (e.clientY - d.startY) / pxPerUnit;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < ORBIT_SLOP) return;
    d.moved = true;

    // הכיוון של "מטר אחד לאורך הקיר" על המסך, בזווית המבט הנוכחית
    const theta = ((from.headingDeg + shown.yawDeg) * Math.PI) / 180;
    const ax = (Math.cos(theta) - Math.sin(theta)) * COS30;
    const ay = (Math.cos(theta) + Math.sin(theta)) * shown.rise;
    // קיר שנראה כמעט מקצהו אינו נותן תשובה לאורך — עדיף לא לנחש
    const alongMm = Math.abs(ax) < 0.05 ? 0 : mdx / ax;
    const upMm = ay * alongMm - mdy;

    /*
     * מעבר לקיר השכן: הגרירה נמדדת תמיד מנקודת המוצא, ולכן היא
     * הפיכה — מי שגרר רחוק מדי חוזר וממשיך מהמקום שהיה.
     */
    let target = from.wall;
    let x = d.originX + alongMm;
    const i = walls.findIndex((w) => w.id === d.wallId);
    if (x < -80 && i > 0) {
      target = walls[i - 1];
      x += target.lengthMm;
    } else if (x > from.wall.lengthMm + 80 && i < walls.length - 1) {
      target = walls[i + 1];
      x -= from.wall.lengthMm;
    }

    const mates = units.filter((u) => u.wallId === target.id);
    const tol = Math.max(SNAP, SNAP_PX / pxPerUnit);
    const nx = snapX(x, unit, mates, target.lengthMm, cornerZones(walls, target, units), tol);
    const ny = d.locked
      ? d.originY
      : snapY(d.originY + upMm, unit, mates, target.heightMm, tol, nx);

    /*
     * אותה חסימה שבמבט החזית: שני ארונות לא עומדים באותו מקום,
     * אבל ארון שכבר חופף חייב להיות מסוגל לצאת משם.
     */
    const stuck = collides(unit, unit.xMm, unit.yMm, mates);
    const free = (px: number, py: number) => stuck || !collides(unit, px, py, mates);
    const [fx, fy] = free(nx, ny)
      ? [nx, ny]
      : free(nx, unit.yMm)
        ? [nx, unit.yMm]
        : free(unit.xMm, ny)
          ? [unit.xMm, ny]
          : [unit.xMm, unit.yMm];
    onMoveTo(d.id, fx, fy, target.id);
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
         * במצב הזזה אצבע שירדה על ארון גוררת אותו; אצבע שירדה על
         * הרצפה עדיין מסובבת את המבט, כי אחרת המתג היה נועל את
         * הזווית ומכריח לחזור אליו בכל פעם.
         */
        if (moving && held && onMoveTo && !present) {
          drag.current = {
            id: held.id,
            wallId: held.wallId,
            startX: e.clientX,
            startY: e.clientY,
            originX: held.xMm,
            originY: held.yMm,
            locked: !!held.floorLocked,
            moved: false,
          };
          return;
        }
        orbit.current = {
          x: e.clientX,
          y: e.clientY,
          from: view,
          moved: false,
          hit,
        };
      }}
      onPointerMove={(e) => {
        if (drag.current) return moveDrag(e);
        const o = orbit.current;
        if (!o) return;
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        if (!o.moved && Math.hypot(dx, dy) < ORBIT_SLOP) return;
        o.moved = true;
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
        orbit.current = null;
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        /*
         * גם גרירה מסתיימת בבחירה: ארון שהועבר לקיר אחר צריך שהמסך
         * יעבור אליו, אחרת הלוח שלו נסגר באמצע העבודה.
         */
        if (d) return onSelect(d.id);
        if (!o || o.moved) return;
        onSelect(o.hit);
      }}
      onPointerCancel={() => {
        orbit.current = null;
        drag.current = null;
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

      <g filter={present ? 'url(#iso-shadow)' : undefined}>
        {faces.map((f) => (
          <polygon
            key={f.key}
            points={f.points}
            fill={f.fill}
            /*
              בהצגה הקו בין לוח ללוח נעלם: הוא מה שהופך רהיט לשרטוט.
              נשאר קו דק מאוד בגוון המשטח עצמו, כדי שפאה בהירה על
              רקע בהיר עדיין תיראה.
            */
            stroke={
              present
                ? 'rgba(87,83,78,0.18)'
                : f.unitId === selectedId
                  ? '#a06236'
                  : '#57534e'
            }
            strokeWidth={
              present ? stroke * 0.35 : f.unitId === selectedId ? stroke * 1.6 : stroke * 0.7
            }
            strokeLinejoin="round"
            data-unit={f.unitId}
            data-wall-solid={f.featureKind}
            className={f.unitId && !present ? 'cursor-pointer' : undefined}
          />
        ))}
      </g>

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
        שני חצי הסיבוב, מתחת לארגז הנבחר.
        כאן ולא בלוח הצדדי: מסובבים ארון כשמסתכלים עליו, ורואים את
        התוצאה באותה תנועה. כל לחיצה היא רבע סיבוב, ושמונה לחיצות
        מחזירות למקום — אין מצב שאי אפשר לצאת ממנו.
      */}
      {spinAt && selectedUnit && onRotate && (
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
            const next = ((((selectedUnit.rotationDeg ?? 0) + dir * 90) % 360) + 360) % 360;
            return (
              <g
                key={label}
                role="button"
                aria-label={label}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onRotate(selectedUnit.id, next as 0 | 90 | 180 | 270);
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
                {/* חץ מעוקל: קשת ברבע מעגל וראש בקצה שאליו מסתובבים */}
                <path
                  d={`M ${cx - dir * r * 0.45} ${cy + r * 0.18} A ${r * 0.5} ${r * 0.5} 0 1 ${
                    dir > 0 ? 1 : 0
                  } ${cx + dir * r * 0.45} ${cy + r * 0.18}`}
                  fill="none"
                  stroke="#a06236"
                  strokeWidth={r * 0.13}
                  strokeLinecap="round"
                />
                <path
                  d={`M ${cx + dir * r * 0.16} ${cy + r * 0.5} L ${cx + dir * r * 0.45} ${
                    cy + r * 0.18
                  } L ${cx + dir * r * 0.6} ${cy + r * 0.52}`}
                  fill="none"
                  stroke="#a06236"
                  strokeWidth={r * 0.13}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </g>
      )}
    </svg>

    {/*
      צפייה או הזזה.
      שתי התנועות דורשות את אותה אצבע על אותה תמונה, ולכן הן אינן
      יכולות לחיות יחד: המתג אומר במפורש מה האצבע עושה עכשיו.
    */}
    {onMoveTo && !present && (
      <button
        onClick={() => setMoving((m) => !m)}
        aria-pressed={moving}
        aria-label="צפייה או הזזה"
        className={`absolute start-1 top-1 rounded-full px-3 py-1 text-[11px] font-medium shadow-sm transition-colors ${
          moving ? 'bg-oak-600 text-white' : 'bg-white/90 text-stone-600 hover:text-oak-700'
        }`}
      >
        {moving ? 'הזזה' : 'צפייה'}
      </button>
    )}

    {/* חזרה לזווית ההתחלתית, אחרי שהסתובבנו למקום שקשה לחזור ממנו */}
    {(view.yawDeg !== DEFAULT_VIEW.yawDeg || view.rise !== DEFAULT_VIEW.rise) && (
      <button
        onClick={() => setView(DEFAULT_VIEW)}
        className="absolute end-1 top-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-stone-600 shadow-sm transition-colors hover:text-oak-700"
      >
        זווית התחלתית
      </button>
    )}
    </div>
  );
}
