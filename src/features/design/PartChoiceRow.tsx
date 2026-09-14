import { useState } from 'react';
import { PencilIcon, PlusIcon } from '../../ui/icons';
import { finishesForRole, materialForRole } from '../../db/types';
import type { Finish, Material, PartChoice, PartRole } from '../../db/types';

/**
 * הגוון והחומר של חלק אחד בארגז.
 *
 * ברוב הזמן אין כאן מה לבחור: הפרויקט כבר קבע גוף אחד וחזיתות
 * אחת, וכל מה שצריך זה לראות מה נבחר. לכן השורה מציגה את השם
 * ולידו עיפרון, והבחירה עצמה נפתחת רק כשבאמת רוצים לשנות.
 *
 * החומר מוצע אחרי הגוון ולא לפניו, כי גוון קיים רק על החומרים
 * שנקבע לו מחיר עליהם — ואין טעם להציע לבנות גוף מחומר שהגוון
 * שנבחר לא מגיע בו.
 */
export function PartChoiceRow({
  label,
  role,
  finishes,
  materials,
  value,
  effective,
  onChange,
  onApplyAll,
  onAddFinish,
}: {
  label: string;
  /** איזה חלק זה — קובע לאיזה חומר נופלים כשהגוון מתחלף */
  role: PartRole;
  finishes: Finish[];
  materials: Material[];
  /** מה שנקבע לארגז הזה. ריק = מה שנקבע לפרויקט */
  value: PartChoice;
  /** מה שבאמת חל, אחרי ברירת המחדל של הפרויקט */
  effective: PartChoice;
  onChange: (choice: PartChoice) => void;
  onApplyAll: (choice: PartChoice) => void;
  onAddFinish: () => void;
}) {
  const [open, setOpen] = useState(false);

  const finish = finishes.find((f) => f.id === effective.finishId);
  /*
   * לגוף מוצעים רק גוונים שקיימים על החומר שמשויך לגוף, ולחזיתות רק
   * אלה של חומר החזיתות. השיוך נקבע בהגדרות החומר.
   */
  const offered = finishesForRole(role, finishes, materials);
  const material = materials.find((m) => m.id === effective.materialId);
  // חומר זמין לגוון רק אם נקבע לו מחיר עליו
  const available = finish ? materials.filter((m) => finish.prices?.[m.id] !== undefined) : materials;
  const inherited = value.finishId === undefined && effective.finishId !== undefined;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[11px] font-medium text-stone-500">{label}</span>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors ${
            open ? 'bg-oak-50 ring-1 ring-oak-300' : 'bg-stone-100 hover:bg-stone-200'
          }`}
        >
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded border border-black/10"
            style={{ background: finish?.hex ?? '#e7e5e4' }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
            {finish?.name ?? 'לא נבחר גוון'}
            {material && <span className="font-normal text-stone-500"> · {material.name}</span>}
          </span>
          {inherited && (
            <span className="shrink-0 text-[10px] text-stone-400">מהפרויקט</span>
          )}
          <PencilIcon className="size-3.5 shrink-0 text-stone-400" />
        </button>
      </div>

      {open && (
        <div className="mt-1.5 rounded-xl border border-stone-200 bg-white p-2.5">
          <span className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-medium text-stone-500">גוון</span>
            <button
              onClick={onAddFinish}
              className="flex items-center gap-0.5 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-oak-700"
            >
              <PlusIcon className="size-3" />
              גוון חדש
            </button>
          </span>

          <div className="flex flex-wrap gap-1.5">
            {offered.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  /*
                   * החלפת גוון עשויה לפסול את החומר שנבחר: לא כל
                   * גוון קיים על כל חומר. אם הוא לא קיים — נופלים
                   * לחומר הראשון שכן, במקום להישאר עם צירוף שאין לו
                   * מחיר.
                   */
                  const ok = f.prices?.[effective.materialId ?? ''] !== undefined;
                  const pick = materialForRole(
                    role,
                    materials,
                    (m) => f.prices?.[m.id] !== undefined,
                  );
                  onChange({
                    finishId: f.id,
                    materialId: ok ? effective.materialId : pick?.id,
                  });
                }}
                title={f.texture ? `${f.name} · ${f.texture}` : f.name}
                className={`flex items-center gap-1.5 rounded-lg py-1 pe-2.5 ps-1 text-sm font-medium transition-colors ${
                  effective.finishId === f.id
                    ? 'bg-oak-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span
                  className="size-5 shrink-0 rounded border border-black/10"
                  style={{ background: f.hex }}
                />
                <span className="max-w-20 truncate">{f.name}</span>
              </button>
            ))}
            {finishes.length === 0 && (
              <span className="text-[11px] text-stone-400">
                אין עדיין גוונים. אפשר להוסיף כאן, או בהגדרות.
              </span>
            )}
          </div>

          {available.length > 0 && (
            <>
              <span className="mt-3 mb-1.5 block text-[10px] font-medium text-stone-500">חומר</span>
              <div className="flex flex-wrap gap-1.5">
                {available.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onChange({ ...effective, materialId: m.id })}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      effective.materialId === m.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {finish && available.length === 0 && (
            <p className="mt-2 text-[11px] leading-snug text-amber-700">
              לגוון הזה עוד לא נקבע מחיר על אף חומר, ולכן אי אפשר לתמחר
              אותו. אפשר לקבוע מחיר בהגדרות.
            </p>
          )}

          <button
            onClick={() => {
              onApplyAll(effective);
              setOpen(false);
            }}
            className="mt-3 w-full rounded-lg bg-stone-100 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-oak-700"
          >
            להחיל על כל הפרויקט
          </button>
        </div>
      )}
    </div>
  );
}
