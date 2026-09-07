import { useState } from 'react';
import { materialsRepo } from '../../materials/materialsRepo';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { TrashIcon } from '../../ui/icons';
import { PART_ROLES, SHEET_HEIGHTS_MM, SHEET_WIDTH_MM } from '../../db/types';
import { cm, unitLabel } from '../../ui/units';
import type { Material, PartRole } from '../../db/types';

/**
 * חומר גלם.
 *
 * החומר הוא הבסיס הפיזי — סנדוויץ׳, MDF, דיקט — ואין לו צבע ואין
 * לו מחיר: המחיר נקבע בהצטלבות עם הגוון, כי אותו לבן עולה אחרת על
 * כל אחד מהם. לכן הרשימה הזו קצרה וכמעט לא משתנה.
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
  const [name, setName] = useState(material?.name ?? '');
  const [thickness, setThickness] = useState(
    material?.thicknessMm !== undefined ? String(material.thicknessMm) : '',
  );
  const [sheetHeight, setSheetHeight] = useState(material?.sheetHeightMm ?? SHEET_HEIGHTS_MM[0]);
  /*
   * לאילו חלקים החומר משמש. זו ההחלטה שקובעת אילו גוונים מוצעים
   * לגוף ואילו לחזיתות — ולכן היא נקבעת כאן, פעם אחת, ולא בכל ארגז.
   */
  const [roles, setRoles] = useState<PartRole[]>(material?.roles ?? []);

  const canSave = name.trim().length > 0;

  async function save() {
    const id = await materialsRepo.save({
      id: material?.id,
      name: name.trim(),
      thicknessMm: thickness.trim() ? Number(thickness) : undefined,
      sheetWidthMm: SHEET_WIDTH_MM,
      sheetHeightMm: sheetHeight,
      roles: roles.length ? roles : undefined,
    });
    onSaved?.(id);
    onClose();
  }

  return (
    <Sheet
      title={material ? 'עריכת חומר' : 'חומר חדש'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {material && (
            <button
              onClick={async () => {
                await materialsRepo.remove(material.id);
                onClose();
              }}
              aria-label="מחיקת החומר"
              className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon />
            </button>
          )}
          <div className="flex-1">
            <PrimaryButton disabled={!canSave} onClick={save}>
              שמירה
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="שם החומר">
          <input
            autoFocus={!material}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
            placeholder="למשל: דיקט 5 מ״מ"
          />
        </Field>

        <Field label="עובי" hint="מ״מ · לא חובה">
          <input
            value={thickness}
            onChange={(e) => setThickness(e.target.value)}
            onFocus={selectOnFocus}
            type="number"
            inputMode="decimal"
            placeholder="—"
            className={`${inputClass} num text-end placeholder:text-stone-300`}
          />
        </Field>

        {/*
          החומר שכל חלק נבנה ממנו הוא החלטה של הנגרייה: הגוף
          מסנדוויץ׳, החזיתות מ-MDF, הגב מדיקט. מה שנבחר כאן קובע גם
          איזה חומר נבחר אוטומטית לחלק, וגם אילו גוונים בכלל מוצעים
          לו — כי גוון קיים על חומר רק אם נקבע לו מחיר עליו.
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
            חומר בלי שיוך לא ייבחר אוטומטית, אבל אפשר לבחור בו ביד.
          </p>
        </Field>

        {/*
          מידת הפלטה היא מאפיין של החומר אצל הספק ולא של החישוב.
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
          המחיר אינו נקבע כאן: אותו גוון עולה אחרת על כל חומר, ולכן הוא
          נקבע בגוון עצמו — מחיר לכל חומר שהגוון קיים עליו.
        </p>
      </div>
    </Sheet>
  );
}
