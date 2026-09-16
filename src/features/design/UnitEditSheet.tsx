import { useState } from 'react';
import { unitsRepo } from '../projects/projectsRepo';
import { history } from './history';
import { glyphDef } from '../../catalog/glyphList';
import { autoShelves } from '../../catalog/CabinetGlyph';
import { drawerRows, drawersAreSimple, zonesWithDrawerRows } from '../../catalog/zones';
import { Sheet } from '../../ui/Sheet';
import { NumField, PrimaryButton } from '../../ui/Field';
import { BoxForm, type BoxSpec } from '../../ui/BoxForm';
import { cm } from '../../ui/units';
import { alongWallMm } from '../../db/types';
import type { PlacedUnit } from '../../db/types';

/**
 * עריכה מהירה של ארגז שכבר מונח על הקיר.
 * השינוי חל על הארגז הזה בלבד ולא על הפריט בספרייה —
 * כך אפשר להתאים ארגז ללקוח בלי לשנות את התקן שלך.
 */
export function UnitEditSheet({
  unit,
  wallLengthMm,
  onClose,
}: {
  unit: PlacedUnit;
  /** אורך הקיר — הגבול של המיקום המספרי */
  wallLengthMm?: number;
  onClose: () => void;
}) {
  /*
   * המיקום על הקיר, כמספר.
   *
   * גרירה נותנת את המקום בערך; מי שרוצה 1,240 בדיוק — כי כך יצא
   * מהמדידה בשטח — הקליד אותו עד עכשיו רק בעקיפין, דרך רוחב של
   * השכן. הגובה כבר היה כאן, ובלי הרוחב הוא היה חצי תשובה.
   */
  const [xMm, setXMm] = useState(unit.xMm);
  /*
   * אי אינו נמדד מקיר, ולכן "מתחילת הקיר" אינו שלו. המקום שלו הוא
   * שתי מידות ברצפת החדר — וכאן הן נכתבות, כמו שנמדדו בשטח.
   */
  const [freeX, setFreeX] = useState(unit.free?.xMm ?? 0);
  const [freeZ, setFreeZ] = useState(unit.free?.zMm ?? 0);
  const [spec, setSpec] = useState<BoxSpec>({
    name: unit.name,
    glyph: unit.glyph,
    doors: unit.doors ?? 2,
    /* מה שבארון בפועל: אזורים מפורשים גוברים על השדה הישן */
    drawers: drawerRows(unit),
    drawerCols: unit.drawerCols ?? 1,
    shelves: unit.shelves ?? autoShelves(unit.heightMm),
    drawerStyle: unit.drawerStyle ?? 'outer',
    widthMm: unit.widthMm,
    heightMm: unit.heightMm,
    depthMm: unit.depthMm,
    yMm: unit.yMm,
    socleMm: unit.socleMm ?? 0,
    counterMm: unit.counterMm ?? 0,
  });

  const canSave = spec.name.trim().length > 0 && spec.widthMm > 0 && spec.heightMm > 0;

  /*
   * הגבול של המיקום המספרי — לפי המידות שנערכות עכשיו.
   *
   * השמירה קצצה עד כאן לאפס בלבד, וההצעה שמתחת לשדה חושבה לפי
   * הרוחב הישן: מי שהקליד 500 ס״מ על קיר של 300 קיבל ארגז מחוץ
   * לקיר, מתחת לשורה שהבטיחה "עד 240". `alongWallMm` הוא מה
   * שהארגז תופס באמת, ולכן הוא יודע גם על סיבוב.
   */
  const footprint = alongWallMm({ ...unit, widthMm: spec.widthMm, depthMm: spec.depthMm });
  const maxX = wallLengthMm === undefined ? null : Math.max(wallLengthMm - footprint, 0);
  const outOfWall = maxX !== null && (xMm < 0 || xMm > maxX);

  /* ארון שפנימו מתואר באזורים מורכבים אינו מקבל מספר מגירות יחיד */
  const composed = !drawersAreSimple(unit);

  async function save() {
    if (outOfWall) return;
    const caps = glyphDef(spec.glyph);
    /*
     * שינוי מספר השורות חייב להגיע גם אל האזור עצמו.
     *
     * האזורים גוברים על השדה הישן, ולכן כתיבה לשדה בלבד דיווחה
     * על שינוי שלא קרה: הטופס הראה שש, והארון נשאר שלוש.
     */
    const zones =
      caps.drawers && !composed ? zonesWithDrawerRows(unit, spec.drawers) : undefined;
    /*
     * צעד אחד לביטול.
     *
     * השמירה כתבה ישירות, בלי לצלם, ולכן "בטל" אחריה דילג אל מה
     * שהיה לפני הגרירה הקודמת — והמצב שרגע לפני העריכה לא היה
     * קיים כלל בהיסטוריה.
     */
    await history.capture(unit.projectId, `sheet:${unit.id}:${Date.now()}`);
    await unitsRepo.update(unit.id, {
      name: spec.name.trim(),
      glyph: spec.glyph,
      ...(zones ? { zones } : {}),
      doors: caps.doors ? spec.doors : undefined,
      drawers: caps.drawers ? spec.drawers : undefined,
      drawerCols: caps.drawers ? spec.drawerCols : undefined,
      shelves: caps.shelves ? spec.shelves : undefined,
      drawerStyle: caps.drawers ? spec.drawerStyle : undefined,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      depthMm: spec.depthMm,
      yMm: spec.yMm,
      socleMm: spec.socleMm || undefined,
      counterMm: spec.counterMm || undefined,
      /* אי נמדד ברצפת החדר, ולכן המיקום על הקיר אינו שלו */
      ...(unit.free
        ? { free: { ...unit.free, xMm: Math.round(freeX), zMm: Math.round(freeZ) } }
        : { xMm: Math.max(Math.round(xMm), 0) }),
    });
    onClose();
  }

  return (
    <Sheet
      title="עריכת הארגז"
      onClose={onClose}
      tall
      footer={
        <PrimaryButton disabled={!canSave || outOfWall} onClick={save}>
          עדכון הארגז
        </PrimaryButton>
      }
    >
      <BoxForm
        value={spec}
        composed={composed}
        onChange={(patch) => setSpec((s) => ({ ...s, ...patch }))}
      />

      {/*
        מיקום מספרי. הגובה יושב ב-`BoxForm` כי הוא חלק מהארגז גם
        בספרייה; המרחק מתחילת הקיר שייך להנחה הזאת בלבד.
      */}
      {!unit.free ? (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4">
          <NumField
            label="מתחילת הקיר"
            value={xMm}
            onChange={setXMm}
            hint={maxX === null ? undefined : `עד ${cm(maxX)}`}
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4">
          <NumField label="ציר X — לרוחב החדר" value={freeX} onChange={setFreeX} />
          <NumField label="ציר Z — לעומק החדר" value={freeZ} onChange={setFreeZ} />
        </div>
      )}
      {outOfWall && maxX !== null && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-snug text-red-900">
          הארגז אינו נכנס בקיר במקום הזה. במידות האלה הוא יכול להתחיל עד{' '}
          {cm(maxX)}.
        </p>
      )}
      <p className="mt-4 text-xs leading-snug text-stone-500">
        בהדמיה: לחיצה ארוכה על הארגז נועלת ציר אחד, וגרירה אחריה מזיזה
        רק בו. מקשי החצים מזיזים את הארגז הנבחר בסנטימטר — עם Shift
        בעשרה — ימינה ושמאלה לרוחב, מעלה ומטה לגובה.
      </p>
      <p className="mt-5 border-t border-stone-100 pt-4 text-xs leading-snug text-stone-500">
        השינוי חל על הארגז הזה בפרויקט בלבד. כדי לשנות את הארגז לכל הפרויקטים
        הבאים, ערוך אותו בספריית הארגזים.
      </p>
    </Sheet>
  );
}
