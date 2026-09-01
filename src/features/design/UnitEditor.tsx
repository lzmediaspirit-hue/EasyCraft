import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { glyphDef } from '../../catalog/glyphList';
import { MAX_BODY_MM, isContainer } from '../../catalog/zones';
import { MATERIAL } from '../../catalog/standards';
import { boardsRepo, finishesRepo } from '../../materials/materialsRepo';
import { ZonesEditor } from './ZonesEditor';
import { FinishPicker } from './FinishPicker';
import { BoardSheet } from '../settings/BoardSheet';
import { SaveToLibrarySheet } from './SaveToLibrarySheet';
import { cm } from '../../ui/units';
import { MeasureInput } from '../../ui/MeasureInput';
import { BookmarkIcon, CloseIcon, PencilIcon, TrashIcon } from '../../ui/icons';
import type {
  BackKind,
  BoardRole,
  ExposedSides,
  LedSpot,
  OpeningMech,
  PlacedUnit,
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

const BACKS: { key: BackKind; label: string }[] = [
  { key: 'thin', label: 'גב דק' },
  { key: 'carcass', label: 'גב בעובי גוף' },
  { key: 'none', label: 'ללא גב' },
];

/** מידות תקן לכל ציר, לבחירה מהירה. */
const WIDTHS = [150, 200, 300, 400, 450, 500, 600, 700, 800, 900, 1000, 1200];
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
export function UnitEditor({
  unit,
  inside,
  onChange,
  onApplyFinishAll,
  onEdit,
  onRemove,
  onClose,
}: {
  unit: PlacedUnit;
  /** מצב התצוגה הנוכחי — חזיתות מוסתרות */
  inside: boolean;
  onChange: (patch: Partial<PlacedUnit>) => void;
  /** החלת גוון על כל הארונות בפרויקט */
  onApplyFinishAll: (part: 'carcass' | 'front' | 'exposed', finishId?: string) => void;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [axis, setAxis] = useState<Axis>('w');
  const activeChip = useRef<HTMLButtonElement>(null);
  const chipRow = useRef<HTMLDivElement>(null);
  const [newBoardRole, setNewBoardRole] = useState<BoardRole | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  /*
   * גוון נבחר מתוך הלוח שממנו החלק באמת נבנה: הגוף מלוחות הגוף,
   * החזיתות והדפנות הזרות מלוחות החזית. אחרת אפשר היה לצבוע גוף
   * בגוון שאין ממנו לוח גוף.
   */
  const finishesByRole = useLiveQuery(async () => {
    const boards = await boardsRepo.list();
    const lists = await Promise.all(
      boards.map(async (b) => ({ role: b.role, items: await finishesRepo.listForBoard(b.id) })),
    );
    const pick = (role: BoardRole) => lists.filter((l) => l.role === role).flatMap((l) => l.items);
    return { carcass: pick('carcass'), front: pick('front') };
  }, []);
  const carcassFinishes = finishesByRole?.carcass ?? [];
  const frontFinishes = finishesByRole?.front ?? [];

  const caps = glyphDef(unit.glyph);
  const locked = unit.floorLocked ?? false;
  const exposed = unit.exposed ?? {};
  const glassSides = unit.glassSides ?? {};
  // הרגליים אינן חלק מהגוף, ולכן האזהרה נמדדת בלעדיהן
  const bodyH = unit.heightMm - (unit.socleMm ?? 0);
  const led = unit.led ?? [];
  const container = isContainer(unit.glyph);

  const options =
    axis === 'w'
      ? source?.widthOptionsMm?.length
        ? source.widthOptionsMm
        : WIDTHS
      : axis === 'h'
        ? HEIGHTS
        : DEPTHS;
  const currentValue = axis === 'w' ? unit.widthMm : axis === 'h' ? unit.heightMm : unit.depthMm;

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

  const applyStandard = (mm: number) =>
    onChange(axis === 'w' ? { widthMm: mm } : axis === 'h' ? { heightMm: mm } : { depthMm: mm });

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
          onClick={onRemove}
          aria-label="הסרת הארגז"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-5" />
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
          onChange={(mm) => onChange({ widthMm: mm })}
        />
        <AxisTab
          active={axis === 'h'}
          onSelect={() => setAxis('h')}
          label="גובה"
          value={unit.heightMm}
          onChange={(mm) => onChange({ heightMm: mm })}
        />
        <AxisTab
          active={axis === 'd'}
          onSelect={() => setAxis('d')}
          label="עומק"
          value={unit.depthMm}
          onChange={(mm) => onChange({ depthMm: mm })}
        />
      </div>

      {bodyH > MAX_BODY_MM && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
          גוף הארון <span className="num">{cm(bodyH)}</span> ס״מ, מעל{' '}
          <span className="num">{cm(MAX_BODY_MM)}</span> ס״מ — קשה להוביל ולהתקין,
          ולרוב עדיף לפצל לשניים.
        </p>
      )}

      <div ref={chipRow} className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {options.map((mm) => (
          <button
            key={mm}
            ref={mm === currentValue ? activeChip : undefined}
            onClick={() => applyStandard(mm)}
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
            <ZonesEditor unit={unit} onChange={onChange} />
            <Row label="גב">
              {BACKS.map((bk) => (
                <Pill
                  key={bk.key}
                  active={(unit.backKind ?? 'thin') === bk.key}
                  onClick={() => onChange({ backKind: bk.key })}
                >
                  {bk.label}
                </Pill>
              ))}
            </Row>
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
                {[200, 250, 300, 350, 400].map((mm) => (
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
                <span className="text-[10px] text-stone-400">ס״מ</span>
              </label>
            </>
          )}

          <FinishPicker
            label="גוון החזיתות"
            finishes={frontFinishes}
            value={unit.frontFinishId ?? unit.finishId}
            onChange={(id) => onChange({ frontFinishId: id, finishId: id })}
            onApplyAll={(id) => onApplyFinishAll('front', id)}
            onAddBoard={() => setNewBoardRole('front')}
          />

          <FinishPicker
            label="גוון הגוף"
            finishes={carcassFinishes}
            value={unit.carcassFinishId}
            onChange={(id) => onChange({ carcassFinishId: id })}
            onApplyAll={(id) => onApplyFinishAll('carcass', id)}
            onAddBoard={() => setNewBoardRole('carcass')}
          />

          <FinishPicker
            label="גוון הדפנות הזרות"
            finishes={frontFinishes}
            value={unit.exposedFinishId}
            onChange={(id) => onChange({ exposedFinishId: id })}
            onApplyAll={(id) => onApplyFinishAll('exposed', id)}
            onAddBoard={() => setNewBoardRole('front')}
          />

          {carcassFinishes.length + frontFinishes.length === 0 && (
            <p className="mt-1 text-[10px] text-stone-400">
              אין עדיין גוונים. אפשר להוסיף לוח כאן, או להגדיר אותם בהגדרות.
            </p>
          )}

          <Row label="דפנות זרות" hint={`עמוקות ב-${MATERIAL.exposedExtraMm} מ״מ מהארגז`}>
            {SIDES.map((s) => (
              <Pill key={s.key} active={!!exposed[s.key]} onClick={() => toggleSide(s.key)}>
                {s.label}
              </Pill>
            ))}
          </Row>

          {/*
            ויטרינה: צד שעשוי זכוכית במקום לוח. הצד יוצא מפירוק
            הפלטות ונכנס לרשימת הזכוכית, ולארון נשארים הגב, הצד
            השני, והתחתית והתקרה.
          */}
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

      <Row label="פס לד">
        {LED_SPOTS.map((s) => (
          <Pill key={s.key} active={led.includes(s.key)} onClick={() => toggleLed(s.key)}>
            {s.label}
          </Pill>
        ))}
      </Row>

      <div className="mt-3 flex items-stretch gap-2">
        <button
          onClick={() =>
            /* תחתית הארגז היא yMm, והרגליים כלולות בגובה — ולכן ארגז
               שנצמד לרצפה יושב על 0 ולא על גובה הרגליים */
            onChange({ floorLocked: !locked, ...(locked ? {} : { yMm: 0 }) })
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

    {newBoardRole && (
      <BoardSheet
        board={null}
        initialRole={newBoardRole}
        onClose={() => setNewBoardRole(null)}
      />
    )}

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
  onChange,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
  value: number;
  onChange: (mm: number) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      <span className="block text-center text-[10px] leading-tight opacity-70">{label}</span>
      <MeasureInput
        value={value}
        onChange={onChange}
        onFocus={onSelect}
        minMm={50}
        ariaLabel={label}
        className="num block w-full bg-transparent text-center text-sm leading-tight font-semibold focus:outline-none"
      />
    </div>
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

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`num min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
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
