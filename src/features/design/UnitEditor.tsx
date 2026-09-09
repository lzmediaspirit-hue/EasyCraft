import { Pill } from '../../ui/Pill';
import { ChevronIcon } from '../../ui/icons';
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { glyphDef } from '../../catalog/glyphList';
import { MAX_BODY_MM, doorCells, isContainer, unitCells } from '../../catalog/zones';
import { MATERIAL, drawerDepth } from '../../catalog/standards';
import { finishesRepo, materialsRepo } from '../../materials/materialsRepo';
import { partChoice } from '../../costing/boards';
import { InteriorEditor } from './InteriorEditor';
import { PartChoiceRow } from './PartChoiceRow';
import { FinishSheet } from '../settings/FinishSheet';
import { SaveToLibrarySheet } from './SaveToLibrarySheet';
import { cm, unitLabel } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { BookmarkIcon, CloseIcon, PencilIcon } from '../../ui/icons';
import { DRAWER_BOXES, bodyHeightMm } from '../../db/types';
import type {
  ExposedSides,
  LedSpot,
  OpeningMech,
  PartChoice,
  PartRole,
  PlacedUnit,
  Project,
} from '../../db/types';

const DOOR_COUNTS = [0, 1, 2, 3, 4, 5, 6];

const SIDES: { key: keyof ExposedSides; label: string }[] = [
  { key: 'start', label: 'שמאל' },
  { key: 'end', label: 'ימין' },
  { key: 'top', label: 'עליון' },
  { key: 'bottom', label: 'תחתון' },
];

const LED_SPOTS: { key: LedSpot; label: string }[] = [
  { key: 'start', label: 'שמאל' },
  { key: 'end', label: 'ימין' },
  { key: 'top', label: 'עליון' },
  { key: 'bottom', label: 'תחתון' },
  { key: 'shelf', label: 'מתחת למדף' },
];

const OPENINGS: { key: OpeningMech; label: string }[] = [
  { key: 'hinge', label: 'צירים' },
  { key: 'lift', label: 'קלאפה' },
  { key: 'sliding', label: 'הזזה' },
];

/** מידות תקן לכל ציר, לבחירה מהירה. */
const WIDTHS = [150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const HEIGHTS = [350, 450, 600, 700, 720, 900, 1000, 1200, 1600, 2000, 2050, 2200, 2320, 2400];
const DEPTHS = [250, 300, 320, 350, 400, 450, 500, 560, 580, 600, 650];

type Axis = 'w' | 'h' | 'd';

/**
 * הלוח שנפתח כשארגז נבחר.
 *
 * מה שמוצג כאן נגזר ממצב התצוגה: כשרואים חזיתות מוצגות הגדרות החזית —
 * דלתות, מנגנון פתיחה, גוון ודפנות זרות. כשהחזיתות מוסתרות מוצג פנים
 * הארון — אזורים, מדפים ומגירות. כך אין על המסך הגדרות שלא רואים.
 */
/** ארבעת הצדדים שאפשר לוותר עליהם, בשמות שנגר משתמש בהם. */
const OMIT_SIDES = [
  { key: 'start', label: 'שמאל' },
  { key: 'end', label: 'ימין' },
  { key: 'top', label: 'תקרה' },
  { key: 'bottom', label: 'תחתית' },
] as const;

export function UnitEditor({
  unit,
  inside,
  project,
  fillWidth,
  fillHeight,
  defaultSocleMm = 0,
  onFree,
  onChange,
  onApplyChoiceAll,
  onEdit,
  onClose,
}: {
  unit: PlacedUnit;
  /** מצב התצוגה הנוכחי — חזיתות מוסתרות */
  inside: boolean;
  /** הפרויקט, לברירות המחדל של הגוון והחומר */
  project?: Project;
  /**
   * הרווח שהארגז יושב בתוכו — איפה הוא מתחיל וכמה הוא גדול.
   * גם הוא נמדד בהדמיה, מאותה סיבה.
   */
  fillWidth?: { startMm: number; sizeMm: number };
  fillHeight?: { startMm: number; sizeMm: number };
  /** גובה הרגליים שהעסק עובד בו — לארגז שחוזר לרצפה */
  defaultSocleMm?: number;
  /** הופך את הארגז לאי בחדר, או מחזיר אותו אל הקיר */
  onFree?: (free: boolean) => void;
  onChange: (patch: Partial<PlacedUnit>) => void;
  /** החלת גוון וחומר על כל הפרויקט */
  onApplyChoiceAll: (role: PartRole, choice: PartChoice) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [axis, setAxis] = useState<Axis>('w');
  /** שדה מידה מדויקת, נפתח מהעיפרון שבקצה הקרוסלה */
  const [typing, setTyping] = useState(false);
  const activeChip = useRef<HTMLButtonElement>(null);
  const chipRow = useRef<HTMLDivElement>(null);
  const [addingFinish, setAddingFinish] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  /* מגירת העריכה המתקדמת נפתחת לבד לארגז שכבר משתמש במה שיש בה */
  const [advanced, setAdvanced] = useState(() => !!unit.free || !!unit.omit);
  const omit = unit.omit ?? {};
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  /*
   * גוון נבחר מתוך הלוח שממנו החלק באמת נבנה: הגוף מלוחות הגוף,
   * החזיתות והדפנות הזרות מלוחות החזית. אחרת אפשר היה לצבוע גוף
   * בגוון שאין ממנו לוח גוף.
   */
  /*
   * כל הגוונים זמינים לכל חלק. הלוח אינו שייך לחלק מסוים, ולכן מה
   * שקובע את החומר הוא הגוון שנבחר — אותו גוון יכול להתקיים על
   * סנדוויץ' ועל MDF, והבחירה היא בין השניים.
   */
  const allFinishes = useLiveQuery(async () => finishesRepo.all(), []) ?? [];
  const materials = useLiveQuery(async () => materialsRepo.list(), []) ?? [];
  /** מה שבאמת חל על חלק — הארגז, ואם לא נקבע בו, הפרויקט */
  const choiceOf = (role: PartRole) => partChoice(unit, role, project);

  const caps = glyphDef(unit.glyph);
  const locked = unit.floorLocked ?? false;
  const exposed = unit.exposed ?? {};
  const glassSides = unit.glassSides ?? {};
  const bodyH = bodyHeightMm(unit);
  const led = unit.led ?? [];
  const container = isContainer(unit.glyph);
  /*
   * לארגז יש חזיתות אם יש לו דלתות או מגירות חיצוניות. ארגז פתוח
   * או נישה למכשיר לא צריכים גוון חזיתות, ולכן השורה לא מוצגת.
   */
  const hasFronts =
    (unit.doors ?? 0) > 0 ||
    unitCells(unit).some(
      ({ content: c }) => c.kind === 'drawers' && c.drawerStyle !== 'inner',
    );
  const hasExposed = !!(exposed.start || exposed.end || exposed.top || exposed.bottom);
  const hasDrawers = unitCells(unit).some(({ content: c }) => c.kind === 'drawers');
  const cells = doorCells(unit);

  /*
   * ברוחב מוצגות גם המידות של הפריט וגם מידות התקן עד 120 ס"מ:
   * ארגז בספרייה מגיע עם כמה רוחבים נפוצים, אבל בשטח צריך לפעמים
   * מידה אחרת, ולחפש אותה בהקלדה זה חיכוך מיותר.
   */
  const options =
    axis === 'w'
      ? [...new Set([...(source?.widthOptionsMm ?? []), ...WIDTHS])].sort((a, b) => a - b)
      : axis === 'h'
        ? HEIGHTS
        : DEPTHS;
  /*
   * העומק שמוצג תלוי במה שרואים: בתצוגת חזית זה העומק הכולל, עם
   * החזית; בתצוגת פנים זה עומק הגוף בלבד. מה שנשמר הוא תמיד עומק
   * הגוף, כי זו המידה שממנה נחתכים הצדדים.
   */
  const depthShift = !inside && hasFronts ? MATERIAL.frontMm : 0;
  const currentValue =
    axis === 'w' ? unit.widthMm : axis === 'h' ? unit.heightMm : unit.depthMm + depthShift;
  /*
   * הרווח שהארגז יושב בתוכו. לעומק אין מה להשלים — הוא נמדד מהקיר
   * החוצה ולא בין שכנים — וארגז שכבר ממלא את הרווח בדיוק אינו צריך
   * השלמה.
   */
  const span = axis === 'w' ? fillWidth : axis === 'h' ? fillHeight : undefined;
  const spanStart = axis === 'w' ? unit.xMm : unit.yMm;
  const fill =
    span && span.sizeMm > 50 && (span.sizeMm !== currentValue || span.startMm !== spanStart)
      ? span
      : null;

  /*
   * המידה הפעילה נגללת למרכז השורה.
   * גלילה דרך scrollIntoView הזיזה גם את הגלילה האנכית של הלוח והסתירה
   * את השורה עצמה, ולכן כאן מוזזת רק הגלילה האופקית — לפי ההפרש בין
   * מרכז השבב למרכז השורה, מה שנכון גם בממשק מימין לשמאל.
   */
  useEffect(() => {
    const row = chipRow.current;
    const chip = activeChip.current;
    if (!row || !chip) return;
    const rowBox = row.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    row.scrollLeft += chipBox.left + chipBox.width / 2 - (rowBox.left + rowBox.width / 2);
  }, [axis, currentValue]);

  const axisLabel = axis === 'w' ? 'רוחב' : axis === 'h' ? 'גובה' : 'עומק';

  const applyStandard = (mm: number) =>
    onChange(
      axis === 'w'
        ? { widthMm: mm }
        : axis === 'h'
          ? { heightMm: mm }
          : { depthMm: Math.max(mm - depthShift, 50) },
    );

  function toggleSide(key: keyof ExposedSides) {
    onChange({ exposed: { ...exposed, [key]: !exposed[key] } });
  }

  function toggleLed(spot: LedSpot) {
    onChange({ led: led.includes(spot) ? led.filter((s) => s !== spot) : [...led, spot] });
  }

  return (
    <>
    {/*
      הלוח נגלל, ולכן אף שורה בתוכו אינה מתכווצת: בלי זה עמודת הפלקס
      דחסה את שורת מידות התקן עד שהיא נעלמה מאחורי שורת המידות.
    */}
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] [&>*]:shrink-0">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-stone-900">{unit.name}</h2>
        <button
          onClick={() => setSavingToLibrary(true)}
          aria-label="שמירה לספרייה"
          title="שמירה לספרייה"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-oak-50 hover:text-oak-700"
        >
          <BookmarkIcon className="size-5" />
        </button>
        <button
          onClick={onEdit}
          aria-label="עריכת הארגז"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-oak-50 hover:text-oak-700"
        >
          <PencilIcon className="size-5" />
        </button>
        <button
          onClick={onClose}
          aria-label="סיום עריכה"
          className="-me-2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      {/*
        שורת מידות אחת: המספר עצמו ניתן להקלדה, והקשה עליו בוחרת את
        הציר שמידות התקן שמתחת משרתות. קודם הייתה שורה שנייה של שדות
        הקלדה שחזרה על אותן מידות והסתירה את שורת המידות המהירות.
      */}
      <div className="mt-3 flex gap-1.5">
        <AxisTab
          active={axis === 'w'}
          onSelect={() => setAxis('w')}
          label="רוחב"
          value={unit.widthMm}
        />
        <AxisTab
          active={axis === 'h'}
          onSelect={() => setAxis('h')}
          label="גובה"
          value={unit.heightMm}
        />
        <AxisTab
          active={axis === 'd'}
          onSelect={() => setAxis('d')}
          label={inside ? 'עומק הגוף' : 'עומק'}
          value={unit.depthMm + depthShift}
        />
      </div>

      {bodyH > MAX_BODY_MM && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
          גוף הארון <span className="num">{cm(bodyH)}</span> ס״מ, מעל{' '}
          <span className="num">{cm(MAX_BODY_MM)}</span> ס״מ — קשה להוביל ולהתקין,
          ולרוב עדיף לפצל לשניים.
        </p>
      )}

      {/*
        הקרוסלה נגמרת לפני העיפרון ולא מתחתיו: העיפרון יושב מחוץ
        לאזור הגלילה, ולכן הוא תמיד במקום אחד ואפשר להגיע אליו בלי
        לגלול עד הסוף.
      */}
      <div className="mt-2 flex items-center gap-1.5">
        <div ref={chipRow} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
          {/*
            השלמה: "קיר בגובה 3 מטר, ארגז של 240 — כמה נשאר למעלה".
            במקום לחסר בראש, הארגז נכנס בדיוק לרווח שהוא יושב בו —
            גם נצמד לתחילתו וגם מקבל את מידתו. השבב נושא את המידה
            עצמה, כדי שרואים מראש מה הוא יעשה.
          */}
          {fill && (
            <button
              onClick={() => {
                setTyping(false);
                onChange(
                  axis === 'w'
                    ? { xMm: fill.startMm, widthMm: fill.sizeMm }
                    : { yMm: fill.startMm, heightMm: fill.sizeMm },
                );
              }}
              className="shrink-0 rounded-full bg-oak-100 px-3 py-1.5 text-sm font-medium text-oak-800 transition-colors hover:bg-oak-200"
            >
              השלמה <span className="num">{cm(fill.sizeMm)}</span>
            </button>
          )}
          {options.map((mm) => (
            <button
              key={mm}
              ref={mm === currentValue ? activeChip : undefined}
              onClick={() => {
                setTyping(false);
                applyStandard(mm);
              }}
              className={`num shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                mm === currentValue
                  ? 'bg-oak-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cm(mm)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTyping((v) => !v)}
          aria-pressed={typing}
          aria-label={`הקלדת ${axisLabel} מדויק`}
          title="מידה מדויקת"
          className={`shrink-0 rounded-full p-2 transition-colors ${
            typing ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          <PencilIcon className="size-4" />
        </button>
      </div>

      {typing && (
        <label className="mt-1.5 flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2">
          <span className="text-[11px] text-stone-500">{axisLabel}</span>
          <MeasureInput
            value={currentValue}
            onChange={applyStandard}
            minMm={50}
            autoFocus
            ariaLabel={`${axisLabel} מדויק`}
            className="num min-w-0 flex-1 bg-transparent text-end text-base font-semibold text-stone-900 focus:outline-none"
          />
          <span className="text-[11px] text-stone-400">{unitLabel()}</span>
        </label>
      )}

      {unit.panelThicknessMm !== undefined && (
        <div className="mt-2">
          <NumBox
            label="עובי הלוח"
            value={unit.panelThicknessMm}
            inMm
            onChange={(mm) => onChange({ panelThicknessMm: mm })}
          />
        </div>
      )}

      {inside ? (
        /* ---- פנים הארון ---- */
        container ? (
          <>
            <InteriorEditor unit={unit} onChange={onChange} />

            {/*
              דלת נתפסת על משהו. בארגז רחב עם ארבע דלתות אין על מה
              לתלות את השתיים האמצעיות, ולכן נדרשת קושרת ביניהן —
              וזה מה שמחלק את הארגז לתאים. ברירת המחדל נגזרת ממספר
              הדלתות, ואפשר לשנות.

              הקושרת היא לוח בגוף הארון, ורואים אותה רק כשהחזיתות
              מוסתרות — ולכן גם מגדירים אותה כאן, מול מה שהיא עושה.
            */}
            {(unit.doors ?? 0) >= 2 && (
              <>
                <Row label="תאים בין הדלתות" hint="הקושרות שהדלתות נתפסות עליהן">
                  {Array.from({ length: unit.doors ?? 1 }, (_, i) => i + 1).map((n) => (
                    <Pill
                      key={n}
                      active={cells === n}
                      onClick={() => onChange({ doorCells: n })}
                    >
                      {n}
                    </Pill>
                  ))}
                </Row>
                {cells > 1 && (
                  <button
                    onClick={() => onChange({ doubleDividers: !unit.doubleDividers })}
                    aria-pressed={!!unit.doubleDividers}
                    className={`mt-1.5 w-full rounded-lg px-3 py-1.5 text-start text-[11px] font-medium transition-colors ${
                      unit.doubleDividers
                        ? 'bg-oak-600 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    קושרת בעובי כפול
                    <span
                      className={`block text-[10px] font-normal ${
                        unit.doubleDividers ? 'text-white/70' : 'text-stone-400'
                      }`}
                    >
                      שני לוחות זה על זה — לארגז ארוך או כבד
                    </span>
                  </button>
                )}
              </>
            )}

            {/*
              מבנה תיבת המגירה משנה אילו חלקים נחתכים, ולכן הוא
              שייך לפנים הארון ולא לחזית.
            */}
            {hasDrawers && (
              <>
                <Row label="תיבת המגירה">
                  {DRAWER_BOXES.map((bx) => (
                    <Pill
                      key={bx.key}
                      active={(unit.drawerBox ?? 'metal') === bx.key}
                      onClick={() => onChange({ drawerBox: bx.key })}
                    >
                      {bx.label}
                    </Pill>
                  ))}
                </Row>
                <p className="mt-1 text-[10px] leading-snug text-stone-400">
                  {DRAWER_BOXES.find((bx) => bx.key === (unit.drawerBox ?? 'metal'))?.hint}
                  {' · עומק התיבה '}
                  <span className="num">{cm(drawerDepth(unit.depthMm))}</span> {unitLabel()},
                  נגזר מעומק הארגז.
                </p>
              </>
            )}

            {/*
              גוון הגוף והגב שייכים למה שרואים כשהחזיתות מוסתרות.
              בתצוגת חזית הם רק שורות שמסיחות את הדעת.
            */}
          <PartChoiceRow
              label="גוף"
              role="carcass"
              finishes={allFinishes}
              materials={materials}
              value={{ finishId: unit.carcassFinishId, materialId: unit.carcassMaterialId }}
              effective={choiceOf('carcass')}
              onChange={(c) => onChange({ carcassFinishId: c.finishId, carcassMaterialId: c.materialId })}
              onApplyAll={(c) => onApplyChoiceAll('carcass', c)}
              onAddFinish={() => setAddingFinish(true)}
            />

            {(unit.backKind ?? 'thin') !== 'none' && (
              <PartChoiceRow
                label="גב"
              role="back"
                finishes={allFinishes}
                materials={materials}
                value={{ finishId: unit.backFinishId, materialId: unit.backMaterialId }}
                effective={choiceOf('back')}
                onChange={(c) => onChange({ backFinishId: c.finishId, backMaterialId: c.materialId })}
                onApplyAll={(c) => onApplyChoiceAll('back', c)}
                onAddFinish={() => setAddingFinish(true)}
              />
            )}

          </>
        ) : (
          <p className="mt-4 text-xs leading-snug text-stone-500">
            לארגז הזה אין פנים שאפשר לחלק — הוא מכשיר או לוח בודד.
          </p>
        )
      ) : (
        /* ---- החזית ---- */
        <>
          {caps.doors && (
            <>
              <Row label="דלתות" hint="0 = בלי חזית">
                {DOOR_COUNTS.map((n) => (
                  <Pill key={n} active={n === (unit.doors ?? 0)} onClick={() => onChange({ doors: n })}>
                    {n}
                  </Pill>
                ))}
              </Row>

              {(unit.doors ?? 0) > 0 && (
                <>
                  <Row label="מנגנון פתיחה">
                    {OPENINGS.map((o) => (
                      <Pill
                        key={o.key}
                        active={(unit.opening ?? 'hinge') === o.key}
                        onClick={() => onChange({ opening: o.key })}
                      >
                        {o.label}
                      </Pill>
                    ))}
                  </Row>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => onChange({ glassDoors: !unit.glassDoors })}
                      aria-pressed={!!unit.glassDoors}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        unit.glassDoors
                          ? 'bg-oak-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      דלתות זכוכית
                    </button>
                    <button
                      onClick={() => onChange({ handles: !unit.handles })}
                      aria-pressed={!!unit.handles}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        unit.handles
                          ? 'bg-oak-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      ידיות
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {unit.corner && (
            <>
              <Row
                label="עומק הפינה המתה"
                hint="החלק שנחסם על ידי הארון שעל הקיר הסמוך"
              >
                {[200, 250, 300, 350, 400, 450, 500, 550, 600, 650].map((mm) => (
                  <Pill
                    key={mm}
                    active={mm === (unit.blindMm ?? 300)}
                    onClick={() => onChange({ blindMm: mm })}
                  >
                    {cm(mm)}
                  </Pill>
                ))}
              </Row>
              {/* הפינה המתה נמדדת בשטח ולא תמיד נופלת על מידת תקן */}
              <label className="mt-2 flex items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-1.5">
                <span className="flex-1 text-[11px] text-stone-500">מידה מדויקת</span>
                <MeasureInput
                  value={unit.blindMm ?? 300}
                  onChange={(mm) => onChange({ blindMm: mm })}
                  minMm={50}
                  maxMm={Math.max(unit.widthMm - 100, 50)}
                  ariaLabel="עומק הפינה המתה"
                  className="num w-14 bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">{unitLabel()}</span>
              </label>
            </>
          )}

          {/*
            שורת גוון מוצגת רק לחלק שקיים בארגז הזה: לארגז פתוח אין
            חזיתות, ולארגז בלי דפנות זרות אין להן גוון. שורה שאין לה
            משמעות היא שורה שמסיחה את הדעת.
          */}
          {hasFronts && (
            <PartChoiceRow
              label="חזיתות"
              role="front"
              finishes={allFinishes}
              materials={materials}
              value={{ finishId: unit.frontFinishId ?? unit.finishId, materialId: unit.frontMaterialId }}
              effective={choiceOf('front')}
              onChange={(c) =>
                onChange({ frontFinishId: c.finishId, finishId: c.finishId, frontMaterialId: c.materialId })
              }
              onApplyAll={(c) => onApplyChoiceAll('front', c)}
              onAddFinish={() => setAddingFinish(true)}
            />
          )}

          {hasExposed && (
            <PartChoiceRow
              label="דפנות זרות"
              role="exposed"
              finishes={allFinishes}
              materials={materials}
              value={{ finishId: unit.exposedFinishId, materialId: unit.exposedMaterialId }}
              effective={choiceOf('exposed')}
              onChange={(c) => onChange({ exposedFinishId: c.finishId, exposedMaterialId: c.materialId })}
              onApplyAll={(c) => onApplyChoiceAll('exposed', c)}
              onAddFinish={() => setAddingFinish(true)}
            />
          )}

          <Row label="דפנות זרות" hint={`ברירת מחדל: גוף +${MATERIAL.exposedExtraMm} מ״מ`}>
            {SIDES.map((s) => (
              <Pill key={s.key} active={!!exposed[s.key]} onClick={() => toggleSide(s.key)}>
                {s.label}
              </Pill>
            ))}
          </Row>

          {/* עומק הדופן — קבוע לפי הגוף, או מידה שהנגר מזין */}
          {(exposed.start || exposed.end || exposed.top || exposed.bottom) && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-[11px] text-stone-500">עומק הדופן</span>
              <Pill
                active={unit.exposedDepthMm === undefined}
                onClick={() => onChange({ exposedDepthMm: undefined })}
              >
                גוף +{MATERIAL.exposedExtraMm}
              </Pill>
              <label className="flex flex-1 items-center gap-1 rounded-lg bg-stone-100 px-2 py-1">
                <MeasureInput
                  value={unit.exposedDepthMm ?? unit.depthMm + MATERIAL.exposedExtraMm}
                  onChange={(mm) => onChange({ exposedDepthMm: mm })}
                  minMm={100}
                  ariaLabel="עומק הדופן הזרה"
                  className="num w-full bg-transparent text-end text-sm font-medium text-stone-900 focus:outline-none"
                />
                <span className="shrink-0 text-[10px] text-stone-400">ס״מ</span>
              </label>
            </div>
          )}

          {/*
            צד שעשוי זכוכית במקום לוח. הצד יוצא מפירוק הפלטות ונכנס
            לרשימת הזכוכית, ולארון נשארים הגב, הצד השני, והתחתית
            והתקרה.

            רק לוויטרינה: בארון אטום אין מה לראות דרך הצד. ארגז ישן
            שכבר סומן כך ממשיך להראות את השורה, כדי שאפשר יהיה
            לבטל — הגדרה שנעלמת ואי אפשר לכבות היא מלכודת.
          */}
          {(glyphDef(unit.glyph).vitrine || glassSides.start || glassSides.end) && (
            <>
              <Row label="צד זכוכית" hint="ויטרינה שרואים דרכה מהצד">
                {(['start', 'end'] as const).map((side) => (
                  <Pill
                    key={side}
                    active={!!glassSides[side]}
                    onClick={() =>
                      onChange({ glassSides: { ...glassSides, [side]: !glassSides[side] } })
                    }
                  >
                    {side === 'start' ? 'שמאל' : 'ימין'}
                  </Pill>
                ))}
              </Row>
              {(glassSides.start || glassSides.end) && (
                <p className="mt-1 text-[10px] leading-snug text-stone-400">
                  הצד נספר במ״ר זכוכית ולא בפלטות.
                  {glassSides.start && glassSides.end && ' שני הצדדים זכוכית — הארון נשען על הגב ועל התחתית והתקרה.'}
                </p>
              )}
            </>
          )}
        </>
      )}

      <Row label="פס לד">
        {LED_SPOTS.map((s) => (
          <Pill key={s.key} active={led.includes(s.key)} onClick={() => toggleLed(s.key)}>
            {s.label}
          </Pill>
        ))}
      </Row>

      {/*
        עריכה מתקדמת: מה שנגר עושה פעם בעשרה ארגזים.

        הדברים האלה אמיתיים ונחוצים — ארגז שנשען על שכנו, ארגז
        שיורד מהקיר — אבל הם לא הדבר שפותחים בשבילו את הלוח. מגירה
        סגורה משאירה את העורך קצר, ומי שצריך אותם יודע לחפש.
      */}
      <button
        onClick={() => setAdvanced((v) => !v)}
        aria-expanded={advanced}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-stone-100 px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200"
      >
        עריכה מתקדמת
        <ChevronIcon className={`size-4 transition-transform ${advanced ? '-rotate-90' : ''}`} />
      </button>

      {advanced && (
        <>
          {/*
            צד שלא נבנה. ארגז שנצמד לשכן נשען עליו ואינו צריך דופן
            משלו, וארגז בנישה יכול לוותר על התקרה. מה שיורד כאן יורד
            גם מהניסור ומהמחיר, ולא רק מהתמונה.
          */}
          <Row label="בלי דופן" hint="הארגז נשען על השכן במקומה">
            {OMIT_SIDES.map((o) => (
              <Pill
                key={o.key}
                active={!!omit[o.key]}
                ariaLabel={`בלי ${o.label}`}
                onClick={() => onChange({ omit: { ...omit, [o.key]: !omit[o.key] } })}
              >
                {o.label}
              </Pill>
            ))}
          </Row>

          {/*
            אי: הארגז יורד מהקיר ועומד בחדר. אחרי ההפיכה גוררים אותו
            בתלת־ממד אל המקום שלו; הכפתור רק מוריד אותו מהקיר.
          */}
          {onFree && (
            <Row label="אי" hint="ארגז שעומד בחדר ולא על קיר">
              <Pill active={!unit.free} ariaLabel="על הקיר" onClick={() => onFree(false)}>
                על הקיר
              </Pill>
              <Pill active={!!unit.free} ariaLabel="אי בחדר" onClick={() => onFree(true)}>
                אי בחדר
              </Pill>
            </Row>
          )}
        </>
      )}

      <div className="mt-3 flex items-stretch gap-2">
        <button
          onClick={() =>
            /* תחתית הארגז היא yMm, והרגליים כלולות בגובה — ולכן ארגז
               שנצמד לרצפה יושב על 0 ולא על גובה הרגליים.
               ארגז שמשוחרר מהרצפה תלוי, ורגליים לארגז תלוי אין; ארגז
               שחוזר לרצפה מקבל אותן בחזרה בגובה שהעסק עובד בו. המתג
               הוא הפיך, ולכן הוא מחזיר בדיוק את מה שלקח. */
            onChange({
              floorLocked: !locked,
              ...(locked ? { socleMm: 0 } : { yMm: 0, socleMm: defaultSocleMm }),
            })
          }
          aria-pressed={locked}
          className={`flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors ${
            locked ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              locked ? 'bg-white/30' : 'bg-stone-300'
            }`}
          >
            <span
              className={`size-4 rounded-full bg-white transition-transform ${
                locked ? '-translate-x-4' : ''
              }`}
            />
          </span>
          הצמדה לרצפה
        </button>

        {/*
          רגליים יש רק לארגז שעומד על הרצפה. ארון תלוי לא נשען על
          כלום, ושורת "גובה רגליים" אצלו היא שאלה בלי משמעות.
        */}
        <div className="min-w-0 flex-1">
          {locked ? (
            <NumBox
              label="גובה רגליים"
              value={unit.socleMm ?? 0}
              /* הרגליים מרימות את גוף הארון, ולכן הגובה הכולל גדל איתן */
              onChange={(mm) =>
                onChange({
                  socleMm: mm || undefined,
                  heightMm: Math.max(unit.heightMm + mm - (unit.socleMm ?? 0), 50),
                  yMm: 0,
                })
              }
            />
          ) : (
            <NumBox label="גובה מהרצפה" value={unit.yMm} onChange={(mm) => onChange({ yMm: mm })} />
          )}
        </div>
      </div>
    </div>

    {addingFinish && <FinishSheet finish={null} onClose={() => setAddingFinish(false)} />}

    {savingToLibrary && (
      <SaveToLibrarySheet unit={unit} onClose={() => setSavingToLibrary(false)} />
    )}
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * ציר אחד בשורת המידות: תווית, מספר שאפשר להקליד, ובחירת הציר
 * שמידות התקן שמתחת משרתות. מיקוד בשדה בוחר את הציר, כדי שהקלדה
 * ומידה מהירה תמיד יעבדו על אותו מימד.
 */
function AxisTab({
  active,
  onSelect,
  label,
  value,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
  value: number;
}) {
  /*
   * הלשונית בוחרת ציר ומראה את המידה שלו — היא כבר לא שדה הקלדה.
   * מקלדת שקפצה מכל נגיעה במספר כיסתה חצי מסך בדיוק כשרוצים לראות
   * את הקיר; מי שצריך מידה שאינה בקרוסלה לוחץ על העיפרון שבקצה.
   */
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      data-axis={label}
      className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      <span className="block text-center text-[10px] leading-tight opacity-70">{label}</span>
      <span className="num block w-full text-center text-sm leading-tight font-semibold">
        {cm(value)}
      </span>
    </button>
  );
}


function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11px] font-medium text-stone-500">{label}</span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}


function NumBox({
  label,
  value,
  minMm,
  inMm,
  onChange,
}: {
  label: string;
  value: number;
  minMm?: number;
  inMm?: boolean;
  onChange: (mm: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">
        {label}
        {inMm && <span className="text-stone-400"> מ״מ</span>}
      </span>
      <MeasureInput
        value={value}
        onChange={onChange}
        minMm={minMm}
        inMm={inMm}
        ariaLabel={label}
        className="num w-full bg-transparent text-base font-medium text-stone-900 focus:outline-none"
      />
    </label>
  );
}
