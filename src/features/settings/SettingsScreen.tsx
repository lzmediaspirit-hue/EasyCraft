import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { settingsRepo } from '../../materials/materialsRepo';
import { MaterialSheet } from './MaterialSheet';
import { FinishSheet } from './FinishSheet';
import { CabinetsSheet } from './CabinetsSheet';
import { ExtrasSection } from './ExtrasSection';
import { Page, ScreenHeader } from '../../ui/Page';
import { nav } from '../../nav/navigation';
import { Field, MoneyInput, NumField, PriceField, inputClass, selectOnFocus } from '../../ui/Field';
import { displayUnit } from '../../ui/units';
import { useDisplayUnit } from '../../ui/useDisplayUnit';
import { ArchiveIcon, ChevronIcon, PlusIcon, SheetIcon, TeamIcon } from '../../ui/icons';
import { PART_ROLES } from '../../db/types';
import type { BackKind, Finish, Material } from '../../db/types';
import { useMaterialsAndFinishes } from '../../materials/useMaterials';

/** סוגי הגב, כברירת מחדל לכל ארגז חדש. */
const BACK_KINDS: { key: BackKind; label: string }[] = [
  { key: 'thin', label: 'גב דק בחריץ' },
  { key: 'carcass', label: 'בעובי הגוף' },
  { key: 'none', label: 'ללא גב' },
];


/**
 * הגדרות העסק: הלוחות שעובדים איתם, וההנחות שמאחורי חישוב הפלטות.
 * מה שנקבע כאן חל על כל הפרויקטים, אלא אם נדרס בפרויקט מסוים.
 */
export function SettingsScreen() {
  const [editingMaterial, setEditingMaterial] = useState<Material | 'new' | null>(null);
  const [editingFinish, setEditingFinish] = useState<Finish | 'new' | null>(null);
  const [cabinets, setCabinets] = useState(false);
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const { materials, finishes } = useMaterialsAndFinishes();

  const unit = useDisplayUnit();

  if (!settings || !materials || !finishes) return null;

  /*
   * הגוונים מקובצים לפי מרקם, בסדר אלפביתי, וגוון בלי מרקם יורד
   * לסוף: הוא לא קטגוריה אלא חוסר, ומקומו אחרי מה שכן מסודר.
   */
  const NO_TEXTURE = 'בלי מרקם';
  const groups = new Map<string, typeof finishes>();
  for (const f of finishes) {
    const key = f.texture || NO_TEXTURE;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const byTexture = [...groups.entries()].sort(([a], [b]) =>
    a === NO_TEXTURE ? 1 : b === NO_TEXTURE ? -1 : a.localeCompare(b, 'he'),
  );

  return (
    <Page>
      <ScreenHeader title="הגדרות" subtitle="צוות, גוונים, לוחות וחישוב" />

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

        {/*
          הגוון הוא מה שהלקוח בוחר ומה שמזמינים לפי שם, ולכן הוא
          הרשימה הראשית. החומר הוא הבסיס שעליו הגוון יושב, והמחיר
          יושב בהצטלבות שביניהם.
        */}
        <section>
          <SectionTitle>גוונים</SectionTitle>
          {/*
            הגוונים מקובצים לפי מרקם. ככה הם עומדים במחסן וככה מדברים
            עליהם — "היער", "המט" — ורשימה ארוכה של שמות בלי חלוקה
            אילצה לקרוא את כולה כדי למצוא אחד. מרקם בלי שם יורד לסוף,
            כי הוא לא קטגוריה אלא חוסר.
          */}
          {byTexture.map(([texture, group]) => (
            <div key={texture} className="mb-3 last:mb-0">
              <h3 className="mb-1.5 flex items-baseline gap-2 px-1">
                <span className="text-[13px] font-semibold text-stone-600">{texture}</span>
                <span className="num text-[11px] text-stone-400">{group.length}</span>
              </h3>
              <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                {group.map((f) => {
                  const on = materials.filter((m) => f.prices?.[m.id] !== undefined);
                  return (
                    <li key={f.id}>
                      <button
                        onClick={() => setEditingFinish(f)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-stone-50"
                      >
                        <span
                          aria-hidden="true"
                          className="size-8 shrink-0 rounded-lg border border-stone-200"
                          style={{ background: f.hex }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-stone-900">
                            {f.name}
                          </span>
                          <span className="block truncate text-xs text-stone-500">
                            {on.length ? on.map((m) => m.name).join(' · ') : 'עוד בלי מחיר לאף חומר'}
                            {f.hasGrain && <span className="text-stone-400"> · סיבים</span>}
                          </span>
                        </span>
                        <ChevronIcon className="size-4 shrink-0 text-stone-300" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <button
            onClick={() => setEditingFinish('new')}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
          >
            <PlusIcon className="size-4" />
            גוון חדש
          </button>
        </section>

        <section>
          <SectionTitle>לוחות</SectionTitle>
          {/*
            לוח מורכב משניים: ליבה וגוון. כאן יושבות הליבות — הגוף
            הפיזי, העובי והצבע שהוא מגיע בהם. הגוון מודבק עליהן,
            והמחיר יושב בהצטלבות שביניהם.
          */}
          <p className="mb-2 text-xs leading-snug text-stone-500">
            ליבה היא הגוף הפיזי של הלוח — סנדוויץ׳, MDF או דיקט. הגוון הוא מה
            שמודבק עליה, וצבע ומרקם יחד קובעים אותו.
          </p>
          <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {materials.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setEditingMaterial(m)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-stone-50"
                >
                  <SheetIcon className="size-5 shrink-0 text-stone-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-900">
                      {m.name}
                    </span>
                    {/* מה הלוח משמש, כדי שהרשימה תיקרא כמו המחסן ולא כמו טבלה */}
                    {m.roles?.length ? (
                      <span className="block truncate text-[11px] text-stone-400">
                        {m.roles.map((r) => PART_ROLES.find((x) => x.key === r)?.label).join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <ChevronIcon className="size-4 shrink-0 text-stone-300" />
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setEditingMaterial('new')}
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
              <MoneyInput
                value={settings.edgeConsumerPerM || ''}
                onChange={(raw) => settingsRepo.save({ edgeConsumerPerM: Number(raw) || 0 })}
              />
            </Field>
            <Field label="קנט במפעל" hint="₪ למטר">
              <MoneyInput
                value={settings.edgeFactoryPerM || ''}
                onChange={(raw) => settingsRepo.save({ edgeFactoryPerM: Number(raw) || 0 })}
              />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle>חישוב פלטות</SectionTitle>
          <p className="mb-2 text-xs leading-snug text-stone-400">
            מידת הפלטה נקבעת לכל חומר בנפרד, כי היא מאפיין של המוצר אצל הספק.
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
              help="משמש רק ללוח שלא נקבע לו עובי משלו. ללוח שיש לו עובי — העובי שלו הוא שקובע את החיתוך, כי הוא זה שיושב במסור."
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

          {/*
            סוג הגב הוא דרך עבודה של הנגרייה ולא החלטה לכל ארגז,
            ולכן הוא נקבע פעם אחת. ארגז שצריך אחרת משנה אצלו.

            נכתב אל `defaults.backKind` — אותו שדה שממנו נולד כל ארגז
            חדש. קודם נכתב לשדה נפרד בשם דומה, ולכן הבחירה כאן נשמרה
            ולא השפיעה: הארגזים המשיכו לקבל גב דק.
          */}
          <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4">
            <span className="mb-2 block text-sm font-medium text-stone-700">
              הגב של ארגז חדש
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BACK_KINDS.map((b) => (
                <button
                  key={b.key}
                  onClick={() =>
                    settingsRepo.save({ defaults: { ...settings.defaults, backKind: b.key } })
                  }
                  aria-pressed={settings.defaults.backKind === b.key}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    settings.defaults.backKind === b.key
                      ? 'bg-oak-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs leading-snug text-stone-500">
            עובי הלוח עצמו אינו נשמר בהגדרת החומר — הוא משתנה בין משלוחים ונקבע
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
              <PriceField
                label="מפעל"
                value={settings.glassFactoryPerM2}
                onChange={(v) => settingsRepo.save({ glassFactoryPerM2: v })}
              />
              <PriceField
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

        {/*
          ארגז שנבנה בנגרייה הזאת הוא נכס שלה, והוא צריך דלת החוצה:
          למכשיר שני, לנגר אחר, או בחזרה אחרי שהוחלף משהו.
        */}
        <section>
          <SectionTitle>ארגזים</SectionTitle>
          <button
            onClick={() => setCabinets(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-start transition-colors hover:border-oak-400"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-oak-100 text-oak-700">
              <ArchiveIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-stone-900">שמירה והעברה של ארגזים</span>
              <span className="block text-xs leading-snug text-stone-500">
                להוציא את הארגזים לקובץ, ולהכניס ארגזים שקיבלת
              </span>
            </span>
            <ChevronIcon className="size-4 shrink-0 rotate-180 text-stone-300" />
          </button>
        </section>

        <section>
          <SectionTitle>תוספות משלך</SectionTitle>
          <ExtrasSection settings={settings} />
          <p className="mt-2 text-xs leading-snug text-stone-500">
            כל תוספת יודעת לפי מה היא נספרת, ולכן היא מתעדכנת לבד בכל פרויקט.
          </p>
        </section>
      </main>

      {editingFinish && (
        <FinishSheet
          finish={editingFinish === 'new' ? null : editingFinish}
          onClose={() => setEditingFinish(null)}
        />
      )}

      {cabinets && <CabinetsSheet onClose={() => setCabinets(false)} />}

      {editingMaterial && (
        <MaterialSheet
          material={editingMaterial === 'new' ? null : editingMaterial}
          onClose={() => setEditingMaterial(null)}
        />
      )}
    </Page>
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
        <PriceField label="מפעל" value={factory} onChange={(v) => onChange(v, consumer)} />
        <PriceField label="צרכן" value={consumer} onChange={(v) => onChange(factory, v)} />
      </div>
    </div>
  );
}
