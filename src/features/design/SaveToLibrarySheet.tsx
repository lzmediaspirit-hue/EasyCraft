import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogRepo } from '../../catalog/catalogRepo';
import { roomsRepo } from '../../catalog/roomsRepo';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { SaveError, useSaveGuard } from '../../ui/saveGuard';
import { cabinetNameKey, freeCabinetName } from '../../catalog/names';
import { Pill } from '../../ui/Pill';
import { cm } from '../../ui/units';
import { reusableSpec } from '../../db/types';
import type { CatalogGroup, PlacedUnit, UnitLevel } from '../../db/types';

/** קבוצה סבירה לארגז שהמקור שלו כבר לא בספרייה */
/** כשאין חדר ואין מקור — המטבח הוא ברירת המחדל הסבירה היחידה */
const GROUP_FALLBACK_ROOM = 'kitchen';

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
  projectRoom,
  onClose,
}: {
  unit: PlacedUnit;
  /** החדר שהפרויקט הזה הוא בו — ההצעה הראשונה לשיוך */
  projectRoom?: string;
  onClose: () => void;
}) {
  const source = useLiveQuery(() => catalogRepo.get(unit.catalogItemId), [unit.catalogItemId]);
  const canUpdate = source !== undefined && !source.isBuiltin;
  const [mode, setMode] = useState<'update' | 'new'>('new');
  /*
   * השם המוצע.
   *
   * הארגז שעל הקיר נושא את שם הפריט שממנו נולד, ולכן "שמירה כארגז
   * חדש" הציעה שם שכבר תפוס — ונדחתה בכל פעם. כאן מוצע שם פנוי,
   * ומרגע שהוקלד משהו הוא מה שקובע.
   */
  const inLibrary = useLiveQuery(() => catalogRepo.all(), [], []);
  const [typed, setTyped] = useState<string | null>(null);
  const guard = useSaveGuard();

  /*
   * לאילו חדרים הארגז שייך — שאלה, ולא ניחוש.
   *
   * כשפריט המקור נמחק, השמירה שייכה קשיח למטבח, סלון וחדר שינה:
   * חדר שירות וכל חדר שהנגר יצר בעצמו לא נכללו, גם כשהארגז נבנה
   * בדיוק שם. החדר של הפרויקט הוא ההצעה, והשאר נבחר ביד.
   */
  const rooms = useLiveQuery(() => roomsRepo.all(), []);
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? source?.rooms ?? (projectRoom ? [projectRoom] : []);

  const target = canUpdate && mode === 'update' ? source : undefined;
  /* עדכון שומר את השם שיש; ארגז חדש מקבל שם פנוי */
  const name = typed ?? (target ? unit.name : freeCabinetName(unit.name, inLibrary.map((i) => i.name)));

  /*
   * ארגז אחר בספרייה שכבר נושא את השם הזה.
   *
   * עד כאן זו הייתה מבוי סתום: השמירה נדחתה ב"כבר יש בספרייה ארגז
   * בשם הזה", ולמי שרצה דווקא להחליף אותו לא הייתה דרך — הוא נאלץ
   * למחוק אותו קודם, או להמציא שם שני. שם זהה הוא בדיוק הכוונה
   * "זה אותו ארגז, בגרסה מעודכנת", ולכן היא נענית.
   *
   * ההשוואה עוברת דרך אותו מפתח מנוקה שבו משתמש שער השמירה, ולכן
   * מה שנראה כאן כהתנגשות הוא מה שייחסם שם — ולהפך.
   *
   * מוחרג רק מי שכבר נבחר לעדכון: הוא אינו "ארגז אחר באותו שם"
   * אלא אותו ארגז. המקור עצמו כן נספר — ארגז שהגיע עם האפליקציה
   * הוא בדיוק המקרה שבו אין מצב "עדכון", ובכל זאת מבקשים להחליף
   * דווקא אותו.
   */
  const twin = inLibrary.find(
    (i) => i.id !== target?.id && cabinetNameKey(i.name) === cabinetNameKey(name),
  );
  /* מי שבאמת ייכתב: המקור בעדכון, התאום בהחלפה, ואחרת שורה חדשה */
  const into = target ?? twin;

  function save() {
    return guard.run(async () => {
    await catalogRepo.saveCustom({
      /*
       * תיאור הבנייה נלקח מרשימה אחת משותפת. קודם הועתקו כאן שדות
       * ביד, וכל מאפיין שנוסף לארגז אחר כך נשמט בשקט — "בלי תקרה"
       * חזר מהספרייה עם תקרה.
       */
      ...reusableSpec(unit),
      id: into?.id,
      /*
       * כשפריט המקור נמחק מהספרייה, הארגז שעל הקיר עדיין מחזיק את
       * כל המפרט שלו — ולכן אפשר לשמור אותו כארגז חדש. רק המידע
       * הקטלוגי חסר, ורק הוא נגזר: קבוצה מהמפלס, וכל החדרים.
       */
      rooms: chosen.length ? chosen : [GROUP_FALLBACK_ROOM],
      group: into?.group ?? source?.group ?? GROUP_BY_LEVEL[unit.level],
      name: name.trim() || unit.name,
      glyph: unit.glyph,

      /* גוון חזית מגרסה ישנה נשמר בשדה אחר, והוא עדיין הגוון שנבחר */
      frontFinishId: unit.frontFinishId ?? unit.finishId,
      level: unit.level,

      defaultWidthMm: unit.widthMm,
      // הרוחב הנוכחי נכנס לרשימת מידות התקן, כדי שיהיה זמין בבחירה מהירה
      widthOptionsMm: [...new Set([...(into?.widthOptionsMm ?? source?.widthOptionsMm ?? []), unit.widthMm])].sort(
        (a, b) => a - b,
      ),

      defaultHeightMm: unit.heightMm,
      defaultDepthMm: unit.depthMm,
      defaultYMm: unit.yMm,
      socleMm: unit.socleMm,
      counterMm: unit.counterMm,
      note: into?.note ?? source?.note,

    });
    onClose();
    });
  }

  return (
    <Sheet
      title="שמירה לספרייה"
      onClose={onClose}
      footer={
        <>
        <SaveError text={guard.error} />
        <PrimaryButton disabled={guard.busy || !name.trim()} onClick={save}>

          {target ? 'עדכון הפריט' : twin ? `החלפת "${twin.name}"` : 'שמירה כארגז חדש'}
        </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-snug text-stone-500">
          כל מה שכיווננת בארגז הזה — מידות, פנים, גב, ידיות וגוון — יישמר
          בספרייה ויחזור מוכן בפעם הבאה.
        </p>

        {/*
          החדרים שהארגז יופיע בהם. ההצעה היא החדר של הפרויקט — שם
          הוא נבנה — ואפשר לסמן עוד. שיוך קשיח לשלושה חדרים השאיר
          בחוץ את חדר השירות וכל חדר שהנגר יצר בעצמו.
        */}
        <Field label="חדרים" hint="איפה הוא יופיע בספרייה">
          <div className="flex flex-wrap gap-1.5">
            {(rooms ?? []).map((r) => (
              <Pill
                key={r.id}
                active={chosen.includes(r.id)}
                wide
                onClick={() =>
                  setPicked(
                    chosen.includes(r.id) ? chosen.filter((x) => x !== r.id) : [...chosen, r.id],
                  )
                }
              >
                {r.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="שם בספרייה">
          <input
            autoFocus
            value={name}
            onChange={(e) => setTyped(e.target.value)}
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

        {/*
          שם שכבר תפוס. במקום שהשמירה תיפול על שער השם, נאמר כאן מה
          תעשה הלחיצה — ומה יקרה לארגז שכבר יושב שם.
        */}
        {twin && !target && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
            בספרייה כבר יש "{twin.name}"{twin.isBuiltin && ' — ארגז שהגיע עם האפליקציה'}.
            שמירה תחליף אותו במה שכיווננת כאן. לשמור לצד הקיים — תנו שם אחר.
          </p>
        )}

        {source?.isBuiltin && !twin && (
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
