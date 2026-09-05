import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { cmToMm, mmToCm } from '../../ui/units';
import { ROOMS, roomDef } from '../../catalog/rooms';
import { WALL_LAYOUTS, wallName } from './wallLayouts';
import { WallFeaturesDesigner } from './WallFeaturesDesigner';
import { RoomShapeEditor, shapeWalls, type ShapePoint } from './RoomShapeEditor';
import { ProjectFinishesStep } from './ProjectFinishesStep';
import { projectsRepo, type NewWallInput } from './projectsRepo';
import { DEFAULT_WALL_HEIGHT, DEFAULT_WALL_LENGTH } from '../../catalog/standards';
import {
  BedroomIcon,
  CustomRoomIcon,
  KitchenIcon,
  LivingIcon,
} from '../../ui/icons';
import type { PartChoice, PartRole, RoomKind, WallFeature } from '../../db/types';

type Step =
  | 'room'
  | 'name'
  | 'layout'
  | 'shape'
  | 'order'
  | 'condition'
  | 'dims'
  | 'finishes'
  | 'features';

/** מנרמל זווית לטווח (-180, 180]. */
const norm = (deg: number): number => {
  let d = ((deg + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return Math.round(d);
};

const ROOM_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  kitchen: KitchenIcon,
  living: LivingIcon,
  bedroom: BedroomIcon,
  custom: CustomRoomIcon,
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
  const [roomKind, setRoomKind] = useState<RoomKind>('kitchen');
  const [name, setName] = useState('');
  const [wallCount, setWallCount] = useState(1);
  const [marksFeatures, setMarksFeatures] = useState(false);
  const [heightCm, setHeightCm] = useState(String(mmToCm(DEFAULT_WALL_HEIGHT)));
  const [lengthsCm, setLengthsCm] = useState<string[]>([String(mmToCm(DEFAULT_WALL_LENGTH))]);
  const [features, setFeatures] = useState<WallFeature[][]>([[]]);
  /* צורת חדר שמשרטטים, כשהפריסות המוכנות לא מתארות אותו */
  const [shape, setShape] = useState<ShapePoint[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [reversed, setReversed] = useState(false);
  const [turns, setTurns] = useState<number[]>([]);
  const [defaults, setDefaults] = useState<Partial<Record<PartRole, PartChoice>>>({});
  const [saving, setSaving] = useState(false);

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
    setName(kind === 'custom' ? '' : roomDef(kind).label);
    setStep(kind === 'custom' ? 'name' : 'layout');
  }

  function pickLayout(walls: number) {
    if (walls === 0) {
      setStep('shape');
      return;
    }
    setTurns([]);
    setWallCount(walls);
    setLengthsCm((prev) =>
      Array.from({ length: walls }, (_, i) => prev[i] ?? String(mmToCm(DEFAULT_WALL_LENGTH))),
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
        return () => setStep(roomKind === 'custom' ? 'name' : 'room');
      case 'shape':
        return () => setStep('layout');
      case 'order':
        return () => setStep('shape');
      case 'condition':
        return () => setStep(turns.length ? 'order' : 'layout');
      case 'dims':
        return () => setStep('condition');
      case 'finishes':
        return () => setStep('dims');
      case 'features':
        return () => setStep('finishes');
    }
  }

  /* ---- שמירה ---- */

  const heightMm = cmToMm(Number(heightCm) || 0);
  const dimsValid =
    heightMm >= 1500 &&
    lengthsCm.slice(0, wallCount).every((l) => cmToMm(Number(l) || 0) >= 300);

  async function save() {
    if (saving) return;
    setSaving(true);
    const walls: NewWallInput[] = Array.from({ length: wallCount }, (_, i) => ({
      lengthMm: cmToMm(Number(lengthsCm[i]) || 0),
      heightMm,
      features: features[i] ?? [],
      // פנייה נשמרת רק לחדר ששורטט; פריסה מוכנה היא תמיד פינות ישרות
      turnDeg: turns[i],
    }));
    const project = await projectsRepo.create({
      customerId,
      name: name.trim() || roomDef(roomKind).label,
      roomKind,
      walls,
      defaults,
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
    finishes: 'גוונים לפרויקט',
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
      <PrimaryButton disabled={!dimsValid} onClick={() => setStep('finishes')}>
        המשך לגוונים
      </PrimaryButton>
    ) : step === 'finishes' ? (
      <PrimaryButton
        disabled={saving}
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
          {ROOMS.map((room) => {
            const Icon = ROOM_ICONS[room.icon];
            return (
              <button
                key={room.kind}
                onClick={() => pickRoom(room.kind)}
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
        <div className="grid grid-cols-2 gap-3">
          {WALL_LAYOUTS.map((layout) => (
            <button
              key={layout.walls}
              onClick={() => pickLayout(layout.walls)}
              className={`flex flex-col items-start gap-2 rounded-2xl border bg-white p-4 text-start transition-colors hover:border-oak-400 hover:bg-oak-50 ${
                wallCount === layout.walls ? 'border-oak-400' : 'border-stone-200'
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

      {step === 'finishes' && (
        <ProjectFinishesStep value={defaults} onChange={setDefaults} />
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
        <div className="space-y-5">
          <Field label="גובה החדר" hint='ס"מ'>
            <input
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              onFocus={selectOnFocus}
              type="number"
              inputMode="numeric"
              className={`${inputClass} num text-end`}
            />
          </Field>

          <div className="space-y-4 border-t border-stone-100 pt-5">
            {Array.from({ length: wallCount }, (_, i) => (
              <Field key={i} label={`אורך ${wallName(i)}`} hint='ס"מ'>
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
                  className={`${inputClass} num text-end`}
                />
              </Field>
            ))}
          </div>
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
                wallHeightMm={heightMm}
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
