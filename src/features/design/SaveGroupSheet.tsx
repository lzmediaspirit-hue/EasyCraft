import { useState } from 'react';
import { catalogRepo } from '../../catalog/catalogRepo';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { cm } from '../../ui/units';
import { alongWallMm } from '../../db/types';
import type { CatalogGroupPart, PlacedUnit } from '../../db/types';

/**
 * שמירת כמה ארגזים כפריט אחד בספרייה.
 *
 * עמודת תנור, פינה שלמה, קיר שנבנה פעם אחת — צירופים שנגר בונה
 * שוב ושוב, ושעד היום נבנו כל פעם מחדש ארגז־ארגז. מה שנשמר הוא
 * היחס בין החלקים ולא המקום שהיו בו, ולכן הצירוף חוזר מוכן ונשאר
 * מחובר גם אחרי שמזיזים אותו.
 */
export function SaveGroupSheet({
  units,
  onClose,
}: {
  units: PlacedUnit[];
  onClose: () => void;
}) {
  const [name, setName] = useState(`${units[0]?.name ?? 'ארגז'} ועוד ${units.length - 1}`);
  const [saving, setSaving] = useState(false);

  /* פינת הקבוצה: הארגז שמתחיל הכי שמאלה והכי נמוך */
  const x0 = Math.min(...units.map((u) => u.xMm));
  const y0 = Math.min(...units.map((u) => u.yMm));
  const widthMm = Math.max(...units.map((u) => u.xMm + alongWallMm(u))) - x0;
  const heightMm = Math.max(...units.map((u) => u.yMm + u.heightMm)) - y0;
  const depthMm = Math.max(...units.map((u) => u.depthMm));

  async function save() {
    if (saving || !units.length) return;
    setSaving(true);
    const parts: CatalogGroupPart[] = units.map((u) => {
      /* זהות, קיר ומיקום נקבעים בהנחה ולא נשמרים */
      const { id, projectId, wallId, xMm, yMm, createdAt, updatedAt, work, free, ...rest } = u;
      void id;
      void projectId;
      void wallId;
      void createdAt;
      void updatedAt;
      void work;
      void free;
      return { dxMm: xMm - x0, dyMm: yMm - y0, unit: rest };
    });
    await catalogRepo.saveCustom({
      rooms: ['kitchen', 'custom'],
      group: 'base',
      name: name.trim() || 'צירוף ארגזים',
      glyph: units[0]?.glyph ?? 'base',
      level: units[0]?.level ?? 'base',
      defaultWidthMm: widthMm,
      widthOptionsMm: [widthMm],
      defaultHeightMm: heightMm,
      defaultDepthMm: depthMm,
      defaultYMm: y0,
      parts,
    });
    onClose();
  }

  return (
    <Sheet
      title="שמירת הצירוף בספרייה"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={save} disabled={saving || !name.trim()}>
          שמירה
        </PrimaryButton>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-snug text-stone-500">
          {units.length} ארגזים יישמרו כפריט אחד. בפעם הבאה הם יונחו יחד,
          באותם מרחקים בדיוק.
        </p>

        <Field label="שם בספרייה">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
          />
        </Field>

        <ul className="space-y-1 border-t border-stone-100 pt-4">
          {units.map((u) => (
            <li key={u.id} className="flex items-baseline gap-2 text-xs text-stone-500">
              <span className="min-w-0 flex-1 truncate text-stone-700">{u.name}</span>
              <span className="num">{cm(u.widthMm)}</span>
              <span>×</span>
              <span className="num">{cm(u.heightMm)}</span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-3 gap-2 border-t border-stone-100 pt-4">
          <Spec label="רוחב הצירוף" value={cm(widthMm)} />
          <Spec label="גובה" value={cm(heightMm)} />
          <Spec label="עומק" value={cm(depthMm)} />
        </dl>
      </div>
    </Sheet>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <dt className="text-[11px] text-stone-400">{label}</dt>
      <dd className="num text-sm font-semibold text-stone-800">{value} ס״מ</dd>
    </div>
  );
}
