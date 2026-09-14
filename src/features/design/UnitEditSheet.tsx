import { useState } from 'react';
import { unitsRepo } from '../projects/projectsRepo';
import { glyphDef } from '../../catalog/glyphList';
import { autoShelves } from '../../catalog/CabinetGlyph';
import { Sheet } from '../../ui/Sheet';
import { PrimaryButton } from '../../ui/Field';
import { BoxForm, type BoxSpec } from '../../ui/BoxForm';
import type { PlacedUnit } from '../../db/types';

/**
 * עריכה מהירה של ארגז שכבר מונח על הקיר.
 * השינוי חל על הארגז הזה בלבד ולא על הפריט בספרייה —
 * כך אפשר להתאים ארגז ללקוח בלי לשנות את התקן שלך.
 */
export function UnitEditSheet({ unit, onClose }: { unit: PlacedUnit; onClose: () => void }) {
  const [spec, setSpec] = useState<BoxSpec>({
    name: unit.name,
    glyph: unit.glyph,
    doors: unit.doors ?? 2,
    drawers: unit.drawers ?? 0,
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

  async function save() {
    const caps = glyphDef(spec.glyph);
    await unitsRepo.update(unit.id, {
      name: spec.name.trim(),
      glyph: spec.glyph,
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
    });
    onClose();
  }

  return (
    <Sheet
      title="עריכת הארגז"
      onClose={onClose}
      tall
      footer={
        <PrimaryButton disabled={!canSave} onClick={save}>
          עדכון הארגז
        </PrimaryButton>
      }
    >
      <BoxForm value={spec} onChange={(patch) => setSpec((s) => ({ ...s, ...patch }))} />
      <p className="mt-5 border-t border-stone-100 pt-4 text-xs leading-snug text-stone-500">
        השינוי חל על הארגז הזה בפרויקט בלבד. כדי לשנות את הארגז לכל הפרויקטים
        הבאים, ערוך אותו בספריית המוצרים.
      </p>
    </Sheet>
  );
}
