import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { cmToMm, mmToCm } from '../../ui/units';
import { ROOMS, roomDef } from '../../catalog/rooms';
import { WALL_LAYOUTS, wallName } from './wallLayouts';
import { FEATURE_DEFS, featureDef } from './wallFeatures';
import { projectsRepo, type NewWallInput } from './projectsRepo';
import { DEFAULT_WALL_HEIGHT, DEFAULT_WALL_LENGTH } from '../../catalog/standards';
import {
  BedroomIcon,
  CustomRoomIcon,
  KitchenIcon,
  LivingIcon,
  PlusIcon,
  TrashIcon,
} from '../../ui/icons';
import type { RoomKind, WallFeature, WallFeatureKind } from '../../db/types';

type Step = 'room' | 'name' | 'layout' | 'condition' | 'dims' | 'features';

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
  const [saving, setSaving] = useState(false);

  /* ---- מעבר בין שלבים ---- */

  function pickRoom(kind: RoomKind) {
    setRoomKind(kind);
    setName(kind === 'custom' ? '' : roomDef(kind).label);
    setStep(kind === 'custom' ? 'name' : 'layout');
  }

  function pickLayout(walls: number) {
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
      case 'condition':
        return () => setStep('layout');
      case 'dims':
        return () => setStep('condition');
      case 'features':
        return () => setStep('dims');
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

  function addFeature(wallIndex: number, kind: WallFeatureKind) {
    const def = featureDef(kind);
    setFeatures((prev) => {
      const next = prev.map((f) => [...f]);
      next[wallIndex] = [
        ...(next[wallIndex] ?? []),
        { id: crypto.randomUUID(), kind, xMm: 0, yMm: def.y, widthMm: def.w, heightMm: def.h },
      ];
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
    condition: 'מה יש על הקיר?',
    dims: 'מידות הקירות',
    features: 'סימון על הקיר',
  };

  const footer =
    step === 'name' ? (
      <PrimaryButton disabled={!name.trim()} onClick={() => setStep('layout')}>
        המשך
      </PrimaryButton>
    ) : step === 'dims' ? (
      <PrimaryButton
        disabled={!dimsValid}
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

              <div className="space-y-2">
                {(features[i] ?? []).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2"
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: featureDef(f.kind).tone }}
                    />
                    <span className="w-20 shrink-0 truncate text-sm text-stone-700">
                      {featureDef(f.kind).label}
                    </span>
                    <MiniNumber
                      label="מ-"
                      value={mmToCm(f.xMm)}
                      onChange={(v) => patchFeature(i, f.id, { xMm: cmToMm(v) })}
                    />
                    <MiniNumber
                      label="רוחב"
                      value={mmToCm(f.widthMm)}
                      onChange={(v) => patchFeature(i, f.id, { widthMm: cmToMm(v) })}
                    />
                    <button
                      onClick={() => removeFeature(i, f.id)}
                      aria-label="הסרה"
                      className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {FEATURE_DEFS.map((def) => (
                  <button
                    key={def.kind}
                    onClick={() => addFeature(i, def.kind)}
                    className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-oak-400 hover:text-oak-700"
                  >
                    <PlusIcon className="size-3" />
                    {def.label}
                  </button>
                ))}
              </div>
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

function MiniNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-stone-100 px-2 py-1">
      <span className="shrink-0 text-[11px] text-stone-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onFocus={selectOnFocus}
        type="number"
        inputMode="numeric"
        className="num w-full min-w-0 bg-transparent text-end text-sm text-stone-800 focus:outline-none"
      />
    </label>
  );
}
