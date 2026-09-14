import { useState } from 'react';
import { boardName, materialsRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { SheetFooter } from '../../ui/SheetFooter';
import { Chip, Field, inputClass, selectOnFocus } from '../../ui/Field';
import { CORES, PART_ROLES, SHEET_HEIGHTS_MM, SHEET_WIDTH_MM, coreOf } from '../../db/types';
import { cm, unitLabel } from '../../ui/units';
import type { CoreKind, Material, PartRole } from '../../db/types';

/**
 * ליבה — הבסיס הפיזי של הלוח.
 *
 * לוח מורכב משניים: ליבה וגוון. כאן נקבעת הליבה — סנדוויץ׳, MDF או
 * דיקט — והעובי והצבע שהיא מגיעה בהם. אין כאן צבע פני שטח ואין
 * מחיר: המחיר נקבע בהצטלבות עם הגוון, כי אותו לבן עולה אחרת על כל
 * ליבה.
 *
 * שורה כאן היא לוח שאפשר להצביע עליו במחסן, ולכן MDF 18 ו-MDF 9
 * הם שתי שורות ולא אחת עם שני עוביים.
 */
export function MaterialSheet({
  material,
  onSaved,
  onClose,
}: {
  material: Material | null;
  onSaved?: (materialId: string) => void;
  onClose: () => void;
}) {
  const [core, setCore] = useState<CoreKind | undefined>(material?.core);
  const [coreColor, setCoreColor] = useState<string | undefined>(material?.coreColor);
  const [thickness, setThickness] = useState<number | undefined>(material?.thicknessMm);
  const [sheetHeight, setSheetHeight] = useState(material?.sheetHeightMm ?? SHEET_HEIGHTS_MM[0]);
  /*
   * שם משלו, כשהנגר רוצה כזה. ריק = השם נגזר מהליבה, מהצבע ומהעובי,
   * כדי ששני אנשים שיוסיפו את אותו לוח יקראו לו אותו דבר.
   */
  const [name, setName] = useState(material?.name ?? '');
  /*
   * לאילו חלקים הלוח משמש. זו ההחלטה שקובעת אילו גוונים מוצעים
   * לגוף ואילו לחזיתות — ולכן היא נקבעת כאן, פעם אחת, ולא בכל ארגז.
   */
  const [roles, setRoles] = useState<PartRole[]>(material?.roles ?? []);
  /** מה מונע את המחיקה, כשמשהו מונע אותה */
  const [problem, setProblem] = useState<string | null>(null);

  const spec = coreOf(core);
  const auto = boardName({ core, coreColor, thicknessMm: thickness });
  const finalName = name.trim() || auto;
  const canSave = finalName.length > 0;

  /** בחירת ליבה מאפסת את מה ששייך לליבה הקודמת ולא קיים בחדשה. */
  function pickCore(key: CoreKind) {
    const next = coreOf(key);
    setCore(key);
    setThickness(next?.thicknessMm[0]);
    setCoreColor(next?.colors?.[0]);
  }

  async function save() {
    const id = await materialsRepo.save({
      id: material?.id,
      name: finalName,
      core,
      coreColor: spec?.colors ? coreColor : undefined,
      thicknessMm: thickness,
      sheetWidthMm: SHEET_WIDTH_MM,
      sheetHeightMm: sheetHeight,
      roles: roles.length ? roles : undefined,
    });
    onSaved?.(id);
    onClose();
  }

  return (
    <Sheet
      title={material ? 'עריכת לוח' : 'לוח חדש'}
      onClose={onClose}
      footer={
        <SheetFooter
          canSave={canSave}
          onSave={save}
          removeLabel="מחיקת הלוח"
          onRemove={
            material
              ? async () => {
                  /*
                   * לוח שמוצמד לארגזים אינו נמחק. מחיקה שלו הייתה
                   * משאירה בארגזים הפניה לשום דבר, והחלקים שלו היו
                   * יוצאים מהתמחור בשקט — הצעת מחיר נמוכה בלי אזהרה.
                   */
                  const used = await materialsRepo.usage(material.id);
                  if (used) {
                    setProblem(
                      `הלוח הזה מוצמד ל-${used} ארגזים. החלף אותם ללוח אחר, ואז אפשר יהיה למחוק אותו.`,
                    );
                    return;
                  }
                  await materialsRepo.remove(material.id);
                  onClose();
                }
              : undefined
          }
        />
      }
    >
      <div className="space-y-5">
        {problem && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900">
            {problem}
          </p>
        )}
        {/*
          הליבה קודמת לכול: היא שקובעת אילו עוביים קיימים, אם יש
          צבע ליבה בכלל, ואם הלוח יכול להגיע מודבק משני הצדדים.
        */}
        <Field group label="ליבה" hint="הגוף הפיזי של הלוח">
          <div className="flex flex-wrap gap-1.5">
            {CORES.map((c) => (
              <Chip key={c.key} active={core === c.key} onClick={() => pickCore(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
          {spec && <p className="mt-1.5 text-[11px] leading-snug text-stone-400">{spec.hint}</p>}
        </Field>

        {spec && (
          <Field group label="עובי" hint="מ״מ · הראשון הוא התקן">
            <div className="flex flex-wrap gap-1.5">
              {spec.thicknessMm.map((t) => (
                <Chip key={t} active={thickness === t} onClick={() => setThickness(t)}>
                  <span className="num">{t}</span>
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {/*
          צבע הליבה אינו הגוון: הגוון מודבק מעל, וצבע הליבה הוא מה
          שנראה בחתך ובקנט — ולכן הנגר בוחר אותו.
        */}
        {spec?.colors && (
          <Field group label="צבע הליבה" hint="נראה בחתך ובקנט">
            <div className="flex flex-wrap gap-1.5">
              {spec.colors.map((c) => (
                <Chip key={c} active={coreColor === c} onClick={() => setCoreColor(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <Field label="שם הלוח" hint="ריק = לפי הליבה">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
            placeholder={auto || 'למשל: דיקט 5 מ״מ'}
          />
        </Field>

        {/*
          החומר שכל חלק נבנה ממנו הוא החלטה של הנגרייה: הגוף
          מסנדוויץ׳, החזיתות מ-MDF, הגב מדיקט. מה שנבחר כאן קובע גם
          איזה לוח נבחר אוטומטית לחלק, וגם אילו גוונים בכלל מוצעים
          לו — כי גוון קיים על לוח רק אם נקבע לו מחיר עליו.
        */}
        <Field group label="משמש ל" hint="אפשר כמה">
          <div className="flex flex-wrap gap-1.5">
            {PART_ROLES.map((r) => (
              <Chip
                key={r.key}
                active={roles.includes(r.key)}
                onClick={() =>
                  setRoles((prev) =>
                    prev.includes(r.key) ? prev.filter((x) => x !== r.key) : [...prev, r.key],
                  )
                }
              >
                {r.label}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
            לוח בלי שיוך לא ייבחר אוטומטית, אבל אפשר לבחור בו ביד.
          </p>
        </Field>

        {/*
          מידת הפלטה היא מאפיין של הלוח אצל הספק ולא של החישוב.
          הרוחב תמיד 122 ס"מ; הגובה משתנה בין ספקים, ולכן הוא נבחר
          מהגבהים שקיימים בשוק.
        */}
        <Field group label="מידת הפלטה" hint={`רוחב ${cm(SHEET_WIDTH_MM)} ${unitLabel()} תמיד`}>
          <div className="flex flex-wrap gap-1.5">
            {SHEET_HEIGHTS_MM.map((h) => (
              <Chip key={h} active={h === sheetHeight} onClick={() => setSheetHeight(h)}>
                <span className="num">
                  {cm(SHEET_WIDTH_MM)}×{cm(h)}
                </span>
              </Chip>
            ))}
          </div>
        </Field>

        <p className="text-xs leading-snug text-stone-500">
          המחיר אינו נקבע כאן: אותו גוון עולה אחרת על כל ליבה, ולכן הוא נקבע בגוון
          עצמו — מחיר לכל לוח שהגוון קיים עליו.
        </p>
      </div>
    </Sheet>
  );
}
