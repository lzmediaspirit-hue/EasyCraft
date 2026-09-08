import { history } from './history';
import { wallsRepo } from '../projects/projectsRepo';
import { wallLabel } from '../projects/wallLayouts';
import { roomDef } from '../../catalog/rooms';
import { WallThumb } from './WallThumb';
import {
  CalcIcon,
  CenterIcon,
  CheckIcon,
  CubeIcon,
  DepthIcon,
  EyeIcon,
  FrontsIcon,
  InsideIcon,
  NestIcon,
  PlanIcon,
  PlusIcon,
  RedoIcon,
  RulerIcon,
  TagIcon,
  UndoIcon,
  ToolsIcon,
  WallsIcon,
} from '../../ui/icons';
import { QuickCalcButton } from '../../ui/QuickCalc';
import { ScreenHeader } from '../../ui/ScreenHeader';
import type { useDesignView } from './designView';
import type { PlacedUnit, Project, UserRole, Wall } from '../../db/types';
import type { SheetName } from './sheets';

/**
 * הכותרת וסרגלי הכלים של מסך ההדמיה.
 *
 * הם יושבים בקובץ משלהם כי הם מה שמשתנה: כמעט כל בקשה על המסך הזה
 * נוגעת בכפתור — נוסף, זז, מוסתר לפי תפקיד — ובלי הפרדה כל שינוי
 * כזה נגע בקובץ של אלף שורות שגם מחזיק את הציור, את המחוונים ואת
 * המגירות.
 *
 * הרכיב אינו מחזיק מצב משלו: כל מה שהוא צריך מגיע כפרופס, וכל
 * לחיצה חוזרת החוצה. הוא מציג ומדווח, לא מחליט.
 */
export function DesignToolbar({
  project,
  walls,
  wallIndex,
  onWallIndex,
  units,
  allUnits,
  role,
  editable,
  workMode,
  design,
  sheet,
  onSheet,
  canUndo,
  canRedo,
  projectId,
  onCenter,
  onClearSelection,
}: {
  project: Project;
  walls: Wall[];
  wallIndex: number;
  onWallIndex: (index: number) => void;
  /** הארגזים על הקיר שעובדים עליו */
  units: PlacedUnit[];
  /** כל הארגזים בפרויקט — ללשוניות הקירות */
  allUnits: PlacedUnit[];
  role: UserRole | undefined;
  editable: boolean;
  workMode: boolean;
  design: ReturnType<typeof useDesignView>;
  sheet: SheetName | null;
  onSheet: (sheet: SheetName | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  projectId: string;
  onCenter: () => void;
  onClearSelection: () => void;
}) {
  const { iso, inside, measure, rulerPair, rulerAxis, wallsOpen, toolsOpen } = design.view;

  return (
    <ScreenHeader
      title={project.name}
      subtitle={subtitle(project.name, project.roomKind, walls.length)}
      action={

        <span className="flex items-center gap-1">
          {/*
            ההדמיה ללקוח היא הדבר היחיד כאן שמיועד למישהו אחר,
            ולכן היא אייקון בפינה ולא כפתור בסרגל הכלים.
          */}
          {role === 'manager' && (
            <button
              onClick={() => onSheet('present')}
              disabled={units.length === 0}
              aria-label="הדמיה ללקוח"
              title="הדמיה להצגה ללקוח"
              className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-oak-700 disabled:opacity-40"
            >
              <EyeIcon />
            </button>
          )}
          {/* סרגלי הכלים — שלוש שורות שאפשר לקפל כשלא עובדים */}
          <button
            onClick={() => design.toggle('toolsOpen')}
            aria-pressed={toolsOpen}
            aria-label="כלי העבודה"
            title={toolsOpen ? 'הסתרת הכלים' : 'הצגת הכלים'}
            className={`rounded-full p-2 transition-colors hover:bg-stone-200/70 ${
              toolsOpen ? 'text-stone-600' : 'text-stone-400'
            }`}
          >
            <ToolsIcon />
          </button>
          {/* שורת הקירות תופסת שורה שלמה, וברוב הזמן לא נוגעים בה */}
          <button
            onClick={() => design.toggle('wallsOpen')}
            aria-pressed={wallsOpen}
            aria-label="שורת הקירות"
            title={wallsOpen ? 'הסתרת שורת הקירות' : 'הצגת שורת הקירות'}
            className={`rounded-full p-2 transition-colors hover:bg-stone-200/70 ${
              wallsOpen ? 'text-stone-600' : 'text-stone-400'
            }`}
          >
            <WallsIcon />
          </button>
          <QuickCalcButton />
        </span>      }
    >
      {/*
        שתי שורות ולא אחת: השורה הראשונה היא מה שעושים על הקיר
        שעובדים עליו, והשנייה היא איך מסתכלים עליו. שורה אחת
        ארוכה נגללה הצידה, וכפתור שצריך לגלול אליו הוא כפתור
        שלא לוחצים עליו.

        שלושתן מתקפלות יחד: מי שמסדר ארגזים צריך אותן, ומי שרק
        מסתכל על הקיר — ובוודאי כשהוא מראה אותו ללקוח — לא.
      */}
      {toolsOpen && (
      <>
      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <Tool
          active={inside}
          onClick={() => design.toggle('inside')}
          icon={inside ? <InsideIcon className="size-4" /> : <FrontsIcon className="size-4" />}
          label={inside ? 'פנים' : 'חזית'}
          title={inside ? 'הצגת חזיתות' : 'הסתרת חזיתות'}
        />
        <Tool
          active={sheet === 'nesting'}
          onClick={() => onSheet('nesting')}
          icon={<NestIcon className="size-4" />}
          label="ניסור"
        />
        {editable && (
          <Tool
            active={sheet === 'depth'}
            onClick={() => onSheet('depth')}
            icon={<DepthIcon className="size-4" />}
            label="עומק אחיד"
          />
        )}
        {/*
          אחרי המכירה הכפתור הראשי שמתחת להדמיה הופך למתג
          תכנון/תהליך, והחישוב עובר לכאן. הוא עדיין נחוץ — מחיר
          משתנה גם אחרי המכירה — אבל הוא כבר לא הפעולה הראשית.
        */}
        {!!project.soldAt && role === 'manager' && (
          <Tool
            active={sheet === 'materials'}
            onClick={() => onSheet('materials')}
            icon={<CalcIcon className="size-4" />}
            label="חישוב"
            title="חומרים ומחיר"
          />
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <Tool
          active={iso}
          onClick={() => design.toggle('iso')}
          icon={<CubeIcon className="size-4" />}
          label={iso ? 'תלת־ממד' : 'שטוח'}
          title={iso ? 'חזרה לציור חזית' : 'מבט תלת־ממדי'}
        />
        {/* מבט על זמין תמיד: משם גם מוסיפים קיר לחדר */}
        <Tool
          active={sheet === 'plan'}
          onClick={() => onSheet(sheet === 'plan' ? null : 'plan')}
          icon={<PlanIcon className="size-4" />}
          label="מבט על"
        />
        {/*
          לחיצות חוזרות על אותו כפתור מחליפות ציר: רוחב, גובה,
          עומק וכיבוי. קודם היה בורר ציר בשורה נפרדת שגזל מקום
          מהציור, ובטלפון הוא נחתך.
        */}
        <Tool
          active={measure !== null}
          onClick={design.cycleMeasure}
          icon={<RulerIcon className="size-4" />}
          label={
            measure === null
              ? 'מדידה'
              : measure === 'w'
                ? 'רוחב'
                : measure === 'h'
                  ? 'גובה'
                  : 'עומק'
          }
          title="לחיצה נוספת מחליפה ציר"
        />
        {/*
          סרגל: מודדים את המרחק בין שני ארגזים, או בין ארגז לפינת
          הקיר. אלה השאלות שנשאלות בשטח — "כמה נשאר בין השניים"
          ו"כמה עד הפינה" — ועד עכשיו היה צריך לחשב אותן בראש.
        */}
        <Tool
          active={rulerPair !== null}
          onClick={() => {
            design.toggleRuler();
            onClearSelection();
          }}
          icon={<RulerIcon className="size-4" />}
          label="סרגל"
          title="מרחק בין שני ארגזים או עד קצה הקיר"
        />
        {/*
          הציר נבחר לפני המדידה ולא נגזר ממנה: שני ארגזים זה על זה
          אפשר למדוד גם לרוחב וגם לגובה, ורק הנגר יודע מה הוא שאל.
        */}
        {rulerPair !== null &&
          (['w', 'h'] as const).map((ax) => (
            <button
              key={ax}
              onClick={() => design.setRulerAxis(ax)}
              aria-pressed={rulerAxis === ax}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                rulerAxis === ax
                  ? 'bg-teal-700 text-white'
                  : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {ax === 'w' ? 'רוחב' : 'גובה'}
            </button>
          ))}
      </div>

      {/*
        שורת פעולות על הארגזים: ביטול וחזרה, שכפול ומרכוז.
        כולן נוגעות במה שכבר על הקיר, ולכן הן חיות יחד ולא בין
        כלי התצוגה.
      */}
      {workMode && (
        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Tool
            active={sheet === 'bulk'}
            onClick={() => onSheet('bulk')}
            icon={<CheckIcon className="size-4" />}
            label="סימון מהיר"
            title="לסמן שלב על כל הארגזים בקיר"
          />
        </div>
      )}

      {editable && (
      <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <Tool
          active={false}
          disabled={!canUndo}
          onClick={() => history.undo(projectId)}
          icon={<UndoIcon className="size-4" />}
          label="בטל"
        />
        <Tool
          active={false}
          disabled={!canRedo}
          onClick={() => history.redo(projectId)}
          icon={<RedoIcon className="size-4" />}
          label="חזור"
        />
        <Tool
          active={false}
          disabled={units.length === 0}
          onClick={onCenter}
          icon={<CenterIcon className="size-4" />}
          label="מרכוז"
          title="ממרכז את הארגזים על הקיר"
        />
        <Tool
          active={sheet === 'finishes'}
          onClick={() => onSheet('finishes')}
          icon={<TagIcon className="size-4" />}
          label="גוון לכולם"
          title="גוון לכל החזיתות, הגופים או הדפנות"
        />
      </div>
      )}
      </>
      )}
      {wallsOpen && (
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {walls.length > 1 &&
          walls.map((w, i) => (
            <button
              key={w.id}
              onClick={() => onWallIndex(i)}
              className={`flex shrink-0 items-center gap-2 rounded-full ps-2.5 pe-4 py-1.5 text-sm font-medium transition-colors ${
                i === wallIndex
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <WallThumb wall={w} units={allUnits} active={i === wallIndex} />
              {wallLabel(w, i)}
            </button>
          ))}
        <button
          onClick={async () => {
            await wallsRepo.add(projectId);
            onWallIndex(walls.length);
          }}
          aria-label="קיר נוסף"
          title="קיר נוסף"
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
        >
          <PlusIcon className="size-4" />
          קיר
        </button>
      </div>
      )}
    </ScreenHeader>
  );
}

function Tool({
  active,
  onClick,
  icon,
  label,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  /** תיאור הפעולה, כשהתווית לבדה לא מספרת מה תקרה */
  title?: string;
  /** פעולה שאין לה על מה לפעול כרגע */
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      /*
       * התווית הנראית היא חלק מהשם הנגיש. כשהיא לא נמצאת בו, מי
       * שמפעיל את האפליקציה בקול אומר "שטוח" ושום כפתור לא נענה.
       */
      aria-label={title ? `${label} — ${title}` : undefined}
      title={title}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200'
      } disabled:opacity-40`}
    >
      {icon}
      {label}
    </button>
  );
}

function subtitle(name: string, roomKind: Project['roomKind'], wallCount: number): string {
  const room = roomDef(roomKind).label;
  const wallsText = wallCount === 1 ? 'קיר אחד' : `${wallCount} קירות`;
  return name.trim() === room ? wallsText : `${room} · ${wallsText}`;
}
