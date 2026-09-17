import { WORK_TONES } from '../../workflow/unitWork';
import { history } from './history';
import { wallsRepo } from '../projects/projectsRepo';
import { wallLabel } from '../projects/wallLayouts';
import { roomDef } from '../../catalog/roomsRepo';
import { WallThumb } from './WallThumb';
import {
  CalcIcon,
  CenterIcon,
  CheckIcon,
  CubeIcon,
  DepthIcon,
  DimensionsIcon,
  ElevationIcon,
  EyeIcon,
  EyeOffIcon,
  FitIcon,
  FrontsIcon,
  InsideIcon,
  MagnetIcon,
  NestIcon,
  PlanIcon,
  PlusIcon,
  RedoIcon,
  RulerIcon,
  SwatchIcon,
  UndoIcon,
  ToolsIcon,
  WallsIcon,
  WarnIcon,
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
  onFit,
  onClearSelection,
  warnCount,
  warnTone,
  onShowHidden,
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
  /** מחזיר את המבט התלת־ממדי לזווית ההתחלתית */
  onFit: () => void;
  onClearSelection: () => void;
  /** כמה בעיות יש בחדר, ומה החמורה שבהן — לאייקון הבדיקה */
  warnCount: number;
  warnTone: string | null;
  /** מחזיר לתצוגה את כל הארגזים שהוסתרו בפרויקט */
  onShowHidden: () => void;
}) {
  const { iso, inside, measure, rulerPair, rulerAxis, snap, wallsOpen, toolsOpen } =
    design.view;
  /*
   * המצב שרואים בו את הקיר — אחד משלושה, ולא מתג שמתאר את ההווה
   * ועושה משהו אחר. הכפתור אמר "שטוח" ולחיצה עליו פתחה תלת־ממד,
   * ואת זה היה צריך ללמוד. מבט על הוא מגירה, ולכן פתיחתה היא
   * המצב שלו.
   */
  const mode: ViewMode = sheet === 'plan' ? 'plan' : iso ? 'iso' : 'flat';
  const setMode = (next: ViewMode) => {
    if (next === 'plan') return onSheet('plan');
    if (sheet === 'plan') onSheet(null);
    design.set('iso', next === 'iso');
  };
  const hiddenCount = allUnits.filter((u) => u.hidden).length;

  return (
    <ScreenHeader
      title={project.name}
      subtitle={subtitle(project.name, project.roomKind, walls.length)}
      action={

        <span className="flex items-center gap-1">
          {/*
            ההדמיה ללקוח היא הדבר היחיד כאן שמיועד למישהו אחר,
            ולכן היא אייקון בפינה ולא כפתור בסרגל הכלים.

            המבקר ביקש שתהיה לה תווית נראית ולא עין בלבד. הבעלים
            ביקש במפורש להוריד את כפתור "ללקוח" מהסרגל, וזו בקשה
            שגוברת: מה שמבדיל את האייקון הזה משאר העיניים במסך הוא
            המקום — הפינה, לא סרגל הכלים — ולא צורת הכפתור.
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
          {/*
            הבדיקה — כאן, ולא בלוח הנתונים.

            היא ישבה מתחת למחוונים, ולכן נעלמה ברגע שנבחר ארגז:
            בדיוק כשהמשתמש עורך את מה שיצר את הבעיה. אייקון בכותרת
            נשאר על המסך תמיד, נושא את המספר ואת צבע החומרה, ואינו
            תלוי בתפקיד — תכנת ונגר רואים אותו כמו המנהל.
          */}
          {warnCount > 0 && (
            <button
              onClick={() => onSheet('warnings')}
              aria-label={`בדיקת התכנון — ${warnCount} ממצאים`}
              title="מה לא ייבנה ומה לא ייפתח"
              className="relative rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800"
            >
              <WarnIcon />
              <span
                className={`num absolute top-0.5 end-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${
                  warnTone ?? 'bg-stone-400'
                }`}
              >
                {warnCount}
              </span>
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
      <div className="mt-3 tool-row flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <Tool
          active={inside}
          onClick={() => design.toggle('inside')}
          icon={inside ? <InsideIcon className="size-4" /> : <FrontsIcon className="size-4" />}
          label={inside ? 'פנים' : 'חזית'}
          title={inside ? 'הצגת חזיתות' : 'הסתרת חזיתות'}
        />
        {/*
          סרגל: מודדים את המרחק בין שני דברים על הקיר — ארגז, חלון,
          דלת, עמוד או קצה הקיר עצמו. אלה השאלות שנשאלות בשטח —
          "כמה נשאר בין השניים" ו"כמה מהחלון עד הארון" — ועד עכשיו
          היה צריך לחשב אותן בראש.

          הוא יושב בשורת החזית ולא בין כלי התצוגה: מדידה היא עבודה
          על הקיר, לא דרך להסתכל עליו.
        */}
        <Tool
          active={rulerPair !== null}
          onClick={() => {
            design.toggleRuler();
            onClearSelection();
          }}
          icon={<RulerIcon className="size-4" />}
          label="סרגל"
          title="מרחק בין ארגז, חלון, דלת, עמוד או קצה הקיר"
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

      <div className="mt-1.5 tool-row flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {/*
          שלושת המצבים יחד, והפעיל מסומן.

          קודם היה כאן מתג אחד שכתוב עליו המצב הנוכחי — "שטוח" —
          ולחיצה עליו פתחה תלת־ממד. כפתור שאומר איפה אתה ועושה
          משהו אחר הוא כפתור שצריך ללמוד, ונגר לומד אותו פעם
          אחת בכל חודש שהוא לא נגע באפליקציה.
        */}
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-stone-200/70 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              /*
               * התווית הנראית היא חלק מהשם הנגיש, כמו בשאר הכלים:
               * מי שמפעיל את האפליקציה בקול אומר "תלת־ממד" ומקבל
               * את הכפתור, ומי שמחפש "מבט תלת־ממדי" מקבל אותו גם.
               */
              aria-label={`${m.label} — ${m.title}`}
              title={m.title}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                mode === m.key
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200'
              }`}
            >
              <m.icon className="size-4" />
              {m.label}
            </button>
          ))}
        </span>
        {/*
          ההצמדה כמתג ולא כמקש שמחזיקים: במגע אין מקש להחזיק,
          ומרווח מכוון בין שני ארגזים הוא בקשה לגיטימית.
        */}
        {editable && (
          <Tool
            active={snap}
            onClick={() => design.toggle('snap')}
            icon={<MagnetIcon className="size-4" />}
            label="הצמדה"
            title={snap ? 'כיבוי, כדי שהארגז ינחת בדיוק במקום שנגררת אליו' : 'הפעלה — הצמדה לשכנים, לפינות ולראש ארגז'}
          />
        )}
        {/* התאמת התצוגה מחזירה את המצלמה, ואינה נוגעת בארגזים */}
        {iso && (
          <Tool
            active={false}
            onClick={onFit}
            icon={<FitIcon className="size-4" />}
            label="התאמת תצוגה"
            title="חזרה לזווית ההתחלתית מול הקיר"
          />
        )}
        {/*
          ארגזים שהוסתרו אחד־אחד. הכפתור מופיע רק כשיש כאלה, וגם
          אומר כמה: ארגז שנעלם ואי אפשר להחזיר הוא ארגז שאבד.
        */}
        {hiddenCount > 0 && (
          <Tool
            active
            onClick={onShowHidden}
            icon={<EyeOffIcon className="size-4" />}
            label={`מוסתרים ${hiddenCount}`}
            title="החזרת כל הארגזים המוסתרים לתצוגה"
          />
        )}
        {/*
          לחיצות חוזרות על אותו כפתור מחליפות ציר: רוחב, גובה,
          עומק וכיבוי. קודם היה בורר ציר בשורה נפרדת שגזל מקום
          מהציור, ובטלפון הוא נחתך.
        */}
        <Tool
          active={measure !== null}
          onClick={design.cycleMeasure}
          icon={<DimensionsIcon className="size-4" />}
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
      </div>

      {/*
        שורת פעולות על הארגזים: ביטול וחזרה, שכפול ומרכוז.
        כולן נוגעות במה שכבר על הקיר, ולכן הן חיות יחד ולא בין
        כלי התצוגה.
      */}
      {workMode && (
        <div className="mt-1.5 tool-row flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Tool
            active={sheet === 'bulk'}
            onClick={() => onSheet('bulk')}
            icon={<CheckIcon className="size-4" />}
            label="סימון מהיר"
            title="לסמן שלב על כל הארגזים בקיר"
          />
        </div>
      )}

      {/*
        מקרא הצבעים.
        במצב ייצור הצבע הוא הדוח, ובלי מקרא הוא חידה: צהוב וכתום
        נראים דומה על מסך בנגרייה. הוא מופיע בשני המבטים, כי
        בשניהם הצבע אומר עכשיו את אותו דבר.
      */}
      {workMode && (
        <ul className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {(Object.keys(WORK_TONES) as (keyof typeof WORK_TONES)[]).map((k) => (
            <li key={k} className="flex items-center gap-1 text-[11px] text-stone-500">
              <span
                className="size-2.5 rounded-sm border"
                style={{ background: WORK_TONES[k].fill, borderColor: WORK_TONES[k].stroke }}
              />
              {WORK_TONES[k].label}
            </li>
          ))}
        </ul>
      )}

      {editable && (
      <div className="mt-1.5 tool-row flex items-center gap-1.5 overflow-x-auto pb-0.5">
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
        {/*
          דגימת לוח ולא תווית מחיר: התווית אמרה "מחיר" למי שראה
          אותה, וזו בדיוק הפעולה השנייה בסרגל.
        */}
        <Tool
          active={sheet === 'finishes'}
          onClick={() => onSheet('finishes')}
          icon={<SwatchIcon className="size-4" />}
          label="גוון לכולם"
          title="גוון לכל החזיתות, הגופים או הדפנות"
        />
      </div>
      )}
      </>
      )}
      {wallsOpen && (
      <div className="mt-2 tool-row flex gap-1.5 overflow-x-auto pb-0.5">
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

/** שלושת המצבים שאפשר לראות בהם את הקיר. */
type ViewMode = 'flat' | 'iso' | 'plan';

const MODES: { key: ViewMode; label: string; title: string; icon: (p: { className?: string }) => React.ReactElement }[] = [
  /*
   * "דו־ממד" ולא "חזית": חזית היא כבר מתג אחר בסרגל — זה שמסיר
   * את הדלתות — ושני כפתורים באותו שם באותו מסך הם כפתור אחד
   * שבור.
   */
  { key: 'flat', label: 'דו־ממד', title: 'ציור החזית של הקיר', icon: ElevationIcon },
  { key: 'iso', label: 'תלת־ממד', title: 'מבט תלת־ממדי על החדר', icon: CubeIcon },
  { key: 'plan', label: 'מבט על', title: 'החדר מלמעלה — ומשם גם מוסיפים קיר', icon: PlanIcon },
];

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
