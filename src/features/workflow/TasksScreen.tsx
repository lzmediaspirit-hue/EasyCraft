import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo, unitsRepo, wallsRepo } from '../projects/projectsRepo';
import { ProjectThumb } from './ProjectThumb';
import { workProgress } from '../../workflow/unitWork';
import { customersRepo } from '../customers/customersRepo';
import { stagesRepo, teamRepo } from '../../workflow/workflowRepo';
import { useCurrentMember } from '../../workflow/useMember';
import { ROLE_LABEL, canOwn, stageDef } from '../../workflow/stages';
import { Page, ScreenHeader } from '../../ui/Page';
import { nav } from '../../nav/navigation';
import { ChevronIcon } from '../../ui/icons';
import type { PlacedUnit, Wall } from '../../db/types';

/** צורת הפרויקט: הקירות והארגזים שעליהם. */
interface Shape {
  walls: Wall[];
  units: PlacedUnit[];
}

/** ריק יציב, כדי שהרינדור הראשון לא ייצור מפה חדשה בכל פעם */
const NO_SHAPES: Map<string, Shape> = new Map();

/**
 * מה פתוח עכשיו בעסק.
 *
 * המנהל רואה כאן את כל התהליכים שרצים ואיפה כל אחד תקוע; כל אחד
 * אחר רואה קודם את מה שמחכה לו, ורק אחר כך את השאר. זה המסך
 * שאמור לענות על "מה אני עושה עכשיו" בלי לפתוח פרויקטים אחד אחד.
 */
export function TasksScreen() {
  const me = useCurrentMember();
  const stages = useLiveQuery(() => stagesRepo.all(), []);
  const projects = useLiveQuery(() => projectsRepo.all(), []);
  const customers = useLiveQuery(() => customersRepo.list(), []);
  const team = useLiveQuery(() => teamRepo.list(), []);
  /*
   * הקירות והארגזים של כל התהליכים הפתוחים, בשאילתה אחת.
   * שורה ברשימה אינה טקסט אלא הפרויקט עצמו: הנגר מזהה את המטבח שלו
   * לפי הצורה ולפי כמה כבר נעשה בו, ולא לפי השם.
   */
  const shapes =
    useLiveQuery(async () => {
      const ids = [
        ...new Set(
          (await stagesRepo.all()).filter((s) => s.status === 'active').map((s) => s.projectId),
        ),
      ];
      const out = new Map<string, Shape>();
      for (const id of ids) {
        out.set(id, {
          walls: await wallsRepo.listForProject(id),
          units: await unitsRepo.listForProject(id),
        });
      }
      return out;
    }, []) ?? NO_SHAPES;

  const active = (stages ?? []).filter((s) => s.status === 'active');
  const mine = me ? active.filter((s) => canOwn(me.role, stageDef(s.key).role)) : [];
  const rest = active.filter((s) => !mine.includes(s));

  const row = (stageId: string) => {
    const s = active.find((x) => x.id === stageId)!;
    const p = projects?.find((x) => x.id === s.projectId);
    const c = customers?.find((x) => x.id === p?.customerId);
    const who = team?.find((m) => m.id === s.assigneeId);
    const def = stageDef(s.key);
    const shape = shapes.get(s.projectId);
    const pct = shape ? Math.round(workProgress(shape.units) * 100) : 0;
    return (
      <li key={s.id}>
        <button
          /*
            הלחיצה פותחת את ההדמיה במצב מעקב, ולא רשימת שלבים: שם
            רואים איזה ארגז נתקע ואיפה הוא עומד בחדר, וזו השאלה
            האמיתית כשפותחים תהליך פתוח.
          */
          onClick={() => nav.push({ name: 'design', projectId: s.projectId, work: true })}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 text-start transition-colors hover:border-oak-400"
        >
          {shape && shape.walls.length > 0 && (
            <ProjectThumb walls={shape.walls} units={shape.units} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-stone-900">
              {p?.name ?? 'פרויקט'}
              <span className="ms-2 text-xs font-normal text-stone-400">{c?.name}</span>
            </span>
            <span className="block truncate text-xs text-stone-500">
              {def.label} ·{' '}
              {who?.name ?? (def.role === 'customer' ? 'הלקוח' : ROLE_LABEL[def.role])}
            </span>
            {/* פס ההתקדמות הוא הדוח: כמה מהעבודה בפרויקט כבר נעשתה */}
            {shape && shape.units.length > 0 && (
              <span className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <span
                    className="block h-full rounded-full bg-oak-600 transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="num text-[11px] font-semibold text-stone-500">{pct}%</span>
              </span>
            )}
          </span>
          {s.scheduledAt && (
            <span className="num shrink-0 text-xs font-medium text-stone-500">
              {new Date(s.scheduledAt).toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          )}
          <ChevronIcon className="size-4 shrink-0 rotate-180 text-stone-300" />
        </button>
      </li>
    );
  };

  return (
    <Page>
      <ScreenHeader
        title={me?.role === 'manager' ? 'תהליכים פתוחים' : 'המשימות שלי'}
        subtitle={me ? `${me.name} · ${ROLE_LABEL[me.role]}` : 'אף אחד לא מחובר'}
        count={active.length}
      />

      <main className="flex-1 px-5 pb-10">
        {!me && (
          <button
            onClick={() => nav.push({ name: 'team' })}
            className="mt-5 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-start text-sm leading-snug text-amber-900"
          >
            אף אחד לא מחובר במכשיר הזה. בחר מי אתה במסך הצוות כדי לראות
            את מה שמחכה לך.
          </button>
        )}

        {active.length === 0 && (
          <p className="mt-8 text-center text-[15px] leading-relaxed text-stone-500">
            אין תהליכים פתוחים. כל פרויקט חדש נפתח עם תהליך עבודה משלו.
          </p>
        )}

        {mine.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">אצלך</h2>
            <ul className="space-y-2">{mine.map((s) => row(s.id))}</ul>
          </section>
        )}

        {rest.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">
              {mine.length > 0 ? 'אצל אחרים' : 'תהליכים פתוחים'}
            </h2>
            <ul className="space-y-2">{rest.map((s) => row(s.id))}</ul>
          </section>
        )}
      </main>
    </Page>
  );
}
