import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { cmToMm, mmToCm } from '../../ui/units';
import { CUSTOM_ROOM_DEF } from '../../catalog/rooms';
import { roomDef, roomsRepo } from '../../catalog/roomsRepo';
import { ASK_COUNT, WALL_COUNTS, WALL_LAYOUTS, wallName } from './wallLayouts';
import { WallFeaturesDesigner } from './WallFeaturesDesigner';
import { RoomShapeEditor, shapeWalls, type ShapePoint } from './RoomShapeEditor';
import { projectsRepo, type NewWallInput } from './projectsRepo';
import { settingsRepo } from '../../materials/materialsRepo';
import { DEFAULT_WALL_HEIGHT, DEFAULT_WALL_LENGTH } from '../../catalog/standards';
import { DEFAULT_TURN_DEG } from '../design/plan';
import { roomIcon } from '../../ui/icons';
import { CUSTOM_ROOM, type RoomKind, type WallFeature } from '../../db/types';

type Step =
  | 'room'
  | 'name'
  | 'layout'
  | 'shape'
  | 'order'
  | 'condition'
  | 'dims'
  | 'features';

/** מנרמל זווית לטווח (-180, 180]. */
const norm = (deg: number): number => {
  let d = ((deg + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return Math.round(d);
};

/**
 * יצירת פרויקט — שאלה אחת בכל מסך.
 * חדר ← פריסת קירות ← מה יש על הקיר ← מידות.
 */
export function NewProjectWizard({
  customerId,
  onClose,
  onCreated,
}: {
  customerId: string;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const [step, setStep] = useState<Step>('room');
  /*
   * החדרים מגיעים מהטבלה, ואחריהם תמיד "שם חדש" — כך שנגר שהוסיף
   * לעצמו חדר שירות או משרד רואה אותו כאן בלי לגעת בקוד.
   */
  const savedRooms = useLiveQuery(() => roomsRepo.all(), [], []);
  const roomChoices = [...savedRooms, CUSTOM_ROOM_DEF];
  const [roomKind, setRoomKind] = useState<RoomKind>('kitchen');
  const [name, setName] = useState('');
  const [wallCount, setWallCount] = useState(1);
  /** "כמה קירות" נבחר, והמספר עצמו עוד לא */
  const [askCount, setAskCount] = useState(false);
  const [marksFeatures, setMarksFeatures] = useState(false);
  /*
   * מידות לכל קיר בנפרד. חדר אמיתי אינו קופסה: יש בו קיר עם תקרה
   * משופעת, יש חלל שנפתח, ויש קיר נמוך שמפריד. גובה אחד לכל החדר
   * הכריח את מי שיש לו קיר אחר לתקן אותו אחר כך בהדמיה.
   */
  const [heightsCm, setHeightsCm] = useState<string[]>([String(mmToCm(DEFAULT_WALL_HEIGHT))]);
  const [lengthsCm, setLengthsCm] = useState<string[]>([String(mmToCm(DEFAULT_WALL_LENGTH))]);
  /*
   * לאיזה צד פונים הקירות הבאים. בפריסה מוכנה כל הפינות זהות, והשאלה
   * היחידה היא אם הקיר השני יוצא שמאלה או ימינה — וזו שאלה שנשאלת
   * מול החדר, לא בקוד.
   */
  const [turnSide, setTurnSide] = useState<'left' | 'right'>('right');
  const [features, setFeatures] = useState<WallFeature[][]>([[]]);
  /* צורת חדר שמשרטטים, כשהפריסות המוכנות לא מתארות אותו */
  const [shape, setShape] = useState<ShapePoint[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [reversed, setReversed] = useState(false);
  const [turns, setTurns] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  /*
   * מידות הקיר שהעסק עובד בהן. נטענות פעם אחת ורק לשדות שעוד לא
   * נגעו בהם: מי שכבר הקליד מידה לא רוצה שהיא תיעלם מתחת לידיים.
   */
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !settings) return;
    seeded.current = true;
    setHeightsCm([String(mmToCm(settings.defaults.wallHeightMm))]);
    setLengthsCm([String(mmToCm(settings.defaults.wallLengthMm))]);
  }, [settings]);

  /* ---- הקירות שנגזרים מהשרטוט, לפי הסדר שנבחר ---- */
  const drawn = shapeWalls(shape);
  const shapeClosed =
    shape.length > 3 &&
    shape[0].x === shape[shape.length - 1].x &&
    shape[0].y === shape[shape.length - 1].y;

  const ordered = (() => {
    const base = reversed
      ? [...drawn].reverse().map((w) => ({ ...w, headingDeg: w.headingDeg + 180 }))
      : drawn;
    const i = shapeClosed ? startIndex % Math.max(base.length, 1) : 0;
    return [...base.slice(i), ...base.slice(0, i)];
  })();

  /* ---- מעבר בין שלבים ---- */

  function pickRoom(kind: RoomKind) {
    setRoomKind(kind);
    setName(kind === CUSTOM_ROOM ? '' : roomDef(kind).label);
    setStep(kind === CUSTOM_ROOM ? 'name' : 'layout');
  }

  function pickLayout(walls: number) {
    if (walls === 0) {
      setAskCount(false);
      setStep('shape');
      return;
    }
    /* "כמה קירות" היא שאלה ולא תשובה — המספר נבחר מיד מתחתיה */
    if (walls === ASK_COUNT) {
      setAskCount(true);
      return;
    }
    setAskCount(false);
    setTurns([]);
    setWallCount(walls);
    /* קיר שנוסף מקבל את אותה מידה שהקיר הראשון נפתח בה */
    setLengthsCm((prev) => Array.from({ length: walls }, (_, i) => prev[i] ?? prev[0] ?? ''));
    setHeightsCm((prev) =>
      Array.from({ length: walls }, (_, i) => prev[i] ?? prev[0] ?? ''),
    );
    setFeatures((prev) => Array.from({ length: walls }, (_, i) => prev[i] ?? []));
    setStep('condition');
  }

  function pickCondition(marks: boolean) {
    setMarksFeatures(marks);
    setStep('dims');
  }

  function backFrom(current: Step): (() => void) | undefined {
    switch (current) {
      case 'room':
        return undefined;
      case 'name':
        return () => setStep('room');
      case 'layout':
        return () => setStep(roomKind === CUSTOM_ROOM ? 'name' : 'room');
      case 'shape':
        return () => setStep('layout');
      case 'order':
        return () => setStep('shape');
      case 'condition':
        return () => setStep(turns.length ? 'order' : 'layout');
      case 'dims':
        return () => setStep('condition');
      case 'features':
        return () => setStep('dims');
    }
  }

  /* ---- שמירה ---- */

  const heightAt = (i: number) => cmToMm(Number(heightsCm[i] ?? heightsCm[0]) || 0);
  const dimsValid =
    Array.from({ length: wallCount }, (_, i) => heightAt(i)).every((h) => h >= 1500) &&
    lengthsCm.slice(0, wallCount).every((l) => cmToMm(Number(l) || 0) >= 300);

  async function save() {
    if (saving) return;
    setSaving(true);
    const walls: NewWallInput[] = Array.from({ length: wallCount }, (_, i) => ({
      lengthMm: cmToMm(Number(lengthsCm[i]) || 0),
      heightMm: heightAt(i),
      features: features[i] ?? [],
      /*
       * חדר ששורטט מביא את הפניות שלו. בפריסה מוכנה כל הפינות ישרות,
       * והבחירה היחידה היא לאיזה צד — שמאלה או ימינה.
       */
      turnDeg: turns[i] ?? (turnSide === 'right' ? DEFAULT_TURN_DEG : -DEFAULT_TURN_DEG),
    }));
    const project = await projectsRepo.create({
      customerId,
      name: name.trim() || roomDef(roomKind).label,
      roomKind,
      walls,
    });
    onCreated(project.id);
  }

  /* ---- שינוי סימונים ---- */

  function addFeature(wallIndex: number, feature: WallFeature) {
    setFeatures((prev) => {
      const next = prev.map((f) => [...f]);
      next[wallIndex] = [...(next[wallIndex] ?? []), feature];
      return next;
    });
  }

  function patchFeature(wallIndex: number, id: string, patch: Partial<WallFeature>) {
    setFeatures((prev) =>
      prev.map((list, i) =>
        i === wallIndex ? list.map((f) => (f.id === id ? { ...f, ...patch } : f)) : list,
      ),
    );
  }

  function removeFeature(wallIndex: number, id: string) {
    setFeatures((prev) => prev.map((list, i) => (i === wallIndex ? list.filter((f) => f.id !== id) : list)));
  }

  /* ---- תוכן לפי שלב ---- */

  const titles: Record<Step, string> = {
    room: 'איזה חדר?',
    name: 'שם החדר',
    layout: 'כמה קירות?',
    shape: 'צורת החדר',
    order: 'סדר הקירות',
    condition: 'מה יש על הקיר?',
    dims: 'מידות הקירות',
    features: 'סימון על הקיר',
  };

  /** קובע את הקירות מהשרטוט וממשיך הלאה. */
  function acceptShape() {
    const n = ordered.length;
    setWallCount(n);
    setLengthsCm(ordered.map((w) => String(mmToCm(w.lengthMm))));
    setFeatures(Array.from({ length: n }, (_, i) => features[i] ?? []));
    setTurns(ordered.map((w, i) => (i === 0 ? 0 : norm(w.headingDeg - ordered[i - 1].headingDeg))));
    setStep('condition');
  }

  const footer =
    step === 'name' ? (
      <PrimaryButton disabled={!name.trim()} onClick={() => setStep('layout')}>
        המשך
      </PrimaryButton>
    ) : step === 'shape' ? (
      <PrimaryButton disabled={drawn.length === 0} onClick={() => setStep('order')}>
        {drawn.length === 0
          ? 'שרטט את החדר'
          : `המשך · ${drawn.length} ${drawn.length === 1 ? 'קיר' : 'קירות'}`}
      </PrimaryButton>
    ) : step === 'order' ? (
      <PrimaryButton onClick={acceptShape}>המשך</PrimaryButton>
    ) : step === 'dims' ? (
      <PrimaryButton
        disabled={!dimsValid || saving}
        onClick={() => (marksFeatures ? setStep('features') : save())}
      >
        {marksFeatures ? 'המשך לסימונים' : 'יצירת הפרויקט'}
      </PrimaryButton>
    ) : step === 'features' ? (
      <PrimaryButton disabled={saving} onClick={save}>
        יצירת הפרויקט
      </PrimaryButton>
    ) : undefined;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={backFrom(step)} footer={footer}>
      {step === 'room' && (
        <div className="grid grid-cols-2 gap-3">
          {roomChoices.map((room) => {
            const Icon = roomIcon(room.icon);
            return (
              <button
                key={room.id}
                onClick={() => pickRoom(room.id)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-start transition-colors hover:border-oak-400 hover:bg-oak-50"
              >
                <span className="text-oak-600">
                  <Icon className="size-8" />
                </span>
                <span className="font-semibold text-stone-900">{room.label}</span>
                <span className="text-xs leading-snug text-stone-500">{room.hint}</span>
              </button>
            );
          })}
        </div>
      )}

      {step === 'name' && (
        <Field label="שם החדר" hint="למשל: חדר עבודה, מרפסת, ממ״ד">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
            enterKeyHint="next"
          />
        </Field>
      )}

      {step === 'layout' && (
        <>
        <div className="grid grid-cols-2 gap-3">
          {WALL_LAYOUTS.map((layout) => (
            <button
              key={layout.walls}
              onClick={() => pickLayout(layout.walls)}
              className={`flex flex-col items-start gap-2 rounded-2xl border bg-white p-4 text-start transition-colors hover:border-oak-400 hover:bg-oak-50 ${
                /* בחירה אחת מסומנת: כשנשאל המספר, "קיר יחיד" כבר לא נבחר */
                (layout.walls === ASK_COUNT ? askCount : !askCount && wallCount === layout.walls)
                  ? 'border-oak-400'
                  : 'border-stone-200'
              }`}
            >
              <svg viewBox="0 0 40 36" className="h-10 w-14 text-oak-600" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={layout.path} />
              </svg>
              <span className="font-semibold text-stone-900">{layout.label}</span>
              <span className="text-xs text-stone-500">{layout.hint}</span>
            </button>
          ))}
        </div>
        {askCount && (
          <div className="mt-3">
            <span className="text-xs text-stone-500">כמה קירות בשרשרת?</span>
            <div className="mt-1.5 flex gap-1.5">
              {WALL_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => pickLayout(n)}
                  aria-label={`${n} קירות`}
                  className="num flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:border-oak-400 hover:bg-oak-50"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {step === 'shape' && <RoomShapeEditor points={shape} onChange={setShape} />}

      {step === 'order' && (
        <OrderStep
          walls={ordered}
          closed={shapeClosed}
          reversed={reversed}
          onReverse={() => setReversed((v) => !v)}
          onStart={(i) => setStartIndex((prev) => (prev + i) % Math.max(ordered.length, 1))}
        />
      )}

      {step === 'condition' && (
        <div className="space-y-3">
          <ConditionCard
            title="קיר נקי"
            hint="אין חלונות, שקעים או פינויים שצריך לעקוף"
            onClick={() => pickCondition(false)}
          />
          <ConditionCard
            title="יש מה לסמן"
            hint="חלונות, דלתות, שקעים, נקודות מים, עמודים או נישות"
            onClick={() => pickCondition(true)}
          />
        </div>
      )}

      {step === 'dims' && (
        <div className="space-y-4">
          {/*
            מידות לכל קיר בנפרד: חדר אמיתי אינו קופסה, ויש בו קיר
            שנמוך מהשאר או ארוך מהשאר. גובה אחד לכל החדר הכריח לתקן
            את החריג אחר כך.
          */}
          {Array.from({ length: wallCount }, (_, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-3">
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{wallName(i)}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="אורך" hint='ס"מ'>
                  <input
                    value={lengthsCm[i] ?? ''}
                    onChange={(e) =>
                      setLengthsCm((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    onFocus={selectOnFocus}
                    type="number"
                    inputMode="numeric"
                    aria-label={`אורך ${wallName(i)}`}
                    className={`${inputClass} num text-end`}
                  />
                </Field>
                <Field label="גובה" hint='ס"מ'>
                  <input
                    value={heightsCm[i] ?? heightsCm[0] ?? ''}
                    onChange={(e) =>
                      setHeightsCm((prev) => {
                        const next = Array.from(
                          { length: Math.max(prev.length, i + 1) },
                          (_, k) => prev[k] ?? prev[0] ?? '',
                        );
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    onFocus={selectOnFocus}
                    type="number"
                    inputMode="numeric"
                    aria-label={`גובה ${wallName(i)}`}
                    className={`${inputClass} num text-end`}
                  />
                </Field>
              </div>
            </div>
          ))}

          {/*
            לאיזה צד יוצא הקיר הבא. בפריסה מוכנה כל הפינות ישרות,
            והשאלה היחידה היא הכיוון — וזו שאלה שנשאלת מול החדר.
          */}
          {wallCount > 1 && drawn.length === 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-3">
              <h3 className="mb-1.5 text-sm font-semibold text-stone-700">
                {wallCount === 2 ? 'לאן פונה הקיר השני' : 'לאן פונים הקירות'}
              </h3>
              <div className="flex gap-1.5">
                {(['right', 'left'] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setTurnSide(side)}
                    aria-pressed={turnSide === side}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      turnSide === side
                        ? 'bg-oak-600 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {side === 'right' ? 'ימינה' : 'שמאלה'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
                עומדים מול {wallName(0)} — ומשם החדר ממשיך לכיוון שנבחר.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 'features' && (
        <div className="space-y-6">
          {Array.from({ length: wallCount }, (_, i) => (
            <section key={i}>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{wallName(i)}</h3>

              <WallFeaturesDesigner
                features={features[i] ?? []}
                wallLengthMm={cmToMm(Number(lengthsCm[i]) || 0)}
                wallHeightMm={heightAt(i)}
                onAdd={(f) => addFeature(i, f)}
                onPatch={(id, patch) => patchFeature(i, id, patch)}
                onRemove={(id) => removeFeature(i, id)}
              />
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function ConditionCard({
  title,
  hint,
  onClick,
}: {
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-start transition-colors hover:border-oak-400 hover:bg-oak-50"
    >
      <span className="block font-semibold text-stone-900">{title}</span>
      <span className="mt-0.5 block text-sm leading-snug text-stone-500">{hint}</span>
    </button>
  );
}


/**
 * סדר הקירות בחדר ששורטט.
 *
 * הקירות משורשרים, ולכן "קיר א׳" הוא לא בחירה חופשית אלא נקודת
 * התחלה: בחדר סגור אפשר להתחיל מכל קיר, ובחדר פתוח רק מאחד משני
 * הקצוות. השאר נגזר מהשרשרת — וזה בדיוק מה שמונע מספור שלא מתאר
 * חדר אמיתי.
 */
function OrderStep({
  walls,
  closed,
  reversed,
  onReverse,
  onStart,
}: {
  walls: { lengthMm: number; headingDeg: number }[];
  closed: boolean;
  reversed: boolean;
  onReverse: () => void;
  onStart: (offset: number) => void;
}) {
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {walls.map((w, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-stone-800">
              {wallName(i)}
            </span>
            <span className="num shrink-0 text-sm text-stone-600">{mmToCm(w.lengthMm)}</span>
            <span className="shrink-0 text-[10px] text-stone-400">ס״מ</span>
            {closed && i > 0 && (
              <button
                onClick={() => onStart(i)}
                className="shrink-0 rounded-md bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-oak-700"
              >
                שיהיה ראשון
              </button>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={onReverse}
        aria-pressed={reversed}
        className="w-full rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200"
      >
        הפיכת כיוון המספור
      </button>

      <p className="text-xs leading-snug text-stone-500">
        {closed
          ? 'החדר סגור, ולכן אפשר להתחיל את המספור מכל קיר.'
          : 'החדר פתוח, ולכן המספור מתחיל מאחד משני הקצוות.'}{' '}
        המידות ניתנות לתיקון בשלב הבא.
      </p>
    </div>
  );
}
