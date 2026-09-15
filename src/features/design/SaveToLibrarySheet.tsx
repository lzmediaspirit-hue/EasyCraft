import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { Pill } from '../../ui/Pill';
import { cm } from '../../ui/units';
import { reusableSpec } from '../../db/types';
import type { CatalogGroup, PlacedUnit, UnitLevel } from '../../db/types';

/** קבוצה סבירה לארגז שהמקור שלו כבר לא בספרייה */
const GROUP_BY_LEVEL: Record<UnitLevel, CatalogGroup> = {
  floor: 'base',
  wall: 'upper',
  tall: 'tall',
};



/**
 * שמירת ארגז שנערך בחזרה לספרייה.
 *
 * הנגר מכוונן ארגז פעם אחת — מידות, מדפים, גב, ידיות וגוון — ומכאן
 * הוא חוזר מוכן בפרויקט הבא במקום להיערך שוב. פריט שהמשתמש יצר
 * אפשר לעדכן במקום; פריט שהגיע עם האפליקציה נשמר כפריט חדש, כדי
 * שהמקור יישאר כפי שהוא.
 */
export function SaveToLibrarySheet({
  unit,
  onClose,
}: {
  unit: PlacedUnit;
  onClose: () => void;
}) {
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  const canUpdate = source !== undefined && !source.isBuiltin;
  const [mode, setMode] = useState<'update' | 'new'>('new');
  const [name, setName] = useState(unit.name);
  const [saving, setSaving] = useState(false);

  const target = canUpdate && mode === 'update' ? source : undefined;

  async function save() {
    if (saving) return;
    setSaving(true);

    await catalogRepo.saveCustom({
      /*
       * תיאור הבנייה נלקח מרשימה אחת משותפת. קודם הועתקו כאן שדות
       * ביד, וכל מאפיין שנוסף לארגז אחר כך נשמט בשקט — "בלי תקרה"
       * חזר מהספרייה עם תקרה.
       */
      ...reusableSpec(unit),
      id: target?.id,
      /*
       * כשפריט המקור נמחק מהספרייה, הארגז שעל הקיר עדיין מחזיק את
       * כל המפרט שלו — ולכן אפשר לשמור אותו כארגז חדש. רק המידע
       * הקטלוגי חסר, ורק הוא נגזר: קבוצה מהמפלס, וכל החדרים.
       */
      rooms: source?.rooms ?? ['kitchen', 'living', 'bedroom'],
      group: source?.group ?? GROUP_BY_LEVEL[unit.level],
      name: name.trim() || unit.name,
      glyph: unit.glyph,

      /* גוון חזית מגרסה ישנה נשמר בשדה אחר, והוא עדיין הגוון שנבחר */
      frontFinishId: unit.frontFinishId ?? unit.finishId,
      level: unit.level,

      defaultWidthMm: unit.widthMm,
      // הרוחב הנוכחי נכנס לרשימת מידות התקן, כדי שיהיה זמין בבחירה מהירה
      widthOptionsMm: [...new Set([...(source?.widthOptionsMm ?? []), unit.widthMm])].sort(
        (a, b) => a - b,
      ),

      defaultHeightMm: unit.heightMm,
      defaultDepthMm: unit.depthMm,
      defaultYMm: unit.yMm,
      socleMm: unit.socleMm,
      counterMm: unit.counterMm,
      note: source?.note,

    });
    onClose();
  }

  return (
    <Sheet
      title="שמירה לספרייה"
      onClose={onClose}
      footer={
        <PrimaryButton disabled={saving || !name.trim()} onClick={save}>

          {target ? 'עדכון הפריט' : 'שמירה כארגז חדש'}
        </PrimaryButton>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-snug text-stone-500">
          כל מה שכיווננת בארגז הזה — מידות, פנים, גב, ידיות וגוון — יישמר
          בספרייה ויחזור מוכן בפעם הבאה.
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

        {canUpdate && (
          <Field group label="איך לשמור">
            <div className="flex flex-wrap gap-1.5">
              <Pill wide active={mode === 'update'} onClick={() => setMode('update')}>
                עדכון {source.name}
              </Pill>
              <Pill wide active={mode === 'new'} onClick={() => setMode('new')}>
                ארגז חדש
              </Pill>
            </div>
          </Field>
        )}

        {source?.isBuiltin && (
          <p className="text-xs leading-snug text-stone-400">
            {source.name} הגיע עם האפליקציה ונשאר כפי שהוא — מה שנשמר כאן
            נוסף לספרייה כארגז נוסף.
          </p>
        )}

        <dl className="grid grid-cols-3 gap-2 border-t border-stone-100 pt-4">
          <Spec label="רוחב" value={cm(unit.widthMm)} />
          <Spec label="גובה" value={cm(unit.heightMm)} />
          <Spec label="עומק" value={cm(unit.depthMm)} />
        </dl>
      </div>
    </Sheet>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <dt className="text-[10px] text-stone-400">{label}</dt>
      <dd className="num text-sm font-semibold text-stone-800">{value}</dd>
    </div>
  );
}
