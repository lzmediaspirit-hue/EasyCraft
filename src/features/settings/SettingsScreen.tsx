import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { boardsRepo, finishesRepo, settingsRepo } from '../../materials/materialsRepo';
import { BoardSheet } from './BoardSheet';
import { ExtrasSection } from './ExtrasSection';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { nav } from '../../nav/navigation';
import { Field, NumField, inputClass, selectOnFocus } from '../../ui/Field';
import { displayUnit } from '../../ui/units';
import { useDisplayUnit } from '../../ui/useDisplayUnit';
import { ChevronIcon, PlusIcon, TeamIcon } from '../../ui/icons';
import { BOARD_MATERIALS } from '../../db/types';
import type { Board } from '../../db/types';


/**
 * הגדרות העסק: הלוחות שעובדים איתם, וההנחות שמאחורי חישוב הפלטות.
 * מה שנקבע כאן חל על כל הפרויקטים, אלא אם נדרס בפרויקט מסוים.
 */
export function SettingsScreen() {
  const [editing, setEditing] = useState<Board | 'new' | null>(null);
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const boards = useLiveQuery(() => boardsRepo.list(), []);
  const finishCounts = useLiveQuery(async () => {
    const all = await finishesRepo.all();
    return all.reduce<Record<string, number>>((acc, f) => {
      acc[f.boardId] = (acc[f.boardId] ?? 0) + 1;
      return acc;
    }, {});
  }, []);

  const unit = useDisplayUnit();

  if (!settings || !boards) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <ScreenHeader title="הגדרות" subtitle="צוות, לוחות, גוונים וחישוב" />

      <main className="flex-1 space-y-8 px-5 pt-5 pb-28">
        <section>
          <SectionTitle>צוות</SectionTitle>
          <button
            onClick={() => nav.push({ name: 'team' })}
            className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-start transition-colors hover:border-oak-400"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-oak-100 text-oak-700">
              <TeamIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-stone-900">אנשי הצוות</span>
              <span className="block text-xs leading-snug text-stone-500">
                מנהל, תכנת ונגרים — ומי מחובר במכשיר הזה
              </span>
            </span>
            <ChevronIcon className="size-4 shrink-0 rotate-180 text-stone-300" />
          </button>
        </section>

        <section>
          <SectionTitle>לוחות</SectionTitle>
          <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  onClick={() => setEditing(board)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-stone-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-900">
                      {board.name}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {BOARD_MATERIALS.find((m) => m.key === board.material)?.label}
                      {board.catalogNumber && <span className="num"> · {board.catalogNumber}</span>}
                      {!!finishCounts?.[board.id] && (
                        <span> · {finishCounts[board.id]} גוונים</span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="num block text-sm font-medium text-stone-800">
                      {board.consumerPrice > 0 ? `₪${board.consumerPrice}` : '—'}
                    </span>
                    <span className="block text-[10px] text-stone-400">לצרכן</span>
                  </span>
                  <ChevronIcon className="size-4 shrink-0 text-stone-300" />
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setEditing('new')}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-4" />
            לוח חדש
          </button>
        </section>

        <section>
          <SectionTitle>יחידות</SectionTitle>
          {/*
            הכול נשמר תמיד במ"מ; זו רק שפת התצוגה. רוב הנגרים מדברים
            בסנטימטרים, ובשרטוט מדויק נוח יותר במ"מ.
          */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <span className="mb-2 block text-sm font-medium text-stone-700">מידות מוצגות ב־</span>
            <div className="flex gap-1.5">
              {(['cm', 'mm'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => displayUnit.set(u)}
                  aria-pressed={unit === u}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    unit === u ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {u === 'cm' ? 'סנטימטרים' : 'מילימטרים'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-stone-400">
              האחסון והחישוב תמיד במ״מ. הבחירה משנה רק את מה שנראה על המסך.
            </p>
          </div>
        </section>

        <section>
          <SectionTitle>מחיר ומע״מ</SectionTitle>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <Field label="מע״מ" hint="%">
              <input
                value={settings.vatPct}
                onChange={(e) => settingsRepo.save({ vatPct: Number(e.target.value) || 0 })}
                onFocus={selectOnFocus}
                type="number"
                inputMode="decimal"
                className={`${inputClass} num text-end`}
              />
            </Field>
            <Field label="קנט לצרכן" hint="₪ למטר">
              <input
                value={settings.edgeConsumerPerM || ''}
                onChange={(e) =>
                  settingsRepo.save({ edgeConsumerPerM: Number(e.target.value) || 0 })
                }
                onFocus={selectOnFocus}
                type="number"
                inputMode="decimal"
                placeholder="₪"
                className={`${inputClass} num text-end`}
              />
            </Field>
            <Field label="קנט במפעל" hint="₪ למטר">
              <input
                value={settings.edgeFactoryPerM || ''}
                onChange={(e) =>
                  settingsRepo.save({ edgeFactoryPerM: Number(e.target.value) || 0 })
                }
                onFocus={selectOnFocus}
                type="number"
                inputMode="decimal"
                placeholder="₪"
                className={`${inputClass} num text-end`}
              />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle>חישוב פלטות</SectionTitle>
          <p className="mb-2 text-xs leading-snug text-stone-400">
            מידת הפלטה נקבעת לכל לוח בנפרד, כי היא מאפיין של המוצר אצל הספק.
          </p>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <NumField
              label="עובי כרסום"
              inMm
              value={settings.kerfMm}
              onChange={(v) => settingsRepo.save({ kerfMm: v })}
            />
            <NumField
              label="עובי גוף לחישוב"
              inMm
              value={settings.carcassThicknessMm}
              onChange={(v) => settingsRepo.save({ carcassThicknessMm: v })}
            />
            <NumField
              label="שקע הגב בחריץ"
              inMm
              help="הגב לא מולבש על הארון אלא יושב בחריץ שנחרץ בצדדים, בתחתית ובתקרה. לכן הוא נחתך גדול מהפתח הפנימי — בעומק החריץ מכל צד. 8 מ״מ הוא הנפוץ."
              value={settings.backGrooveMm}
              onChange={(v) => settingsRepo.save({ backGrooveMm: v })}
            />
            <NumField
              label="מרווח סביב חזית"
              inMm
              help="דלת או חזית מגירה נחתכת קטנה מהפתח, כדי שיישאר אוויר לצירים ולא תתחכך בשכנה. המרווח נלקח מכל צד. 3 מ״מ הוא הנפוץ."
              value={settings.frontGapMm}
              onChange={(v) => settingsRepo.save({ frontGapMm: v })}
            />
          </div>

          <label className="mt-3 block rounded-2xl border border-stone-200 bg-white p-4">
            <span className="mb-1.5 flex items-baseline gap-2">
              <span className="text-sm font-medium text-stone-700">ניצולת פלטה</span>
              <span className="num text-xs text-stone-400">{settings.yieldPct}%</span>
            </span>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={settings.yieldPct}
              onChange={(e) => settingsRepo.save({ yieldPct: Number(e.target.value) })}
              className="w-full accent-oak-600"
            />
            <span className="mt-1.5 block text-xs leading-snug text-stone-500">
              אחוז הפלטה שבאמת הופך לחלקים. זו הערכה עד שייכנס מנוע ניצול לוח,
              ואז המספר ייגזר מהניסורים בפועל.
            </span>
          </label>

          <p className="mt-3 text-xs leading-snug text-stone-500">
            עובי הלוח עצמו אינו נשמר בהגדרת הלוח — הוא משתנה בין משלוחים ונקבע
            מול הלוח הפיזי. העובי כאן משמש רק לגזירת רוחב התחתית והתקרה.
          </p>
        </section>
        <section>
          <SectionTitle>מחירי אביזרים</SectionTitle>
          <div className="space-y-2">
            <AccessoryRow
              label="מגירה"
              unit="ליחידה"
              factory={settings.accessories.drawerFactory}
              consumer={settings.accessories.drawerConsumer}
              onChange={(factory, consumer) =>
                settingsRepo.save({
                  accessories: {
                    ...settings.accessories,
                    drawerFactory: factory,
                    drawerConsumer: consumer,
                  },
                })
              }
            />
            <AccessoryRow
              label="פס לד"
              unit="למטר רץ"
              factory={settings.accessories.ledFactory}
              consumer={settings.accessories.ledConsumer}
              onChange={(factory, consumer) =>
                settingsRepo.save({
                  accessories: {
                    ...settings.accessories,
                    ledFactory: factory,
                    ledConsumer: consumer,
                  },
                })
              }
            />
            <AccessoryRow
              label="מנגנון קלאפה"
              unit="ליחידה"
              factory={settings.accessories.liftFactory}
              consumer={settings.accessories.liftConsumer}
              onChange={(factory, consumer) =>
                settingsRepo.save({
                  accessories: {
                    ...settings.accessories,
                    liftFactory: factory,
                    liftConsumer: consumer,
                  },
                })
              }
            />
          </div>

          <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-stone-800">דלת זכוכית</span>
              <span className="text-[11px] text-stone-400">למ״ר</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PriceBox
                label="מפעל"
                value={settings.glassFactoryPerM2}
                onChange={(v) => settingsRepo.save({ glassFactoryPerM2: v })}
              />
              <PriceBox
                label="צרכן"
                value={settings.glassConsumerPerM2}
                onChange={(v) => settingsRepo.save({ glassConsumerPerM2: v })}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
              דלתות זכוכית נספרות לפי שטח ולא נכללות בכמות הפלטות.
            </p>
          </div>
        </section>

        <section>
          <SectionTitle>תוספות משלך</SectionTitle>
          <ExtrasSection settings={settings} />
          <p className="mt-2 text-xs leading-snug text-stone-500">
            כל תוספת יודעת לפי מה היא נספרת, ולכן היא מתעדכנת לבד בכל פרויקט.
          </p>
        </section>
      </main>

      {editing && (
        <BoardSheet
          board={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold text-stone-500">{children}</h2>;
}

/** מחיר אביזר: במפעל ולצרכן, באותה שורה. */
function AccessoryRow({
  label,
  unit,
  factory,
  consumer,
  onChange,
}: {
  label: string;
  unit: string;
  factory: number;
  consumer: number;
  onChange: (factory: number, consumer: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-stone-800">{label}</span>
        <span className="text-[11px] text-stone-400">{unit}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <PriceBox label="מפעל" value={factory} onChange={(v) => onChange(v, consumer)} />
        <PriceBox label="צרכן" value={consumer} onChange={(v) => onChange(factory, v)} />
      </div>
    </div>
  );
}

function PriceBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl bg-stone-100 px-3 py-2">
      <span className="block text-[11px] text-stone-500">{label}</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onFocus={selectOnFocus}
        type="number"
        inputMode="decimal"
        placeholder="₪"
        className="num w-full bg-transparent text-base font-medium text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
    </label>
  );
}
