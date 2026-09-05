import { Sheet } from '../../ui/Sheet';
import { ProjectFinishesStep } from '../projects/ProjectFinishesStep';
import type { PartChoice, PartRole, Project } from '../../db/types';

/**
 * הגוון של כל הפרויקט, לכל חלק.
 *
 * לקוח שמחליף דעה על גוון החזיתות לא מחליף אותה לארגז אחד — הוא
 * מחליף אותה למטבח. עד עכשיו זה היה עשרים לחיצות, ובדיוק שם נשכח
 * ארגז אחד בגוון הישן.
 *
 * הבחירה נשמרת כברירת המחדל של הפרויקט והחריגות שבארגזים נמחקות,
 * ולכן "לכל הארגזים" באמת חל — וגם ארגז שיתווסף מחר יקבל אותו.
 */
export function ProjectFinishesSheet({
  project,
  onApply,
  onClose,
}: {
  project: Project;
  onApply: (role: PartRole, choice: PartChoice) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="גוון לכל הארגזים" onClose={onClose} tall>
      <ProjectFinishesStep
        value={project.defaults ?? {}}
        onChange={(next) => {
          /*
           * מוחל מיד ולא בשמירה: אחרי כל בחירה רואים את הקיר
           * משתנה, וזו כל הנקודה של השינוי הזה.
           */
          for (const key of Object.keys(next) as PartRole[]) {
            const before = project.defaults?.[key];
            const after = next[key];
            if (!after) continue;
            if (before?.finishId === after.finishId && before?.materialId === after.materialId) {
              continue;
            }
            onApply(key, after);
          }
        }}
      />
    </Sheet>
  );
}
